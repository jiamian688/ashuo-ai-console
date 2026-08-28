import { Router } from 'express';
import { activeProvider } from '../services/llm.js';
import {
  commentAdminConfigured,
  listSources,
  listComments,
  passComment,
  passComments,
  rejectComment,
  rejectComments,
  getTodayReviewStats,
  listReviewLog,
} from '../services/commentAdmin.js';
import { askAi, runAutoReview } from '../services/commentAutoReview.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json({ configured: commentAdminConfigured(), ai: activeProvider(), sources: listSources() });
});

router.get('/today-stats', (req, res) => {
  res.json(getTodayReviewStats());
});

// 我们自己审核过的记录(本地日志,不是问后台状态),避免重复审核。
router.get('/history', (req, res) => {
  try {
    const { source = 'mv', page = 1, limit = 20 } = req.query;
    const data = listReviewLog(source, { page: Number(page), limit: Number(limit) });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// status: 未提供时,有审核队列的默认只拉未审核(0);book 没有审核队列,忽略该参数。
router.get('/list', async (req, res) => {
  try {
    const { source = 'mv', page = 1, limit = 20, status } = req.query;
    const data = await listComments(source, { page: Number(page), limit: Number(limit), status });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 让 AI 给一批评论逐条给出建议(通过/拒绝 + 理由),不落地执行,人工确认后再点通过/拒绝
router.post('/ai-review', async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: '没有需要审核的评论' });

  const provider = activeProvider();
  if (!provider) {
    return res.status(400).json({ error: '未配置 AI,无法自动审核(需在后端设置 XAI_API_KEY 或 ANTHROPIC_API_KEY)' });
  }

  try {
    const list = items.map((it) => ({ id: it.id, content: it.content || '', title: it.title || '' }));
    const suggestions = await askAi(list);
    res.json({ suggestions, mode: provider });
  } catch (err) {
    res.status(500).json({ error: 'AI 审核失败: ' + err.message });
  }
});

// 一键:拉取当前未审核评论 -> AI 判断 -> 直接按建议执行通过/拒绝(book 模块的拒绝=删除)。
// 核心逻辑在 services/commentAutoReview.js,定时任务(scheduler.js)调用的是同一份。
router.post('/auto-review', async (req, res) => {
  const provider = activeProvider();
  if (!provider) {
    return res.status(400).json({ error: '未配置 AI,无法自动审核(需在后端设置 XAI_API_KEY 或 ANTHROPIC_API_KEY)' });
  }
  try {
    const source = req.body?.source || 'mv';
    const limit = Number(req.body?.limit) || 50;
    const onlyToday = !!req.body?.onlyToday;
    const result = await runAutoReview(source, { limit, onlyToday });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '自动审核失败: ' + err.message });
  }
});

router.post('/pass', async (req, res) => {
  try {
    await passComment(req.body?.source || 'mv', req.body?.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/pass-batch', async (req, res) => {
  try {
    await passComments(req.body?.source || 'mv', req.body?.ids || []);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/reject', async (req, res) => {
  try {
    await rejectComment(req.body?.source || 'mv', req.body?.id, req.body?.reason);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/reject-batch', async (req, res) => {
  try {
    await rejectComments(req.body?.source || 'mv', req.body?.ids || [], req.body?.reason);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
