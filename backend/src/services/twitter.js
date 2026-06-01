import { TwitterApi } from 'twitter-api-v2';

function creds() {
  return {
    appKey: process.env.X_API_KEY || '',
    appSecret: process.env.X_API_SECRET || '',
    accessToken: process.env.X_ACCESS_TOKEN || '',
    accessSecret: process.env.X_ACCESS_SECRET || '',
  };
}

export function twitterConfigured() {
  const c = creds();
  return Boolean(c.appKey && c.appSecret && c.accessToken && c.accessSecret);
}

function client() {
  const c = creds();
  if (!twitterConfigured()) throw new Error('未配置 X API 密钥(需要 4 个值)');
  return new TwitterApi(c);
}

// 验证凭据:返回当前授权账号
export async function testTwitter() {
  const me = await client().v2.me();
  return { username: me.data?.username, name: me.data?.name, id: me.data?.id };
}

// 发推
export async function postTweet(text) {
  const t = (text || '').trim();
  if (!t) throw new Error('推文内容不能为空');
  if (t.length > 280) throw new Error(`推文超过 280 字符(当前 ${t.length}）`);
  const res = await client().v2.tweet(t);
  const id = res.data?.id;
  return { id, url: id ? `https://x.com/i/web/status/${id}` : null };
}
