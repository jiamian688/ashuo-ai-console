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
  getTodayReviewStats,
  listReviewLog,
} from '../services/commentAdmin.js';

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
  const maxTokens = Math.min(6000, 400 + items.length * 60);
  let text = await chat({ prompt: buildReviewPrompt(items), maxTokens });
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
    const onlyToday = !!req.body?.onlyToday;
    const { list, hasApprovalFlow } = await listComments(source, { page: 1, limit, status: 0 });
    if (!list.length) return res.json({ reviewed: 0, passed: 0, rejected: 0, skipped: 0, details: [] });

    // 只审核今天(北京时间)发的评论;更早的先跳过不动,避免动到往期存量。
    let targetList = list;
    let skipped = 0;
    if (onlyToday) {
      const todayStr = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
      targetList = list.filter((it) => String(it.created_at || '').slice(0, 10) === todayStr);
      skipped = list.length - targetList.length;
    }
    if (!targetList.length) return res.json({ reviewed: 0, passed: 0, rejected: 0, skipped, details: [] });

    const items = targetList.map((it) => ({ id: it.id, content: it.content, title: it.title }));
    const suggestions = await askAi(items);

    const passItems = suggestions.filter((s) => s.action === 'pass');
    const rejectItems = suggestions.filter((s) => s.action === 'reject');

    // 通过/拒绝都按 AI 给的理由分组批量执行(而不是一条条单独发请求),
    // 既提速,也能把每条的理由存进本地日志(而不是丢掉)。
    const groupByReason = (items) => {
      const byReason = new Map();
      for (const r of items) {
        const key = r.reason || '';
        if (!byReason.has(key)) byReason.set(key, []);
        byReason.get(key).push(r.id);
      }
      return byReason;
    };

    if (hasApprovalFlow && passItems.length) {
      for (const [reason, ids] of groupByReason(passItems)) {
        if (ids.length === 1) await passComment(source, ids[0], reason);
        else await passComments(source, ids, reason);
      }
    }
    for (const [reason, ids] of groupByReason(rejectItems)) {
      if (ids.length === 1) await rejectComment(source, ids[0], reason || '违规内容');
      else await rejectComments(source, ids, reason || '违规内容');
    }

    res.json({
      reviewed: suggestions.length,
      passed: hasApprovalFlow ? passItems.length : 0,
      rejected: rejectItems.length,
      skipped,
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
