import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const ACTION_LABELS = {
  login_ok: '登录成功',
  login_fail: '登录失败',
  logout: '退出',
  create_user: '新建账号',
  reset_password: '重置密码',
  update_tools: '修改工具权限',
  delete_user: '删除账号',
};

const PAGE_SIZE = 50;

// 后端 ts 是 UTC 的 'YYYY-MM-DD HH:MM:SS',补上 Z 再按本地时区显示
const fmtTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime())
    ? ts
    : d.toLocaleString('zh-CN', { hour12: false });
};

const fmtDetail = (raw) => {
  if (!raw) return '';
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === 'object') {
      return Object.entries(o)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? (v.length ? v.join('/') : '全部') : v ?? '—'}`)
        .join(' · ');
    }
  } catch { /* 不是 JSON 就原样显示 */ }
  return raw;
};

export default function ActivityLog() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = (p = page) => {
    setLoading(true);
    setError('');
    api.listActivity({ action, actor: actor.trim(), page: p, limit: PAGE_SIZE })
      .then((d) => {
        setRows(d.rows || []);
        setTotal(d.total || 0);
        setPage(d.page || p);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  // 首次加载 + 筛选条件变化时回到第 1 页重新拉
  useEffect(() => { load(1); /* eslint-disable-next-line */ }, [action]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page page--wide">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className="section-head" style={{ marginTop: 20 }}>
        <h2>操作日志</h2>
        <span className="hint">登录 / 退出 与账号相关操作的记录,含时间、用户、IP。仅管理员可见。</span>
      </div>

      <div className="card card--tight" style={{ marginTop: 8 }}>
        <div className="card-head" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="text-input" style={{ width: 150 }} value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">全部动作</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input
            className="text-input"
            style={{ width: 180 }}
            placeholder="按用户名筛选"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(1)}
          />
          <button className="ghost-btn" onClick={() => load(1)} disabled={loading}>{loading ? '查询中…' : '查询'}</button>
          <div style={{ flex: 1 }} />
          <span className="hint">共 {total} 条</span>
        </div>

        {error && <div className="error" style={{ margin: 12 }}>{error}</div>}

        <div style={{ overflowX: 'auto' }}>
          <table className="compact">
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>时间</th>
                <th>用户</th>
                <th>动作</th>
                <th>对象</th>
                <th>IP</th>
                <th>详情</th>
                <th>客户端</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="empty" style={{ padding: 26 }}>暂无记录</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtTime(r.ts)}</td>
                  <td>{r.actor || '—'}</td>
                  <td style={{ color: r.action === 'login_fail' ? 'var(--red, #e0446c)' : undefined }}>
                    {ACTION_LABELS[r.action] || r.action}
                  </td>
                  <td>{r.target || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.ip || '—'}</td>
                  <td style={{ maxWidth: 260, whiteSpace: 'normal', wordBreak: 'break-all' }}>{fmtDetail(r.detail)}</td>
                  <td
                    style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={r.user_agent || ''}
                  >
                    {r.user_agent || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <button className="ghost-btn" onClick={() => load(page - 1)} disabled={loading || page <= 1}>上一页</button>
          <span className="hint">第 {page} / {totalPages} 页</span>
          <button className="ghost-btn" onClick={() => load(page + 1)} disabled={loading || page >= totalPages}>下一页</button>
        </div>
      </div>
    </div>
  );
}
