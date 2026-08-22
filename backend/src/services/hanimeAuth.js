// 用账号+密码+TOTP(谷歌验证器)动态验证码,自动登录 hanimepro 管理后台换取新 token。
// TOTP 算法见 RFC 6238,和 Google Authenticator / Authy 完全兼容,不需要额外依赖。
import crypto from 'crypto';

const BASE = process.env.HANIME_ADMIN_BASE_URL || 'https://sf-10-hanimepro-ht.zcxyprod.cc';

function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of base32.replace(/=+$/, '').toUpperCase()) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTOTP(secret, { step = 30, digits = 6 } = {}) {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

export function autoLoginConfigured() {
  return Boolean(
    process.env.HANIME_ADMIN_USERNAME && process.env.HANIME_ADMIN_PASSWORD && process.env.HANIME_ADMIN_TOTP_SECRET
  );
}

// 返回新 token(来自响应头 x-admin-token),失败抛错
export async function loginAndGetToken() {
  const username = process.env.HANIME_ADMIN_USERNAME;
  const password = process.env.HANIME_ADMIN_PASSWORD;
  const secret = process.env.HANIME_ADMIN_TOTP_SECRET;
  if (!username || !password || !secret) {
    throw new Error('未配置 HANIME_ADMIN_USERNAME/PASSWORD/TOTP_SECRET,无法自动登录管理后台');
  }
  const card_num = generateTOTP(secret);
  const body = new URLSearchParams({ username, password, card_num });
  const resp = await fetch(`${BASE}/admin/login/doLogin`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const token = resp.headers.get('x-admin-token');
  const data = await resp.json().catch(() => ({}));
  if (!token || data.code !== 0) {
    throw new Error(data.msg || `自动登录管理后台失败 (${resp.status})`);
  }
  return token;
}
