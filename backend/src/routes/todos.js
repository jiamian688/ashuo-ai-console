import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM todos ORDER BY id DESC').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { content, bucket } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: '内容不能为空' });
  const info = db
    .prepare(`INSERT INTO todos (content, bucket) VALUES (?, ?)`)
    .run(content.trim(), bucket === 'tomorrow' ? 'tomorrow' : 'today');
  res.status(201).json(db.prepare('SELECT * FROM todos WHERE id=?').get(info.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const { done } = req.body || {};
  db.prepare(`UPDATE todos SET done=? WHERE id=?`).run(done ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM todos WHERE id=?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM todos WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
