import { Router } from 'express';
import { adminConfigured } from '../services/adminClient.js';
import { listPosts, passPost, rejectPost } from '../services/postAdmin.js';
import { activeProvider, chat, chatVision } from '../services/llm.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json({ configured: adminConfigured(), ai: activeProvider() });
});

router.get('/list', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const data = await listPosts({ page: Number(page), limit: Number(limit), status });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/pass', async (req, res) => {
  try {
    await passPost(req.body?.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/reject', async (req, res) => {
  try {
    await rejectPost(req.body?.id, req.body?.reason);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function buildPrompt(post) {
  return (
    `你是成人内容社区的帖子审核员。下面是一条用户发布的帖子(标题+正文+最多3张配图)。\n` +
    `请判断是否应该拒绝,拒绝标准(满足任意一条就拒绝):\n` +
    `1. 标题或正文里包含联系方式引流:微信号/QQ号/电报(TG)号/手机号/其他社交账号/外部链接/加群暗示等,目的是把用户引导到平台外交易或加好友。\n` +
    `2. 配图内容空洞、无实际画面内容、纯文字截图广告、和帖子主题无关、或者明显是引流广告图(比如二维码、联系方式截图),即"没有看点"。\n` +
    `3. 没有配图但正文也是空洞灌水(比如只有几个字、乱码、纯符号)。\n` +
    `如果都不满足,就通过。单纯口语化的短评(如"666""求约"这种带正常互动意图的)不算违规,不要因为内容是成人社区就一律拒绝。\n` +
    `只输出一个 JSON 对象,不要任何多余文字或代码块围栏,格式为 {"action":"pass"或"reject","reason":"一句话理由(不超过20字)"}。\n\n` +
    `标题:${post.title || '(无)'}\n正文:${post.content || '(无)'}`
  );
}

async function aiJudgePost(post) {
  let text;
  if (post.images && post.images.length > 0) {
    text = await chatVision({ prompt: buildPrompt(post), images: post.images.slice(0, 3), maxTokens: 300 });
  } else {
    text = await chat({ prompt: buildPrompt(post), maxTokens: 300 });
  }
  text = text.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(text);
}

// 给一批帖子逐条 AI 建议,不落地执行
router.post('/ai-review', async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: '没有需要审核的帖子' });
  const provider = activeProvider();
  if (!provider) return res.status(400).json({ error: '未配置 AI,无法自动审核' });

  try {
    const suggestions = [];
    for (const post of items) {
      try {
        const r = await aiJudgePost(post);
        suggestions.push({ id: post.id, ...r });
      } catch (e) {
        suggestions.push({ id: post.id, action: 'error', reason: e.message });
      }
    }
    res.json({ suggestions, mode: provider });
  } catch (err) {
    res.status(500).json({ error: 'AI 审核失败: ' + err.message });
  }
});

// 一键:拉取当前待审核帖子 -> AI 判断(含识图) -> 直接按建议执行通过/拒绝
router.post('/auto-review', async (req, res) => {
  const provider = activeProvider();
  if (!provider) return res.status(400).json({ error: '未配置 AI,无法自动审核' });
  try {
    const limit = Number(req.body?.limit) || 20;
    const { list } = await listPosts({ page: 1, limit, status: 0 });
    if (!list.length) return res.json({ reviewed: 0, passed: 0, rejected: 0, details: [] });

    const details = [];
    let passed = 0;
    let rejected = 0;
    for (const post of list) {
      try {
        const r = await aiJudgePost(post);
        if (r.action === 'reject') {
          await rejectPost(post.id, r.reason || '');
          rejected++;
        } else {
          await passPost(post.id);
          passed++;
        }
        details.push({ id: post.id, title: post.title, ...r });
      } catch (e) {
        details.push({ id: post.id, title: post.title, action: 'error', reason: e.message });
      }
    }
    res.json({ reviewed: list.length, passed, rejected, details });
  } catch (err) {
    res.status(500).json({ error: '自动审核失败: ' + err.message });
  }
});

export default router;
