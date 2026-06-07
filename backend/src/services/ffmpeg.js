import { spawn } from 'child_process';
import path from 'path';
import ffmpegStatic from 'ffmpeg-static';

const FFMPEG = ffmpegStatic || 'ffmpeg';

// 封面统一尺寸
export const COVER_W = 750;
export const COVER_H = 422;

// 取偶数(libx264 / yuv420 要求裁切宽高、偏移都是偶数)
const even = (n) => { n = Math.round(n); return n % 2 === 0 ? n : n - 1; };

// 水印位置 → overlay 坐标(m=距边缘的边距 px,越小越贴角)
const wmCoord = (pos, m) => ({
  br: `W-w-${m}:H-h-${m}`, // 右下(默认)
  bl: `${m}:H-h-${m}`,     // 左下
  tr: `W-w-${m}:${m}`,     // 右上
  tl: `${m}:${m}`,         // 左上
}[pos] || `W-w-${m}:H-h-${m}`);

function run(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, args);
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('ffmpeg 失败 (code ' + code + '): ' + stderr.slice(-400)));
    });
  });
}

// 裁剪视频 + 自动去字(中间模糊 / 四周裁切)+ 可选叠加水印
// start/end 接受秒数或 "mm:ss";watermark 为图片/视频路径;wmPosition ∈ br/bl/tr/tl
// wmWidth 水印宽度(px);wmOpacity 不透明度(0~1,null=按类型取默认)
// wmIsVideo:水印是动态文件(.mov/webm/gif 等)。会无限循环播放,主视频结束时收尾。
// cropTop/Bottom/Left/Right:0~1 比例,把对应边按比例裁掉(去掉贴边的文字/字幕条)。
// blurBoxes:[{x,y,w,h}] 像素矩形数组(基于原始分辨率),逐个高斯模糊,遮住 OCR 识别出的文字/水印。
// preset:编码速度档位。Render 免费套餐 CPU 极弱,自动发布走 'ultrafast' 才跑得完。
// maxHeight:>0 时把视频按比例缩到「最高这么多像素高」(只缩不放),大幅降低编码量和体积。
// wmScale:水印宽度占视频宽度的比例(自适应,不同分辨率下视觉大小一致);wmWidth>0 时改用固定像素
export async function processVideo({ input, output, start, end, watermark, wmIsVideo = false, wmPosition = 'br', wmScale = 0.20, wmWidth = 0, wmOpacity = null, wmMargin = 0, cropTop = 0, cropBottom = 0, cropLeft = 0, cropRight = 0, blurBoxes = [], preset = 'veryfast', maxHeight = 0, crf = 0 }) {
  const args = ['-y'];
  if (start) args.push('-ss', String(start));
  if (end) args.push('-to', String(end));
  args.push('-i', input);

  // 裁边换算像素坐标、水印按比例缩放,都需要原始分辨率(模糊框已是像素坐标,无需再探测)
  const needCrop = cropTop > 0 || cropBottom > 0 || cropLeft > 0 || cropRight > 0;
  let W = 0, H = 0;
  if (needCrop || watermark) ({ w: W, h: H } = await probeResolution(input));

  // 主画面预处理:可选限制最大高度(等比、不放大、保证偶数边长)
  const downscale = maxHeight > 0 ? `scale=-2:'min(${maxHeight}\\,ih)'` : null;

  // 用具名标签把滤镜串成链:模糊去字 → 裁边 → 缩放 → 叠水印,cur 始终是当前视频流标签
  // 模糊在裁边之前做,所以 blurBoxes 用的是原始坐标
  const parts = [];
  let cur = '[0]';

  (blurBoxes || []).forEach((box, i) => {
    const x = even(box.x), y = even(box.y), w = even(box.w), h = even(box.h);
    if (w < 2 || h < 2) return;
    // 模糊强度随文字高度走,并设较高下限,确保大字号也彻底糊掉、不可读
    const sigma = Math.min(60, Math.max(15, Math.round(h / 3)));
    parts.push(`${cur}split[s${i}a][s${i}b]`);
    parts.push(`[s${i}b]crop=${w}:${h}:${x}:${y},gblur=sigma=${sigma}[bl${i}]`);
    parts.push(`[s${i}a][bl${i}]overlay=${x}:${y}[bx${i}]`);
    cur = `[bx${i}]`;
  });

  if (needCrop && W && H) {
    const l = even(cropLeft * W), r = even(cropRight * W);
    const t = even(cropTop * H), b = even(cropBottom * H);
    const cw = even(W - l - r), ch = even(H - t - b);
    if (cw > 0 && ch > 0) {
      parts.push(`${cur}crop=${cw}:${ch}:${l}:${t}[cr]`);
      cur = '[cr]';
    }
  }

  if (downscale) {
    parts.push(`${cur}${downscale}[ds]`);
    cur = '[ds]';
  }

  let mapArgs = null;
  if (watermark) {
    // 不透明度:动态水印默认 1(保留自带透明通道、不再变淡),静态图默认 0.65
    const aa = wmOpacity == null ? (wmIsVideo ? 1 : 0.65) : wmOpacity;
    if (wmIsVideo) args.push('-stream_loop', '-1'); // 动态水印无限循环
    args.push('-i', watermark);
    // 水印宽度按视频宽度比例算(默认 20%),低分辨率视频自动变小、紧贴角落;wmWidth>0 时用固定像素
    const wmW = wmWidth > 0 ? wmWidth : (W ? Math.max(80, even(W * wmScale)) : 200);
    // 边距同样按比例,保证各分辨率下都紧贴角落
    const margin = wmMargin > 0 ? wmMargin : (W ? Math.max(10, Math.round(W * 0.018)) : 18);
    const pos = wmCoord(wmPosition, margin);
    const shortest = wmIsVideo ? ':shortest=1' : ''; // 主视频结束即收尾,避免无限循环
    parts.push(`[1]format=rgba,colorchannelmixer=aa=${aa},scale=${wmW}:-1[wm]`);
    parts.push(`${cur}[wm]overlay=${pos}${shortest}[outv]`);
    cur = '[outv]';
    mapArgs = ['-map', '[outv]', '-map', '0:a?']; // 取叠加后画面 + 主视频音轨(水印自带音轨忽略)
  }

  if (parts.length) {
    args.push('-filter_complex', parts.join(';'));
    if (!mapArgs) mapArgs = ['-map', cur, '-map', '0:a?'];
  }
  if (mapArgs) args.push(...mapArgs);

  args.push('-c:v', 'libx264', '-preset', preset);
  if (crf > 0) args.push('-crf', String(crf)); // 质量/体积控制:越大越小,18~28 常用,23 接近视觉无损
  args.push('-c:a', 'aac', '-movflags', '+faststart', output);
  await run(args);
}

// 读取视频分辨率(宽×高)。和 probeDuration 一样从 ffmpeg -i 的 stderr 里解析。
export function probeResolution(input) {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG, ['-i', input]);
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', () => resolve({ w: 0, h: 0 }));
    proc.on('close', () => {
      const m = stderr.match(/Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/);
      resolve(m ? { w: +m[1], h: +m[2] } : { w: 0, h: 0 });
    });
  });
}

// 把一帧加工成 750×422 高清封面:
// 画面完整缩放进框(不裁切,避免"半个头"),背后用模糊放大的同图填满,最后锐化
const FIT =
  `split[a][b];` +
  `[a]scale=${COVER_W}:${COVER_H}:force_original_aspect_ratio=increase:flags=lanczos,` +
  `crop=${COVER_W}:${COVER_H},boxblur=20:3[bg];` +
  `[b]scale=${COVER_W}:${COVER_H}:force_original_aspect_ratio=decrease:flags=lanczos[fg];` +
  `[bg][fg]overlay=(W-w)/2:(H-h)/2,unsharp=5:5:1.0:5:5:0.0`;

// 生成封面:at 为空 → 自动挑选最具代表性的一帧;at 有值 → 取该时间点
export async function extractThumbnail({ input, output, at }) {
  const hasAt = at != null && String(at).trim() !== '';
  if (hasAt) {
    await run(['-y', '-ss', String(at), '-i', input, '-vf', FIT, '-frames:v', '1', '-q:v', '2', output]);
  } else {
    // thumbnail 滤镜在前 200 帧里挑最有代表性的一帧
    await run(['-y', '-i', input, '-vf', `thumbnail=n=200,${FIT}`, '-frames:v', '1', '-q:v', '2', output]);
  }
}

// 读取视频时长(秒)。Render 上没有 ffprobe,改用 ffmpeg 读取并从 stderr 解析 Duration。
export function probeDuration(input) {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG, ['-i', input]);
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', () => resolve(0));
    proc.on('close', () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
      if (!m) return resolve(0);
      resolve((+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]));
    });
  });
}

// 单图高清化:不足 1280 宽则等比放大到 1280(已够大则不放大),再轻锐化。输出单张 jpg。
export async function enhanceImage({ input, output }) {
  await run(['-y', '-i', input,
    '-vf', `scale=w='if(lt(iw,1280),1280,iw)':h=-2:flags=lanczos,unsharp=5:5:0.8`,
    '-frames:v', '1', '-q:v', '2', output]);
}

// 把 3 张图横向拼成一张帖子封面(默认 794×422)。每格等比放大铺满后居中裁切,再轻锐化。
export async function makeTriptych({ images, output, W = 794, H = 422 }) {
  // 面板宽度取偶数(yuv420 色度采样要求),前两格各取 even(W/3),第三格补足到 W
  const a = even(W / 3), b = even(W / 3);
  const widths = [a, b, even(W - a - b)];
  const args = ['-y'];
  for (const img of images) args.push('-i', img);
  // 居中裁切,但竖向偏上(人脸通常在画面上部,留多一点顶部避免裁到脸)
  const parts = widths.map((w, i) =>
    `[${i}]scale=${w}:${H}:force_original_aspect_ratio=increase:flags=lanczos,` +
    `crop=${w}:${H}:(iw-${w})/2:(ih-${H})*0.3,unsharp=5:5:0.6[p${i}]`);
  parts.push(`[p0][p1][p2]hstack=inputs=3`);
  args.push('-filter_complex', parts.join(';'), '-frames:v', '1', '-q:v', '2', output);
  await run(args);
}

// 截取 N 张"最精彩"的帧:沿时间轴在 10%~90% 区间均匀取点(避开片头片尾黑场),
// 每个点用 thumbnail 在邻近若干帧里挑最有代表性的一张。返回生成的图片路径数组。
export async function extractHighlights({ input, outDir, baseName, count = 3 }) {
  const dur = await probeDuration(input);
  const paths = [];
  for (let i = 0; i < count; i++) {
    const frac = count === 1 ? 0.5 : 0.1 + (0.8 * i) / (count - 1);
    const ts = dur > 0 ? dur * frac : i * 2; // 拿不到时长就退化成固定间隔
    const out = path.join(outDir, `${baseName}-${i + 1}.jpg`);
    await run(['-y', '-ss', ts.toFixed(2), '-i', input,
      '-vf', 'thumbnail=n=40', '-frames:v', '1', '-q:v', '2', out]);
    paths.push(out);
  }
  return paths;
}
