import { Router } from 'express';
import db from '../db.js';
import { hashPassword } from '../services/password.js';

const router = Router();

function parseTools(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT id, username, nickname, is_admin, tools, created_at FROM users ORDER BY id').all();
  res.json(rows.map((r) => ({ ...r, isAdmin: !!r.is_admin, tools: parseTools(r.tools) })));
});

router.post('/', (req, res) => {
  const { username, password, nickname, tools } = req.body || {};
  if (!username || !username.trim() || !password) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少 6 位' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (exists) return res.status(400).json({ error: '这个账号已经存在' });

  const toolsJson = Array.isArray(tools) ? JSON.stringify(tools) : null;
  const { hash, salt } = hashPassword(password);
  const info = db
    .prepare('INSERT INTO users (username, password_hash, salt, nickname, is_admin, tools) VALUES (?, ?, ?, ?, 0, ?)')
    .run(username.trim(), hash, salt, (nickname || username).trim(), toolsJson);
  res.json({ id: info.lastInsertRowid, username: username.trim(), nickname: (nickname || username).trim(), isAdmin: false, tools });
});

router.post('/:id/reset-password', (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });
  const { hash, salt } = hashPassword(password);
  const info = db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: '账号不存在' });
  res.json({ ok: true });
});

// tools: null/未传 = 不限制(能看到全部工具);数组 = 只能看到列出的工具
router.post('/:id/tools', (req, res) => {
  const { tools } = req.body || {};
  const toolsJson = Array.isArray(tools) ? JSON.stringify(tools) : null;
  const info = db.prepare('UPDATE users SET tools = ? WHERE id = ?').run(toolsJson, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: '账号不存在' });
  res.json({ ok: true, tools });
});

router.delete('/:id', (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: '账号不存在' });
  if (Number(req.params.id) === req.user.uid) {
    return res.status(400).json({ error: '不能删除自己当前登录的账号' });
  }
  if (target.is_admin) {
    const adminCount = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1').get().n;
    if (adminCount <= 1) return res.status(400).json({ error: '至少要保留一个管理员账号' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
