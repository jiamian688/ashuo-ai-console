import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const ACTION_LABEL = { pass: '建议通过', reject: '建议拒绝', error: 'AI 出错' };

export default function PostReview() {
  const navigate = useNavigate();
  const [status, setStatus] = useState({ configured: false, ai: null });
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState(null);
  const [suggestions, setSuggestions] = useState({});
  const [aiBusy, setAiBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoResult, setAutoResult] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    api.listPendingPosts(page, limit)
      .then((d) => { setList(d.list || []); setTotal(d.total || 0); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.postAdminStatus().then(setStatus).catch(() => {});
  }, []);
  useEffect(() => { load(); setSuggestions({}); setAutoResult(null); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAiReview = async () => {
    if (!list.length) return;
    setAiBusy(true);
    setError('');
    try {
      const items = list.map((p) => ({ id: p.id, title: p.title, content: p.content, images: p.images }));
      const { suggestions: sugs } = await api.aiReviewPosts(items);
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
      const r = await api.autoReviewPosts(20);
      setAutoResult(r);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAutoBusy(false);
    }
  };

  const doPass = async (id) => {
    setActingId(id);
    try {
      await api.passPost(id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  };

  const doReject = async (id) => {
    const reason = window.prompt('拒绝理由(可留空):', suggestions[id]?.reason || '帖子内容标题和主题不符。') ?? '';
    setActingId(id);
    try {
      await api.rejectPost(id, reason);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className={`tg-banner ${status.configured ? 'ok' : 'warn'}`}>
        <span className="dot" style={{ background: status.configured ? 'var(--green)' : 'var(--amber)' }} />
        {status.configured
          ? `已连接管理后台帖子接口 · AI: ${status.ai || '未配置'}`
          : '未配置管理后台 token(在 backend/.env 填 HANIME_ADMIN_TOKEN 或自动登录三件套后可用)'}
        <button className="ghost-btn" onClick={load} disabled={loading}>{loading ? '刷新中…' : '刷新'}</button>
      </div>
      {error && <div className="error" style={{ margin: '12px 0' }}>{error}</div>}
      {autoResult && (
        <div className="small" style={{ color: 'var(--text-faint)', margin: '12px 0' }}>
          本轮自动审核 {autoResult.reviewed} 条 · 通过 {autoResult.passed} · 拒绝 {autoResult.rejected}
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>待审核帖子 <span className="muted">· 共 {total} 条</span></span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="ghost-btn" onClick={runAiReview} disabled={aiBusy || !list.length}>
              {aiBusy ? 'AI 审核中…' : 'AI 给出建议(不自动执行)'}
            </button>
            <button className="btn-primary" onClick={runAutoReview} disabled={autoBusy}>
              {autoBusy ? '自动审核中…' : '一键 AI 自动审核并执行(含识图)'}
            </button>
          </div>
        </div>
        <div style={{ padding: '0 26px 26px' }}>
          {!loading && list.length === 0 && <div className="empty" style={{ padding: 26 }}>暂无待审核帖子</div>}
          {list.map((p) => {
            const sug = suggestions[p.id];
            return (
              <div key={p.id} style={{ display: 'flex', gap: 16, padding: '18px 0', borderBottom: '1px solid var(--border)' }}>
                {p.thumbUrl ? (
                  <img src={p.thumbUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: 8, background: 'var(--surface-2)', flexShrink: 0, display: 'grid', placeItems: 'center', color: 'var(--text-faint)', fontSize: 12 }}>无图</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{p.title || '(无标题)'}</div>
                  <div className="muted" style={{ margin: '4px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{p.content}</div>
                  <div className="small" style={{ color: 'var(--text-faint)' }}>
                    {p.nickname} · {p.topics || '无主题'} · {p.typeStr}{p.type === 2 ? ` ${p.unlockCoins}金币` : ''} · 图{p.photoNum} 视频{p.videoNum} · {p.createdAt}
                  </div>
                  {sug && (
                    <div style={{ marginTop: 6 }}>
                      <span className={`status-pill ${sug.action === 'pass' ? 'posted' : 'failed'}`}>{ACTION_LABEL[sug.action] || sug.action} · {sug.reason}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                  <button className="btn-primary" style={{ padding: '6px 16px' }} disabled={actingId === p.id} onClick={() => doPass(p.id)}>通过</button>
                  <button className="ghost-btn" style={{ padding: '6px 16px' }} disabled={actingId === p.id} onClick={() => doReject(p.id)}>拒绝</button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px' }}>
          <button className="ghost-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>上一页</button>
          <span className="muted" style={{ alignSelf: 'center' }}>第 {page} 页</span>
          <button className="ghost-btn" onClick={() => setPage((p) => p + 1)} disabled={page * limit >= total}>下一页</button>
        </div>
      </div>
    </div>
  );
}
