import { spawn } from 'child_process';
import path from 'path';
import ffmpegStatic from 'ffmpeg-static';

const FFMPEG = ffmpegStatic || 'ffmpeg';

// 封面统一尺寸
export const COVER_W = 750;
export const COVER_H = 422;

// 水印位置 → overlay 坐标(留 20px 边距)
const WM_POS = {
  br: 'W-w-20:H-h-20', // 右下(默认)
  bl: '20:H-h-20',     // 左下
  tr: 'W-w-20:20',     // 右上
  tl: '20:20',         // 左上
};

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
export async function processVideo({ input, output, start, end, watermark, wmPosition = 'br', wmWidth = 160, wmOpacity = 0.65 }) {
  const args = ['-y'];
  if (start) args.push('-ss', String(start));
  if (end) args.push('-to', String(end));
  args.push('-i', input);

  if (watermark) {
    args.push('-i', watermark);
    const pos = WM_POS[wmPosition] || WM_POS.br;
    // 水印缩放到指定宽度、指定不透明度,叠加到指定角
    args.push('-filter_complex',
      `[1]format=rgba,colorchannelmixer=aa=${wmOpacity},scale=${wmWidth}:-1[wm];[0][wm]overlay=${pos}`);
  }

  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-movflags', '+faststart', output);
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
