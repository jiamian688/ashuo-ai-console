// 共享的管理后台(hanimepro)HTTP 客户端。
// 优先用账号+密码+TOTP 自动登录换 token(见 hanimeAuth.js),token 只存在内存里、
// 2 小时左右会过期,过期时自动重新登录重试一次;没配自动登录的话退回读 HANIME_ADMIN_TOKEN 静态值。
//
// 安全阀:真正发起登录请求这一步有冷却时间限制(见 LOGIN_COOLDOWN_MS),不管多少个请求
// 同时失败、不管失败原因是不是登录问题,冷却期内最多只会真的去敲一次登录接口 —— 之前就是
// 因为没有这个限制,短时间内触发了多次登录尝试,把对方账号防爆破锁定了,这里加上避免重蹈覆辙。
import { autoLoginConfigured, loginAndGetToken } from './hanimeAuth.js';

const BASE = process.env.HANIME_ADMIN_BASE_URL || 'https://sf-10-hanimepro-ht.zcxyprod.cc';
const LOGIN_COOLDOWN_MS = 60_000;

let cachedToken = process.env.HANIME_ADMIN_TOKEN || null;
let loginPromise = null;
let lastLoginAttempt = 0;
let lastLoginError = null;

export function adminConfigured() {
  return Boolean(cachedToken) || autoLoginConfigured();
}

async function login() {
  if (loginPromise) return loginPromise;

  const now = Date.now();
  if (lastLoginError && now - lastLoginAttempt < LOGIN_COOLDOWN_MS) {
    // 冷却期内不再真的发请求,直接复用上一次的失败,避免反复触发对方的防爆破锁定
    throw lastLoginError;
  }

  lastLoginAttempt = now;
  loginPromise = loginAndGetToken()
    .then((token) => {
      cachedToken = token;
      lastLoginError = null;
      return token;
    })
    .catch((err) => {
      lastLoginError = err;
      throw err;
    })
    .finally(() => {
      loginPromise = null;
    });
  return loginPromise;
}

async function ensureToken() {
  if (cachedToken) return cachedToken;
  if (!autoLoginConfigured()) {
    throw new Error('未配置管理后台 token(需在 backend/.env 填 HANIME_ADMIN_TOKEN,或填 HANIME_ADMIN_USERNAME/PASSWORD/TOTP_SECRET 用自动登录)');
  }
  return login();
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

  // token 过期/失效时 code 不为 0;如果配了自动登录,换新 token 重试一次(真正登录动作受上面的冷却限制)。
  if (data.code !== 0 && autoLoginConfigured()) {
    cachedToken = null;
    try {
      const freshToken = await login();
      ({ resp, data } = await callWithToken(path, options, freshToken));
    } catch (loginErr) {
      // 登录本身失败(含冷却中):把原始业务错误和登录错误都带出去,方便判断到底是哪一步的问题
      throw new Error(`${data.msg || '请求失败'}(重新登录也失败: ${loginErr.message})`);
    }
  }

  if (data.code !== 0) throw new Error(data.msg || `管理后台请求失败 (${resp.status})`);
  return data;
}
