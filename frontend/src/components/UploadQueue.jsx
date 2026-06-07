import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import TagPicker from './TagPicker.jsx';

let _uid = 0;
// 本地上传可达 200MB/s,真实进度会一闪而过。让进度条至少花这么久填满,确保肉眼可见。
const MIN_UPLOAD_MS = 1500;

function fmtSize(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
// 进度条里的紧凑写法:276M / 909M
function fmtMB(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)}M`;
  return `${Math.max(1, Math.round(bytes / 1024))}K`;
}
// 速度:bytes/s -> 1.00MB/s 或 320KB/s
function fmtSpeed(bps) {
  if (!bps || bps < 0) return '0KB/s';
  if (bps >= 1048576) return `${(bps / 1048576).toFixed(2)}MB/s`;
  return `${Math.max(1, Math.round(bps / 1024))}KB/s`;
}
function pctOf(it) {
  if (it.total) return (it.loaded / it.total) * 100;
  return it.progress || 0;
}
// 大绿条里居中显示的百分比 / 流量 / 颜色
function bigPct(it) {
  if (it.status === 'processing') return 100;
  if (it.status === 'posted') return 100;
  if (it.status === 'error' || it.status === 'canceled') return pctOf(it);
  return pctOf(it);
}
function bigColor(it) {
  if (it.status === 'error') return 'var(--red, #e5484d)';
  if (it.status === 'canceled') return 'var(--muted, #888)';
  return 'var(--green)';
}
function bigLabel(it) {
  if (it.status === 'uploading') return `${bigPct(it).toFixed(0)}%`;
  if (it.status === 'processing') return '发布中…';
  if (it.status === 'posted') return '已发布';
  if (it.status === 'canceled') return '已取消';
  if (it.status === 'error') return '失败';
  return '';
}

// 可复用的「多选 → 待上传队列 → 每个文件独立富进度条 → 发布跟踪」上传组件
// withCaption: 是否显示配文输入框(社群管理用);onUploaded: 每上传成功一个回调一次
// onViewTask(taskId): 点「查看任务」时回调(社群页用来打开详情弹窗);不传则跳转 /community
export default function UploadQueue({ withCaption = false, onUploaded, onViewTask }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]); // {uid,file,name,size,status,taskId,progress,loaded,total,speed,error}
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [pickerUid, setPickerUid] = useState(null); // 正在为哪个文件选分类
  const [concurrency, setConcurrency] = useState(
    () => Number(localStorage.getItem('yule_upload_concurrency')) || 2
  );
  const inputRef = useRef(null);
  const aborts = useRef({}); // uid -> AbortController(用于单文件取消)

  useEffect(() => {
    localStorage.setItem('yule_upload_concurrency', String(concurrency));
  }, [concurrency]);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    setItems((prev) => {
      const seen = new Set(prev.map((it) => it.name + ':' + it.size));
      const adds = incoming
        .filter((f) => !seen.has(f.name + ':' + f.size))
        .map((f) => ({ uid: `${Date.now()}-${++_uid}`, file: f, name: f.name, size: f.size, status: 'pending', keyword: '' }));
      return [...prev, ...adds];
    });
  };

  // 正在上传中的文件不能直接移除(请用取消按钮);其余状态随时可移除
  const removeItem = (uid) => {
    setItems((prev) => prev.filter((it) => it.uid !== uid || it.status === 'uploading'));
  };
  const clearAll = () => { if (!uploading) setItems([]); };

  // 给单个待上传文件设它自己的关键词(一一对应:视频N → 关键词N),决定该条 AI 文案与标签
  const setKeyword = (uid, keyword) => {
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, keyword } : it)));
  };

  const cancelItem = (uid) => {
    const ac = aborts.current[uid];
    if (ac) ac.abort();
  };

  // 失败 / 已取消的文件,重新放回上传(file 对象仍在内存里,可直接重传)
  const retryItem = async (uid) => {
    const it = items.find((x) => x.uid === uid);
    if (!it || !it.file) return;
    setUploading(true);
    await uploadOne(it);
    setUploading(false);
  };

  // 查看任务:社群页传 onViewTask 打开详情弹窗;否则跳到社群页
  const viewTask = (taskId) => {
    if (onViewTask) onViewTask(taskId);
    else navigate('/community');
  };

  const pendingCount = items.filter((it) => it.status === 'pending').length;
  const totalBytes = items.reduce((s, it) => s + it.size, 0);

  const uploadOne = async (it) => {
    const ac = new AbortController();
    aborts.current[it.uid] = ac;
    const startedAt = Date.now();
    // real:XHR 回报的真实进度;ticker 据此算出「显示进度」(被 MIN_UPLOAD_MS 限速,保证可见)
    const real = { pct: 0, loaded: 0, total: it.size };
    let lastLoaded = 0;
    let lastTime = startedAt;
    let shownSpeed = 0;

    setItems((prev) => prev.map((x) =>
      x.uid === it.uid ? { ...x, status: 'uploading', progress: 0, loaded: 0, total: it.size, speed: 0 } : x));

    const ticker = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const timePct = Math.min(100, (elapsed / MIN_UPLOAD_MS) * 100);
      // 显示进度 = 真实进度和「时间允许的进度」取较小值:
      //   秒传时被时间限速,慢传时跟随真实进度。
      const pct = Math.min(real.pct, timePct);
      const total = real.total || it.size;
      const loaded = Math.round((total * pct) / 100);
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      if (dt > 0) { shownSpeed = (loaded - lastLoaded) / dt; lastLoaded = loaded; lastTime = now; }
      setItems((prev) => prev.map((x) =>
        x.uid === it.uid && x.status === 'uploading'
          ? { ...x, progress: pct, loaded, total, speed: shownSpeed } : x));
    }, 80);

    try {
      const form = new FormData();
      form.append('files', it.file);
      // 关键词 = 上方默认 + 该文件自己的关键词(都填则拼一起,如「肌肉猛男 性爱」;
      // 想一一对应就把上方留空,每个文件单独填)
      const kw = [caption.trim(), (it.keyword || '').trim()].filter(Boolean).join(' ');
      if (withCaption && kw) form.append('caption', kw);
      const r = await api.uploadTasks(form, (info) => {
        real.pct = info.percent;
        real.loaded = info.loaded;
        real.total = info.total;
      }, ac.signal);
      // 传输完成,但确保进度条至少显示满 MIN_UPLOAD_MS 再进入下一阶段
      real.pct = 100;
      await new Promise((res) => setTimeout(res, Math.max(0, MIN_UPLOAD_MS - (Date.now() - startedAt))));
      clearInterval(ticker);
      const taskId = r?.created?.[0]?.id;
      // 传输完成 ≠ 发布完成:后端还要转码 + 截图 + 发到 TG,进入 processing 由下面轮询跟踪
      setItems((prev) => prev.map((x) =>
        x.uid === it.uid ? { ...x, status: 'processing', progress: 100, taskId } : x));
      onUploaded && onUploaded();
    } catch (err) {
      clearInterval(ticker);
      if (err.name === 'AbortError') {
        setItems((prev) => prev.map((x) => (x.uid === it.uid ? { ...x, status: 'canceled' } : x)));
      } else {
        setItems((prev) => prev.map((x) => (x.uid === it.uid ? { ...x, status: 'error', error: err.message } : x)));
      }
    } finally {
      delete aborts.current[it.uid];
    }
  };

  // 并发上传:用 concurrency 个 worker 从队列里取任务
  const startUpload = async () => {
    const queue = items.filter((it) => it.status === 'pending');
    if (!queue.length || uploading) return;
    setShowSettings(false);
    setUploading(true);
    let idx = 0;
    const worker = async () => {
      while (idx < queue.length) {
        const it = queue[idx++];
        await uploadOne(it);
      }
    };
    const n = Math.max(1, Math.min(concurrency, queue.length));
    await Promise.all(Array.from({ length: n }, () => worker()));
    setUploading(false);
  };

  // 上传完成后,后端仍在转码/发布。轮询任务状态直到 posted/failed,
  // 让用户在本地秒传的环境下也能持续看到「发布中…」反馈。
  const watching = items
    .filter((it) => it.status === 'processing' && it.taskId)
    .map((it) => it.taskId)
    .join(',');
  useEffect(() => {
    if (!watching) return;
    let alive = true;
    const tick = async () => {
      try {
        const tasks = await api.listTasks();
        const byId = new Map(tasks.map((t) => [t.id, t]));
        if (!alive) return;
        setItems((prev) =>
          prev.map((it) => {
            if (it.status !== 'processing' || !it.taskId) return it;
            const t = byId.get(it.taskId);
            if (!t) return it;
            if (t.status === 'posted') return { ...it, status: 'posted' };
            if (t.status === 'failed') return { ...it, status: 'error', error: t.error || '处理失败' };
            return it;
          })
        );
      } catch {
        /* ignore，下个周期再试 */
      }
    };
    const id = setInterval(tick, 3000);
    tick();
    return () => { alive = false; clearInterval(id); };
  }, [watching]);

  return (
    <div>
      {withCaption && (
        <>
          <div className="field-label">默认关键词(可留空 · 想给每个视频单独填,就用下方每行的「关键词N」框,视频1↔关键词1 一一对应)</div>
          <textarea
            className="text-input"
            style={{ width: '100%', minHeight: 64, resize: 'vertical', marginBottom: 20 }}
            placeholder="留空则只用每个文件自己的关键词;若填了,会和每个文件的关键词拼在一起(如默认「肌肉猛男」+ 某文件「性爱」→ 肌肉猛男 性爱)"
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
              <div className="gear-wrap">
                <button className="icon-btn" title="上传设置" onClick={() => setShowSettings((v) => !v)}>⚙</button>
                {showSettings && (
                  <div className="gear-pop" onClick={(e) => e.stopPropagation()}>
                    <div className="gear-row">
                      <span>同时上传</span>
                      <select value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} disabled={uploading}>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} 个</option>)}
                      </select>
                    </div>
                    <div className="gear-hint">限速需改造为分片上传,暂未支持</div>
                  </div>
                )}
              </div>
              <button className="ghost-btn" onClick={clearAll} disabled={uploading}>清空</button>
              <button className="btn-primary" onClick={startUpload} disabled={uploading || pendingCount === 0}>
                {uploading ? '上传中…' : '开始上传'}
              </button>
            </div>
          </div>

          <div className="queue-list">
            {items.map((it, idx) => (
              it.status === 'pending' ? (
                // 待上传:序号 + 文件名 + 该文件独立关键词(视频N ↔ 关键词N)
                <div className="queue-row" key={it.uid}>
                  <div className="qinfo">
                    <div className="fname">
                      <span className="qnum" style={{ display: 'inline-block', minWidth: 22, marginRight: 6, padding: '0 6px', borderRadius: 6, background: '#eef0fb', color: '#6c5ce7', fontWeight: 600, textAlign: 'center' }}>{idx + 1}</span>
                      {it.name}
                    </div>
                    <div className="fsize">{fmtSize(it.size)}</div>
                  </div>
                  {withCaption && (
                    <div className="qkw" style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 200, margin: '0 10px' }}>
                      <input
                        className="kw-input"
                        type="text"
                        value={it.keyword || ''}
                        onChange={(e) => setKeyword(it.uid, e.target.value)}
                        placeholder={`关键词${idx + 1}(留空用上方默认)`}
                        style={{ flex: 1, minWidth: 100, padding: '5px 8px', border: '1px solid #d8dbe8', borderRadius: 6, fontSize: 13 }}
                      />
                      <button
                        type="button"
                        className="up-btn"
                        onClick={() => setPickerUid(it.uid)}
                        title="打开分类弹窗,多选标签"
                        style={{ whiteSpace: 'nowrap', padding: '5px 12px', border: '1px solid #6c5ce7', color: '#6c5ce7', background: '#fff', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
                      >
                        选分类
                      </button>
                    </div>
                  )}
                  <div className="qstatus">
                    <span className="muted">待上传</span>
                    <button className="qdel" onClick={() => removeItem(it.uid)} title="移除">×</button>
                  </div>
                </div>
              ) : (
                // 上传中 / 发布中 / 已完成 / 失败:每个文件一条大进度条
                <div className="up-card" key={it.uid}>
                  <div className="up-card-name" title={it.name}>{it.name}</div>
                  <div
                    className={`up-bigbar ${it.status === 'processing' ? 'pulsing' : ''}`}
                  >
                    <div
                      className={`up-bigfill ${it.status === 'uploading' || it.status === 'processing' ? 'striped' : ''}`}
                      style={{ width: `${bigPct(it)}%`, background: bigColor(it) }}
                    />
                    <span className="up-bigpct">{bigLabel(it)}</span>
                  </div>
                  <div className="up-bigmeta">
                    {it.status === 'uploading' && (
                      <>
                        <span>{fmtMB(it.loaded || 0)} / {fmtMB(it.total || it.size)}</span>
                        <span>{fmtSpeed(it.speed)}</span>
                      </>
                    )}
                    {it.status === 'processing' && <span>转码 + 截图 + 发布到频道中…</span>}
                    {it.status === 'posted' && <span>任务 #{it.taskId ?? '—'} 已发布到频道</span>}
                    {it.status === 'canceled' && <span>已取消上传</span>}
                    {it.status === 'error' && <span className="up-err" title={it.error}>{it.error || '处理失败'}</span>}
                  </div>
                  <div className="up-actions">
                    {it.status === 'uploading' && (
                      <button className="up-btn" onClick={() => cancelItem(it.uid)}>✕ 取消</button>
                    )}
                    {it.status === 'uploading' && (
                      <button className="up-btn" onClick={() => setShowSettings((v) => !v)}>⚙ 设置</button>
                    )}
                    {(it.status === 'error' || it.status === 'canceled') && (
                      <button className="up-btn primary" onClick={() => retryItem(it.uid)} disabled={uploading}>↻ 重试</button>
                    )}
                    {(it.status === 'posted' || it.status === 'processing' || it.status === 'error') && (
                      <button className="up-btn" onClick={() => viewTask(it.taskId)}>查看任务</button>
                    )}
                    {it.status !== 'uploading' && it.status !== 'processing' && (
                      <button className="up-btn" onClick={() => removeItem(it.uid)}>移除</button>
                    )}
                  </div>
                </div>
              )
            ))}
          </div>
        </>
      )}

      {pickerUid != null && (
        <TagPicker
          title={`选择分类 · ${items.find((it) => it.uid === pickerUid)?.name || ''}`}
          initial={items.find((it) => it.uid === pickerUid)?.keyword || ''}
          onCancel={() => setPickerUid(null)}
          onConfirm={(kw) => { setKeyword(pickerUid, kw); setPickerUid(null); }}
        />
      )}
    </div>
  );
}
