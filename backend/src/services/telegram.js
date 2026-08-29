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

// 把一个视频文件发到指定 chat。>50MB 用 sendDocument(bot API 上传上限),否则 sendVideo。
// replyToMessageId:填了就作为该消息的回复发出(用于「频道帖子的评论」)。
async function sendVideoFile({ token, chatId, filePath, caption, parseMode, replyToMessageId }) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('视频文件不存在: ' + filePath);
  }
  const size = fs.statSync(filePath).size;
  const method = size > 50 * 1024 * 1024 ? 'sendDocument' : 'sendVideo';
  const field = method === 'sendDocument' ? 'document' : 'video';

  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption);
  if (caption && parseMode) form.append('parse_mode', parseMode);
  if (replyToMessageId) form.append('reply_to_message_id', String(replyToMessageId));
  if (method === 'sendVideo') form.append('supports_streaming', 'true');
  form.append(field, new Blob([fs.readFileSync(filePath)]), path.basename(filePath));

  const res = await fetch(`${API}/bot${token}/${method}`, { method: 'POST', body: form });
  const data = await res.json();
  if (!data.ok) {
    throw new Error('Telegram API 错误: ' + (data.description || res.status));
  }
  return { messageId: data.result?.message_id };
}

// 把视频发到 Telegram 频道(TELEGRAM_CHAT_ID)。
export async function postVideoToTelegram({ filePath, caption, parseMode }) {
  const { token, chatId } = creds();
  if (!token || !chatId) {
    return { skipped: true, reason: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 未配置,跳过真实发布' };
  }
  const { messageId } = await sendVideoFile({ token, chatId, filePath, caption, parseMode });
  return { skipped: false, messageId };
}

// 把「视频 + 多张图片 + 文案」作为一组(media group)一条消息发出。
// 文案挂在第一个媒体上(视频优先)。photoPaths 为图片路径数组。
export async function postMediaGroupToTelegram({ videoPath, photoPaths = [], caption, parseMode }) {
  const { token, chatId } = creds();
  if (!token || !chatId) {
    return { skipped: true, reason: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 未配置,跳过真实发布' };
  }

  const form = new FormData();
  form.append('chat_id', chatId);
  const media = [];
  let idx = 0;

  const attach = (filePath, type) => {
    const field = `file${idx++}`;
    const item = { type, media: `attach://${field}` };
    if (media.length === 0 && caption) { // 文案放第一个媒体
      item.caption = caption;
      if (parseMode) item.parse_mode = parseMode;
    }
    if (type === 'video') item.supports_streaming = true;
    media.push(item);
    form.append(field, new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
  };

  if (videoPath) attach(videoPath, 'video');
  for (const p of photoPaths) attach(p, 'photo');

  if (media.length < 2) {
    throw new Error('媒体组至少需要 2 个媒体');
  }
  form.append('media', JSON.stringify(media));

  const res = await fetch(`${API}/bot${token}/sendMediaGroup`, { method: 'POST', body: form });
  const data = await res.json();
  if (!data.ok) {
    throw new Error('Telegram sendMediaGroup 错误: ' + (data.description || res.status));
  }
  return { skipped: false, count: data.result?.length, messageId: data.result?.[0]?.message_id };
}

// ---- 新版发布:频道发「截图 + 文案」,视频作为该帖子的评论 ----
// 需要:bot 是频道管理员;bot 在频道绑定的讨论组里(能发消息);频道已开启评论。

let _linkedChatId; // 缓存频道绑定的讨论组 id
let _updateOffset = 0; // getUpdates 增量游标
let _postLock = Promise.resolve(); // 串行化「发帖 + 抓自动转发」,避免并发任务抢 getUpdates(会 409)

async function getLinkedChatId(token, channelId) {
  if (_linkedChatId !== undefined) return _linkedChatId;
  const res = await fetch(`${API}/bot${token}/getChat?chat_id=${encodeURIComponent(channelId)}`);
  const data = await res.json();
  _linkedChatId = data.ok ? (data.result?.linked_chat_id ?? null) : null;
  return _linkedChatId;
}

// 频道帖子会被 Telegram 自动转发进讨论组。轮询 getUpdates 找那条自动转发消息,
// 返回它在讨论组里的 message_id(拿它做 reply_to 就等于「评论这个帖子」)。
async function waitForForwardedPost({ token, groupId, channelPostId, timeoutMs = 25000 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${API}/bot${token}/getUpdates?offset=${_updateOffset}&timeout=8&allowed_updates=%5B%22message%22%5D`
    );
    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const upd of data.result) {
        _updateOffset = Math.max(_updateOffset, upd.update_id + 1);
        const m = upd.message;
        if (!m || String(m.chat?.id) !== String(groupId) || !m.is_automatic_forward) continue;
        const originId = m.forward_origin?.message_id ?? m.forward_from_message_id;
        if (originId === channelPostId) return m.message_id;
      }
    }
  }
  return null;
}

// 频道发截图+文案;视频作为评论发到讨论组。任一步失败都兜底,保证视频最终发得出去。
export async function postChannelWithVideoComment({ videoPath, photoPaths = [], caption, parseMode }) {
  const { token, chatId } = creds();
  if (!token || !chatId) {
    return { skipped: true, reason: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 未配置,跳过真实发布' };
  }
  // 没截到图:退回「视频直接发频道(带文案)」
  if (!photoPaths.length) {
    const r = await postVideoToTelegram({ filePath: videoPath, caption, parseMode });
    return { ...r, mode: 'fallback-video-only' };
  }

  // 串行执行,拿到锁再往下走
  let release;
  const prev = _postLock;
  _postLock = new Promise((r) => (release = r));
  await prev;
  try {
    // 1) 频道发截图 + 文案
    let channelPostId;
    if (photoPaths.length >= 2) {
      const form = new FormData();
      form.append('chat_id', chatId);
      const media = photoPaths.map((p, i) => {
        const field = `file${i}`;
        form.append(field, new Blob([fs.readFileSync(p)]), path.basename(p));
        const item = { type: 'photo', media: `attach://${field}` };
        if (i === 0 && caption) {
          item.caption = caption;
          if (parseMode) item.parse_mode = parseMode;
        }
        return item;
      });
      form.append('media', JSON.stringify(media));
      const res = await fetch(`${API}/bot${token}/sendMediaGroup`, { method: 'POST', body: form });
      const data = await res.json();
      if (!data.ok) throw new Error('sendMediaGroup 错误: ' + (data.description || res.status));
      channelPostId = data.result?.[0]?.message_id;
    } else {
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('photo', new Blob([fs.readFileSync(photoPaths[0])]), path.basename(photoPaths[0]));
      if (caption) form.append('caption', caption);
      if (caption && parseMode) form.append('parse_mode', parseMode);
      const res = await fetch(`${API}/bot${token}/sendPhoto`, { method: 'POST', body: form });
      const data = await res.json();
      if (!data.ok) throw new Error('sendPhoto 错误: ' + (data.description || res.status));
      channelPostId = data.result?.message_id;
    }

    // 2) 找讨论组
    const groupId = await getLinkedChatId(token, chatId);
    if (!groupId) {
      // 频道没绑讨论组:视频只能直接发频道兜底
      const r = await sendVideoFile({ token, chatId, filePath: videoPath });
      return { skipped: false, channelPostId, commented: false, mode: 'fallback-no-discussion', videoMessageId: r.messageId };
    }

    // 3) 抓自动转发进讨论组的那条帖子
    const discussionMsgId = await waitForForwardedPost({ token, groupId, channelPostId });

    // 4) 视频作为评论发到讨论组(抓不到转发消息就不带 reply,直接发讨论组)。
    //    发讨论组失败(通常是 bot 还没被拉进讨论组)→ 兜底把视频发回频道,内容不丢。
    try {
      const r = await sendVideoFile({
        token, chatId: groupId, filePath: videoPath,
        replyToMessageId: discussionMsgId || undefined,
      });
      return {
        skipped: false, channelPostId, videoMessageId: r.messageId,
        commented: Boolean(discussionMsgId),
        mode: discussionMsgId ? 'comment' : 'discussion-no-reply',
      };
    } catch (e) {
      console.error('[telegram] 视频发讨论组失败,改发回频道:', e.message);
      const r = await sendVideoFile({ token, chatId, filePath: videoPath });
      return { skipped: false, channelPostId, videoMessageId: r.messageId, commented: false, mode: 'fallback-video-to-channel', note: e.message };
    }
  } finally {
    release();
  }
}
