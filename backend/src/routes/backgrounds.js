import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'backgrounds');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.jpg';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype || '')) return cb(new Error('只能上传图片'));
    cb(null, true);
  },
});

const router = Router();

// 图片库是所有账号共享的(谁都能传、谁都能挑别人传的用),但"当前用的是哪张"是每个账号自己的选择
// (users.active_background_id),不是图片自己的属性——所以这里的 active 要按 req.user 现算,不能存在 backgrounds 行上。
const toDto = (row, activeId) => ({
  id: row.id,
  url: `/files/backgrounds/${row.filename}`,
  originalName: row.original_name,
  uploadedBy: row.uploaded_by,
  active: row.id === activeId,
  createdAt: row.created_at,
});

const getActiveId = (uid) => db.prepare('SELECT active_background_id FROM users WHERE id=?').get(uid)?.active_background_id ?? null;

router.get('/', (req, res) => {
  const activeId = getActiveId(req.user.uid);
  const rows = db.prepare('SELECT * FROM backgrounds ORDER BY id DESC').all();
  res.json(rows.map((r) => toDto(r, activeId)));
});

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有收到图片' });
  const info = db
    .prepare('INSERT INTO backgrounds (filename, original_name, uploaded_by) VALUES (?, ?, ?)')
    .run(req.file.filename, req.file.originalname || null, req.user.username);
  res.status(201).json(toDto(db.prepare('SELECT * FROM backgrounds WHERE id=?').get(info.lastInsertRowid), getActiveId(req.user.uid)));
});

router.patch('/:id/activate', (req, res) => {
  const row = db.prepare('SELECT * FROM backgrounds WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '找不到这张背景图' });
  db.prepare('UPDATE users SET active_background_id=? WHERE id=?').run(row.id, req.user.uid);
  res.json(toDto(row, row.id));
});

router.patch('/deactivate', (req, res) => {
  db.prepare('UPDATE users SET active_background_id=NULL WHERE id=?').run(req.user.uid);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM backgrounds WHERE id=?').get(req.params.id);
  if (row) {
    fs.unlink(path.join(uploadDir, row.filename), () => {});
    db.prepare('DELETE FROM backgrounds WHERE id=?').run(req.params.id);
    // 有人正用着这张的话,清掉他们的选择,退回默认渐变,别留着一个指向已删图片的死引用。
    db.prepare('UPDATE users SET active_background_id=NULL WHERE active_background_id=?').run(req.params.id);
  }
  res.json({ ok: true });
});

export default router;
