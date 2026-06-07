import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fileUrl } from '../api/client.js';
import UploadQueue from '../components/UploadQueue.jsx';

function fmtDate(s) {
  if (!s) return '—';
  // 数据库存的是 UTC 时间(SQLite datetime('now'),不带时区标记)。
  // 补上 'Z' 当作 UTC 解析,再用浏览器本地时区显示(你的电脑设成泰国时间,就显示泰国时间)。
  const iso = (s.includes('T') ? s : s.replace(' ', 'T'));
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
const CAPTION_MODE_LABEL = {
  claude: 'AI 生成(Claude) ✅',
  grok: 'AI 生成(Grok) ✅',
  template: '模板兜底(未配 AI 或已降级)',
  error: 'AI 调用出错,改用了你填的原文',
};
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
  const [tg, setTg] = useState({ configured: false });
  const [testing, setTesting] = useState(false);
  const [detail, setDetail] = useState(null); // 当前查看的任务
  const [copied, setCopied] = useState(false);

  const copyCaption = async (text) => {
    const s = text || '';
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(s);
      } else {
        throw new Error('clipboard api unavailable');
      }
    } catch {
      // 兜底:非安全上下文 / 无剪贴板权限时,用临时 textarea + execCommand
      try {
        const ta = document.createElement('textarea');
        ta.value = s;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        alert('复制失败,请手动选中复制');
        return;
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  // screenshots 在库里存的是 JSON 字符串,转成数组
  const shotsOf = (t) => {
    if (!t?.screenshots) return [];
    try { return JSON.parse(t.screenshots) || []; } catch { return []; }
  };

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
          <UploadQueue
            withCaption
            onUploaded={load}
            onViewTask={(id) => {
              const t = tasks.find((x) => x.id === id);
              if (t) setDetail(t);
            }}
          />
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
                  <span className="link" style={{ cursor: 'pointer' }} onClick={() => setDetail(t)}>查看 →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              任务 #{detail.id}
              <button className="qdel" onClick={() => setDetail(null)} title="关闭">×</button>
            </div>
            <div className="modal-body">
              <div className="kv"><span>状态</span><b><span className={`status-pill ${detail.status}`}>{STATUS_LABEL[detail.status] || detail.status}</span></b></div>
              <div className="kv"><span>文件</span><b>{detail.original_name || '—'}</b></div>
              <div className="kv"><span>创建时间</span><b>{fmtDate(detail.created_at)}</b></div>
              <div className="kv"><span>耗时</span><b>{fmtDuration(detail.duration_seconds)}</b></div>
              <div className="kv"><span>文案来源</span><b>{CAPTION_MODE_LABEL[detail.caption_mode] || '—'}</b></div>
              {detail.caption && (
                <div className="kv-block">
                  <div className="kv-block-head">
                    <span>发布的文案</span>
                    <button className="mini-btn" onClick={() => copyCaption(detail.caption)}>
                      {copied ? '已复制 ✓' : '复制文案'}
                    </button>
                  </div>
                  <pre className="caption-box">{detail.caption}</pre>
                </div>
              )}
              {shotsOf(detail).length > 0 && (
                <div className="kv-block">
                  <span>截图(点图可看大图 · 保存到本地)</span>
                  <div className="shot-grid">
                    {shotsOf(detail).map((p, i) => (
                      <div className="shot-cell" key={i}>
                        <a href={fileUrl(p)} target="_blank" rel="noreferrer">
                          <img src={fileUrl(p)} alt={`截图${i + 1}`} />
                        </a>
                        <a className="mini-btn" href={fileUrl(p)} download={`task-${detail.id}-shot-${i + 1}.jpg`}>
                          保存图片 ↓
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detail.video_path && (
                <div className="kv-block">
                  <div className="kv-block-head">
                    <span>成品视频</span>
                    <a className="mini-btn" href={fileUrl(detail.video_path)} download={`task-${detail.id}.mp4`}>
                      保存视频 ↓
                    </a>
                  </div>
                  <video className="detail-video" src={fileUrl(detail.video_path)} controls />
                </div>
              )}
              {detail.status === 'failed' && (
                <div className="kv-block">
                  <span>失败原因</span>
                  <pre className="error-box">{detail.error || '未记录具体原因'}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
