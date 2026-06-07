import { createWorker } from 'tesseract.js';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import ffmpegStatic from 'ffmpeg-static';
import { probeResolution, probeDuration } from './ffmpeg.js';

const FFMPEG = ffmpegStatic || 'ffmpeg';

const even = (n) => { n = Math.round(n); return n % 2 === 0 ? n : n - 1; };

// 抽取某个时间点的一帧到 out;targetW>0 时按比例缩小(加速 OCR,坐标再按比例还原)
function extractFrame(input, ts, out, targetW) {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-ss', String(ts), '-i', input, '-frames:v', '1'];
    if (targetW) args.push('-vf', `scale=${targetW}:-2`);
    args.push('-q:v', '3', out);
    const proc = spawn(FFMPEG, args);
    proc.on('error', reject);
    proc.on('close', (c) => (c === 0 ? resolve() : reject(new Error('抽帧失败'))));
  });
}

// tesseract.js 不同版本里词可能在 data.words,也可能要从 blocks 里遍历出来
function wordsFrom(data) {
  if (Array.isArray(data.words) && data.words.length) return data.words;
  const out = [];
  for (const block of data.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        for (const w of line.words || []) out.push(w);
      }
    }
  }
  return out;
}

const overlapArea = (a, b) => {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  return x2 > x && y2 > y ? (x2 - x) * (y2 - y) : 0;
};
const iou = (a, b) => {
  const ov = overlapArea(a, b);
  return ov === 0 ? 0 : ov / (a.w * a.h + b.w * b.h - ov);
};
const union = (a, b) => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

// 根据识别到的文字框,算出某条边「刚好盖住该边文字」需要裁掉的比例。
// 只看贴近该边的框(top/bottom 看上下 20%,left/right 看左右 15%),裁到文字外缘 + 一点余量,
// 夹在 0~max(默认 25%)之间:没有边缘文字就返回 0(不裁),也绝不会裁太多影响观看。
export function autoCropFraction(boxes, edge, W, H, max = 0.25, marginFrac = 0.01) {
  let px = 0;
  for (const b of boxes) {
    const right = b.x + b.w, bottom = b.y + b.h;
    if (edge === 'top' && b.y <= H * 0.20) px = Math.max(px, bottom);
    else if (edge === 'bottom' && bottom >= H * 0.80) px = Math.max(px, H - b.y);
    else if (edge === 'left' && b.x <= W * 0.15) px = Math.max(px, right);
    else if (edge === 'right' && right >= W * 0.85) px = Math.max(px, W - b.x);
  }
  if (px <= 0) return 0;
  const dim = edge === 'top' || edge === 'bottom' ? H : W;
  return Math.min(max, px / dim + marginFrac);
}

// 在视频里检测「稳定出现」的文字区域(水印/字幕),返回像素坐标的偶数矩形数组。
// 思路:沿时间轴抽 samples 帧做 OCR,只保留在多帧中重复出现的区域,过滤偶发误识别。
export async function detectTextBoxes(input, { samples = 4, minConfidence = 45, lang = 'eng' } = {}) {
  const { w: W, h: H } = await probeResolution(input);
  if (!W || !H) return [];
  const dur = await probeDuration(input);
  const targetW = W > 1280 ? 1280 : 0;     // 大图先缩到 1280 宽再识别
  const scale = targetW ? W / targetW : 1; // OCR 坐标 → 原始视频坐标

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
  let worker;
  const perFrame = [];
  try {
    worker = await createWorker(lang);
    for (let i = 0; i < samples; i++) {
      const frac = samples === 1 ? 0.5 : 0.1 + (0.8 * i) / (samples - 1);
      const ts = dur > 0 ? (dur * frac).toFixed(2) : String(i * 2);
      const fp = path.join(tmpDir, `f${i}.jpg`);
      try {
        await extractFrame(input, ts, fp, targetW);
        const { data } = await worker.recognize(fp, {}, { blocks: true });
        const boxes = wordsFrom(data)
          .filter((w) => (w.confidence || 0) >= minConfidence && (w.text || '').trim().length >= 2)
          .map((w) => ({
            x: w.bbox.x0 * scale, y: w.bbox.y0 * scale,
            w: (w.bbox.x1 - w.bbox.x0) * scale, h: (w.bbox.y1 - w.bbox.y0) * scale,
          }))
          .filter((b) => b.w > 0 && b.h > 0 && b.w < W * 0.95 && b.h < H * 0.5);
        perFrame.push(boxes);
      } catch {
        perFrame.push([]);
      } finally {
        fs.unlink(fp, () => {});
      }
    }
  } finally {
    if (worker) await worker.terminate();
    fs.rm(tmpDir, { recursive: true, force: true }, () => {});
  }

  // 跨帧聚类:重叠的框合并成一簇,记录它出现在哪些帧
  const clusters = [];
  perFrame.forEach((boxes, fi) => {
    for (const b of boxes) {
      const hit = clusters.find((c) => iou(c.box, b) > 0.3);
      if (hit) { hit.box = union(hit.box, b); hit.frames.add(fi); }
      else clusters.push({ box: { ...b }, frames: new Set([fi]) });
    }
  });
  // 只保留出现在「半数及以上」帧的稳定区域
  const threshold = Math.max(2, Math.ceil(samples / 2));
  const kept = clusters.filter((c) => c.frames.size >= threshold).map((c) => c.box);

  // 各方向留一点边距,换算成偶数像素并夹在画面内
  return kept
    .map((b) => {
      const padX = b.w * 0.06 + 6, padY = b.h * 0.25 + 6;
      const x = Math.max(0, b.x - padX), y = Math.max(0, b.y - padY);
      const w = Math.min(W - x, b.w + padX * 2), h = Math.min(H - y, b.h + padY * 2);
      return { x: even(x), y: even(y), w: even(w), h: even(h) };
    })
    .filter((b) => b.w >= 8 && b.h >= 8);
}
