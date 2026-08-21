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

  const sources = status.sources?.length ? status.sources : FALLBACK_SOURCES;
  const cur = sources.find((s) => s.key === source) || sources[0];
  const rejectLabel = cur?.hasApprovalFlow ? '拒绝' : '删除';

  const load = () => {
    setLoading(true);
    setError('');
    api.listPendingComments(source, page, limit)
      .then((d) => { setList(d.list || []); setTotal(d.total || 0); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.commentReviewStatus().then(setStatus).catch(() => {});
  }, []);
  useEffect(() => { load(); setSelected({}); setSuggestions({}); setAutoResult(null); }, [page, source]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, [source]);

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
    try {
      const r = await api.autoReviewComments(source, 50);
      setAutoResult(r);
      load();
      setSelected({});
      setSuggestions({});
    } catch (err) {
      setError(err.message);
    } finally {
      setAutoBusy(false);
    }
  };

  const doPass = async (id) => {
    setActingId(id);
    try {
      await api.passComment(source, id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  };

  const doReject = async (id) => {
    const reason = cur?.hasApprovalFlow
      ? (window.prompt('拒绝理由(可留空):', suggestions[id]?.reason || '') ?? '')
      : (window.confirm('确认删除这条评论?') ? '' : null);
    if (reason === null) return;
    setActingId(id);
    try {
      await api.rejectComment(source, id, reason);
      load();
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
      setSelected({});
    } catch (err) {
      setError(err.message);
    }
  };

  const batchReject = async () => {
    if (!selectedIds.length) return;
    let reason = '';
    if (cur?.hasApprovalFlow) {
      reason = window.prompt(`批量拒绝 ${selectedIds.length} 条评论,理由(可留空):`, '') ?? '';
    } else if (!window.confirm(`确认删除选中的 ${selectedIds.length} 条评论?`)) {
      return;
    }
    try {
      await api.rejectComments(source, selectedIds, reason);
      load();
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
        <div className="card-head">
          {cur?.label || '评论'} <span className="muted">· {cur?.hasApprovalFlow ? `共 ${total} 条未审核` : `最近 ${total} 条 · 无审核队列,仅可删除违规内容`}</span>
        </div>
        <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="ghost-btn" onClick={load} disabled={loading}>{loading ? '刷新中…' : '刷新'}</button>
          <button className="ghost-btn" onClick={runAiReview} disabled={aiBusy || !list.length}>
            {aiBusy ? 'AI 审核中…' : 'AI 给出建议(不自动执行)'}
          </button>
          <button className="btn-primary" onClick={runAutoReview} disabled={autoBusy}>
            {autoBusy ? '自动审核中…' : '一键 AI 自动审核并执行'}
          </button>
          {selectedIds.length > 0 && (
            <>
              {cur?.hasApprovalFlow && <button className="ghost-btn" onClick={batchPass}>批量通过 ({selectedIds.length})</button>}
              <button className="ghost-btn" onClick={batchReject}>批量{rejectLabel} ({selectedIds.length})</button>
            </>
          )}
        </div>
        {error && <div className="error" style={{ margin: '0 20px 16px' }}>{error}</div>}
        {autoResult && (
          <div className="small" style={{ color: 'var(--text-faint)', margin: '0 20px 16px' }}>
            本轮自动审核 {autoResult.reviewed} 条 · 通过 {autoResult.passed} · {rejectLabel} {autoResult.rejected}
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
              <th>AI 建议</th>
              <th style={{ textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!loading && list.length === 0 && (
              <tr><td colSpan={7} className="empty" style={{ padding: 26 }}>暂无{cur?.hasApprovalFlow ? '待审核' : ''}评论</td></tr>
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
      </div>
    </div>
  );
}
