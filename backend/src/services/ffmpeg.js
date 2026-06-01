import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';

const FFMPEG = ffmpegStatic || 'ffmpeg';

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

// 裁剪:start/end 接受秒数或 "mm:ss" / "hh:mm:ss"
export async function trimVideo({ input, output, start, end }) {
  const args = ['-y'];
  if (start) args.push('-ss', String(start));
  if (end) args.push('-to', String(end));
  args.push('-i', input, '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-movflags', '+faststart', output);
  await run(args);
}

// 在指定时间点截一帧作为封面
export async function extractThumbnail({ input, output, at = 0 }) {
  await run(['-y', '-ss', String(at), '-i', input, '-frames:v', '1', '-q:v', '2', output]);
}
