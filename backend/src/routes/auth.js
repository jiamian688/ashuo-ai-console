import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const expected = process.env.APP_PASSWORD || 'admin';
  if (!password || password !== expected) {
    return res.status(401).json({ error: '密码错误' });
  }
  const token = jwt.sign(
    { username: username || 'sishuo' },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  );
  res.json({ token, username: username || 'sishuo' });
});

export default router;
