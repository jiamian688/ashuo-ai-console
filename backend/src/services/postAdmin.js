// 对接管理后台「资源管理 → 帖子管理」的帖子审核接口。
import { adminCall } from './adminClient.js';
import db from '../db.js';

const insertLog = db.prepare(
  'INSERT INTO post_review_log (item_id, action, reason) VALUES (?, ?, ?)'
);
function logReview(id, action, reason) {
  insertLog.run(id, action, reason || '');
}

// 当天(按北京时间 UTC+8 折算)帖子审核汇总:总数/通过/拒绝。
export function getTodayPostStats() {
  const rows = db.prepare(`
    SELECT action, COUNT(*) AS n
    FROM post_review_log
    WHERE date(created_at, '+8 hours') = date('now', '+8 hours')
    GROUP BY action
  `).all();
  let passed = 0, rejected = 0;
  for (const r of rows) {
    if (r.action === 'pass') passed = r.n;
    else rejected = r.n;
  }
  return { total: passed + rejected, passed, rejected };
}

function normalize(raw) {
  const imgs = (raw.show_imgs || []).filter((m) => m.cover_url).map((m) => m.cover_url);
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content,
    status: raw.status,
    statusStr: raw.status_str,
    refuseReason: raw.refuse_reason || '',
    topics: raw.topics || '',
    type: raw.type,
    typeStr: raw.type_str,
    unlockCoins: raw.unlock_coins,
    nickname: raw.member_nickname || '',
    thumbUrl: imgs[0] || '',
    images: imgs,
    photoNum: raw.photo_num || 0,
    videoNum: raw.video_num || 0,
    createdAt: raw.created_at,
    auditorName: raw.auditor_name || '',
  };
}

// status: 0=待审核 1=已通过 2=未通过;不传时只拉待审核
export async function listPosts({ page = 1, limit = 20, status } = {}) {
  const params = { page, limit, status: status === undefined || status === '' ? 0 : status };
  const data = await adminCall('/admin/post/listAjax', { params });
  const list = (data.data || []).map(normalize);
  return { list, total: data.count || 0 };
}

export async function passPost(id) {
  const r = await adminCall('/admin/post/pass', { method: 'POST', body: { _pk: id } });
  logReview(id, 'pass');
  return r;
}

export async function rejectPost(id, reason) {
  const r = await adminCall('/admin/post/refuseUserUpload', { method: 'POST', body: { _pk: id, status: 2, refused: reason || '' } });
  logReview(id, 'reject', reason);
  return r;
}
