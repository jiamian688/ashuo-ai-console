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

const toDto = (row) => ({
  id: row.id,
  url: `/files/backgrounds/${row.filename}`,
  originalName: row.original_name,
  active: !!row.is_active,
  createdAt: row.created_at,
});

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM backgrounds ORDER BY id DESC').all();
  res.json(rows.map(toDto));
});

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有收到图片' });
  const info = db
    .prepare('INSERT INTO backgrounds (filename, original_name) VALUES (?, ?)')
    .run(req.file.filename, req.file.originalname || null);
  res.status(201).json(toDto(db.prepare('SELECT * FROM backgrounds WHERE id=?').get(info.lastInsertRowid)));
});

router.patch('/:id/activate', (req, res) => {
  const row = db.prepare('SELECT * FROM backgrounds WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '找不到这张背景图' });
  db.prepare('UPDATE backgrounds SET is_active=0').run();
  db.prepare('UPDATE backgrounds SET is_active=1 WHERE id=?').run(req.params.id);
  res.json(toDto(db.prepare('SELECT * FROM backgrounds WHERE id=?').get(req.params.id)));
});

router.patch('/deactivate', (req, res) => {
  db.prepare('UPDATE backgrounds SET is_active=0').run();
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM backgrounds WHERE id=?').get(req.params.id);
  if (row) {
    fs.unlink(path.join(uploadDir, row.filename), () => {});
    db.prepare('DELETE FROM backgrounds WHERE id=?').run(req.params.id);
  }
  res.json({ ok: true });
});

export default router;
