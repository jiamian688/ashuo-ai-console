import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const fmtNum = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('zh-CN'));

export default function PlayBoard() {
  const navigate = useNavigate();
  const [status, setStatus] = useState({ configured: false, types: [] });
  const [active, setActive] = useState('');
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.playBoardStatus()
      .then((s) => {
        setStatus(s);
        if (s.types?.length) setActive(s.types[0].key);
      })
      .catch((err) => setError(err.message));
  }, []);

  const load = (type) => {
    if (!type) return;
    setLoading(true);
    setError('');
    api.playBoard(type, 10)
      .then(setBoard)
      .catch((err) => { setBoard(null); setError(err.message); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (active) load(active); /* eslint-disable-next-line */ }, [active]);

  return (
    <div className="page page--wide">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className={`tg-banner ${status.configured ? 'ok' : 'warn'}`}>
        <span className="dot" style={{ background: status.configured ? 'var(--green)' : 'var(--amber)' }} />
        {status.configured
          ? '已连接管理后台 · 每 6 小时记录一次快照,「当日新增播放」= 今日累计 − 昨日快照'
          : '未配置管理后台 token(在 backend/.env 填 HANIME_ADMIN_TOKEN 后可用)'}
        <button className="ghost-btn" onClick={() => load(active)} disabled={loading}>{loading ? '刷新中…' : '刷新'}</button>
      </div>

      <div className="section-head" style={{ marginTop: 20 }}>
        <h2>播放量 Top 10</h2>
        <span className="hint">按累计播放排序 · 每日早晨快照自动更新</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {status.types.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className="ghost-btn"
            style={{
              padding: '6px 16px',
              borderRadius: 999,
              fontWeight: active === t.key ? 700 : 400,
              background: active === t.key ? 'var(--primary-soft)' : 'var(--surface)',
              color: active === t.key ? 'var(--primary)' : 'var(--text-soft)',
              borderColor: active === t.key ? 'transparent' : 'var(--border)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      {board?.note && (
        <div style={{ borderLeft: '3px solid var(--amber)', background: 'rgba(245,158,11,0.12)', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
          {board.note}
          {board.sampleKeys && <div style={{ color: 'var(--text-soft)', marginTop: 6, fontSize: 12 }}>返回字段:{board.sampleKeys.join(', ')}</div>}
        </div>
      )}

      <div className="card card--tight">
        <div className="card-head">
          {board?.label || '—'}
          <span className="muted">{board?.date ? `快照 ${board.date}` : ''}{board && !board.hasYesterday && board.list?.length ? ' · 当日新增需明日起才有对照' : ''}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="compact">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th style={{ textAlign: 'left', minWidth: 260 }}>标题</th>
                <th style={{ minWidth: 110 }}>当日新增播放</th>
                <th style={{ minWidth: 110 }}>累计播放</th>
              </tr>
            </thead>
            <tbody>
              {!loading && (!board || !board.list?.length) && (
                <tr><td colSpan={4} className="empty" style={{ padding: 24 }}>暂无数据</td></tr>
              )}
              {board?.list?.map((it) => (
                <tr key={it.id}>
                  <td style={{ fontWeight: 700, color: it.rank <= 3 ? 'var(--primary)' : 'var(--text-soft)' }}>{it.rank}</td>
                  <td style={{ textAlign: 'left' }}>{it.title}</td>
                  <td style={{ fontWeight: 600 }}>{it.playToday === null ? '—' : `+${fmtNum(it.playToday)}`}</td>
                  <td style={{ color: 'var(--text-soft)' }}>{fmtNum(it.playTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hint" style={{ marginTop: 12 }}>
        字段口径待确认:如某类目提示「没识别到播放量字段」,访问 <code>/api/play-board/probe?type={active}</code> 看返回字段名告诉我,我补进映射即可。
      </div>
    </div>
  );
}
