// 共享的管理后台(hanimepro)HTTP 客户端。
// 鉴权用管理后台自己的 Bearer token(在浏览器登录后从开发者工具里复制),
// 存在 HANIME_ADMIN_TOKEN 里 —— 这是用户自己的会话凭证,后端只是原样转发,不做任何存储之外的处理。
const BASE = process.env.HANIME_ADMIN_BASE_URL || 'https://sf-10-hanimepro-ht.zcxyprod.cc';

export function adminConfigured() {
  return Boolean(process.env.HANIME_ADMIN_TOKEN);
}

export async function adminCall(path, { method = 'GET', params, body } = {}) {
  const token = process.env.HANIME_ADMIN_TOKEN;
  if (!token) throw new Error('未配置管理后台 token(需在 backend/.env 填 HANIME_ADMIN_TOKEN)');

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
  if (data.code !== 0) throw new Error(data.msg || `管理后台请求失败 (${resp.status})`);
  return data;
}
