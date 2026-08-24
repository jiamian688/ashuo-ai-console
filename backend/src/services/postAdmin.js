// 对接管理后台「资源管理 → 帖子管理」的帖子审核接口。
import { adminCall } from './adminClient.js';

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
  return adminCall('/admin/post/doPass', { method: 'POST', body: { id } });
}

export async function rejectPost(id, reason) {
  return adminCall('/admin/post/doReject', { method: 'POST', body: { id, refused: reason || '' } });
}
