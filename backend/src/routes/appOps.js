import { Router } from 'express';
import db from '../db.js';
import { adminConfigured } from '../services/adminClient.js';
import { logActivity } from '../services/activityLog.js';
import {
  listMembers, listOrders, listCharges, saveCharge,
  listExchangeCodes, listProducts, generateExchangeCodes, deleteExchangeCode, listExchangeLogs,
} from '../services/appOps.js';

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

router.get('/exchange-codes', async (req, res) => {
  try {
    const { code, status, productId } = req.query;
    res.json(await listExchangeCodes({ ...pageOpts(req.query), code, status, productId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/products', async (req, res) => {
  try {
    res.json(await listProducts());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/exchange-codes', async (req, res) => {
  const { productId, qty, expiredAt } = req.body || {};
  const pid = Number(productId);
  const n = Number(qty);
  if (!Number.isInteger(pid) || pid <= 0) return res.status(400).json({ error: '请选择产品' });
  if (!Number.isInteger(n) || n < 1 || n > 100) return res.status(400).json({ error: '生成数量须为 1~100' });
  if (expiredAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiredAt)) return res.status(400).json({ error: '过期日期格式不正确' });
  try {
    const codes = await generateExchangeCodes({ productId: pid, qty: n, expiredAt });
    logActivity({ req, actor: req.user?.username, actorId: req.user?.uid, action: 'app_exchange_code', target: String(pid), detail: { op: 'generate', productId: pid, qty: n, expiredAt, codes } });
    res.json({ ok: true, codes });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/exchange-codes/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id 不正确' });
  try {
    await deleteExchangeCode(id);
    logActivity({ req, actor: req.user?.username, actorId: req.user?.uid, action: 'app_exchange_code', target: String(id), detail: { op: 'delete', id, code: req.query.code } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/exchange-logs', async (req, res) => {
  try {
    const { code, aff } = req.query;
    res.json(await listExchangeLogs({ ...pageOpts(req.query), code, aff }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
