import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const fmtNum = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('zh-CN'));

export default function PlayBoard() {
  const navigate = useNavigate();
  const [status, setStatus] = useState({ configured: false, types: [] });
  const [active, setActive] = useState('');
  const [board, setBoard] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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

  const loadCategories = (type) => {
    api.playBoardCategories(type).then((r) => setCategories(r.categories || [])).catch(() => setCategories([]));
  };

  const load = (type) => {
    if (!type) return;
    setLoading(true);
    setError('');
    setCategoryFilter('');
    api.playBoard(type)
      .then(setBoard)
      .catch((err) => { setBoard(null); setError(err.message); })
      .finally(() => setLoading(false));
    loadCategories(type);
  };

  const refresh = () => {
    if (!active) return;
    setRefreshing(true);
    setError('');
    api.playBoardRefresh(active)
      .then(setBoard)
      .catch((err) => setError(err.message))
      .finally(() => setRefreshing(false));
    loadCategories(active);
  };

  useEffect(() => { if (active) load(active); /* eslint-disable-next-line */ }, [active]);

  // 一条数据的分类可能是逗号分隔的多值(比如 H游 常见"即时战略,模拟经营"),按其中任意一个匹配
  const itemMatchesCategory = (it, name) =>
    (it.category || '').split(/[,,、]/).map((s) => s.trim()).includes(name);
  const filteredList = categoryFilter
    ? (board?.list || []).filter((it) => itemMatchesCategory(it, categoryFilter))
    : board?.list || [];

  return (
    <div className="page page--wide">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className={`tg-banner ${status.configured ? 'ok' : 'warn'}`}>
        <span className="dot" style={{ background: status.configured ? 'var(--green)' : 'var(--amber)' }} />
        {status.configured
          ? '已连接管理后台 · 每 6 小时全量重抓一次快照,「当日新增播放」= 今日累计 − 昨日快照'
          : '未配置管理后台 token(在 backend/.env 填 HANIME_ADMIN_TOKEN 后可用)'}
        <button className="ghost-btn" onClick={() => load(active)} disabled={loading || refreshing}>{loading ? '加载中…' : '重新加载'}</button>
        <button className="ghost-btn" onClick={refresh} disabled={loading || refreshing} title="真的去后台重新抓全量数据,数据多的话要等几秒到几十秒">
          {refreshing ? '全量抓取中…' : '↻ 立即全量刷新'}
        </button>
      </div>

      <div className="section-head" style={{ marginTop: 20 }}>
        <h2>播放量排行(全量)</h2>
        <span className="hint">按累计播放排序 · 共 {filteredList.length} 条{categoryFilter ? `(${categoryFilter})` : ''}{board?.date ? ` · 快照 ${board.date}` : ''}</span>
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

      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <button
            onClick={() => setCategoryFilter('')}
            className="ghost-btn"
            style={{
              padding: '4px 14px', borderRadius: 999, fontSize: 13,
              fontWeight: categoryFilter === '' ? 700 : 400,
              background: categoryFilter === '' ? 'var(--surface)' : 'transparent',
              color: categoryFilter === '' ? 'var(--text)' : 'var(--text-soft)',
              borderColor: 'var(--border)',
            }}
          >
            全部分类 · {board?.list?.length || 0}
          </button>
          {categories.map((c) => (
            <button
              key={c.name}
              onClick={() => setCategoryFilter(c.name)}
              className="ghost-btn"
              title={c.official ? '官方分类' : '数据里出现过,但不在官方分类表里'}
              style={{
                padding: '4px 14px', borderRadius: 999, fontSize: 13,
                fontWeight: categoryFilter === c.name ? 700 : 400,
                background: categoryFilter === c.name ? 'var(--primary-soft)' : 'transparent',
                color: categoryFilter === c.name ? 'var(--primary)' : (c.count ? 'var(--text-soft)' : 'var(--text-faint)'),
                borderColor: 'var(--border)',
                borderStyle: c.official ? 'solid' : 'dashed',
              }}
            >
              {c.name} · {c.count}
            </button>
          ))}
        </div>
      )}

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
          <span className="muted">
            {board?.date ? `快照 ${board.date}` : ''}
            {board && !board.hasYesterday && board.list?.length ? ' · 当日新增需明日起才有对照' : ''}
          </span>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 640, overflowY: 'auto' }}>
          <table className="compact play-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th style={{ width: 460, textAlign: 'left' }}>标题</th>
                <th style={{ width: 130 }}>分类</th>
                <th style={{ width: 150 }}>当日新增播放</th>
                <th style={{ width: 150 }}>累计播放</th>
              </tr>
            </thead>
            <tbody>
              {!loading && !filteredList.length && (
                <tr><td colSpan={5} className="empty" style={{ padding: 24 }}>暂无数据</td></tr>
              )}
              {filteredList.map((it, i) => (
                <tr key={it.id}>
                  <td style={{ fontWeight: 700, color: i < 3 ? 'var(--primary)' : 'var(--text-soft)' }}>{i + 1}</td>
                  <td style={{ textAlign: 'left' }}>{it.title}</td>
                  <td style={{ color: 'var(--text-soft)' }}>{it.category || '—'}</td>
                  <td style={{ fontWeight: 600, textAlign: 'right', paddingRight: 24 }}>{it.playToday === null ? '—' : `+${fmtNum(it.playToday)}`}</td>
                  <td style={{ color: 'var(--text-soft)', textAlign: 'right', paddingRight: 24 }}>{fmtNum(it.playTotal)}</td>
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
