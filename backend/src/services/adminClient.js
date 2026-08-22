// 共享的管理后台(hanimepro)HTTP 客户端。
// 优先用账号+密码+TOTP 自动登录换 token(见 hanimeAuth.js),token 只存在内存里、
// 2 小时左右会过期,过期时自动重新登录重试一次;没配自动登录的话退回读 HANIME_ADMIN_TOKEN 静态值。
import { autoLoginConfigured, loginAndGetToken } from './hanimeAuth.js';

const BASE = process.env.HANIME_ADMIN_BASE_URL || 'https://sf-10-hanimepro-ht.zcxyprod.cc';

let cachedToken = process.env.HANIME_ADMIN_TOKEN || null;
let loginPromise = null;

export function adminConfigured() {
  return Boolean(cachedToken) || autoLoginConfigured();
}

async function ensureToken() {
  if (cachedToken) return cachedToken;
  if (!autoLoginConfigured()) {
    throw new Error('未配置管理后台 token(需在 backend/.env 填 HANIME_ADMIN_TOKEN,或填 HANIME_ADMIN_USERNAME/PASSWORD/TOTP_SECRET 用自动登录)');
  }
  if (!loginPromise) {
    loginPromise = loginAndGetToken().finally(() => { loginPromise = null; });
  }
  cachedToken = await loginPromise;
  return cachedToken;
}

async function callWithToken(path, { method = 'GET', params, body } = {}, token) {
  let url = `${BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }
  const resp = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json().catch(() => ({}));
  return { resp, data };
}

export async function adminCall(path, options = {}) {
  const token = await ensureToken();
  let { resp, data } = await callWithToken(path, options, token);

  // token 过期/失效时 code 不为 0;如果配了自动登录,强制换新 token 重试一次。
  if (data.code !== 0 && autoLoginConfigured()) {
    cachedToken = null;
    const freshToken = await ensureToken();
    ({ resp, data } = await callWithToken(path, options, freshToken));
  }

  if (data.code !== 0) throw new Error(data.msg || `管理后台请求失败 (${resp.status})`);
  return data;
}
