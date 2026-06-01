import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fileUrl } from '../api/client.js';

export default function ClipManagement() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [thumbAt, setThumbAt] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError('请先选择视频文件');
    setError('');
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      if (start.trim()) form.append('start', start.trim());
      if (end.trim()) form.append('end', end.trim());
      form.append('thumbAt', thumbAt.trim() || '0');
      const r = await api.processClip(form);
      setResult(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-head">剪辑管理 <span className="muted">· 视频裁剪 + 封面图生成(ffmpeg)</span></div>
        <div className="card-body">
          <form onSubmit={submit}>
            <div className="field-label">选择视频文件</div>
            <div className="dropzone" onClick={() => inputRef.current?.click()} style={{ padding: 28 }}>
              <div className="big">{file ? file.name : '点击选择视频文件'}</div>
              <div className="small">{file ? `${(file.size / 1048576).toFixed(1)} MB` : '支持常见视频格式'}</div>
              <input ref={inputRef} type="file" accept="video/*" hidden
                onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>

            <div className="clip-grid">
              <div>
                <div className="field-label">裁剪起点(秒 或 mm:ss,留空=从头)</div>
                <input className="text-input" value={start} onChange={(e) => setStart(e.target.value)} placeholder="如 0:05" />
              </div>
              <div>
                <div className="field-label">裁剪终点(秒 或 mm:ss,留空=到尾)</div>
                <input className="text-input" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="如 0:30" />
              </div>
              <div>
                <div className="field-label">封面截取时间点</div>
                <input className="text-input" value={thumbAt} onChange={(e) => setThumbAt(e.target.value)} placeholder="如 0:03" />
              </div>
            </div>

            <button className="btn-primary" style={{ marginTop: 20, padding: '12px 24px' }} disabled={busy}>
              {busy ? '处理中…(大文件较慢)' : '开始处理'}
            </button>
          </form>
          {error && <div className="error">{error}</div>}
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="card-head">处理结果</div>
          <div className="card-body clip-result">
            {result.cover && (
              <div>
                <div className="field-label">封面图</div>
                <img className="cover-preview" src={fileUrl(result.cover)} alt="cover" />
                <div><a className="link" href={fileUrl(result.cover)} download>下载封面 ↓</a></div>
              </div>
            )}
            {result.video && (
              <div style={{ flex: 1 }}>
                <div className="field-label">裁剪后的视频</div>
                <video className="video-preview" src={fileUrl(result.video)} controls />
                <div><a className="link" href={fileUrl(result.video)} download>下载视频 ↓</a></div>
              </div>
            )}
            {!result.video && (
              <div className="empty">未填写起止时间,仅生成了封面图。</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
