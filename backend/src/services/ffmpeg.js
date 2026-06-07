import { spawn } from 'child_process';
import path from 'path';
import ffmpegStatic from 'ffmpeg-static';

const FFMPEG = ffmpegStatic || 'ffmpeg';

// 封面统一尺寸
export const COVER_W = 750;
export const COVER_H = 422;

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

// 裁剪视频,可选叠加图片水印
// start/end 接受秒数或 "mm:ss";watermark 为图片路径;wmPosition ∈ br/bl/tr/tl
// wmWidth 水印宽度(px);wmOpacity 不透明度(0~1)
// preset:编码速度档位。Render 免费套餐 CPU 极弱,自动发布走 'ultrafast' 才跑得完。
// maxHeight:>0 时把视频按比例缩到「最高这么多像素高」(只缩不放),大幅降低编码量和体积。
export async function processVideo({ input, output, start, end, watermark, wmPosition = 'br', wmWidth = 160, wmOpacity = 0.65, wmMargin = 20, preset = 'veryfast', maxHeight = 0, crf = 0 }) {
  const args = ['-y'];
  if (start) args.push('-ss', String(start));
  if (end) args.push('-to', String(end));
  args.push('-i', input);

  // 主画面预处理:可选限制最大高度(等比、不放大、保证偶数边长)
  const downscale = maxHeight > 0 ? `scale=-2:'min(${maxHeight}\\,ih)'` : null;

  if (watermark) {
    args.push('-i', watermark);
    const pos = wmCoord(wmPosition, wmMargin);
    const base = downscale ? `[0]${downscale}[v];` : '';
    const vin = downscale ? '[v]' : '[0]';
    // 水印缩放到指定宽度、指定不透明度,叠加到指定角
    args.push('-filter_complex',
      `${base}[1]format=rgba,colorchannelmixer=aa=${wmOpacity},scale=${wmWidth}:-1[wm];${vin}[wm]overlay=${pos}`);
  } else if (downscale) {
    args.push('-vf', downscale);
  }

  args.push('-c:v', 'libx264', '-preset', preset);
  if (crf > 0) args.push('-crf', String(crf)); // 质量/体积控制:越大越小,18~28 常用,23 接近视觉无损
  args.push('-c:a', 'aac', '-movflags', '+faststart', output);
  await run(args);
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
