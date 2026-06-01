import fs from 'fs';
import path from 'path';

const API = 'https://api.telegram.org';

function creds() {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  };
}

export function telegramConfigured() {
  const { token, chatId } = creds();
  return Boolean(token && chatId);
}

// 校验配置:getMe 验证 token,可选发一条文字到频道验证 chat_id
export async function testTelegram({ sendPing = false } = {}) {
  const { token, chatId } = creds();
  if (!token) throw new Error('未配置 TELEGRAM_BOT_TOKEN');

  const meRes = await fetch(`${API}/bot${token}/getMe`);
  const me = await meRes.json();
  if (!me.ok) throw new Error('token 无效: ' + (me.description || meRes.status));

  let pinged = false;
  if (sendPing) {
    if (!chatId) throw new Error('未配置 TELEGRAM_CHAT_ID');
    const r = await fetch(`${API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: '✅ Yule AgentCenter 连接测试成功' }),
    });
    const d = await r.json();
    if (!d.ok) throw new Error('发送到 chat 失败: ' + (d.description || r.status));
    pinged = true;
  }

  return { botUsername: me.result?.username, hasChatId: Boolean(chatId), pinged };
}

// 把视频发到 Telegram。>50MB 用 sendDocument(bot API 上传上限),否则 sendVideo。
export async function postVideoToTelegram({ filePath, caption }) {
  const { token, chatId } = creds();
  if (!token || !chatId) {
    return { skipped: true, reason: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 未配置,跳过真实发布' };
  }
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('视频文件不存在: ' + filePath);
  }

  const size = fs.statSync(filePath).size;
  const method = size > 50 * 1024 * 1024 ? 'sendDocument' : 'sendVideo';
  const field = method === 'sendDocument' ? 'document' : 'video';

  const form = new FormData();
  form.append('chat_id', chatId);
  if (caption) form.append('caption', caption);
  const buffer = fs.readFileSync(filePath);
  form.append(field, new Blob([buffer]), path.basename(filePath));

  const res = await fetch(`${API}/bot${token}/${method}`, { method: 'POST', body: form });
  const data = await res.json();
  if (!data.ok) {
    throw new Error('Telegram API 错误: ' + (data.description || res.status));
  }
  return { skipped: false, messageId: data.result?.message_id };
}
