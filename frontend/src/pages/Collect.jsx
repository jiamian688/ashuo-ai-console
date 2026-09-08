import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fileUrl } from '../api/client.js';

const fmtSize = (b) => {
  if (!b) return '—';
  const mb = b / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
};

export default function Collect() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [referer, setReferer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [candidates, setCandidates] = useState(null);

  const run = () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setCandidates(null);
    api.collectVideo(url.trim(), referer.trim() || undefined)
      .then(setResult)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const extract = () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setCandidates(null);
    api.collectExtract(url.trim())
      .then((d) => setCandidates(d.urls || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className="section-head" style={{ marginTop: 20 }}>
        <h2>视频采集</h2>
        <span className="hint">m3u8 / mp4 直链,或含视频的网页地址 → 服务器下载合并成 MP4</span>
      </div>

      <div className="card card--tight">
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-soft)' }}>
            视频 / 页面地址
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://.../index.m3u8  或  https://.../video.mp4  或  网页地址"
              style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', font: 'inherit' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-soft)' }}>
            Referer(可选,下载报错/为空时填视频所在页面地址)
            <input
              value={referer}
              onChange={(e) => setReferer(e.target.value)}
              placeholder="https://..."
              style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', font: 'inherit' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" onClick={run} disabled={loading}>{loading ? '处理中…' : '开始采集'}</button>
            <button className="ghost-btn" onClick={extract} disabled={loading}>只提取地址</button>
          </div>
          <div className="hint">m3u8 会用 ffmpeg 拉全部分片合并,大视频可能要等几分钟,期间别关页面。</div>
        </div>
      </div>

      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

      {candidates && (
        <div className="card card--tight" style={{ marginTop: 12 }}>
          <div className="card-head">页面里找到 {candidates.length} 个视频地址</div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {candidates.length === 0 && <div className="hint">没找到 m3u8 / mp4。可能是动态加载,试试打开视频后在浏览器 F12 里找真实地址。</div>}
            {candidates.map((u) => (
              <div key={u} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
                <button className="ghost-btn" style={{ flexShrink: 0 }} onClick={() => { setUrl(u); setCandidates(null); }}>用这个</button>
                <span style={{ wordBreak: 'break-all', color: 'var(--text-soft)' }}>{u}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="card card--tight" style={{ marginTop: 12 }}>
          <div className="card-head">采集完成 <span className="muted">{fmtSize(result.size)} · {result.source}</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <video src={fileUrl(result.file)} controls style={{ width: '100%', maxHeight: 420, background: '#000', borderRadius: 8 }} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <a className="btn-primary" href={fileUrl(result.file)} download={result.name} style={{ textDecoration: 'none' }}>下载 MP4</a>
              <span className="hint" style={{ wordBreak: 'break-all' }}>源:{result.videoUrl}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
