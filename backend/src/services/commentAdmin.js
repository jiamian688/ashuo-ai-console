// 对接外部视频站(hanimepro)管理后台的评论审核接口。
// 鉴权用管理后台自己的 Bearer token(在浏览器登录后从开发者工具里复制),
// 存在 HANIME_ADMIN_TOKEN 里 —— 这是用户自己的会话凭证,后端只是原样转发,不做任何存储之外的处理。
const BASE = process.env.HANIME_ADMIN_BASE_URL || 'https://sf-10-hanimepro-ht.zcxyprod.cc';

// 后台目前有 4 个评论模块。mv/post/porn 三个走「未审核→通过/拒绝」的审核队列;
// book(书评)后台没有审核队列,评论发出即可见,唯一的管理手段是删除,所以拒绝=删除。
const SOURCES = {
  mv: { resource: 'mvcomment', label: '视频评论', contentField: 'content', titleField: 'mv_title', hasApprovalFlow: true },
  post: { resource: 'postcomment', label: '社区评论', contentField: 'comment', titleField: null, hasApprovalFlow: true },
  porn: { resource: 'porncomment', label: '黄游评论', contentField: 'comment', titleField: 'porn_name', hasApprovalFlow: true },
  book: { resource: 'bookcomment', label: '书评', contentField: 'content', titleField: 'book_name', hasApprovalFlow: false },
};

function sourceConfig(key) {
  const cfg = SOURCES[key];
  if (!cfg) throw new Error('未知的评论来源: ' + key);
  return cfg;
}

export function listSources() {
  return Object.entries(SOURCES).map(([key, v]) => ({ key, label: v.label, hasApprovalFlow: v.hasApprovalFlow }));
}

export function commentAdminConfigured() {
  return Boolean(process.env.HANIME_ADMIN_TOKEN);
}

async function call(path, { method = 'GET', params, body } = {}) {
  const token = process.env.HANIME_ADMIN_TOKEN;
  if (!token) throw new Error('未配置评论审核后台 token(需在 backend/.env 填 HANIME_ADMIN_TOKEN)');

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

function normalize(sourceKey, cfg, raw) {
  return {
    id: raw.id,
    source: sourceKey,
    content: raw[cfg.contentField] || '',
    title: cfg.titleField ? raw[cfg.titleField] || '' : '',
    nickname: raw.nickname || raw.username || '',
    status: raw.status,
    refuse_reason: raw.refuse_reason || '',
    created_at: raw.created_at,
  };
}

// status: 未提供时,有审核队列的模块默认只拉「未审核」(0);book 没有审核队列,拉全部最新的。
export async function listComments(sourceKey, { page = 1, limit = 20, status } = {}) {
  const cfg = sourceConfig(sourceKey);
  const params = { page, limit };
  if (cfg.hasApprovalFlow) {
    params.status = status === undefined || status === '' ? 0 : status;
  }
  const data = await call(`/admin/${cfg.resource}/listAjax`, { params });
  const list = (data.data || []).map((raw) => normalize(sourceKey, cfg, raw));
  return { list, total: data.count || 0, hasApprovalFlow: cfg.hasApprovalFlow, label: cfg.label };
}

export async function passComment(sourceKey, id) {
  const cfg = sourceConfig(sourceKey);
  if (!cfg.hasApprovalFlow) throw new Error(`${cfg.label}没有审核队列,不需要「通过」`);
  return call(`/admin/${cfg.resource}/doPass`, { method: 'POST', body: { id } });
}

export async function passComments(sourceKey, ids) {
  const cfg = sourceConfig(sourceKey);
  if (!cfg.hasApprovalFlow) throw new Error(`${cfg.label}没有审核队列,不需要「通过」`);
  return call(`/admin/${cfg.resource}/passAll`, { method: 'POST', body: { ids: ids.join(',') } });
}

// 有审核队列的模块:「拒绝」= 打回并记录原因;book 没有审核队列:「拒绝」= 直接删除。
export async function rejectComment(sourceKey, id, reason) {
  const cfg = sourceConfig(sourceKey);
  if (cfg.hasApprovalFlow) {
    return call(`/admin/${cfg.resource}/doReject`, { method: 'POST', body: { id, refused: reason || '' } });
  }
  return call(`/admin/${cfg.resource}/del`, { method: 'POST', body: { _pk: id } });
}

export async function rejectComments(sourceKey, ids, reason) {
  const cfg = sourceConfig(sourceKey);
  if (cfg.hasApprovalFlow) {
    return call(`/admin/${cfg.resource}/batchRefuse`, { method: 'POST', body: { comment_ids: ids.join(','), refused: reason || '' } });
  }
  return call(`/admin/${cfg.resource}/delAll`, { method: 'POST', body: { value: ids.join(',') } });
}
