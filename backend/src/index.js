import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

import authRouter from './routes/auth.js';
import tasksRouter from './routes/tasks.js';
import todosRouter from './routes/todos.js';
import aiRouter from './routes/ai.js';
import telegramRouter from './routes/telegram.js';
import clipsRouter from './routes/clips.js';
import socialRouter from './routes/social.js';
import comicRouter from './routes/comic.js';
import commentReviewRouter from './routes/commentReview.js';
import businessDataRouter from './routes/businessData.js';
import usersRouter from './routes/users.js';
import postAdminRouter from './routes/postAdmin.js';
import sheetExportRouter from './routes/sheetExport.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

// 剪辑产物(封面图/裁剪视频)下载
app.use('/files', express.static(path.join(__dirname, '..', 'uploads')));

// 鉴权中间件:除登录外都要带 Bearer token
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    next();
  } catch {
    res.status(401).json({ error: '登录已过期' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: '需要管理员权限' });
  next();
}

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'yule-agentcenter' }));
app.use('/api/auth', authRouter);
app.get('/api/auth/me', requireAuth, (req, res) => res.json(req.user));

app.use('/api/tasks', requireAuth, tasksRouter);
app.use('/api/todos', requireAuth, todosRouter);
app.use('/api/ai', requireAuth, aiRouter);
app.use('/api/telegram', requireAuth, telegramRouter);
app.use('/api/clips', requireAuth, clipsRouter);
app.use('/api/social', requireAuth, socialRouter);
app.use('/api/comic', requireAuth, comicRouter);
app.use('/api/comment-review', requireAuth, commentReviewRouter);
app.use('/api/business-data', requireAuth, businessDataRouter);
app.use('/api/sheet-export', sheetExportRouter); // 不走 requireAuth,自己校验 token(见路由文件)
app.use('/api/users', requireAuth, requireAdmin, usersRouter);
app.use('/api/post-admin', requireAuth, postAdminRouter);

// 本地用 BACKEND_PORT(避开被注入的 PORT);Render 等平台注入 PORT,回退到它
const PORT = process.env.BACKEND_PORT || process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ backend running on http://localhost:${PORT}`));
