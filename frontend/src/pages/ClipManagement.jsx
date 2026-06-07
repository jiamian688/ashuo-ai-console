import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fileUrl } from '../api/client.js';

const WM_POSITIONS = [
  { v: 'br', label: '右下角' },
  { v: 'bl', label: '左下角' },
  { v: 'tr', label: '右上角' },
  { v: 'tl', label: '左上角' },
];

export default function ClipManagement() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('single');
  const [file, setFile] = useState(null);
  const [watermark, setWatermark] = useState(null);
  const [wmPosition, setWmPosition] = useState('br');
  const [autoBlurText, setAutoBlurText] = useState(false);
  const [rmTop, setRmTop] = useState(false);
  const [rmBottom, setRmBottom] = useState(false);
  const [rmLeft, setRmLeft] = useState(false);
  const [rmRight, setRmRight] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);
  const wmRef = useRef(null);

  // 手动封面:上传 3 张图拼成 794×422 帖子封面(不带水印)
  const [coverImgs, setCoverImgs] = useState([]);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState('');
  const [coverResult, setCoverResult] = useState(null);
  const coverRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError('请先选择视频文件');
    setError('');
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('mode', mode);
      if (watermark) {
        form.append('watermark', watermark);
        form.append('wmPosition', wmPosition);
      }
      // 去字:全部交给 OCR —— 智能模糊 + 自动裁边(裁多少由识别到的边缘文字决定)
      if (autoBlurText) form.append('autoBlurText', '1');
      if (rmTop) form.append('cropTop', '1');
      if (rmBottom) form.append('cropBottom', '1');
      if (rmLeft) form.append('cropLeft', '1');
      if (rmRight) form.append('cropRight', '1');
      const r = await api.processClip(form);
      setResult(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const makeCover = async (e) => {
    e.preventDefault();
    if (coverImgs.length !== 3) return setCoverError('请选择 3 张图片');
    setCoverError('');
    setCoverBusy(true);
    setCoverResult(null);
    try {
      const form = new FormData();
      coverImgs.forEach((img) => form.append('images', img));
      const r = await api.makeCover(form);
      setCoverResult(r);
    } catch (err) {
      setCoverError(err.message);
    } finally {
      setCoverBusy(false);
    }
  };

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-head">剪辑管理 <span className="muted">· 自动去字 + 水印 + 智能封面(750×422 高清)</span></div>
        <div className="card-body">
          <form onSubmit={submit}>
            <div className="field-label">剪辑类型</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              {[
                ['single', '单视频', '剪辑上水印 · 自动选最佳帧做高清封面(不带水印)'],
                ['post', '帖子视频', '剪辑上水印 · 另出 4 张带水印精彩帧 + 794×422 三联帖子封面'],
              ].map(([v, label, desc]) => (
                <button key={v} type="button" onClick={() => setMode(v)}
                  style={{
                    flex: 1, textAlign: 'left', padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                    border: mode === v ? '1px solid #8b5cf6' : '1px solid var(--border, #d9d9e3)',
                    background: mode === v ? 'rgba(139,92,246,0.08)' : 'transparent',
                    color: 'inherit',
                  }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{mode === v ? '✓ ' : ''}{label}</div>
                  <div className="small" style={{ marginTop: 2 }}>{desc}</div>
                </button>
              ))}
            </div>

            <div className="field-label">选择视频文件</div>
            <div className="dropzone" onClick={() => inputRef.current?.click()} style={{ padding: 28 }}>
              <div className="big">{file ? file.name : '点击选择视频文件'}</div>
              <div className="small">{file ? `${(file.size / 1048576).toFixed(1)} MB` : '支持常见视频格式'}</div>
              <input ref={inputRef} type="file" accept="video/*" hidden
                onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>

            <div className="field-label">去除画面文字 / 水印(可选 · 全自动)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                ['智能去字（OCR）', autoBlurText, setAutoBlurText],
                ['裁顶部', rmTop, setRmTop],
                ['裁底部', rmBottom, setRmBottom],
                ['裁左侧', rmLeft, setRmLeft],
                ['裁右侧', rmRight, setRmRight],
              ].map(([label, val, set]) => (
                <button key={label} type="button" onClick={() => set(!val)}
                  style={{
                    padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 14,
                    border: val ? '1px solid #8b5cf6' : '1px solid var(--border, #d9d9e3)',
                    background: val ? '#8b5cf6' : 'transparent',
                    color: val ? '#fff' : 'inherit',
                  }}>
                  {val ? '✓ ' : ''}{label}
                </button>
              ))}
            </div>
            <div className="small" style={{ marginTop: 6 }}>
              智能去字按文字真实大小逐块模糊(目前只认英文,中文水印建议用裁边);裁顶/底/左/右会自动算出「刚好盖住该边文字」的厚度,识别不到文字时默认裁约 12%(夹在 0~25%)——勾了哪条边就一定裁掉一些 · 顶部横幅用「裁顶部」,角标 logo 用对应边 · 保持高清
            </div>

            <div className="field-label" style={{ marginTop: 18 }}>水印(可选 · 透明 PNG 或 .mov 动态水印)</div>
            <div className="clip-grid">
              <div style={{ gridColumn: 'span 2' }}>
                <div className="dropzone" onClick={() => wmRef.current?.click()} style={{ padding: 18 }}>
                  <div className="big" style={{ fontSize: 15 }}>{watermark ? watermark.name : '点击选择水印(不选则不加水印)'}</div>
                  <div className="small">{watermark ? `${watermark.size >= 1024 * 1024 ? (watermark.size / 1024 / 1024).toFixed(1) + ' MB' : (watermark.size / 1024).toFixed(0) + ' KB'}` : 'PNG / JPG 静态,或 .mov / webm / gif 动态,自动缩放循环叠加'}</div>
                  <input ref={wmRef} type="file" accept="image/*,video/*" hidden
                    onChange={(e) => setWatermark(e.target.files?.[0] || null)} />
                </div>
              </div>
              <div>
                <div className="field-label">水印位置</div>
                <select className="text-input" value={wmPosition} onChange={(e) => setWmPosition(e.target.value)} disabled={!watermark}>
                  {WM_POSITIONS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
                {watermark && (
                  <div className="small" style={{ marginTop: 6 }}>
                    <a className="link" onClick={() => setWatermark(null)}>移除水印</a>
                  </div>
                )}
              </div>
            </div>

            <button className="btn-primary" style={{ marginTop: 20, padding: '12px 24px' }} disabled={busy}>
              {busy
                ? (autoBlurText || rmTop || rmBottom || rmLeft || rmRight ? '识别 + 处理中…(OCR 较慢)' : '处理中…(大文件较慢)')
                : '开始处理'}
            </button>
          </form>
          {error && <div className="error">{error}</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-head">单独制作帖子封面 <span className="muted">· 上传 3 张图拼成 794×210(不带水印 · 人脸居中)</span></div>
        <div className="card-body">
          <form onSubmit={makeCover}>
            <div className="small" style={{ marginBottom: 8 }}>
              视频里没有人物生活照时用这里:选 3 张图(建议 1 张人物照 + 性爱图等),从左到右横向拼接,人脸自动居中偏上
            </div>
            <div className="dropzone" onClick={() => coverRef.current?.click()} style={{ padding: 22 }}>
              <div className="big" style={{ fontSize: 15 }}>
                {coverImgs.length ? `已选 ${coverImgs.length} 张${coverImgs.length === 3 ? '' : '(需 3 张)'}` : '点击选择 3 张图片'}
              </div>
              <div className="small">{coverImgs.length ? coverImgs.map((f) => f.name).join(' · ') : '按从左到右的顺序选择,支持 PNG / JPG'}</div>
              <input ref={coverRef} type="file" accept="image/*" multiple hidden
                onChange={(e) => setCoverImgs(Array.from(e.target.files || []).slice(0, 3))} />
            </div>
            <button className="btn-primary" style={{ marginTop: 16, padding: '12px 24px' }}
              disabled={coverBusy || coverImgs.length !== 3}>
              {coverBusy ? '拼接中…' : '制作封面'}
            </button>
          </form>
          {coverError && <div className="error">{coverError}</div>}
          {coverResult?.cover && (
            <div style={{ marginTop: 16 }}>
              <div className="field-label">帖子封面 · 794×210</div>
              <img className="cover-preview" src={fileUrl(coverResult.cover)} alt="cover" />
              <div><a className="link" href={fileUrl(coverResult.cover)} download>下载封面 ↓</a></div>
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="card-head">处理结果</div>
          <div className="card-body clip-result">
            {result.cover && (
              <div>
                <div className="field-label">{result.mode === 'post' ? '帖子封面 · 794×422(三联 · 不带水印)' : '封面图 · 750×422 高清'}</div>
                <img className="cover-preview" src={fileUrl(result.cover)} alt="cover" />
                <div><a className="link" href={fileUrl(result.cover)} download>下载封面 ↓</a></div>
              </div>
            )}
            {result.postImages?.length > 0 && (
              <div style={{ flexBasis: '100%' }}>
                <div className="field-label">帖子内容 · {result.postImages.length} 张精彩帧(高清 · 带水印)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {result.postImages.map((img, i) => (
                    <div key={img}>
                      <img src={fileUrl(img)} alt={`帧 ${i + 1}`}
                        style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                      <div><a className="link" href={fileUrl(img)} download>下载第 {i + 1} 张 ↓</a></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.video && (
              <div style={{ flex: 1 }}>
                <div className="field-label">
                  处理后的视频{watermark ? '(含水印)' : ''}
                  {autoBlurText && (result.textBoxes > 0
                    ? ` · 已模糊 ${result.textBoxes} 处文字`
                    : ' · 未识别到文字')}
                  {result.crop && (() => {
                    const c = result.crop;
                    const p = [];
                    if (c.top) p.push(`顶 ${c.top}%`);
                    if (c.bottom) p.push(`底 ${c.bottom}%`);
                    if (c.left) p.push(`左 ${c.left}%`);
                    if (c.right) p.push(`右 ${c.right}%`);
                    return p.length ? ` · 自动裁 ${p.join(' / ')}` : ' · 边缘无文字,未裁';
                  })()}
                </div>
                <video className="video-preview" src={fileUrl(result.video)} controls />
                <div><a className="link" href={fileUrl(result.video)} download>下载视频 ↓</a></div>
              </div>
            )}
            {!result.video && (
              <div className="empty">未去字也未加水印,仅生成了封面图。</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
