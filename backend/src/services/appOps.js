// 对接管理后台「用户管理→用户列表」「财务管理→订单列表」「财务管理→上下分」。
// 接口路径和参数抓自后台前端代码:列表统一是 page/limit + where[字段]=值。
import { adminCall } from './adminClient.js';

// 只把有值的筛选条件拼成 where[...] 参数
function buildParams({ page = 1, limit = 20 }, where) {
  const params = { page, limit };
  for (const [field, value] of Object.entries(where)) {
    if (value !== undefined && value !== null && value !== '') params[`where[${field}]`] = value;
  }
  return params;
}

const num = (v) => Number(v ?? 0);

// 用户列表这个接口要带 X-Requested-With 才返回 JSON(后台前端也是这么调的)
export async function listMembers({ page, limit, aff, affCode, uuid, nickname, oauthType } = {}) {
  const data = await adminCall('/admin/members/index', {
    params: buildParams({ page, limit }, { aff, aff_code: affCode, uuid, nickname, oauth_type: oauthType }),
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  const list = (data.data || []).map((m) => ({
    uid: num(m.uid),
    aff: num(m.aff),
    affCode: m.aff_str || m.aff_code || '',
    uuid: m.uuid || '',
    nickname: m.nickname || '',
    username: m.username || '',
    thumbUrl: m.thumb || m.thumb_url || '',
    oauthType: m.oauth_type || '',
    appVersion: m.app_version || '',
    channel: m.channel || '',
    regip: m.regip || '',
    regdate: m.regdate || '',
    lastactivity: m.lastactivity || '',
    invitedNum: num(m.invited_num),
    invitedByStr: m.invited_by_str || '',
    authStatusStr: m.auth_status_str || '',
    money: num(m.money),
    chatMoney: num(m.chat_money),
    proxyMoney: num(m.proxy_money),
    roleStr: m.role_str || '',
    vipLevelStr: m.vip_level_str || '',
    expiredAt: m.expired_at || '',
  }));
  return { list, total: data.count || 0 };
}

// status: 0=待支付 2=支付中 3=支付成功 99=支付失败
export async function listOrders({ page, limit, affCode, uuid, orderId, status, oauthType, dateFrom, dateTo } = {}) {
  const params = buildParams({ page, limit }, {
    'orders.aff_code': affCode,
    'orders.uuid': uuid,
    'orders.order_id': orderId,
    'orders.status': status,
    'orders.oauth_type': oauthType,
  });
  if (dateFrom) params['between[orders.created_at][from]'] = `${dateFrom} 00:00:00`;
  if (dateTo) params['between[orders.created_at][to]'] = `${dateTo} 23:59:59`;
  params.sort = 'orders.created_at';
  params.order = 'desc';
  const data = await adminCall('/admin/orders/listAjax', { params });
  const list = (data.data || []).map((o) => ({
    id: o.id,
    orderId: o.order_id || '',
    appOrder: o.app_order || '',
    aff: o.aff ?? '',
    nickname: o.nickname || '',
    productName: o.product_name || '',
    descp: o.descp || '',
    amount: num(o.amount) / 100,
    payAmount: num(o.pay_amount) / 100,
    status: num(o.status),
    statusStr: o.status_str || '',
    oauthType: o.oauth_type || '',
    channel: o.channel || '',
    createdAt: o.created_at || '',
    paidAt: o.paid_at || '',
  }));
  return { list, total: data.count || 0 };
}

// type: 1=下分 2=上分;scoreType: 1=金币 2=积分 3=裸聊金币
export async function listCharges({ page, limit, toAff, type } = {}) {
  const data = await adminCall('/admin/chargeadmin/listAjax', {
    params: buildParams({ page, limit }, { to_aff: toAff, type }),
  });
  const list = (data.data || []).map((c) => ({
    id: c.id,
    toAff: c.to_aff,
    admin: c.admin || '',
    score: num(c.score),
    scoreTypeStr: c.score_type_str || '',
    type: num(c.type),
    typeStr: c.type_str || '',
    des: c.des || '',
    addtime: c.addtime || '',
  }));
  return { list, total: data.count || 0 };
}

export async function saveCharge({ toAff, score, scoreType, type, des, logDesc }) {
  return adminCall('/admin/chargeadmin/save', {
    method: 'POST',
    form: true,
    body: { to_aff: toAff, score, score_type: scoreType, type, des: des || '', logDesc: logDesc || des || '' },
  });
}

// ---------- 用户管理→兑换码 ----------
// status: 1=可用 0=已使用
export async function listExchangeCodes({ page, limit, code, status, productId } = {}) {
  const params = buildParams({ page, limit }, { status, product_id: productId });
  if (code) params['search[code]'] = code;
  const data = await adminCall('/admin/exchangecode/listAjax', { params });
  const list = (data.data || []).map((c) => ({
    id: c.id,
    code: String(c.code || '').replace(/<[^>]*>/g, '').trim(), // 后台返回的是 <pre class='red'>码</pre>
    productId: c.product_id,
    productName: c.product_name || '',
    validDate: num(c.valid_date),
    status: num(c.status),
    statusStr: c.status_str || '',
    expiredAt: c.expired_at || '',
    usedAt: c.used_at || '',
    createdAt: c.created_at || '',
  }));
  return { list, total: data.count || 0 };
}

// 生成兑换码时选产品用:后台自己也是一次拉 500 条全部产品
export async function listProducts() {
  const data = await adminCall('/admin/product/listAjax', { params: { page: 1, limit: 500 } });
  return (data.data || []).map((p) => ({ id: p.id, name: p.pname || `产品 ${p.id}`, status: num(p.status) }));
}

// 后台不直接返回兑换码数组,而是返回一段 html,码是里面 20 位的大写十六进制串
export async function generateExchangeCodes({ productId, qty, expiredAt }) {
  const body = { product_id: productId, generate_qty: qty };
  if (expiredAt) body.expired_at = `${expiredAt} 23:59:59`;
  const data = await adminCall('/admin/exchangecode/save', { method: 'POST', form: true, body });
  return (data.data?.html || '').match(/\b[A-F0-9]{20}\b/g) || [];
}

export async function deleteExchangeCode(id) {
  return adminCall('/admin/exchangecode/del', { method: 'POST', form: true, body: { _pk: id } });
}

export async function listExchangeLogs({ page, limit, code, aff } = {}) {
  const data = await adminCall('/admin/exchangecodelog/listAjax', {
    params: buildParams({ page, limit }, { exchange_code: code, aff }),
  });
  const list = (data.data || []).map((l) => ({
    id: l.id,
    aff: l.aff,
    code: String(l.exchange_code || '').replace(/<[^>]*>/g, '').trim(),
    remark: l.remark || '',
    statusStr: l.status_str || '',
    createdAt: l.created_at || '',
  }));
  return { list, total: data.count || 0 };
}
