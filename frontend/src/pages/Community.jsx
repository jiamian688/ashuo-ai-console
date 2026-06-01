import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

function fmtDate(s) {
  if (!s) return '—';
  return s.replace('T', ' ').slice(0, 16);
}
function fmtDuration(sec) {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}
const STATUS_LABEL = { posted: 'posted', queued: 'queued', processing: 'processing', failed: 'failed' };

export default function Community() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [tg, setTg] = useState({ configured: false });
  const [testing, setTesting] = useState(false);
  const inputRef = useRef(null);

  const load = () => api.listTasks().then(setTasks).catch(() => {});
  useEffect(() => {
    load();
    api.telegramStatus().then(setTg).catch(() => {});
    const t = setInterval(load, 4000); // 轮询刷新处理中状态
    return () => clearInterval(t);
  }, []);

  const testTg = async () => {
    setTesting(true);
    try {
      const r = await api.telegramTest();
      alert(`连接成功 ✅\nBot: @${r.botUsername}\n已发送测试消息: ${r.pinged ? '是' : '否'}`);
    } catch (err) {
      alert('连接失败: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    if (caption.trim()) form.append('caption', caption.trim());
    setUploading(true);
    try {
      await api.uploadTasks(form);
      load();
    } catch (err) {
      alert('上传失败: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className={`tg-banner ${tg.configured ? 'ok' : 'warn'}`}>
        <span className="dot" style={{ background: tg.configured ? 'var(--green)' : 'var(--amber)' }} />
        {tg.configured
          ? 'Telegram 已配置 · 上传后将真实发布到频道'
          : 'Telegram 未配置 · 当前为演示模式(在 backend/.env 填入 BOT_TOKEN 和 CHAT_ID)'}
        <button className="ghost-btn" onClick={testTg} disabled={testing}>
          {testing ? '测试中…' : '测试连接'}
        </button>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-head">上传新任务</div>
        <div className="card-body">
          <div className="field-label">配文(可选,作为 Telegram caption)</div>
          <textarea
            className="text-input"
            style={{ width: '100%', minHeight: 64, resize: 'vertical', marginBottom: 20 }}
            placeholder="给这条视频写点说明文字…"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <div className="field-label">选择视频文件</div>
          <div
            className={`dropzone ${drag ? 'drag' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
          >
            <div className="big">{uploading ? '上传中…' : '拖拽视频到这里 · 或点击选择文件'}</div>
            <div className="small">支持多选 · 单文件 ≤ 5 GB</div>
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">任务列表 <span className="muted">· 仅你上传的任务</span></div>
        <table>
          <thead>
            <tr>
              <th style={{ width: 80 }}>#</th>
              <th>上传者</th>
              <th>状态</th>
              <th>创建</th>
              <th>耗时</th>
              <th style={{ textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr><td colSpan={6} className="empty" style={{ padding: 26 }}>还没有任务,上传一个视频试试</td></tr>
            )}
            {tasks.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{t.uploader}</td>
                <td>
                  <span className={`status-pill ${t.status}`}>
                    <span className="dot" style={{ background: 'currentColor', opacity: 0.7 }} />
                    {STATUS_LABEL[t.status] || t.status}
                  </span>
                </td>
                <td>{fmtDate(t.created_at)}</td>
                <td>{fmtDuration(t.duration_seconds)}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className="link">查看 →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
