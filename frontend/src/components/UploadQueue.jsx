import { useRef, useState } from 'react';
import { api } from '../api/client.js';

let _uid = 0;

function fmtSize(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// 可复用的「多选 → 待上传队列 → 清空/开始上传 → 每个文件显示任务号」上传组件
// withCaption: 是否显示配文输入框(社群管理用);onUploaded: 每上传成功一个回调一次(刷新列表/统计)
export default function UploadQueue({ withCaption = false, onUploaded }) {
  const [items, setItems] = useState([]); // {uid, file, name, size, status:'pending'|'uploading'|'done'|'error', taskId, error}
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const inputRef = useRef(null);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    setItems((prev) => {
      const seen = new Set(prev.map((it) => it.name + ':' + it.size));
      const adds = incoming
        .filter((f) => !seen.has(f.name + ':' + f.size))
        .map((f) => ({ uid: ++_uid, file: f, name: f.name, size: f.size, status: 'pending' }));
      return [...prev, ...adds];
    });
  };

  const removeItem = (uid) => {
    if (uploading) return;
    setItems((prev) => prev.filter((it) => it.uid !== uid));
  };
  const clearAll = () => { if (!uploading) setItems([]); };

  const pendingCount = items.filter((it) => it.status === 'pending').length;
  const totalBytes = items.reduce((s, it) => s + it.size, 0);

  const startUpload = async () => {
    const pend = items.filter((it) => it.status === 'pending');
    if (!pend.length || uploading) return;
    setUploading(true);
    for (const it of pend) {
      setItems((prev) => prev.map((x) => (x.uid === it.uid ? { ...x, status: 'uploading' } : x)));
      try {
        const form = new FormData();
        form.append('files', it.file);
        if (withCaption && caption.trim()) form.append('caption', caption.trim());
        const r = await api.uploadTasks(form);
        const taskId = r?.created?.[0]?.id;
        setItems((prev) => prev.map((x) => (x.uid === it.uid ? { ...x, status: 'done', taskId } : x)));
        onUploaded && onUploaded();
      } catch (err) {
        setItems((prev) => prev.map((x) => (x.uid === it.uid ? { ...x, status: 'error', error: err.message } : x)));
      }
    }
    setUploading(false);
  };

  return (
    <div>
      {withCaption && (
        <>
          <div className="field-label">主题 / 关键词(AI 自动生成文案 + 标签 · 留空用默认)</div>
          <textarea
            className="text-input"
            style={{ width: '100%', minHeight: 64, resize: 'vertical', marginBottom: 20 }}
            placeholder="例如:健身日常 / 海边度假 …… AI 会据此生成吸引人的文案和话题标签"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </>
      )}

      <div className="field-label">选择视频文件</div>
      <div
        className={`dropzone ${drag ? 'drag' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
      >
        <div className="big">拖拽视频到这里 · 或点击选择文件</div>
        <div className="small">支持多选 · 单文件 ≤ 5 GB</div>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {items.length > 0 && (
        <>
          <div className="queue-bar">
            <div className="summary">
              {items.length} 个文件 · 共 {fmtSize(totalBytes)} · 待上传 {pendingCount}
            </div>
            <div className="queue-actions">
              <button className="ghost-btn" onClick={clearAll} disabled={uploading}>清空</button>
              <button className="btn-primary" onClick={startUpload} disabled={uploading || pendingCount === 0}>
                {uploading ? '上传中…' : '开始上传'}
              </button>
            </div>
          </div>

          <div className="queue-list">
            {items.map((it) => (
              <div className="queue-row" key={it.uid}>
                <div className="qinfo">
                  <div className="fname">{it.name}</div>
                  <div className="fsize">{fmtSize(it.size)}</div>
                </div>
                <div className="qstatus">
                  {it.status === 'pending' && (
                    <>
                      <span className="muted">待上传</span>
                      <button className="qdel" onClick={() => removeItem(it.uid)} title="移除">×</button>
                    </>
                  )}
                  {it.status === 'uploading' && <span className="status-pill processing">上传中…</span>}
                  {it.status === 'done' && (
                    <span className="status-pill posted">✅ 任务 #{it.taskId ?? '—'}</span>
                  )}
                  {it.status === 'error' && (
                    <span className="status-pill failed" title={it.error}>✗ 失败</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
