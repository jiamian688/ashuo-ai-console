// 统一的 LLM 调用层:同时支持 Claude(Anthropic)和 Grok(xAI),用环境变量切换。
//   AI_PROVIDER=claude|grok  指定用哪个;留空则自动:
//     有 XAI_API_KEY 用 grok,否则有 ANTHROPIC_API_KEY 用 claude,都没有则降级模板。
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const GROK_MODEL = process.env.GROK_MODEL || 'grok-3';

// 返回当前生效的提供商:'claude' | 'grok' | null(未配置 key)
export function activeProvider() {
  const p = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (p === 'grok') return process.env.XAI_API_KEY ? 'grok' : null;
  if (p === 'claude') return process.env.ANTHROPIC_API_KEY ? 'claude' : null;
  // 自动:优先 grok,其次 claude
  if (process.env.XAI_API_KEY) return 'grok';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  return null;
}

export function aiEnabled() {
  return activeProvider() !== null;
}

// 内部:返回 { text, usage },usage = { tokens, costUsd }
async function chatRaw(prompt, maxTokens) {
  const provider = activeProvider();
  if (provider === 'grok') return chatGrok(prompt, maxTokens);
  if (provider === 'claude') return chatClaude(prompt, maxTokens);
  throw new Error('未配置 AI(在 backend/.env 填 XAI_API_KEY 或 ANTHROPIC_API_KEY)');
}

// 给一段 prompt,返回纯文本。未配置或调用失败时抛错。
export async function chat({ prompt, maxTokens = 600 }) {
  const { text } = await chatRaw(prompt, maxTokens);
  return text;
}

// 同 chat,但额外带回消耗:{ text, usage: { tokens, costUsd } }
export async function chatWithUsage({ prompt, maxTokens = 600 }) {
  return chatRaw(prompt, maxTokens);
}

async function chatClaude(prompt, maxTokens) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  const text = (data.content?.[0]?.text || '').trim();
  if (!text) throw new Error('AI 返回空内容');
  const u = data.usage || {};
  return { text, usage: { tokens: (u.input_tokens || 0) + (u.output_tokens || 0), costUsd: 0 } };
}

// xAI 的接口是 OpenAI 兼容格式
async function chatGrok(prompt, maxTokens) {
  const resp = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await resp.json();
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : data.error.message);
  }
  const text = (data.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('AI 返回空内容');
  const u = data.usage || {};
  return { text, usage: { tokens: u.total_tokens || 0, costUsd: (u.cost_in_usd_ticks || 0) / 1e9 } };
}
