// 频道视频文案 + 标签生成。配置了 AI(Claude 或 Grok)就用 AI,否则用本地模板兜底。
import { chat, activeProvider } from './llm.js';

export { aiEnabled } from './llm.js';

// topic:用户在上传时填的「主题/关键词」(可空)。返回 { caption, mode }
// mode:'claude' | 'grok' = 真用了对应 AI;'template' = 没配 key 走的模板
export async function generateChannelCaption({ topic } = {}) {
  const provider = activeProvider();
  const t = (topic || '').trim();

  // 没配 AI:模板兜底(主题在前 + 默认标签)
  if (!provider) {
    const tags = (process.env.DEFAULT_TAGS || '#每日更新 #精彩视频').trim();
    const base = t || '精彩内容,不容错过 🔥';
    return { caption: `${base}\n\n${tags}`, mode: 'template' };
  }

  const topicLine = t
    ? `主题/关键词:「${t}」。`
    : '这是一条短视频,没有特别指定主题,写得有吸引力、通用即可。';

  const prompt =
    `为一条要发到 Telegram 频道的短视频写中文文案。${topicLine} ` +
    `要求:第一行是 1~2 句吸引人的中文描述(可用 emoji);空一行;` +
    `最后一行给 3~5 个相关中文话题标签,#开头、用空格分隔。` +
    `只输出文案本身,不要任何解释、不要引号。`;

  const caption = await chat({ prompt, maxTokens: 400 });
  if (!caption) throw new Error('AI 返回空文案');
  return { caption, mode: provider };
}
