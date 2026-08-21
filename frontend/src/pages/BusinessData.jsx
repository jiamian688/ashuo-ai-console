import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const fmtNum = (n) => (n === undefined || n === null ? '—' : Number(n).toLocaleString('zh-CN'));
const fmtPct = (n) => (n === undefined || n === null ? '—' : `${Number(n).toFixed(2)}%`);
const sum = (list, key) => list.reduce((s, d) => s + (Number(d[key]) || 0), 0);

export default function BusinessData() {
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

  const today = days[0];
  const last7 = days.slice(0, 7);
  const last30 = days;

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className={`tg-banner ${status.configured ? 'ok' : 'warn'}`}>
        <span className="dot" style={{ background: status.configured ? 'var(--green)' : 'var(--amber)' }} />
        {status.configured
          ? '已连接管理后台每日报告接口'
          : '未配置管理后台 token(在 backend/.env 填 HANIME_ADMIN_TOKEN 后可用)'}
        <button className="ghost-btn" onClick={load} disabled={loading}>{loading ? '刷新中…' : '刷新'}</button>
      </div>
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

      {today && (
        <>
          <div className="section-head" style={{ marginTop: 20 }}>
            <h2>最新一天数据({today.date})</h2>
            <span className="hint">每日报告次日凌晨才生成,这里是最近已生成的一天,不是实时今天 —— 实时数据看首页顶部</span>
          </div>
          <div className="stats">
            <div className="stat-card"><div className="stat-icon green">￥</div><div><div className="label">今日收入</div><div className="value">{fmtNum(today.rechargeAmount)}</div></div></div>
            <div className="stat-card"><div className="stat-icon purple">✓</div><div><div className="label">今日新增</div><div className="value">{fmtNum(today.newUsers)}</div></div></div>
            <div className="stat-card"><div className="stat-icon blue">◷</div><div><div className="label">今日活跃</div><div className="value">{fmtNum(today.activeTotal)}</div></div></div>
            <div className="stat-card"><div className="stat-icon amber">%</div><div><div className="label">支付成功率</div><div className="value">{fmtPct(today.rechargeSuccessRate)}</div></div></div>
          </div>
          <div className="stats">
            <div className="stat-card"><div className="stat-icon green">￥</div><div><div className="label">近 7 天收入</div><div className="value">{fmtNum(sum(last7, 'rechargeAmount'))}</div></div></div>
            <div className="stat-card"><div className="stat-icon green">￥</div><div><div className="label">近 30 天收入</div><div className="value">{fmtNum(sum(last30, 'rechargeAmount'))}</div></div></div>
            <div className="stat-card"><div className="stat-icon purple">✓</div><div><div className="label">近 7 天新增</div><div className="value">{fmtNum(sum(last7, 'newUsers'))}</div></div></div>
            <div className="stat-card"><div className="stat-icon blue">◷</div><div><div className="label">次日留存率</div><div className="value">{fmtPct(today.keep1dayRate)}</div></div></div>
          </div>
        </>
      )}

      <div className="card" style={{ marginTop: 8 }}>
        <div className="card-head">最近 30 天明细</div>
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>新增</th>
              <th>日活</th>
              <th>收入</th>
              <th>支付成功率</th>
              <th>ARPU</th>
              <th>次日留存率</th>
              <th>3日留存率</th>
              <th>7日留存率</th>
            </tr>
          </thead>
          <tbody>
            {!loading && days.length === 0 && (
              <tr><td colSpan={9} className="empty" style={{ padding: 26 }}>暂无数据</td></tr>
            )}
            {days.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td>{fmtNum(d.newUsers)}</td>
                <td>{fmtNum(d.activeTotal)}</td>
                <td>{fmtNum(d.rechargeAmount)}</td>
                <td>{fmtPct(d.rechargeSuccessRate)}</td>
                <td>{d.arpu ?? '—'}</td>
                <td>{fmtPct(d.keep1dayRate)}</td>
                <td>{fmtPct(d.keep3dayRate)}</td>
                <td>{fmtPct(d.keep7dayRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
