// 频道视频文案 + 标签生成。配置了 AI(Claude 或 Grok)就用 AI,否则用本地模板兜底。
import { chatWithUsage, activeProvider } from './llm.js';

export { aiEnabled } from './llm.js';

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 把「正文 + 标签」拼成最终文案,中间固定插一行引流 CTA(传送门)。
// 返回 { text, html }:
//   text —— 纯文本,存库 / 详情页展示与复制用;
//   html —— 配了 PROMO_LINK 时把「传送门」做成可点击链接,发 Telegram 用(需 parse_mode=HTML)。
//           没配 PROMO_LINK 则为 null,直接发纯文本。
export function buildCaption(narrative, tags) {
  const ctaText = (process.env.CTA_TEXT || '点击观看高清完整版视频').trim();
  const ctaLabel = (process.env.CTA_LABEL || '【传送门】').trim();
  const link = (process.env.PROMO_LINK || '').trim();
  const n = (narrative || '').trim();
  const tagLine = (tags || '').trim();

  const text = [n, `${ctaText} ${ctaLabel}`, tagLine].filter(Boolean).join('\n');

  let html = null;
  if (link) {
    const ctaHtml = `${escapeHtml(ctaText)} <a href="${escapeHtml(link)}">${escapeHtml(ctaLabel)}</a>`;
    html = [escapeHtml(n), ctaHtml, escapeHtml(tagLine)].filter(Boolean).join('\n');
  }
  return { text, html };
}

// topic:用户在上传时填的「主题/关键词」(可空)。返回 { caption, captionHtml, mode }
// mode:'claude' | 'grok' = 真用了对应 AI;'template' = 没配 key 走的模板
export async function generateChannelCaption({ topic } = {}) {
  const provider = activeProvider();
  const t = (topic || '').trim();
  const defaultTags = (process.env.DEFAULT_TAGS || '#每日更新 #精彩视频').trim();

  // 没配 AI:模板兜底(关键词当正文 + 默认标签 + 固定 CTA)
  if (!provider) {
    const base = t || '精彩内容,不容错过 🔥';
    const { text, html } = buildCaption(base, defaultTags);
    return { caption: text, captionHtml: html, mode: 'template', usage: { tokens: 0, costUsd: 0 } };
  }

  const kw = t
    ? `视频关键词/主题:「${t}」。`
    : '这是一条成人向短视频,没有特别指定关键词,请自行发挥写得撩人、通用。';

  const prompt =
    `你是一个成人内容频道的文案写手。为一条要发到 Telegram 频道的短视频写中文引流文案。${kw}\n` +
    `按下面两部分输出,两部分之间用单独一行「===」分隔:\n` +
    `第一部分:一段有画面感、撩人、露骨的中文叙述(2~4 句,可用 emoji),目的是吸引人点击观看完整视频。\n` +
    `第二部分:3~5 个与内容高度相关的中文话题标签,以 # 开头,用空格分隔,全部放在同一行。\n` +
    `只输出这两部分和中间的「===」,不要任何解释、不要引号、不要写「第一部分」之类的字样。`;

  const { text: raw, usage } = await chatWithUsage({ prompt, maxTokens: 500 });
  if (!raw) throw new Error('AI 返回空文案');

  // 拆出正文与标签
  let narrative = raw.trim();
  let tags = defaultTags;
  const parts = raw.split(/\n?\s*={3,}\s*\n?/);
  if (parts.length >= 2) {
    narrative = parts[0].trim();
    tags = parts.slice(1).join(' ').trim() || defaultTags;
  } else {
    // AI 没按分隔符返回:把最后一行当标签(如果它像标签)
    const lines = raw.trim().split('\n');
    const last = (lines[lines.length - 1] || '').trim();
    if (last.startsWith('#')) {
      tags = last;
      narrative = lines.slice(0, -1).join('\n').trim();
    }
  }

  const { text, html } = buildCaption(narrative, tags);
  return { caption: text, captionHtml: html, mode: provider, usage };
}
