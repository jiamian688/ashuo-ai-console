import { Router } from 'express';
import { chat, activeProvider } from '../services/llm.js';
import {
  commentAdminConfigured,
  listSources,
  listComments,
  passComment,
  passComments,
  rejectComment,
  rejectComments,
} from '../services/commentAdmin.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json({ configured: commentAdminConfigured(), ai: activeProvider(), sources: listSources() });
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

function buildReviewPrompt(items) {
  return (
    `你是视频/漫画/游戏网站的评论审核员。下面是一批待审核的用户评论(JSON 数组,每条含 id、content 评论正文、title 所属内容标题仅供参考)。\n` +
    `请逐条判断该评论本身是否违规,违规标准:包含联系方式/微信/QQ/电报号/外链等拉人引流、色情资源贩卖或线下交易引流、赌博诈骗广告、人身攻击辱骂、政治敏感内容。\n` +
    `外链不一定带 http,也可能是"111m.top""xxx.cc"这种裸域名,或用"搜妹网页""关注XX""加V"之类文字变相引导跳转,同样按外链拉流处理。\n` +
    `如果同一批里出现多条内容完全相同或高度相似的评论(同一段广告文案反复出现在不同内容下),这是典型广告号特征,即使单条文字模糊也应判定为违规。\n` +
    `单纯的口语化短评(如"666""爽""不错""？？？"等)一律视为正常,不要因为评论所在内容是成人内容就拒绝评论本身。\n` +
    `只输出一个 JSON 数组,不要任何多余文字或代码块围栏,每个元素格式为 {"id":评论id,"action":"pass"或"reject","reason":"一句话理由(不超过20字)"}。\n\n` +
    `待审核评论:\n${JSON.stringify(items)}`
  );
}

async function askAi(items) {
  let text = await chat({ prompt: buildReviewPrompt(items), maxTokens: 2000 });
  text = text.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(text);
}

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
// 为后续接「定时自动审核」预留 —— 这里就是到时候会被定时任务调用的同一段逻辑。
router.post('/auto-review', async (req, res) => {
  const provider = activeProvider();
  if (!provider) {
    return res.status(400).json({ error: '未配置 AI,无法自动审核(需在后端设置 XAI_API_KEY 或 ANTHROPIC_API_KEY)' });
  }
  try {
    const source = req.body?.source || 'mv';
    const limit = Number(req.body?.limit) || 50;
    const { list, hasApprovalFlow } = await listComments(source, { page: 1, limit, status: 0 });
    if (!list.length) return res.json({ reviewed: 0, passed: 0, rejected: 0, details: [] });

    const items = list.map((it) => ({ id: it.id, content: it.content, title: it.title }));
    const suggestions = await askAi(items);

    const passIds = suggestions.filter((s) => s.action === 'pass').map((s) => s.id);
    const rejectItems = suggestions.filter((s) => s.action === 'reject');

    if (hasApprovalFlow && passIds.length) await passComments(source, passIds);
    for (const r of rejectItems) {
      await rejectComment(source, r.id, r.reason || '');
    }

    res.json({
      reviewed: suggestions.length,
      passed: hasApprovalFlow ? passIds.length : 0,
      rejected: rejectItems.length,
      details: suggestions,
    });
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
