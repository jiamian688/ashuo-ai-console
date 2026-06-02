import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { postVideoToTelegram, postMediaGroupToTelegram } from '../services/telegram.js';
import { processVideo, extractHighlights } from '../services/ffmpeg.js';
import { generateChannelCaption } from '../services/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const assetsDir = path.join(__dirname, '..', '..', 'assets');

// Telegram 机器人发送上限 ~50MB
const TG_MAX = 50 * 1024 * 1024;

// 找固定 logo 水印(放在 backend/assets/ 里,提交进仓库,Render 上也能用)
function defaultWatermark() {
  for (const name of ['watermark.png', 'watermark.jpg', 'logo.png']) {
    const p = path.join(assetsDir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5 GB
});

// 启动自愈:免费实例可能在处理视频时被休眠/重启,导致任务永远卡在 processing。
// 服务一启动就把这些「半途而废」的任务标记为失败,避免列表里一直转圈。
try {
  const r = db.prepare(
    `UPDATE tasks SET status='failed', error='处理中断(服务重启,可能是视频过大或免费实例休眠),请重新上传或先用本地剪辑工具压缩' WHERE status IN ('processing','queued')`
  ).run();
  if (r.changes > 0) console.log(`[启动自愈] 重置 ${r.changes} 个卡住的任务为 failed`);
} catch (e) {
  console.error('[启动自愈] 失败:', e.message);
}

const router = Router();

// 列表(仅当前用户上传的）
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM tasks ORDER BY id DESC LIMIT 200')
    .all();
  res.json(rows);
});

// 概览统计(供仪表盘）
router.get('/stats', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const done = db.prepare(`SELECT COUNT(*) n FROM tasks WHERE status='posted' AND date(created_at)=?`).get(today).n;
  const queued = db.prepare(`SELECT COUNT(*) n FROM tasks WHERE status IN ('queued','processing')`).get().n;
  const failed = db.prepare(`SELECT COUNT(*) n FROM tasks WHERE status='failed' AND date(created_at)=?`).get(today).n;
  res.json({ done, queued, failed, xAccounts: 2 });
});

// 上传视频 -> 入队 -> 异步发布
router.post('/', upload.array('files'), async (req, res) => {
  const files = req.files || [];
  if (files.length === 0) return res.status(400).json({ error: '没有收到文件' });
  const caption = (req.body?.caption || '').trim();

  const insert = db.prepare(`
    INSERT INTO tasks (uploader, filename, original_name, size, status)
    VALUES (?, ?, ?, ?, 'queued')
  `);

  const created = [];
  for (const f of files) {
    const info = insert.run(req.user?.username || 'sishuo', f.filename, f.originalname, f.size);
    created.push({ id: info.lastInsertRowid, filename: f.filename, original_name: f.originalname });
  }

  res.status(201).json({ created });

  // 后台逐个处理(不阻塞响应)。caption 此处作为 AI 的「主题/关键词」
  for (const item of created) {
    processTask(item.id, path.join(uploadDir, item.filename), caption);
  }
});

// 自动发布流水线:AI 文案+标签 → 加固定 logo 水印 → 截 3 张精彩图 → 视频+3图+文案 一组发到频道
async function processTask(id, originalPath, topic) {
  const start = Date.now();
  db.prepare(`UPDATE tasks SET status='processing' WHERE id=?`).run(id);
  const temps = [];
  try {
    const size = fs.existsSync(originalPath) ? fs.statSync(originalPath).size : 0;
    if (size > TG_MAX) {
      throw new Error(
        `视频 ${(size / 1048576).toFixed(0)}MB 超过 Telegram 机器人 50MB 发送上限,` +
        `请先用本地剪辑工具裁剪/压缩到 50MB 内再上传`
      );
    }

    // 1) 文案 + 标签(AI;失败则退回用户填的主题)
    let caption = '';
    try {
      caption = (await generateChannelCaption({ topic })).caption;
    } catch (e) {
      caption = (topic || '').trim();
      console.error(`[task ${id}] 文案生成失败,改用原文:`, e.message);
    }

    // 2) 固定 logo 水印(有 logo 才加;水印后若超 50MB 则退回原视频)
    let videoForPost = originalPath;
    const wm = defaultWatermark();
    if (wm) {
      try {
        const wmOut = path.join(uploadDir, `wm-${id}-${Date.now()}.mp4`);
        // 固定右上角、尺寸小、不挡画面
        await processVideo({
          input: originalPath, output: wmOut, watermark: wm,
          wmPosition: process.env.WM_POSITION || 'tr',
          wmWidth: Number(process.env.WM_WIDTH) || 150,
          wmOpacity: Number(process.env.WM_OPACITY) || 0.9,
          preset: process.env.WM_PRESET || 'ultrafast', // 免费套餐 CPU 弱,最快档才跑得完
        });
        temps.push(wmOut);
        if (fs.statSync(wmOut).size <= TG_MAX) videoForPost = wmOut;
        else console.warn(`[task ${id}] 水印后超 50MB,改发原视频`);
      } catch (e) {
        console.error(`[task ${id}] 加水印失败,改发原视频:`, e.message);
      }
    }

    // 3) 三张精彩图
    let photos = [];
    try {
      photos = await extractHighlights({
        input: videoForPost,
        outDir: uploadDir,
        baseName: `hl-${id}-${Date.now()}`,
        count: 3,
      });
      temps.push(...photos);
    } catch (e) {
      console.error(`[task ${id}] 截图失败:`, e.message);
    }

    // 4) 发布:有图 → 视频+图 一组发;没截到图 → 退化为单条视频
    let result;
    if (photos.length >= 1) {
      result = await postMediaGroupToTelegram({ videoPath: videoForPost, photoPaths: photos, caption });
    } else {
      result = await postVideoToTelegram({ filePath: videoForPost, caption });
    }
    if (result?.skipped) console.log(`[task ${id}] ${result.reason}`);

    const seconds = Math.round((Date.now() - start) / 1000);
    db.prepare(
      `UPDATE tasks SET status='posted', posted_at=datetime('now'), duration_seconds=? WHERE id=?`
    ).run(seconds, id);
  } catch (err) {
    const seconds = Math.round((Date.now() - start) / 1000);
    db.prepare(`UPDATE tasks SET status='failed', error=?, duration_seconds=? WHERE id=?`)
      .run(String(err.message || err), seconds, id);
    console.error(`[task ${id}] 失败:`, err.message);
  } finally {
    fs.unlink(originalPath, () => {});
    for (const t of temps) fs.unlink(t, () => {});
  }
}

export default router;
