import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

// 纯前端诊断:复用 /business-data/daily 的每日报告,不额外调后端。
// 口径:keep*Rate / rechargeSuccessRate 已是百分数(如 4.60);arpu 是比值(如 0.71)。
// 当前阶段没有付费投放渠道,新增主要来自自然量 / 邀请,心得据此聚焦「留存 + 付费漏斗 + 内容活动」。

const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const sum = (a) => a.reduce((s, v) => s + v, 0);
const pct = (a, b) => (b ? (a / b) * 100 : 0);
const fmtNum = (n) => Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const fmt1 = (n) => (Number(n) || 0).toFixed(1);
const fmt2 = (n) => (Number(n) || 0).toFixed(2);
const fmt3 = (n) => (Number(n) || 0).toFixed(3);

// 环比文案:num 走百分比,pp 走百分点
const chgNum = (c, p) => {
  if (!p) return { txt: '—', sign: 0 };
  const x = ((c - p) / p) * 100;
  if (Math.abs(x) < 3) return { txt: '持平', sign: 0 };
  return { txt: `${x > 0 ? '+' : ''}${x.toFixed(0)}%`, sign: Math.sign(x) };
};
const chgPP = (c, p) => {
  const x = c - p;
  if (Math.abs(x) < 0.3) return { txt: '持平', sign: 0 };
  return { txt: `${x > 0 ? '+' : ''}${x.toFixed(1)}pp`, sign: Math.sign(x) };
};

const LEVEL = {
  high: { border: '#e0446c', bg: 'rgba(224,68,108,0.10)', tag: '严重', color: '#e0446c' },
  mid: { border: '#f59e0b', bg: 'rgba(245,158,11,0.12)', tag: '关注', color: '#f59e0b' },
  info: { border: '#3b6fe0', bg: 'rgba(59,111,224,0.12)', tag: '提示', color: '#3b6fe0' },
  good: { border: '#16a34a', bg: 'rgba(22,163,74,0.12)', tag: '正常', color: '#16a34a' },
};

function Spark({ data, w = 240, h = 40, color = 'var(--primary)' }) {
  const v = data.map((x) => (Number.isFinite(x) ? x : 0));
  if (v.length < 2) return null;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  const step = w / (v.length - 1);
  const pts = v.map((x, i) => [i * step, h - 4 - ((x - min) / span) * (h - 8)]);
  const dAttr = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%' }}>
      <path d={dAttr} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  );
}

// 把一组日报聚合成合计口径,再统一派生指标
function aggregate(arr) {
  const s = (k) => sum(arr.map((r) => num(r[k])));
  const a = {
    _n: arr.length || 1,
    newUsers: s('newUsers'), newAndroid: s('newAndroid'), newWeb: s('newWeb'), inviteUsers: s('inviteUsers'),
    activeTotal: s('activeTotal'), activeAndroid: s('activeAndroid'), activeWeb: s('activeWeb'),
    registerIp: s('registerIp'), activeIp: s('activeIp'),
    keep1day: s('keep1day'), keep3day: s('keep3day'), keep7day: s('keep7day'),
    rechargeAmount: s('rechargeAmount'), vipRechargeAmount: s('vipRechargeAmount'),
    coinRechargeAmount: s('coinRechargeAmount'), oldPayTotal: s('oldPayTotal'), invitedCharge: s('invitedCharge'),
    rechargeCount: s('rechargeCount'), rechargeSuccessCount: s('rechargeSuccessCount'),
    payingUsers: s('payingUsers'), regPayUser: s('regPayUser'),
  };
  const oldActive = Math.max(a.activeTotal - a.newUsers, 0);
  const paidOld = Math.max(a.payingUsers - a.regPayUser, 0);
  const newRev = a.rechargeAmount - a.oldPayTotal;
  // 成功订单没有按新老用户拆的字段,按「付费人数占比」估算拆分
  const succOrders = a.rechargeSuccessCount || a.rechargeCount || 0;
  const newPayOrders = a.payingUsers ? Math.round((succOrders * a.regPayUser) / a.payingUsers) : 0;
  const oldPayOrders = Math.max(succOrders - newPayOrders, 0);
  return {
    ...a, oldActive, paidOld, newRev, newPayOrders, oldPayOrders,
    newSpendPerPayer: a.regPayUser ? newRev / a.regPayUser : 0,
    oldSpendPerPayer: paidOld ? a.oldPayTotal / paidOld : 0,
    androidNewShare: pct(a.newAndroid, a.newUsers),
    webNewShare: pct(a.newWeb, a.newUsers),
    inviteShare: pct(a.inviteUsers, a.newUsers),
    oldActiveShare: pct(oldActive, a.activeTotal),
    newDauRatio: pct(a.newUsers, a.activeTotal),
    regPerIp: a.registerIp ? a.newUsers / a.registerIp : 0,
    activePerIp: a.activeIp ? a.activeTotal / a.activeIp : 0,
    keep1Rate: pct(a.keep1day, a.newUsers),
    keep3Rate: pct(a.keep3day, a.newUsers),
    keep7Rate: pct(a.keep7day, a.newUsers),
    retDecay: a.keep1day ? (a.keep7day / a.keep1day) * 100 : 0,
    pullRate: pct(a.rechargeCount, a.activeTotal),
    paySuccess: pct(a.payingUsers, a.rechargeCount),
    activePayRate: pct(a.payingUsers, a.activeTotal),
    day0PayRate: pct(a.regPayUser, a.newUsers),
    oldPayRate: pct(paidOld, oldActive),
    ordersPerPayer: a.payingUsers ? a.rechargeSuccessCount / a.payingUsers : 0,
    arpu: pct(a.rechargeAmount, a.activeTotal) / 100,
    arppu: a.payingUsers ? a.rechargeAmount / a.payingUsers : 0,
    newArpu: a.newUsers ? newRev / a.newUsers : 0,
    oldArpu: oldActive ? a.oldPayTotal / oldActive : 0,
    vipShare: pct(a.vipRechargeAmount, a.rechargeAmount),
    coinShare: pct(a.coinRechargeAmount, a.rechargeAmount),
    newRevShare: pct(newRev, a.rechargeAmount),
    oldRevShare: pct(a.oldPayTotal, a.rechargeAmount),
    fissionShare: pct(a.invitedCharge, a.rechargeAmount),
  };
}

// 明细表行定义:cell 取展示串;cmp+kind 用于算「近7 vs 前7」环比;goodUp 决定环比颜色(留空=不着色)
const perDay = (m, key) => m[key] / m._n;
const ROWS = [
  { grp: '用户与结构' },
  { label: '新增(日均)', cell: (m) => fmtNum(perDay(m, 'newUsers')), cmp: (m) => perDay(m, 'newUsers'), kind: 'num', goodUp: true },
  { label: '安卓注册 / 占比', sub: true, cell: (m) => `${fmtNum(perDay(m, 'newAndroid'))} · ${fmt1(m.androidNewShare)}%`, cmp: (m) => m.androidNewShare, kind: 'pp' },
  { label: 'H5 注册 / 占比', sub: true, cell: (m) => `${fmtNum(perDay(m, 'newWeb'))} · ${fmt1(m.webNewShare)}%`, cmp: (m) => m.webNewShare, kind: 'pp' },
  { label: '邀请带来 / 占新增', sub: true, cell: (m) => `${fmtNum(perDay(m, 'inviteUsers'))} · ${fmt1(m.inviteShare)}%`, cmp: (m) => m.inviteShare, kind: 'pp', goodUp: true },
  { label: '日活(日均)', cell: (m) => fmtNum(perDay(m, 'activeTotal')), cmp: (m) => perDay(m, 'activeTotal'), kind: 'num', goodUp: true },
  { label: '安卓 / H5 日活', sub: true, cell: (m) => `${fmtNum(perDay(m, 'activeAndroid'))} / ${fmtNum(perDay(m, 'activeWeb'))}` },
  { label: '老用户活跃 / 占日活', sub: true, cell: (m) => `${fmtNum(perDay(m, 'oldActive'))} · ${fmt1(m.oldActiveShare)}%`, cmp: (m) => m.oldActiveShare, kind: 'pp', goodUp: true },
  { label: '新增占日活比(导量依赖度)', cell: (m) => `${fmt1(m.newDauRatio)}%`, cmp: (m) => m.newDauRatio, kind: 'pp', goodUp: false },
  { label: '注册/IP · 活跃/IP', cell: (m) => `${fmt2(m.regPerIp)} / ${fmt2(m.activePerIp)}`, cmp: (m) => m.regPerIp, kind: 'num', goodUp: false },

  { grp: '留存(核心)' },
  { label: '次日留存率 / 人数·日', cell: (m) => `${fmt2(m.keep1Rate)}% · ${fmtNum(perDay(m, 'keep1day'))}`, cmp: (m) => m.keep1Rate, kind: 'pp', goodUp: true },
  { label: '3 日留存率 / 人数·日', cell: (m) => `${fmt2(m.keep3Rate)}% · ${fmtNum(perDay(m, 'keep3day'))}`, cmp: (m) => m.keep3Rate, kind: 'pp', goodUp: true },
  { label: '7 日留存率 / 人数·日', cell: (m) => `${fmt2(m.keep7Rate)}% · ${fmtNum(perDay(m, 'keep7day'))}`, cmp: (m) => m.keep7Rate, kind: 'pp', goodUp: true },
  { label: '留存衰减(7留 ÷ 次留)', cell: (m) => `${fmt1(m.retDecay)}%`, cmp: (m) => m.retDecay, kind: 'pp', goodUp: true },

  { grp: '付费漏斗(逐层)' },
  { label: '拉单量(日均) / 拉单率', cell: (m) => `${fmtNum(perDay(m, 'rechargeCount'))} · ${fmt2(m.pullRate)}%`, cmp: (m) => m.pullRate, kind: 'pp', goodUp: true },
  { label: '成功订单(日均)', sub: true, cell: (m) => fmtNum(perDay(m, 'rechargeSuccessCount')), cmp: (m) => perDay(m, 'rechargeSuccessCount'), kind: 'num', goodUp: true },
  { label: '支付成功率(付费人数 ÷ 拉单)', cell: (m) => `${fmt2(m.paySuccess)}%`, cmp: (m) => m.paySuccess, kind: 'pp', goodUp: true },
  { label: '付费人数(日均) / 活跃付费率', cell: (m) => `${fmtNum(perDay(m, 'payingUsers'))} · ${fmt2(m.activePayRate)}%`, cmp: (m) => m.activePayRate, kind: 'pp', goodUp: true },
  { label: '新增付费人数 / DAY0 付费率', cell: (m) => `${fmtNum(perDay(m, 'regPayUser'))} · ${fmt2(m.day0PayRate)}%`, cmp: (m) => m.day0PayRate, kind: 'pp', goodUp: true },
  { label: '老用户付费人数 / 老用户付费率', cell: (m) => `${fmtNum(perDay(m, 'paidOld'))} · ${fmt2(m.oldPayRate)}%`, cmp: (m) => m.oldPayRate, kind: 'pp', goodUp: true },
  { label: '新用户支付单量(日均·估)', sub: true, cell: (m) => fmtNum(perDay(m, 'newPayOrders')), cmp: (m) => perDay(m, 'newPayOrders'), kind: 'num', goodUp: true },
  { label: '老用户支付单量(日均·估)', sub: true, cell: (m) => fmtNum(perDay(m, 'oldPayOrders')), cmp: (m) => perDay(m, 'oldPayOrders'), kind: 'num', goodUp: true },
  { label: '人均成功订单', cell: (m) => fmt2(m.ordersPerPayer), cmp: (m) => m.ordersPerPayer, kind: 'num', goodUp: true },

  { grp: '收入结构' },
  { label: '总充值(日均)', cell: (m) => fmtNum(perDay(m, 'rechargeAmount')), cmp: (m) => perDay(m, 'rechargeAmount'), kind: 'num', goodUp: true },
  { label: 'VIP 充值 / 占比', sub: true, cell: (m) => `${fmtNum(perDay(m, 'vipRechargeAmount'))} · ${fmt1(m.vipShare)}%`, cmp: (m) => m.vipShare, kind: 'pp' },
  { label: '金币充值 / 占比', sub: true, cell: (m) => `${fmtNum(perDay(m, 'coinRechargeAmount'))} · ${fmt1(m.coinShare)}%`, cmp: (m) => m.coinShare, kind: 'pp' },
  { label: '新增贡献收入 / 占比', cell: (m) => `${fmtNum(perDay(m, 'newRev'))} · ${fmt1(m.newRevShare)}%`, cmp: (m) => m.newRevShare, kind: 'pp', goodUp: true },
  { label: '老用户充值 / 占比', cell: (m) => `${fmtNum(perDay(m, 'oldPayTotal'))} · ${fmt1(m.oldRevShare)}%`, cmp: (m) => m.oldRevShare, kind: 'pp', goodUp: false },
  { label: '裂变充值 / 占比', cell: (m) => `${fmtNum(perDay(m, 'invitedCharge'))} · ${fmt1(m.fissionShare)}%`, cmp: (m) => m.fissionShare, kind: 'pp', goodUp: true },
  { label: 'ARPU(收入 ÷ 日活)', cell: (m) => fmt3(m.arpu), cmp: (m) => m.arpu, kind: 'num', goodUp: true },
  { label: 'ARPPU(收入 ÷ 付费人数)', cell: (m) => fmt1(m.arppu), cmp: (m) => m.arppu, kind: 'num', goodUp: true },
  { label: '新增 ARPU', sub: true, cell: (m) => fmt3(m.newArpu), cmp: (m) => m.newArpu, kind: 'num', goodUp: true },
  { label: '老用户 ARPU', sub: true, cell: (m) => fmt2(m.oldArpu), cmp: (m) => m.oldArpu, kind: 'num', goodUp: true },
  { label: '新用户人均消费(按付费人数)', cell: (m) => fmt2(m.newSpendPerPayer), cmp: (m) => m.newSpendPerPayer, kind: 'num', goodUp: true },
  { label: '老用户人均消费(按付费人数)', cell: (m) => fmt2(m.oldSpendPerPayer), cmp: (m) => m.oldSpendPerPayer, kind: 'num', goodUp: true },
];

// 复用同一套 ROWS 渲染任意列组合;deltas = [{label,a,b}] 每项多一列对比(a 相对 b 的变化)
function MetricTable({ columns, deltas = [] }) {
  const dl = deltas.filter((x) => x && x.a && x.b);
  const span = columns.length + 1 + dl.length;
  return (
    <table className="compact">
      <thead>
        <tr>
          <th style={{ textAlign: 'left', minWidth: 200 }}>指标</th>
          {columns.map((c) => <th key={c.key} style={{ minWidth: 100 }}>{c.label}</th>)}
          {dl.map((x, i) => <th key={`d${i}`} style={{ minWidth: 82 }}>{x.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row, i) => {
          if (row.grp) {
            return (
              <tr key={`g${i}`}>
                <td colSpan={span} style={{ fontWeight: 700, background: 'var(--surface-2)', fontSize: 12.5, color: 'var(--text-soft)' }}>{row.grp}</td>
              </tr>
            );
          }
          return (
            <tr key={i}>
              <td style={{ textAlign: 'left', paddingLeft: row.sub ? 22 : 10, color: row.sub ? 'var(--text-soft)' : 'var(--text)' }}>{row.label}</td>
              {columns.map((c) => <td key={c.key}>{c.m ? row.cell(c.m) : '—'}</td>)}
              {dl.map((x, di) => {
                let txt = '—';
                let color = 'var(--text-faint)';
                if (row.cmp && x.a && x.b) {
                  const r = row.kind === 'pp' ? chgPP(row.cmp(x.a), row.cmp(x.b)) : chgNum(row.cmp(x.a), row.cmp(x.b));
                  txt = r.txt;
                  if (r.sign !== 0 && row.goodUp !== undefined) color = (r.sign > 0) === row.goodUp ? 'var(--green)' : '#e0446c';
                  else if (r.sign !== 0) color = 'var(--text-soft)';
                }
                return <td key={`d${di}`} style={{ color, fontWeight: 600 }}>{txt}</td>;
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MiniStat({ label, cur, prev, pp }) {
  const c = num(cur);
  const p = num(prev);
  const r = pp ? chgPP(c, p) : chgNum(c, p);
  const color = r.sign === 0 ? 'var(--text-faint)' : r.sign > 0 ? 'var(--green)' : '#e0446c';
  return (
    <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
      <span style={{ color: 'var(--text-soft)' }}>{label} </span>
      {pp ? `${fmt2(c)}%` : fmtNum(c)}
      <span style={{ color, marginLeft: 4 }}>{r.txt}</span>
    </span>
  );
}

export default function BusinessInsight() {
  const navigate = useNavigate();
  const [status, setStatus] = useState({ configured: false });
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openDays, setOpenDays] = useState(() => new Set());
  const [dateA, setDateA] = useState('');
  const [dateB, setDateB] = useState('');

  const toggleDay = (date) => setOpenDays((s) => {
    const n = new Set(s);
    if (n.has(date)) n.delete(date); else n.add(date);
    return n;
  });

  const load = () => {
    setLoading(true);
    setError('');
    api.listDailyBusinessData(62)
      .then((d) => {
        const list = d.list || [];
        setDays(list);
        if (list[0]) setOpenDays(new Set([list[0].date]));
        if (list[0]) setDateA(list[0].date);
        if (list[1]) setDateB(list[1].date);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.businessDataStatus().then(setStatus).catch(() => {});
    load();
  }, []);

  const model = useMemo(() => {
    if (!days.length) return null;
    const rows = days; // 倒序:rows[0] = 最近一天;最多 62 天(为「月环比」留出上月同日)
    const rows30 = rows.slice(0, 30);
    const cur = rows[0];
    const base = rows.slice(1, 8);
    const last7 = rows.slice(0, 7);
    const prev7 = rows.slice(7, 14);

    const d = (r, k) => num(r[k]);
    const baseMean = (k) => mean(base.map((r) => d(r, k)));
    const rel = (a, b) => (b ? ((a - b) / b) * 100 : (a ? 100 : 0));

    const mToday = aggregate([cur]);
    const m7 = aggregate(last7);
    const mPrev7 = prev7.length ? aggregate(prev7) : null;
    const m30 = aggregate(rows30);

    // 日环比 = 最新日 vs 前一日;月环比 = 最新日 vs 上月同日(取不到则退回约 30 天前)
    const mCur = aggregate([cur]);
    const mPrevDay = rows[1] ? aggregate([rows[1]]) : null;
    const _mref = new Date(cur.date + 'T00:00:00');
    _mref.setMonth(_mref.getMonth() - 1);
    const _p2 = (n) => String(n).padStart(2, '0');
    const monthAgoDate = `${_mref.getFullYear()}-${_p2(_mref.getMonth() + 1)}-${_p2(_mref.getDate())}`;
    const monthAgoRow = rows.find((r) => r.date === monthAgoDate) || rows[30] || null;
    const mMonthAgo = monthAgoRow ? aggregate([monthAgoRow]) : null;
    const monthAgoLabel = monthAgoRow ? monthAgoRow.date.slice(5) : '上月同日';

    // ---------- 异常监控 ----------
    const alerts = [];
    const push = (level, text) => alerts.push({ level, text });

    const revDelta = rel(d(cur, 'rechargeAmount'), baseMean('rechargeAmount'));
    if (revDelta <= -30) push('high', `收入 ${fmtNum(d(cur, 'rechargeAmount'))},比前 7 天均值 ${fmtNum(baseMean('rechargeAmount'))} 低 ${Math.abs(revDelta).toFixed(0)}%,确认是否活动结束 / 大 R 未复充`);
    else if (revDelta <= -15) push('mid', `收入较前 7 天均值下滑 ${Math.abs(revDelta).toFixed(0)}%(${fmtNum(d(cur, 'rechargeAmount'))} vs ${fmtNum(baseMean('rechargeAmount'))})`);
    else if (revDelta >= 40) push('info', `收入较前 7 天均值高 ${revDelta.toFixed(0)}%,确认是否单个大 R 贡献(当天老用户充值占比 ${fmt1(mToday.oldRevShare)}%)`);

    const nuDelta = rel(d(cur, 'newUsers'), baseMean('newUsers'));
    if (nuDelta <= -25) push('mid', `新增 ${fmtNum(d(cur, 'newUsers'))},较前 7 天均值缩量 ${Math.abs(nuDelta).toFixed(0)}%,确认自然量来源是否有变化`);
    else if (nuDelta >= 40) push('info', `新增放量 ${nuDelta.toFixed(0)}%,留意留存 / ARPU 是否被稀释,并抽查注册 IP 是否异常`);

    const dauDelta = rel(d(cur, 'activeTotal'), baseMean('activeTotal'));
    if (dauDelta <= -15) push('mid', `日活较前 7 天均值下滑 ${Math.abs(dauDelta).toFixed(0)}%`);

    const arpuDelta = rel(d(cur, 'arpu'), baseMean('arpu'));
    if (arpuDelta <= -25 && nuDelta > 10) push('high', `新增放量但 ARPU 掉 ${Math.abs(arpuDelta).toFixed(0)}%(${fmt2(d(cur, 'arpu'))} vs ${fmt2(baseMean('arpu'))}),新增质量下降`);
    else if (arpuDelta <= -25) push('mid', `ARPU ${fmt2(d(cur, 'arpu'))},较前 7 天均值低 ${Math.abs(arpuDelta).toFixed(0)}%`);

    const k1 = d(cur, 'keep1dayRate');
    if (k1 && k1 < 8) push('mid', `次日留存 ${fmt2(k1)}%,低于 8% 警戒线`);
    else if (baseMean('keep1dayRate') && k1 - baseMean('keep1dayRate') <= -1.5) push('mid', `次日留存较前 7 天均值降 ${(baseMean('keep1dayRate') - k1).toFixed(1)}pp`);

    if (m7.keep1day && m7.keep3day / m7.keep1day < 0.4) push('mid', `留存衰减偏快:近 7 天 3 留仅为次留的 ${fmt1((m7.keep3day / m7.keep1day) * 100)}%`);

    const sr = d(cur, 'rechargeSuccessRate');
    if (sr && sr < 40) push('mid', `支付成功率 ${fmt2(sr)}%,低于 40%,查最低档定价 / 支付方式数量 / 失败挽留`);
    else if (baseMean('rechargeSuccessRate') && sr - baseMean('rechargeSuccessRate') <= -8) push('mid', `支付成功率较前 7 天均值降 ${(baseMean('rechargeSuccessRate') - sr).toFixed(0)}pp`);

    if (m7.pullRate && m7.pullRate < 2) push('mid', `近 7 天拉单率仅 ${fmt2(m7.pullRate)}%(走到收银台的活跃占比),付费入口 / 解锁引导偏弱`);
    if (mToday.newDauRatio > 70) push('mid', `导量依赖度 ${fmt1(mToday.newDauRatio)}%(新增 ÷ 日活),日活高度依赖当天新增,留存盘子未形成`);
    if (mToday.oldRevShare > 60) push('info', `老用户充值占当天收入 ${fmt1(mToday.oldRevShare)}%,收入靠存量大 R,判断大盘请看「新增贡献收入」`);
    if (m7.regPerIp > 1.6) push('info', `近 7 天注册/IP 比 ${fmt2(m7.regPerIp)},偏高,警惕同 IP 批量注册(农场号 / 刷量),建议抽查设备与注册来源`);
    if (rows.slice(0, 7).every((r) => d(r, 'invitedCharge') === 0)) push('info', '近 7 天裂变充值持续为 0,邀请裂变未启动 —— 无投放阶段这是最该补的增长杠杆');
    if (!alerts.length) push('good', '当天各项指标相对前 7 天均值无明显异常');

    // ---------- 走向 sparkline ----------
    const seriesAsc = [...rows30].reverse();
    const trendDefs = [
      { key: 'rechargeAmount', label: '收入', mode: 'sum', fmt: fmtNum },
      { key: 'newUsers', label: '新增', mode: 'sum', fmt: fmtNum },
      { key: 'activeTotal', label: '日活', mode: 'mean', fmt: fmtNum },
      { key: 'arpu', label: 'ARPU', mode: 'mean', fmt: fmt2 },
    ];
    const agg = (arr, k, mode) => (mode === 'sum' ? sum(arr.map((r) => d(r, k))) : mean(arr.map((r) => d(r, k))));
    const trends = trendDefs.map((t) => {
      const now = agg(last7, t.key, t.mode);
      const before = prev7.length ? agg(prev7, t.key, t.mode) : null;
      const delta = before ? ((now - before) / before) * 100 : null;
      return { ...t, now, before, delta, series: seriesAsc.map((r) => d(r, t.key)) };
    });

    // ---------- 心得(分组、带数字) ----------
    const arppuList = rows.map((r) => ({ date: r.date, v: d(r, 'payingUsers') ? d(r, 'rechargeAmount') / d(r, 'payingUsers') : 0 }));
    const topArppu = [...arppuList].sort((a, b) => b.v - a.v)[0];
    const oldPayVals = last7.map((r) => d(r, 'oldPayTotal'));
    const day0List = last7.map((r) => ({ date: r.date, v: d(r, 'newUsers') ? (d(r, 'regPayUser') / d(r, 'newUsers')) * 100 : 0 }));
    const bestDay0 = [...day0List].sort((a, b) => b.v - a.v)[0];
    // 7日均值 vs 前7日均值(给还是以周为单位的结论用)
    const cmp7 = (getter, ppMode) => {
      if (!mPrev7) return '';
      const c = getter(m7);
      const p = getter(mPrev7);
      const r = ppMode ? chgPP(c, p) : chgNum(c, p);
      return r.txt === '持平' ? ',环比基本持平' : `,环比${r.sign > 0 ? '↑' : '↓'}${r.txt.replace('+', '').replace('-', '')}`;
    };
    // 最新日:日环比(vs 前一日) + 月环比(vs 上月同日),getter 作用在单日聚合对象上
    const seg = (label, r) => (r.sign === 0 ? `${label}持平` : `${label}${r.sign > 0 ? '↑' : '↓'}${r.txt.replace(/[+-]/g, '')}`);
    const dm = (getter, ppMode) => {
      const c = getter(mCur);
      const parts = [];
      if (mPrevDay) parts.push(seg('日环比', ppMode ? chgPP(c, getter(mPrevDay)) : chgNum(c, getter(mPrevDay))));
      if (mMonthAgo) parts.push(seg(`月环比(vs ${monthAgoLabel})`, ppMode ? chgPP(c, getter(mMonthAgo)) : chgNum(c, getter(mMonthAgo))));
      return parts.length ? `(${parts.join(' · ')})` : '';
    };

    const notes = [
      {
        title: '规模与结构',
        items: [
          `最新一天 ${cur.date.slice(5)}:新增 ${fmtNum(mCur.newUsers)} ${dm((m) => m.newUsers)}、日活 ${fmtNum(mCur.activeTotal)} ${dm((m) => m.activeTotal)}、收入 ${fmtNum(mCur.rechargeAmount)} ${dm((m) => m.rechargeAmount)}。`,
          `近 7 天日均新增 ${fmtNum(m7.newUsers / m7._n)}、日均日活 ${fmtNum(m7.activeTotal / m7._n)}${cmp7((m) => m.newUsers)} / 日活${cmp7((m) => m.activeTotal)}(vs 前 7 天)。`,
          `新增结构:安卓 ${fmt1(m7.androidNewShare)}% · H5 ${fmt1(m7.webNewShare)}%;邀请带来的新增占 ${fmt1(m7.inviteShare)}%${m7.inviteShare < 5 ? ' —— 邀请几乎没量,是无投放阶段最该做起来的杠杆' : ''}。`,
          `老用户活跃占日活 ${fmt1(m7.oldActiveShare)}%(新增占 ${fmt1(m7.newDauRatio)}%)。${m7.newDauRatio > 65 ? '日活几乎靠当天新增撑,新增一波动日活立刻跟着掉,说明留存盘子还没起来。' : '老用户盘子已在形成,继续观察其增速。'}`,
          `注册/IP 比 ${fmt2(m7.regPerIp)}、活跃/IP 比 ${fmt2(m7.activePerIp)}。${m7.regPerIp > 1.6 ? '注册/IP 偏高,建议抽查是否存在同 IP 批量注册(农场号 / 刷量)。' : '基本在正常区间。'}`,
        ],
      },
      {
        title: '留存(当前阶段第一优先级)',
        items: [
          `最新一天 ${cur.date.slice(5)} 次留 ${fmt2(mCur.keep1Rate)}% ${dm((m) => m.keep1Rate, true)}、3 留 ${fmt2(mCur.keep3Rate)}% ${dm((m) => m.keep3Rate, true)};近 7 天次留 ${fmt2(m7.keep1Rate)}%、3 留 ${fmt2(m7.keep3Rate)}%、7 留 ${fmt2(m7.keep7Rate)}%,日均留存人数 次 ${fmtNum(m7.keep1day / m7._n)} / 3日 ${fmtNum(m7.keep3day / m7._n)} / 7日 ${fmtNum(m7.keep7day / m7._n)}。`,
          `留存衰减:7 留 ÷ 次留 = ${fmt1(m7.retDecay)}%。${m7.retDecay < 25 ? '衰减偏快,用户拉新回来一次后很快流失,重点在「第 2~7 天的追更动机」。' : '衰减相对平缓。'}`,
          `内容类 app 次留健康线通常在 20% 上下,当前 ${fmt2(m7.keep1Rate)}% 明显偏低。先确认口径:留存分母是「当日新增」还是「当日活跃」、是否只统计了安卓、是否剔除同日重复;最近 1~2 天的留存可能还没跑完,别用最新点下结论。`,
          `可动作(产品侧,不依赖投放):新用户前 3 集免费 + 看完自动连播、进度记忆(打开直接续播)、次日定向推送「接着看 + 新剧」、首日 push 时机 A/B、开屏直接进正片而非首页。`,
        ],
      },
      {
        title: '付费漏斗(逐层拆)',
        items: [
          `第一层 活跃 → 拉单:最新一天拉单率 ${fmt2(mCur.pullRate)}% ${dm((m) => m.pullRate, true)};近 7 天 ${fmt2(m7.pullRate)}%(${fmtNum(m7.rechargeCount)} 单 / ${fmtNum(m7.activeTotal)} 活跃)。${m7.pullRate < 2 ? '走到收银台的人太少,是漏斗最细的一环 —— 优先加付费入口、解锁引导、首充弹窗。' : ''}`,
          `第二层 拉单 → 成功:最新一天支付成功率 ${fmt2(mCur.paySuccess)}% ${dm((m) => m.paySuccess, true)};近 7 天 ${fmt2(m7.paySuccess)}%。${m7.paySuccess < 45 ? '偏低,查最低档定价是否过高、支付方式是否够、失败后有没有挽留。' : '尚可,重点仍在第一层。'}`,
          `活跃付费率 ${fmt2(m7.activePayRate)}%、DAY0 付费率 ${fmt2(m7.day0PayRate)}%、老用户付费率 ${fmt2(m7.oldPayRate)}%;人均成功订单 ${fmt2(m7.ordersPerPayer)} 单。`,
          `近 7 天 DAY0 付费率最高是 ${bestDay0 ? bestDay0.date : '—'}(${bestDay0 ? fmt2(bestDay0.v) : '—'}%),回看当天做了什么(活动 / 新剧上线 / 推送 / 首充调整),能复制的固化下来。`,
        ],
      },
      {
        title: '收入结构',
        items: [
          `最新一天总充值 ${fmtNum(mCur.rechargeAmount)} ${dm((m) => m.rechargeAmount)}、付费人数 ${fmtNum(mCur.payingUsers)} ${dm((m) => m.payingUsers)}、ARPPU ${fmt1(mCur.arppu)} ${dm((m) => m.arppu)};近 7 天总充值 ${fmtNum(m7.rechargeAmount)}(日均 ${fmtNum(m7.rechargeAmount / m7._n)})${cmp7((m) => m.rechargeAmount)}。`,
          `产品拆分:VIP 占 ${fmt1(m7.vipShare)}% · 金币占 ${fmt1(m7.coinShare)}%。${m7.coinShare < 10 ? '金币(单集解锁)几乎没跑,和低拉单率互相印证 —— 用户还没进入「为单集付费」的环节,追更 + 解锁墙要一起做。' : ''}`,
          `用户拆分:新增贡献收入 ${fmtNum(m7.newRev)}(占 ${fmt1(m7.newRevShare)}%),老用户充值 ${fmtNum(m7.oldPayTotal)}(占 ${fmt1(m7.oldRevShare)}%);近 7 天单日老用户充值在 ${fmtNum(Math.min(...oldPayVals))} ~ ${fmtNum(Math.max(...oldPayVals))} 之间波动${Math.max(...oldPayVals) > 2 * (Math.min(...oldPayVals) || 1) ? ',被少数大 R 带动,判断大盘趋势请盯「新增贡献收入」这条稳线' : ''}。`,
          `新增 ARPU ${fmt3(m7.newArpu)}、老用户 ARPU ${fmt2(m7.oldArpu)}${cmp7((m) => m.newArpu)}(新增 ARPU)。单日 ARPPU 最高 ${topArppu ? fmt1(topArppu.v) : '—'} 出现在 ${topArppu ? topArppu.date : '—'},排查是否单人大额,并建立大 R 维护(专属客服 / 礼包 / 提前触达)。`,
        ],
      },
      {
        title: '增长建议(无付费投放前提)',
        items: [
          `裂变 / 邀请:近 30 天裂变充值合计 ${fmtNum(m30.invitedCharge)}、邀请新增占比 ${fmt1(m30.inviteShare)}%。把邀请入口做进播放页 / 个人中心,配「邀请得 VIP 天数 + 被邀请人首充礼包 + 邀请榜」。`,
          `活动:首充 6 元档、限时解锁包、签到送金币 / VIP 体验卡,直接抬 DAY0 付费率和拉单率。`,
          `内容:稳定上新节奏 + 追更推送、爆款剧做续集、首页强化榜单 / 分类,提升次留与 3 留。`,
          `召回:对 7 日内流失用户发「你追的剧更新了」push / 短信,把老用户盘子的漏水补上。`,
          `数据基建:补「分剧 播放 → 解锁 → 付费」漏斗(目前内容侧是黑盒);即使无投放也要看自然量的累计 ARPU 曲线(3日 / 7日 / 30日),用来判断单用户价值走向。`,
        ],
      },
    ];

    // ---------- 按天详查:每天 vs 前一天(展示最近 31 天) ----------
    const dayList = rows.slice(0, 31).map((row, i) => {
      const prev = rows[i + 1] || null;
      return { date: row.date, row, prev, mDay: aggregate([row]), mPrev: prev ? aggregate([prev]) : null };
    });

    return { cur, mToday, m7, mPrev7, m30, alerts, trends, notes, dayList, monthAgoLabel };
  }, [days]);

  // 「关键数据速览」第1列所选日期的上月同日,用于「月环比」列(取不到退回约 30 天前)
  const monthAgoAggOf = (date) => {
    if (!date) return null;
    const t = new Date(date + 'T00:00:00');
    t.setMonth(t.getMonth() - 1);
    const s = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    let r = days.find((x) => x.date === s);
    if (!r) {
      const i = days.findIndex((x) => x.date === date);
      r = i >= 0 ? days[i + 30] || null : null;
    }
    return r ? aggregate([r]) : null;
  };

  const rowA = days.find((r) => r.date === dateA) || null;
  const rowB = days.find((r) => r.date === dateB) || null;
  const mA = rowA ? aggregate([rowA]) : null;
  const mB = rowB ? aggregate([rowB]) : null;

  const dateSel = (value, setter) => (
    <select
      value={value || ''}
      onChange={(e) => setter(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      style={{ font: 'inherit', fontSize: 12, padding: '2px 4px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}
    >
      {days.map((r) => <option key={r.date} value={r.date}>{r.date.slice(5)}</option>)}
    </select>
  );

  const mAMonthAgo = mA ? monthAgoAggOf(dateA) : null;

  const cols = model ? [
    { key: 'a', label: dateSel(dateA, setDateA), m: mA },
    { key: 'b', label: dateSel(dateB, setDateB), m: mB },
    { key: 'w7', label: '近 7 日', m: model.m7 },
    { key: 'w30', label: '近 30 日', m: model.m30 },
  ] : [];

  return (
    <div className="page page--wide">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className={`tg-banner ${status.configured ? 'ok' : 'warn'}`}>
        <span className="dot" style={{ background: status.configured ? 'var(--green)' : 'var(--amber)' }} />
        {status.configured ? '已连接管理后台每日报告接口 · 诊断基于最近 62 天(近30天参照 + 上月同日做月环比;暂无付费投放,聚焦留存 / 付费 / 内容)' : '未配置管理后台 token(在 backend/.env 填 HANIME_ADMIN_TOKEN 后可用)'}
        <button className="ghost-btn" onClick={load} disabled={loading}>{loading ? '刷新中…' : '刷新'}</button>
      </div>
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
      {!model && !loading && !error && <div className="hint" style={{ marginTop: 16 }}>暂无数据</div>}

      {model && (
        <>
          <div className="section-head" style={{ marginTop: 20 }}>
            <h2>今日体检({model.cur.date})</h2>
            <span className="hint">对比前 7 天均值,自动标记偏离</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {model.alerts.map((a, i) => {
              const s = LEVEL[a.level];
              return (
                <div key={i} style={{ borderLeft: `3px solid ${s.border}`, background: s.bg, borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ color: s.color, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{s.tag}</span>
                  <span style={{ fontSize: 13.5, lineHeight: 1.6 }}>{a.text}</span>
                </div>
              );
            })}
          </div>

          <div className="section-head" style={{ marginTop: 28 }}>
            <h2>关键指标走向</h2>
            <span className="hint">近 7 天 vs 前 7 天 · 迷你图为近 30 天</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
            {model.trends.map((t) => (
              <div key={t.key} className="stat-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <div className="label">{t.label} · 近7天{t.mode === 'sum' ? '合计' : '均值'}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <div className="value" style={{ fontSize: 20 }}>{t.fmt(t.now)}</div>
                  {t.delta !== null && (
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: t.delta >= 0 ? 'var(--green)' : '#e0446c' }}>
                      {t.delta >= 0 ? '▲' : '▼'} {Math.abs(t.delta).toFixed(1)}%
                    </span>
                  )}
                </div>
                <Spark data={t.series} color={t.delta >= 0 ? 'var(--green)' : '#e0446c'} />
                <div className="hint" style={{ fontSize: 11 }}>前 7 天 {t.before !== null ? t.fmt(t.before) : '—'}</div>
              </div>
            ))}
          </div>

          <div className="section-head" style={{ marginTop: 28 }}>
            <h2>关键数据速览</h2>
            <span className="hint">前两列可选日期(默认最新 vs 前一天)· 环比 = 第1列÷第2列 · 月环比 = 第1列÷上月同日</span>
          </div>
          <div className="card card--tight">
            <div style={{ overflowX: 'auto' }}>
              <MetricTable
                columns={cols}
                deltas={[
                  { label: '环比', a: mA, b: mB },
                  { label: `月环比${mAMonthAgo ? '' : '(无)'}`, a: mA, b: mAMonthAgo },
                ]}
              />
            </div>
          </div>

          <div className="section-head" style={{ marginTop: 28 }}>
            <h2>按天详查</h2>
            <span className="hint">点开某天 = 该天 vs 前一天逐项对比</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {model.dayList.map((it) => {
              const open = openDays.has(it.date);
              return (
                <div key={it.date} className="card card--tight" style={{ marginBottom: 0 }}>
                  <button
                    onClick={() => toggleDay(it.date)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '11px 16px', background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left' }}
                  >
                    <span style={{ fontWeight: 700, flexShrink: 0 }}>{open ? '▾' : '▸'} {it.date}</span>
                    {it.prev && (
                      <span style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <MiniStat label="收入" cur={it.row.rechargeAmount} prev={it.prev.rechargeAmount} />
                        <MiniStat label="新增" cur={it.row.newUsers} prev={it.prev.newUsers} />
                        <MiniStat label="日活" cur={it.row.activeTotal} prev={it.prev.activeTotal} />
                        <MiniStat label="次留" cur={it.row.keep1dayRate} prev={it.prev.keep1dayRate} pp />
                        <MiniStat label="付费人数" cur={it.row.payingUsers} prev={it.prev.payingUsers} />
                      </span>
                    )}
                  </button>
                  {open && (it.prev ? (
                    <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border)' }}>
                      <MetricTable
                        columns={[
                          { key: 'd', label: it.date.slice(5), m: it.mDay },
                          { key: 'p', label: `前一日 ${it.prev.date.slice(5)}`, m: it.mPrev },
                        ]}
                        deltas={[{ label: '环比', a: it.mDay, b: it.mPrev }]}
                      />
                    </div>
                  ) : (
                    <div className="card-body hint" style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>没有更早一天的数据可对比</div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="section-head" style={{ marginTop: 28 }}>
            <h2>每日体检心得</h2>
            <span className="hint">最新一天含 日环比(vs 前一天) + 月环比(vs 上月同日)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {model.notes.map((sec, i) => (
              <div key={i} className="card card--tight">
                <div className="card-head">{i + 1}. {sec.title}</div>
                <div className="card-body" style={{ padding: '14px 20px' }}>
                  <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {sec.items.map((n, j) => <li key={j} style={{ fontSize: 13.5, lineHeight: 1.75 }}>{n}</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
