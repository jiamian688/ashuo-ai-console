// AI 自动审核评论的核心逻辑,被"手动点按钮"(routes/commentReview.js)和
// "定时任务"(scheduler.js)两处共用,保证行为完全一致。
import { chat } from './llm.js';
import {
  listComments,
  passComment,
  passComments,
  rejectComment,
  rejectComments,
} from './commentAdmin.js';

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

// grok 常常不听话:给的 JSON 前面带 `**`、`**输出:**`、```json 围栏,或数组后面再补一段说明。
// 直接 JSON.parse 就会 `Unexpected token '*'` 整轮报错,该模块这一轮等于没审。
// 这里尽量把 JSON 数组从任意包装里抠出来。
function extractJsonArray(raw) {
  let t = String(raw || '').trim();
  // 去掉任意位置的 ``` / ```json 围栏
  t = t.replace(/```[a-zA-Z]*\s*/g, '').replace(/```/g, '').trim();
  try {
    const v = JSON.parse(t);
    if (Array.isArray(v)) return v;
  } catch { /* 落到下面按 [ ] 截取 */ }
  const s = t.indexOf('[');
  const e = t.lastIndexOf(']');
  if (s !== -1 && e > s) {
    try {
      const v = JSON.parse(t.slice(s, e + 1));
      if (Array.isArray(v)) return v;
    } catch { /* 继续抛错 */ }
  }
  throw new Error('AI 返回无法解析为 JSON 数组: ' + t.slice(0, 200));
}

export async function askAi(items) {
  const maxTokens = Math.min(6000, 400 + items.length * 60);
  const text = await chat({ prompt: buildReviewPrompt(items), maxTokens });
  const arr = extractJsonArray(text);
  // 只保留结构合法的建议,防止个别脏元素影响后续 filter/执行
  return arr.filter(
    (s) => s && s.id != null && (s.action === 'pass' || s.action === 'reject')
  );
}

function groupByReason(items) {
  const byReason = new Map();
  for (const r of items) {
    const key = r.reason || '';
    if (!byReason.has(key)) byReason.set(key, []);
    byReason.get(key).push(r.id);
  }
  return byReason;
}

// 拉取待审核评论 -> AI 判断 -> 直接按建议执行通过/拒绝(book 模块的拒绝=删除)。
export async function runAutoReview(source, { limit = 50, onlyToday = false } = {}) {
  const { list, hasApprovalFlow } = await listComments(source, { page: 1, limit, status: 0 });
  if (!list.length) return { reviewed: 0, passed: 0, rejected: 0, skipped: 0, details: [] };

  // 只审核最近发布的评论;更早的先跳过不动,避免动到往期存量。
  let targetList = list;
  let skipped = 0;
  if (onlyToday) {
    // 不按「北京自然日」判定 —— 那样在北京 00:00 前后会漏掉跨日那一两个小时、
    // 上一轮还没抓到的评论(定时任务每 2 小时一轮)。改成滚动时间窗:
    // 只保留最近 RECENT_HOURS 小时内发布的,既不碰往期存量,也不受午夜切日影响。
    const RECENT_HOURS = 30;
    const cutoff = Date.now() - RECENT_HOURS * 3600 * 1000;
    const parseBJ = (s) => {
      s = String(s || '').trim();
      if (!s) return NaN;
      // 后台 created_at 是北京时间(UTC+8)的 'YYYY-MM-DD HH:MM:SS'
      let ms = Date.parse(s.replace(' ', 'T') + '+08:00');
      if (!Number.isFinite(ms)) ms = Date.parse(s); // 兜底:后台若改用自带时区的格式
      return ms;
    };
    targetList = list.filter((it) => {
      const ms = parseBJ(it.created_at);
      return Number.isFinite(ms) && ms >= cutoff;
    });
    skipped = list.length - targetList.length;
  }
  if (!targetList.length) return { reviewed: 0, passed: 0, rejected: 0, skipped, details: [] };

  const items = targetList.map((it) => ({ id: it.id, content: it.content, title: it.title }));
  const suggestions = await askAi(items);

  const passItems = suggestions.filter((s) => s.action === 'pass');
  const rejectItems = suggestions.filter((s) => s.action === 'reject');

  // 通过/拒绝都按 AI 给的理由分组批量执行(而不是一条条单独发请求),
  // 既提速,也能把每条的理由存进本地日志(而不是丢掉)。
  if (hasApprovalFlow && passItems.length) {
    for (const [reason, ids] of groupByReason(passItems)) {
      if (ids.length === 1) await passComment(source, ids[0], reason);
      else await passComments(source, ids, reason);
    }
  }
  // book 没有真正验证过的批量删除接口(delAll 是猜的,404 过),这个模块删除一律走单条,不批量。
  if (!hasApprovalFlow) {
    for (const r of rejectItems) await rejectComment(source, r.id, r.reason || '违规内容');
  } else {
    for (const [reason, ids] of groupByReason(rejectItems)) {
      if (ids.length === 1) await rejectComment(source, ids[0], reason || '违规内容');
      else await rejectComments(source, ids, reason || '违规内容');
    }
  }

  return {
    reviewed: suggestions.length,
    passed: hasApprovalFlow ? passItems.length : 0,
    rejected: rejectItems.length,
    skipped,
    details: suggestions,
  };
}
