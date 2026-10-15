import { Router } from 'express';
import db from '../db.js';
import { adminConfigured } from '../services/adminClient.js';
import { logActivity } from '../services/activityLog.js';
import { listMembers, listOrders, listCharges, saveCharge } from '../services/appOps.js';

const router = Router();

// 上下分会直接改用户余额,不能只靠前端隐藏卡片:后端再按账号的工具权限校验一次。
// tools 为 NULL 表示不限制(能看到全部工具)。
router.use((req, res, next) => {
  if (req.user?.isAdmin) return next();
  const row = db.prepare('SELECT tools FROM users WHERE id = ?').get(req.user?.uid);
  let tools = null;
  try { tools = row?.tools ? JSON.parse(row.tools) : null; } catch { tools = null; }
  if (tools && !tools.includes('appOps')) return res.status(403).json({ error: '没有 App 日常运营权限' });
  next();
});

const pageOpts = (q) => ({ page: Number(q.page) || 1, limit: Math.min(Number(q.limit) || 20, 100) });

router.get('/status', (req, res) => {
  res.json({ configured: adminConfigured() });
});

router.get('/members', async (req, res) => {
  try {
    const { aff, affCode, uuid, nickname, oauthType } = req.query;
    res.json(await listMembers({ ...pageOpts(req.query), aff, affCode, uuid, nickname, oauthType }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const { affCode, uuid, orderId, status, oauthType, dateFrom, dateTo } = req.query;
    res.json(await listOrders({ ...pageOpts(req.query), affCode, uuid, orderId, status, oauthType, dateFrom, dateTo }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/charges', async (req, res) => {
  try {
    const { toAff, type } = req.query;
    res.json(await listCharges({ ...pageOpts(req.query), toAff, type }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/charge', async (req, res) => {
  const { toAff, score, scoreType, type, des, logDesc } = req.body || {};
  const aff = Number(toAff);
  const amount = Number(score);
  if (!Number.isInteger(aff) || aff <= 0) return res.status(400).json({ error: '请填写正确的用户 aff' });
  if (!Number.isInteger(amount) || amount < 1) return res.status(400).json({ error: '分数必须是正整数' });
  if (![1, 2, 3].includes(Number(scoreType))) return res.status(400).json({ error: '分数类型不正确' });
  if (![1, 2].includes(Number(type))) return res.status(400).json({ error: '类型不正确' });
  if (!String(des || '').trim()) return res.status(400).json({ error: '请填写上下分理由' });
  const payload = { toAff: aff, score: amount, scoreType: Number(scoreType), type: Number(type), des: String(des).trim(), logDesc };
  try {
    await saveCharge(payload);
    logActivity({ req, actor: req.user?.username, actorId: req.user?.uid, action: 'app_charge', target: String(aff), detail: payload });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
