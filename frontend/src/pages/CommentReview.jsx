import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const ACTION_LABEL = { pass: '建议通过', reject: '建议拒绝' };
const FALLBACK_SOURCES = [
  { key: 'mv', label: '视频评论', hasApprovalFlow: true },
  { key: 'post', label: '社区评论', hasApprovalFlow: true },
  { key: 'porn', label: '黄游评论', hasApprovalFlow: true },
  { key: 'book', label: '书评', hasApprovalFlow: false },
];

export default function CommentReview() {
  const navigate = useNavigate();
  const [status, setStatus] = useState({ configured: false, ai: null, sources: FALLBACK_SOURCES });
  const [source, setSource] = useState('mv');
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState({});
  const [suggestions, setSuggestions] = useState({}); // id -> { action, reason }
  const [aiBusy, setAiBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoResult, setAutoResult] = useState(null);
  const [actingId, setActingId] = useState(null);
  const [sweepBusy, setSweepBusy] = useState(false);
  const [sweepProgress, setSweepProgress] = useState(null); // { round, reviewed, passed, rejected, details: [] }
  const [todayStats, setTodayStats] = useState(null);
  const [onlyToday, setOnlyToday] = useState(true); // 只自动审核今天发的评论,往期存量不动
  const [view, setView] = useState('pending'); // 'pending' | 'history'
  const [historyList, setHistoryList] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadTodayStats = () => {
    api.commentReviewTodayStats().then(setTodayStats).catch(() => {});
  };

  const sources = status.sources?.length ? status.sources : FALLBACK_SOURCES;
  const cur = sources.find((s) => s.key === source) || sources[0];
  const rejectLabel = '删除'; // 所有模块的"拒绝"现在都是真删除(doReject/batchRefuse 调用成功但不会真的隐藏前台内容)

  const load = () => {
    setLoading(true);
    setError('');
    api.listPendingComments(source, page, limit)
      .then((d) => { setList(d.list || []); setTotal(d.total || 0); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const loadHistory = () => {
    setHistoryLoading(true);
    api.commentReviewHistory(source, historyPage, limit)
      .then((d) => { setHistoryList(d.list || []); setHistoryTotal(d.total || 0); })
      .catch((err) => setError(err.message))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    api.commentReviewStatus().then(setStatus).catch(() => {});
    loadTodayStats();
  }, []);
  useEffect(() => { if (view === 'pending') { load(); setSelected({}); setSuggestions({}); setAutoResult(null); setSweepProgress(null); } }, [page, source, view]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (view === 'history') loadHistory(); }, [historyPage, source, view]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); setHistoryPage(1); }, [source]);

  const selectedIds = Object.keys(selected).filter((id) => selected[id]).map(Number);

  const toggleAll = (checked) => {
    const next = {};
    if (checked) list.forEach((c) => { next[c.id] = true; });
    setSelected(next);
  };

  const runAiReview = async () => {
    if (!list.length) return;
    setAiBusy(true);
    setError('');
    try {
      const items = list.map((c) => ({ id: c.id, content: c.content, title: c.title }));
      const { suggestions: sugs } = await api.aiReviewComments(items);
      const map = {};
      sugs.forEach((s) => { map[s.id] = s; });
      setSuggestions(map);
    } catch (err) {
      setError(err.message);
    } finally {
      setAiBusy(false);
    }
  };

  const runAutoReview = async () => {
    setAutoBusy(true);
    setError('');
    setAutoResult(null);
    setSweepProgress(null);
    try {
      const r = await api.autoReviewComments(source, 50, onlyToday);
      setAutoResult(r);
      load();
      loadTodayStats();
      setSelected({});
      setSuggestions({});
    } catch (err) {
      setError(err.message);
    } finally {
      setAutoBusy(false);
    }
  };

  const MAX_SWEEP_ROUNDS = 30; // 安全阀:最多处理 30*100=3000 条,防止极端情况下无限循环
  const runSweep = async () => {
    setSweepBusy(true);
    setError('');
    setAutoResult(null);
    setSweepProgress({ round: 0, reviewed: 0, passed: 0, rejected: 0, skipped: 0, details: [] });
    try {
      let round = 0;
      for (;;) {
        round += 1;
        const r = await api.autoReviewComments(source, 100, onlyToday);
        setSweepProgress((prev) => ({
          round,
          reviewed: prev.reviewed + r.reviewed,
          passed: prev.passed + r.passed,
          rejected: prev.rejected + r.rejected,
          skipped: (prev.skipped || 0) + (r.skipped || 0),
          details: [...prev.details, ...(r.details || [])],
        }));
        api.listPendingComments(source, 1, 1).then((d) => setTotal(d.total || 0)).catch(() => {});
        loadTodayStats();
        if (!r.reviewed || round >= MAX_SWEEP_ROUNDS) break;
        await new Promise((resolve) => setTimeout(resolve, 100)); // 拒绝已经改成按理由批量提交,这里稍等一下就够了
      }
      load();
      setSelected({});
      setSuggestions({});
    } catch (err) {
      setError(err.message);
    } finally {
      setSweepBusy(false);
    }
  };

  const doPass = async (id) => {
    setActingId(id);
    try {
      await api.passComment(source, id);
      load();
      loadTodayStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  };

  const doReject = async (id) => {
    if (!window.confirm('确认删除这条评论?')) return;
    const reason = window.prompt('删除理由(可留空,只存本地记录):', suggestions[id]?.reason || '') ?? '';
    setActingId(id);
    try {
      await api.rejectComment(source, id, reason);
      load();
      loadTodayStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  };

  const batchPass = async () => {
    if (!selectedIds.length) return;
    try {
      await api.passComments(source, selectedIds);
      load();
      loadTodayStats();
      setSelected({});
    } catch (err) {
      setError(err.message);
    }
  };

  const batchReject = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`确认删除选中的 ${selectedIds.length} 条评论?`)) return;
    const reason = window.prompt('删除理由(可留空,只存本地记录):', '') ?? '';
    try {
      await api.rejectComments(source, selectedIds, reason);
      load();
      loadTodayStats();
      setSelected({});
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className={`tg-banner ${status.configured ? 'ok' : 'warn'}`}>
        <span className="dot" style={{ background: status.configured ? 'var(--green)' : 'var(--amber)' }} />
        {status.configured
          ? `已连接管理后台评论接口 · AI: ${status.ai || '未配置'}`
          : '未配置评论审核后台 token(在 backend/.env 填 HANIME_ADMIN_TOKEN 后可用)'}
      </div>

      {todayStats && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div className="muted small">今日已审核(全部模块)</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{todayStats.total}</div>
            </div>
            <div>
              <div className="muted small">通过</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--green, #16a34a)' }}>{todayStats.passed}</div>
            </div>
            <div>
              <div className="muted small">拒绝</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--red, #e0446c)' }}>{todayStats.rejected}</div>
            </div>
            {todayStats.bySource?.length > 0 && (
              <div className="muted small" style={{ marginLeft: 'auto' }}>
                {todayStats.bySource.map((s) => `${s.label} ${s.total}`).join(' · ')}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 0 }}>
          {sources.map((s) => (
            <button
              key={s.key}
              className={source === s.key ? 'btn-primary' : 'ghost-btn'}
              style={{ padding: '6px 16px' }}
              onClick={() => setSource(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="card-body" style={{ display: 'flex', gap: 8, paddingTop: 0, paddingBottom: 0 }}>
          <button className={view === 'pending' ? 'btn-primary' : 'ghost-btn'} style={{ padding: '6px 16px' }} onClick={() => setView('pending')}>未审核</button>
          <button className={view === 'history' ? 'btn-primary' : 'ghost-btn'} style={{ padding: '6px 16px' }} onClick={() => setView('history')}>已审核记录</button>
        </div>
        <div className="card-head">
          {cur?.label || '评论'}{' '}
          <span className="muted">
            {view === 'pending'
              ? (cur?.hasApprovalFlow ? `· 共 ${total} 条未审核` : `· 最近 ${total} 条 · 无审核队列,仅可删除违规内容`)
              : `· 共 ${historyTotal} 条已审核记录`}
          </span>
        </div>
        {error && <div className="error" style={{ margin: '16px 20px 0' }}>{error}</div>}

        {view === 'pending' ? (
          <>
            <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="ghost-btn" onClick={load} disabled={loading}>{loading ? '刷新中…' : '刷新'}</button>
              <button className="ghost-btn" onClick={runAiReview} disabled={aiBusy || !list.length}>
                {aiBusy ? 'AI 审核中…' : 'AI 给出建议(不自动执行)'}
              </button>
              <button className="btn-primary" onClick={runAutoReview} disabled={autoBusy || sweepBusy}>
                {autoBusy ? '自动审核中…' : '一键 AI 自动审核并执行(单批 50 条)'}
              </button>
              <button className="btn-primary" onClick={runSweep} disabled={autoBusy || sweepBusy}>
                {sweepBusy ? `批量清空中…(第 ${sweepProgress?.round || 0} 轮)` : '全部自动审核(循环清空队列)'}
              </button>
              <label className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-soft)' }}>
                <input type="checkbox" checked={onlyToday} onChange={(e) => setOnlyToday(e.target.checked)} disabled={autoBusy || sweepBusy} />
                只审核今天发的评论(往期存量不动)
              </label>
              {selectedIds.length > 0 && (
                <>
                  {cur?.hasApprovalFlow && <button className="ghost-btn" onClick={batchPass}>批量通过 ({selectedIds.length})</button>}
                  <button className="ghost-btn" onClick={batchReject}>批量{rejectLabel} ({selectedIds.length})</button>
                </>
              )}
            </div>
            {sweepProgress && (
              <div style={{ margin: '0 20px 16px' }}>
                <div className="small" style={{ color: 'var(--text-faint)', marginBottom: 8 }}>
                  {sweepBusy ? '批量处理中…' : '批量处理完成'} · 共 {sweepProgress.round} 轮 · 累计审核 {sweepProgress.reviewed} 条 · 通过 {sweepProgress.passed} · {rejectLabel} {sweepProgress.rejected}
                  {onlyToday && sweepProgress.skipped > 0 && ` · 跳过 ${sweepProgress.skipped} 条(非今天)`}
                  {!sweepBusy && sweepProgress.round >= MAX_SWEEP_ROUNDS && sweepProgress.reviewed > 0 && '(已达单次上限,若仍有剩余可再次点击继续)'}
                </div>
                {sweepProgress.details.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    {sweepProgress.details.map((d, i) => (
                      <div key={`${d.id}-${i}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
                        <span className="muted" style={{ width: 60, flexShrink: 0 }}>#{d.id}</span>
                        <span className={`status-pill ${d.action === 'pass' ? 'posted' : 'failed'}`} style={{ flexShrink: 0 }}>
                          {d.action === 'pass' ? '已通过' : `已${rejectLabel}`}
                        </span>
                        <span className="muted">{d.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {autoResult && (
              <div style={{ margin: '0 20px 16px' }}>
                <div className="small" style={{ color: 'var(--text-faint)', marginBottom: 8 }}>
                  本轮自动审核 {autoResult.reviewed} 条 · 通过 {autoResult.passed} · {rejectLabel} {autoResult.rejected}
                  {onlyToday && autoResult.skipped > 0 && ` · 跳过 ${autoResult.skipped} 条(非今天)`}
                </div>
                {autoResult.details?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    {autoResult.details.map((d) => (
                      <div key={d.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
                        <span className="muted" style={{ width: 60, flexShrink: 0 }}>#{d.id}</span>
                        <span className={`status-pill ${d.action === 'pass' ? 'posted' : 'failed'}`} style={{ flexShrink: 0 }}>
                          {d.action === 'pass' ? `已${'通过'}` : `已${rejectLabel}`}
                        </span>
                        <span className="muted">{d.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" checked={list.length > 0 && selectedIds.length === list.length} onChange={(e) => toggleAll(e.target.checked)} />
                  </th>
                  <th style={{ width: 70 }}>ID</th>
                  <th>内容标题</th>
                  <th>评论内容</th>
                  <th>用户</th>
                  <th>创建时间</th>
                  <th>AI 建议</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {!loading && list.length === 0 && (
                  <tr><td colSpan={8} className="empty" style={{ padding: 26 }}>暂无{cur?.hasApprovalFlow ? '待审核' : ''}评论</td></tr>
                )}
                {list.map((c) => {
                  const sug = suggestions[c.id];
                  return (
                    <tr key={c.id}>
                      <td><input type="checkbox" checked={!!selected[c.id]} onChange={(e) => setSelected((s) => ({ ...s, [c.id]: e.target.checked }))} /></td>
                      <td>{c.id}</td>
                      <td style={{ maxWidth: 220 }} title={c.title}>{c.title || '—'}</td>
                      <td>{c.content}</td>
                      <td>{c.nickname || '—'}</td>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{c.created_at || '—'}</td>
                      <td>
                        {sug
                          ? <span className={`status-pill ${sug.action === 'pass' ? 'posted' : 'failed'}`}>{ACTION_LABEL[sug.action] || sug.action} · {sug.reason}</span>
                          : <span className="muted">—</span>}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {cur?.hasApprovalFlow && (
                          <span className="link" style={{ cursor: 'pointer', marginRight: 12 }} onClick={() => doPass(c.id)}>
                            {actingId === c.id ? '处理中…' : '通过'}
                          </span>
                        )}
                        <span className="link" style={{ cursor: 'pointer' }} onClick={() => doReject(c.id)}>{rejectLabel}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px' }}>
              <button className="ghost-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>上一页</button>
              <span className="muted" style={{ alignSelf: 'center' }}>第 {page} 页</span>
              <button className="ghost-btn" onClick={() => setPage((p) => p + 1)} disabled={page * limit >= total}>下一页</button>
            </div>
          </>
        ) : (
          <>
            <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="ghost-btn" onClick={loadHistory} disabled={historyLoading}>{historyLoading ? '刷新中…' : '刷新'}</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 70 }}>ID</th>
                  <th style={{ width: 100 }}>结果</th>
                  <th>理由</th>
                  <th style={{ width: 180 }}>处理时间</th>
                </tr>
              </thead>
              <tbody>
                {!historyLoading && historyList.length === 0 && (
                  <tr><td colSpan={4} className="empty" style={{ padding: 26 }}>还没有审核记录</td></tr>
                )}
                {historyList.map((h, i) => (
                  <tr key={`${h.id}-${h.created_at}-${i}`}>
                    <td>#{h.id}</td>
                    <td>
                      <span className={`status-pill ${h.action === 'pass' ? 'posted' : 'failed'}`}>
                        {h.action === 'pass' ? '已通过' : `已${rejectLabel}`}
                      </span>
                    </td>
                    <td className="muted">{h.reason || '—'}</td>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>{h.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px' }}>
              <button className="ghost-btn" onClick={() => setHistoryPage((p) => Math.max(1, p - 1))} disabled={historyPage <= 1}>上一页</button>
              <span className="muted" style={{ alignSelf: 'center' }}>第 {historyPage} 页</span>
              <button className="ghost-btn" onClick={() => setHistoryPage((p) => p + 1)} disabled={historyPage * limit >= historyTotal}>下一页</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
