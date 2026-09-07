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
  const [scanResult, setScanResult] = useState('');
  const [scanning, setScanning] = useState(false);

  const runScan = () => {
    setScanning(true);
    setScanResult('扫描中…(要逐个试十几个接口,约 10-20 秒)');
    api.playBoardScan()
      .then((r) => setScanResult(JSON.stringify(r, null, 2)))
      .catch((err) => setScanResult('扫描失败:' + err.message))
      .finally(() => setScanning(false));
  };

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

      <div style={{ marginTop: 20, borderTop: '1px dashed var(--border)', paddingTop: 14 }}>
        <div className="section-head" style={{ margin: 0 }}>
          <h2 style={{ fontSize: 15 }}>调试:扫描后台内容接口</h2>
          <button className="ghost-btn" onClick={runScan} disabled={scanning}>{scanning ? '扫描中…' : '开始扫描'}</button>
        </div>
        <div className="hint" style={{ marginBottom: 8 }}>
          自动试一批可能的 resource 名(mv/book/comic/cartoon/anime/manga…),列出哪些通、疑似播放量字段。把结果整段复制发给开发即可接入动漫/漫画。
        </div>
        {scanResult && (
          <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.5, overflowX: 'auto', maxHeight: 420, overflowY: 'auto', whiteSpace: 'pre', margin: 0 }}>
            {scanResult}
          </pre>
        )}
      </div>
    </div>
  );
}
