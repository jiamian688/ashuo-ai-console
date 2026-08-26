// 对接管理后台「数据统计 → 每日报告」接口,取经营数据(收入/注册/日活/留存)。
import { adminCall } from './adminClient.js';

function normalize(raw) {
  return {
    date: raw.date,
    // 用户
    newUsers: raw.total_register,
    newAndroid: raw.total_android_installation,
    newWeb: raw.total_web_installation,
    activeTotal: raw.total_active,
    activeAndroid: raw.total_android_active,
    activeWeb: raw.total_web_active,
    inviteUsers: raw.invite_user,
    registerIp: raw.reg_ip,
    activeIp: raw.active_ip,
    retainIp: raw.retain_ip,
    // 留存
    keep1day: raw.keep_1day,
    keep1dayRate: raw.keep_1day_rate,
    keep3day: raw.keep_3day,
    keep3dayRate: raw.keep_3day_rate,
    keep7day: raw.keep_7day,
    keep7dayRate: raw.keep_7day_rate,
    // 收入
    rechargeAmount: raw.total_recharge_amount,
    oldPayTotal: raw.old_pay_total,
    vipRechargeAmount: raw.total_vip_recharge_amount,
    coinRechargeAmount: raw.total_coin_recharge_amount,
    invitedCharge: raw.invited_charge,
    rechargeCount: raw.total_recharge_count,
    rechargeSuccessCount: raw.total_recharge_success_count,
    rechargeSuccessRate: raw.total_recharge_success_rate,
    payingUsers: raw.number_of_user_paid,
    regPayUser: raw.reg_pay_user,
    arpu: raw.arpu,
    arppu: raw.arppu,
  };
}

// 财务管理→订单列表按天筛选「设备=android」拿当天下单量(不筛状态,和「拉单量」口径一致:所有下单,不只成功的)。
async function getAndroidOrderCount(date) {
  const data = await adminCall('/admin/orders/listAjax', {
    params: {
      page: 1,
      limit: 1,
      'where[orders.oauth_type]': 'android',
      'between[orders.created_at][from]': `${date} 00:00:00`,
      'between[orders.created_at][to]': `${date} 23:59:59`,
    },
  });
  return data.count || 0;
}

// 后台按日期倒序返回,limit 条 = 最近 limit 天
export async function listDailyReports({ limit = 30 } = {}) {
  const data = await adminCall('/admin/dailyreport/listAjax', { params: { page: 1, limit } });
  const list = (data.data || []).map(normalize);
  const androidCounts = await Promise.all(
    list.map((d) => getAndroidOrderCount(d.date).catch(() => null))
  );
  list.forEach((d, i) => { d.androidOrderCount = androidCounts[i]; });
  return { list, total: data.count || 0 };
}

// 后台首页「今日关键指标」,格式是现成的 [{name, number}] 中文展示对,原样透传即可。
export async function getTodayStats() {
  const data = await adminCall('/admin/index/panelDataAjax');
  return data.data || [];
}
