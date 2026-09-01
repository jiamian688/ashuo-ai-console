import { Router } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { verifyPassword } from '../services/password.js';
import { logActivity } from '../services/activityLog.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }
  const uname = username.trim();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(uname);
  if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
    logActivity({
      req,
      actor: uname || null,
      actorId: user?.id ?? null,
      action: 'login_fail',
      detail: user ? '密码错误' : '账号不存在',
    });
    return res.status(401).json({ error: '账号或密码错误' });
  }
  const token = jwt.sign(
    { uid: user.id, username: user.username, isAdmin: !!user.is_admin },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  );
  let tools = null;
  try { tools = user.tools ? JSON.parse(user.tools) : null; } catch { tools = null; }
  logActivity({ req, actor: user.username, actorId: user.id, action: 'login_ok' });
  res.json({ token, username: user.username, nickname: user.nickname || user.username, isAdmin: !!user.is_admin, tools });
});

// 退出:JWT 无状态,服务端无需失效处理,这里只为把「谁几点退出」记进日志。
// 不挂 requireAuth(登录态可能已过期),自己尽力解出用户名。
router.post('/logout', (req, res) => {
  let actor = null;
  let actorId = null;
  try {
    const header = req.headers.authorization || '';
    const tok = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (tok) {
      const p = jwt.verify(tok, process.env.JWT_SECRET || 'dev-secret');
      actor = p.username || null;
      actorId = p.uid ?? null;
    }
  } catch { /* token 无效就当匿名退出 */ }
  logActivity({ req, actor, actorId, action: 'logout' });
  res.json({ ok: true });
});

export default router;
