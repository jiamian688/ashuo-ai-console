import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

function VariantCard({ initial }) {
  const [text, setText] = useState(initial);
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const over = text.length > 280;

  const publish = async () => {
    setError('');
    setPosting(true);
    setResult(null);
    try {
      const r = await api.postTweet(text);
      setResult(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="variant-card">
      <textarea
        className="text-input"
        style={{ width: '100%', minHeight: 96, resize: 'vertical' }}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="variant-foot">
        <span className={`count ${over ? 'over' : ''}`}>{text.length} / 280</span>
        <button className="ghost-btn" onClick={() => navigator.clipboard.writeText(text)}>复制</button>
        <button className="btn-primary" style={{ padding: '8px 18px' }} onClick={publish} disabled={posting || over || !text.trim()}>
          {posting ? '发布中…' : '发布到 X'}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {result && (
        <div className="post-ok">
          已发布 ✅ <a className="link" href={result.url} target="_blank" rel="noreferrer">查看推文 ↗</a>
        </div>
      )}
    </div>
  );
}

export default function SocialMedia() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('');
  const [x, setX] = useState({ configured: false });
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.socialStatus().then(setX).catch(() => {});
  }, []);

  const generate = async (e) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { variants, mode } = await api.genCopy(keyword.trim(), 3);
      setVariants(variants);
      setMode(mode);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testX = async () => {
    setTesting(true);
    try {
      const r = await api.socialTest();
      alert(`连接成功 ✅\n账号: @${r.username}（${r.name}）`);
    } catch (err) {
      alert('连接失败: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className={`tg-banner ${x.configured ? 'ok' : 'warn'}`}>
        <span className="dot" style={{ background: x.configured ? 'var(--green)' : 'var(--amber)' }} />
        {x.configured
          ? 'X 已配置 · 可一键发布推文'
          : 'X 未配置 · 生成的文案可复制手动发(在 backend/.env 填 4 个 X_ 密钥后支持一键发布)'}
        <button className="ghost-btn" onClick={testX} disabled={testing}>
          {testing ? '测试中…' : '测试连接'}
        </button>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-head">AI 推特文案生成器 <span className="muted">· 关键词 → 多版本文案</span></div>
        <div className="card-body">
          <form className="todo-input" onSubmit={generate}>
            <input className="text-input" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="输入关键词,如:比特币、AI 创业、健身…" />
            <button className="btn-primary" disabled={loading}>{loading ? '生成中…' : '生成文案'}</button>
          </form>
          {error && <div className="error">{error}</div>}
          {mode === 'template' && variants.length > 0 && (
            <div className="small" style={{ color: 'var(--text-faint)', marginTop: 12 }}>
              当前为模板模式 · 在后端 .env 配置 ANTHROPIC_API_KEY 后将由 Claude 生成
            </div>
          )}
        </div>
      </div>

      {variants.length > 0 && (
        <div className="card">
          <div className="card-head">生成结果 <span className="muted">· 可编辑后发布或复制</span></div>
          <div className="card-body">
            {variants.map((v, i) => <VariantCard key={i + v.slice(0, 8)} initial={v} />)}
          </div>
        </div>
      )}
    </div>
  );
}
