// 对接外部视频站(hanimepro)管理后台的评论审核接口。
import { adminConfigured, adminCall } from './adminClient.js';
import db from '../db.js';

const insertLog = db.prepare(
  'INSERT INTO comment_review_log (source, item_id, action, reason) VALUES (?, ?, ?, ?)'
);
function logReview(sourceKey, ids, action, reason) {
  const tx = db.transaction((idList) => {
    for (const id of idList) insertLog.run(sourceKey, id, action, reason || '');
  });
  tx(ids);
}

// book 等无审核队列的模块,后台只会返回「最近发布」的评论,AI 判过「通过」的也不会消失。
// 用我们自己记的审核日志过滤掉已经处理过的,避免重复审核、看起来像没生效。
function getReviewedIdSet(sourceKey) {
  const rows = db.prepare('SELECT DISTINCT item_id FROM comment_review_log WHERE source = ?').all(sourceKey);
  return new Set(rows.map((r) => r.item_id));
}

// 我们自己审核过的记录(不是问后台的状态,是本地日志),给"已审核"这个视图用,
// 避免用户搞不清哪些已经处理过、重复点一遍。
export function listReviewLog(sourceKey, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const rows = db.prepare(
    'SELECT item_id AS id, action, reason, created_at FROM comment_review_log WHERE source = ? ORDER BY id DESC LIMIT ? OFFSET ?'
  ).all(sourceKey, limit, offset);
  const total = db.prepare('SELECT COUNT(*) AS n FROM comment_review_log WHERE source = ?').get(sourceKey).n;
  return { list: rows, total };
}

// 当天(按北京时间 UTC+8 折算)评论审核汇总:总数/通过/拒绝,以及按模块拆分。
export function getTodayReviewStats() {
  const rows = db.prepare(`
    SELECT source, action, COUNT(*) AS n
    FROM comment_review_log
    WHERE date(created_at, '+8 hours') = date('now', '+8 hours')
    GROUP BY source, action
  `).all();
  const bySource = {};
  let passed = 0, rejected = 0;
  for (const r of rows) {
    if (!bySource[r.source]) bySource[r.source] = { source: r.source, passed: 0, rejected: 0 };
    if (r.action === 'pass') { bySource[r.source].passed += r.n; passed += r.n; }
    else { bySource[r.source].rejected += r.n; rejected += r.n; }
  }
  return {
    total: passed + rejected,
    passed,
    rejected,
    bySource: Object.values(bySource).map((s) => ({
      ...s,
      label: SOURCES[s.source]?.label || s.source,
      total: s.passed + s.rejected,
    })),
  };
}

// 后台目前有 4 个评论模块。mv/post/porn 三个有「未审核→通过」的审核队列(通过还是走 doPass/passAll);
// book(书评)没有审核队列,评论发出即可见。四个模块的「拒绝」现在统一是删除(见 rejectComment 的说明)。
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

export const commentAdminConfigured = adminConfigured;
const call = adminCall;

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
  let list = (data.data || []).map((raw) => normalize(sourceKey, cfg, raw));
  if (!cfg.hasApprovalFlow) {
    const reviewed = getReviewedIdSet(sourceKey);
    list = list.filter((c) => !reviewed.has(c.id));
  }
  return { list, total: data.count || 0, hasApprovalFlow: cfg.hasApprovalFlow, label: cfg.label };
}

// reason 只是给本地日志用(方便在"已审核记录"里看到 AI 给的理由),不会传给后台。
export async function passComment(sourceKey, id, reason) {
  const cfg = sourceConfig(sourceKey);
  if (!cfg.hasApprovalFlow) throw new Error(`${cfg.label}没有审核队列,不需要「通过」`);
  const r = await call(`/admin/${cfg.resource}/doPass`, { method: 'POST', body: { id } });
  logReview(sourceKey, [id], 'pass', reason);
  return r;
}

export async function passComments(sourceKey, ids, reason) {
  const cfg = sourceConfig(sourceKey);
  if (!cfg.hasApprovalFlow) throw new Error(`${cfg.label}没有审核队列,不需要「通过」`);
  const r = await call(`/admin/${cfg.resource}/passAll`, { method: 'POST', body: { ids: ids.join(',') } });
  logReview(sourceKey, ids, 'pass', reason);
  return r;
}

// 「拒绝」统一 = 直接删除。之前 mv/post/porn 用的 doReject/batchRefuse 接口调用能成功(200),
// 但实测不会真的把评论从前台隐藏(拒绝原因也不落地),等于没生效——书评那边的删除倒是真实验证过有效,
// 所以四个模块全部统一走删除,批量也不再猜从没验证过的 delAll,一律逐条删除保证真的生效。
export async function rejectComment(sourceKey, id, reason) {
  const cfg = sourceConfig(sourceKey);
  const r = await call(`/admin/${cfg.resource}/del`, { method: 'POST', body: { _pk: id } });
  logReview(sourceKey, [id], 'reject', reason);
  return r;
}

export async function rejectComments(sourceKey, ids, reason) {
  const cfg = sourceConfig(sourceKey);
  let r;
  for (const id of ids) {
    r = await call(`/admin/${cfg.resource}/del`, { method: 'POST', body: { _pk: id } });
  }
  logReview(sourceKey, ids, 'reject', reason);
  return r;
}
