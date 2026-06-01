import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { postVideoToTelegram } from '../services/telegram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads');

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

  // 后台逐个处理(不阻塞响应）
  for (const item of created) {
    processTask(item.id, path.join(uploadDir, item.filename), caption || item.original_name);
  }
});

async function processTask(id, filePath, caption) {
  const start = Date.now();
  db.prepare(`UPDATE tasks SET status='processing' WHERE id=?`).run(id);
  try {
    const result = await postVideoToTelegram({ filePath, caption });
    const seconds = Math.round((Date.now() - start) / 1000);
    db.prepare(
      `UPDATE tasks SET status='posted', posted_at=datetime('now'), duration_seconds=? WHERE id=?`
    ).run(seconds, id);
    if (result.skipped) console.log(`[task ${id}] ${result.reason}`);
  } catch (err) {
    const seconds = Math.round((Date.now() - start) / 1000);
    db.prepare(`UPDATE tasks SET status='failed', error=?, duration_seconds=? WHERE id=?`)
      .run(String(err.message || err), seconds, id);
    console.error(`[task ${id}] 失败:`, err.message);
  }
}

export default router;
