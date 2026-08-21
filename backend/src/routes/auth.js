import { Router } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { verifyPassword } from '../services/password.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
    return res.status(401).json({ error: '账号或密码错误' });
  }
  const token = jwt.sign(
    { uid: user.id, username: user.username, isAdmin: !!user.is_admin },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  );
  res.json({ token, username: user.username, nickname: user.nickname || user.username, isAdmin: !!user.is_admin });
});

export default router;
