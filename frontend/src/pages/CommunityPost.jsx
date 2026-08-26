import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const TYPE_OPTIONS = [
  { value: 0, label: '免费' },
  { value: 2, label: '金币解锁' },
];

export default function CommunityPost() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [aff, setAff] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState(0);
  const [unlockCoins, setUnlockCoins] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const pickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(null);
    setSubmitting(true);
    try {
      let videoImg = '';
      if (imageFile) {
        setUploading(true);
        const r = await api.uploadCommunityPostImage(imageFile);
        videoImg = r.url;
        setUploading(false);
      }
      const r = await api.createCommunityPost({
        title,
        content,
        aff,
        categoryId,
        type,
        unlockCoins: type === 2 ? Number(unlockCoins) || 0 : 0,
        videoImg,
      });
      setSuccess(r.id);
      setTitle('');
      setContent('');
      setImageFile(null);
      setImagePreview('');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      {success && (
        <div className="tg-banner ok">
          <span className="dot" style={{ background: 'var(--green)' }} />
          发布成功,帖子 ID:{success}
        </div>
      )}
      {error && <div className="error" style={{ margin: '12px 0' }}>{error}</div>}

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-head">发布新帖子</div>
        <form onSubmit={submit} style={{ padding: '0 26px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="muted small" style={{ marginBottom: 6 }}>标题</div>
            <input className="text-input" style={{ width: '100%' }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="帖子标题" required />
          </div>
          <div>
            <div className="muted small" style={{ marginBottom: 6 }}>正文</div>
            <textarea className="text-input" style={{ width: '100%', minHeight: 120, resize: 'vertical' }} value={content} onChange={(e) => setContent(e.target.value)} placeholder="帖子正文内容" required />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div className="muted small" style={{ marginBottom: 6 }}>发帖用户 AFF <span style={{ color: 'var(--text-faint)' }}>(去后台"用户管理"里查)</span></div>
              <input className="text-input" style={{ width: '100%' }} value={aff} onChange={(e) => setAff(e.target.value)} placeholder="例如 124703" required />
            </div>
            <div style={{ flex: 1 }}>
              <div className="muted small" style={{ marginBottom: 6 }}>圈子分类 ID <span style={{ color: 'var(--text-faint)' }}>(去后台"分类列表"里查)</span></div>
              <input className="text-input" style={{ width: '100%' }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="例如 362" required />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div className="muted small" style={{ marginBottom: 6 }}>类型</div>
              <select className="text-input" value={type} onChange={(e) => setType(Number(e.target.value))}>
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {type === 2 && (
              <div>
                <div className="muted small" style={{ marginBottom: 6 }}>解锁金币数</div>
                <input className="text-input" type="number" min="0" value={unlockCoins} onChange={(e) => setUnlockCoins(e.target.value)} placeholder="例如 15" />
              </div>
            )}
          </div>
          <div>
            <div className="muted small" style={{ marginBottom: 6 }}>封面图(选填,后台只有这一个图片位,不是相册)</div>
            {imagePreview ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={imagePreview} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8 }} />
                <button type="button" className="ghost-btn" onClick={() => { setImageFile(null); setImagePreview(''); }}>移除</button>
              </div>
            ) : (
              <input type="file" accept="image/*" onChange={pickImage} />
            )}
          </div>
          <button className="btn-primary" type="submit" disabled={submitting} style={{ alignSelf: 'flex-start', padding: '10px 28px' }}>
            {uploading ? '上传图片中…' : submitting ? '发布中…' : '发布'}
          </button>
        </form>
      </div>
    </div>
  );
}
