// 对接管理后台「资源管理 → 帖子管理」的帖子审核接口。
import { adminCall, adminUploadFile } from './adminClient.js';
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

// 帖子图片走单独的上传接口(multipart),拿到的 url 才是 /admin/post/save 里 video_img 要传的值。
export async function uploadPostImage(buffer, filename, mimetype) {
  const data = await adminUploadFile(buffer, filename, mimetype);
  return data.url;
}

// 管理员直接发帖:字段抓自后台"帖子管理→+ 添加"表单实际提交的请求。
// set_top/sort/is_best/is_deleted/is_open 这几个跟表单默认值保持一致;
// is_finished/status 固定为 1(已完成/已通过),因为是管理员直接发布,不走用户审核流程。
export async function createPost({ title, content, aff, categoryId, type = 0, unlockCoins = 0, videoImg = '' }) {
  return adminCall('/admin/post/save', {
    method: 'POST',
    body: {
      title,
      aff,
      category_id: categoryId,
      content,
      video_img: videoImg,
      set_top: 0,
      sort: 0,
      type,
      unlock_coins: unlockCoins,
      is_best: 0,
      is_deleted: 0,
      is_finished: 1,
      status: 1,
      is_open: 0,
    },
  });
}
