// 频道视频文案 + 标签生成。配置了 ANTHROPIC_API_KEY 用 Claude,否则用本地模板兜底。
const MODEL = 'claude-sonnet-4-6';

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// topic:用户在上传时填的「主题/关键词」(可空)。返回 { caption, mode }
export async function generateChannelCaption({ topic } = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  const t = (topic || '').trim();

  // 没配 key:模板兜底(主题在前 + 默认标签)
  if (!key) {
    const tags = (process.env.DEFAULT_TAGS || '#每日更新 #精彩视频').trim();
    const base = t || '精彩内容,不容错过 🔥';
    return { caption: `${base}\n\n${tags}`, mode: 'template' };
  }

  const topicLine = t
    ? `主题/关键词:「${t}」。`
    : '这是一条短视频,没有特别指定主题,写得有吸引力、通用即可。';

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content:
            `为一条要发到 Telegram 频道的短视频写中文文案。${topicLine} ` +
            `要求:第一行是 1~2 句吸引人的中文描述(可用 emoji);空一行;` +
            `最后一行给 3~5 个相关中文话题标签,#开头、用空格分隔。` +
            `只输出文案本身,不要任何解释、不要引号。`,
        },
      ],
    }),
  });

  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  const caption = (data.content?.[0]?.text || '').trim();
  if (!caption) throw new Error('AI 返回空文案');
  return { caption, mode: 'claude' };
}
