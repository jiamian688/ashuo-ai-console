import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

// 纯前端诊断:复用 /business-data/daily 的每日报告,不额外调后端。
// 口径见「经营数据明细」页:keep*Rate / rechargeSuccessRate 已是百分数(如 4.60),arpu 是比值(如 0.71)。

const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const sum = (a) => a.reduce((s, v) => s + v, 0);
const fmtNum = (n) => Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const fmt2 = (n) => (Number(n) || 0).toFixed(2);
const fmtPct = (n) => `${(Number(n) || 0).toFixed(2)}%`;

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
  const pts = v.map((x, i) => [(i * step), h - 4 - ((x - min) / span) * (h - 8)]);
  const dAttr = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%' }}>
      <path d={dAttr} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  );
}

export default function BusinessInsight() {
  const navigate = useNavigate();
  const [status, setStatus] = useState({ configured: false });
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api.listDailyBusinessData(30)
      .then((d) => setDays(d.list || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.businessDataStatus().then(setStatus).catch(() => {});
    load();
  }, []);

  const model = useMemo(() => {
    if (!days.length) return null;
    const rows = days; // 后台按日期倒序:rows[0] = 最近已生成的一天
    const cur = rows[0];
    const base = rows.slice(1, 8);   // 前 7 天做基线
    const last7 = rows.slice(0, 7);
    const prev7 = rows.slice(7, 14);

    const d = (r, k) => num(r[k]);
    const baseMean = (k) => mean(base.map((r) => d(r, k)));
    const rel = (a, b) => (b ? ((a - b) / b) * 100 : (a ? 100 : 0));

    const derived = (r) => {
      const nu = d(r, 'newUsers'), dau = d(r, 'activeTotal'), rev = d(r, 'rechargeAmount');
      const pay = d(r, 'payingUsers'), regPay = d(r, 'regPayUser'), oldPay = d(r, 'oldPayTotal');
      return {
        arppu: pay ? rev / pay : 0,
        regPayRate: nu ? (regPay / nu) * 100 : 0,
        activePayRate: dau ? (pay / dau) * 100 : 0,
        newDauRatio: dau ? (nu / dau) * 100 : 0,
        oldPayShare: rev ? (oldPay / rev) * 100 : 0,
        newRev: rev - oldPay,
      };
    };
    const curD = derived(cur);

    // ---------- 异常监控 ----------
    const alerts = [];
    const push = (level, text) => alerts.push({ level, text });

    const revBase = baseMean('rechargeAmount');
    const revDelta = rel(d(cur, 'rechargeAmount'), revBase);
    if (revDelta <= -30) push('high', `收入 ${fmtNum(d(cur, 'rechargeAmount'))},比前 7 天均值 ${fmtNum(revBase)} 低 ${Math.abs(revDelta).toFixed(0)}%`);
    else if (revDelta <= -15) push('mid', `收入较前 7 天均值下滑 ${Math.abs(revDelta).toFixed(0)}%(${fmtNum(d(cur, 'rechargeAmount'))} vs ${fmtNum(revBase)})`);
    else if (revDelta >= 40) push('info', `收入较前 7 天均值高 ${revDelta.toFixed(0)}%,确认是否单个大 R 贡献(老用户充值占比 ${curD.oldPayShare.toFixed(0)}%)`);

    const nuBase = baseMean('newUsers');
    const nuDelta = rel(d(cur, 'newUsers'), nuBase);
    if (nuDelta <= -25) push('mid', `新增 ${fmtNum(d(cur, 'newUsers'))},较前 7 天均值缩量 ${Math.abs(nuDelta).toFixed(0)}%,检查投放`);
    else if (nuDelta >= 40) push('info', `新增放量 ${nuDelta.toFixed(0)}%,重点盯当天 ARPU / 次留是否被拉低`);

    const dauDelta = rel(d(cur, 'activeTotal'), baseMean('activeTotal'));
    if (dauDelta <= -15) push('mid', `日活较前 7 天均值下滑 ${Math.abs(dauDelta).toFixed(0)}%`);

    const arpuBase = baseMean('arpu');
    const arpuDelta = rel(d(cur, 'arpu'), arpuBase);
    if (arpuDelta <= -25 && nuDelta > 10) push('high', `新增放量但 ARPU 掉 ${Math.abs(arpuDelta).toFixed(0)}%(${fmt2(d(cur, 'arpu'))} vs ${fmt2(arpuBase)}),新量质量差`);
    else if (arpuDelta <= -25) push('mid', `ARPU ${fmt2(d(cur, 'arpu'))},较前 7 天均值低 ${Math.abs(arpuDelta).toFixed(0)}%`);

    const k1 = d(cur, 'keep1dayRate');
    const k1Base = baseMean('keep1dayRate');
    if (k1 && k1 < 8) push('mid', `次日留存 ${fmtPct(k1)},低于 8% 警戒线`);
    else if (k1Base && k1 - k1Base <= -1.5) push('mid', `次日留存较前 7 天均值降 ${(k1Base - k1).toFixed(1)}pp`);

    const sr = d(cur, 'rechargeSuccessRate');
    const srBase = baseMean('rechargeSuccessRate');
    if (sr && sr < 40) push('mid', `支付成功率 ${fmtPct(sr)},低于 40%,查最低档价格 / 支付方式`);
    else if (srBase && sr - srBase <= -8) push('mid', `支付成功率较前 7 天均值降 ${(srBase - sr).toFixed(0)}pp`);

    if (curD.newDauRatio > 70) push('mid', `导量依赖度 ${curD.newDauRatio.toFixed(0)}%(新增/日活),日活高度依赖当天买量`);
    if (curD.oldPayShare > 60) push('info', `老用户充值占收入 ${curD.oldPayShare.toFixed(0)}%,当天收入靠存量大 R,不可持续`);

    if (rows.slice(0, 7).every((r) => d(r, 'invitedCharge') === 0)) {
      push('info', '近 7 天裂变充值持续为 0,邀请裂变没有跑起来');
    }
    if (!alerts.length) push('good', '当天各项指标相对前 7 天均值无明显异常');

    // ---------- 关键指标走向:近 7 天 vs 前 7 天 ----------
    const agg = (arr, k, mode) => (mode === 'sum' ? sum(arr.map((r) => d(r, k))) : mean(arr.map((r) => d(r, k))));
    const trendDefs = [
      { key: 'rechargeAmount', label: '收入', mode: 'sum', fmt: fmtNum, spark: true },
      { key: 'newUsers', label: '新增', mode: 'sum', fmt: fmtNum, spark: true },
      { key: 'activeTotal', label: '日活', mode: 'mean', fmt: fmtNum, spark: true },
      { key: 'arpu', label: 'ARPU', mode: 'mean', fmt: fmt2, spark: true },
      { key: 'payingUsers', label: '付费人数', mode: 'sum', fmt: fmtNum, spark: false },
      { key: 'keep1dayRate', label: '次日留存', mode: 'mean', fmt: fmtPct, spark: false },
      { key: 'rechargeSuccessRate', label: '支付成功率', mode: 'mean', fmt: fmtPct, spark: false },
    ];
    const seriesAsc = [...rows].reverse();
    const trends = trendDefs.map((t) => {
      const now = agg(last7, t.key, t.mode);
      const before = prev7.length ? agg(prev7, t.key, t.mode) : null;
      const delta = before ? ((now - before) / before) * 100 : null;
      return { ...t, now, before, delta, series: t.spark ? seriesAsc.map((r) => d(r, t.key)) : null };
    });

    // ---------- 每日体检心得 ----------
    const notes = [];
    if (nuDelta >= 15 && arpuDelta <= -10) notes.push('本批放量伴随 ARPU 下滑,属于「以量换质」,第二天优先换渠道或压预算,不要继续加量。');
    else if (nuDelta <= -15 && arpuDelta >= 10) notes.push('缩量但 ARPU 回升,留下来的是相对优质的量,可小步测试放量看质量是否守得住。');

    if (curD.oldPayShare > 50) notes.push(`当天收入 ${curD.oldPayShare.toFixed(0)}% 来自老用户充值,判断趋势请看「新增贡献收入」(${fmtNum(curD.newRev)})这条更稳的线,别用总收入。`);

    const k1_7 = mean(last7.map((r) => d(r, 'keep1dayRate')));
    if (k1_7 && k1_7 < 8) notes.push(`近 7 天次留均值仅 ${k1_7.toFixed(1)}%,属结构性问题:先确认留存口径(分母是新增还是活跃),再排首集钩子和买量渠道质量。`);

    const ndr_7 = mean(last7.map((r) => derived(r).newDauRatio));
    if (ndr_7 > 65) notes.push(`近 7 天平均 ${ndr_7.toFixed(0)}% 的日活是当天新增,几乎没有留存盘子,停投当天日活就会塌,短期靠召回(push / 短信)补。`);

    notes.push('付费漏斗分两段看:日活 → 拉单量(引导:付费墙位置 / 首充弹窗)、拉单量 → 付费人数(转化:价格档 / 支付方式)。');

    const best = [...last7].sort((a, b) => derived(b).regPayRate - derived(a).regPayRate)[0];
    if (best && derived(best).regPayRate > 0) notes.push(`近 7 天 DAY0 付费率最高是 ${best.date}(${derived(best).regPayRate.toFixed(2)}%),回溯当天的渠道 / 素材 / 排播并复用。`);

    return { cur, curD, alerts, trends, notes, k1_7, ndr_7 };
  }, [days]);

  return (
    <div className="page page--wide">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className={`tg-banner ${status.configured ? 'ok' : 'warn'}`}>
        <span className="dot" style={{ background: status.configured ? 'var(--green)' : 'var(--amber)' }} />
        {status.configured ? '已连接管理后台每日报告接口 · 诊断基于最近 30 天' : '未配置管理后台 token(在 backend/.env 填 HANIME_ADMIN_TOKEN 后可用)'}
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
                {t.series && <Spark data={t.series} color={t.delta >= 0 ? 'var(--green)' : '#e0446c'} />}
                <div className="hint" style={{ fontSize: 11 }}>前 7 天 {t.before !== null ? t.fmt(t.before) : '—'}</div>
              </div>
            ))}
          </div>

          <div className="section-head" style={{ marginTop: 28 }}>
            <h2>每日体检心得</h2>
            <span className="hint">按规则自动生成,供参考</span>
          </div>
          <div className="card card--tight">
            <div className="card-body" style={{ padding: '14px 20px' }}>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {model.notes.map((n, i) => (
                  <li key={i} style={{ fontSize: 13.5, lineHeight: 1.7 }}>{n}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
