// 视频采集:给一个 m3u8 / mp4 直链,或一个网页地址,下载/合并成 MP4 存到 uploads/collect,返回 /files 路径。
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import ffmpegStatic from 'ffmpeg-static';

const FFMPEG = ffmpegStatic || 'ffmpeg';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'uploads', 'collect');
fs.mkdirSync(OUT_DIR, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36';

function extOf(u) {
  try { return path.extname(new URL(u).pathname).toLowerCase(); } catch { return ''; }
}

// 从网页 HTML 里扒 m3u8 / mp4 地址(含相对路径)
export async function extractVideoUrls(pageUrl) {
  const res = await fetch(pageUrl, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`打开页面失败 HTTP ${res.status}`);
  const html = await res.text();
  const abs = html.match(/https?:\/\/[^\s"'<>()]+\.(?:m3u8|mp4)(?:\?[^\s"'<>()]*)?/gi) || [];
  const rel = [...html.matchAll(/["'](\/[^"']+\.(?:m3u8|mp4)(?:\?[^"']*)?)["']/gi)]
    .map((m) => { try { return new URL(m[1], pageUrl).href; } catch { return null; } })
    .filter(Boolean);
  return [...new Set([...abs, ...rel])];
}

function ffmpegDownload(url, outPath, { referer } = {}) {
  return new Promise((resolve, reject) => {
    const headers = [`User-Agent: ${UA}`];
    if (referer) headers.push(`Referer: ${referer}`);
    const args = [
      '-y',
      '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
      '-headers', headers.join('\r\n') + '\r\n',
      '-i', url,
      '-c', 'copy', '-bsf:a', 'aac_adtstoasc',
      '-movflags', '+faststart',
      outPath,
    ];
    const proc = spawn(FFMPEG, args);
    let err = '';
    proc.stderr.on('data', (d) => (err += d.toString()));
    const killer = setTimeout(() => proc.kill('SIGKILL'), 15 * 60 * 1000);
    proc.on('error', (e) => { clearTimeout(killer); reject(e); });
    proc.on('close', (code) => {
      clearTimeout(killer);
      if (code === 0) resolve();
      else reject(new Error('ffmpeg 合并失败: ' + err.slice(-400)));
    });
  });
}

async function directDownload(url, outPath, { referer } = {}) {
  const headers = { 'user-agent': UA };
  if (referer) headers.referer = referer;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20 * 60 * 1000) });
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(outPath));
}

export async function collectVideo(inputUrl, { referer } = {}) {
  let url = String(inputUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('请填 http/https 开头的地址');
  let ext = extOf(url);
  let source = '直链';

  if (ext !== '.m3u8' && ext !== '.mp4') {
    const urls = await extractVideoUrls(url);
    if (!urls.length) throw new Error('页面里没找到 m3u8 / mp4 地址,请直接填视频直链');
    url = urls.find((u) => extOf(u) === '.m3u8') || urls[0];
    ext = extOf(url);
    source = `从页面提取(${urls.length} 个候选,取 ${ext.slice(1)})`;
  }

  const name = `collect-${Date.now()}.mp4`;
  const outPath = path.join(OUT_DIR, name);
  if (ext === '.m3u8') await ffmpegDownload(url, outPath, { referer });
  else await directDownload(url, outPath, { referer });

  const size = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;
  if (!size) { try { fs.unlinkSync(outPath); } catch { /* ignore */ } throw new Error('下载完成但文件为空,可能需要填 Referer'); }
  return { file: `/files/collect/${name}`, name, size, videoUrl: url, source };
}
