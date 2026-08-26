import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TYPE_OPTIONS = [
  { value: 1, label: '免费' },
  { value: 2, label: '金币解锁' },
];

export default function CommunityPost() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [topics, setTopics] = useState('');
  const [type, setType] = useState(1);
  const [unlockCoins, setUnlockCoins] = useState('');
  const [note, setNote] = useState('');

  const submit = (e) => {
    e.preventDefault();
    setNote(
      '这个功能还差最后一步:需要去 hanimepro 后台"帖子管理"页面点一次"+ 添加",' +
      '把弹出的新增帖子表单填完提交,抓一下那条请求的 Headers(Request URL)和 Payload' +
      '(尤其是图片是直接一起提交还是要先单独上传拿 URL)发给我,我马上把发布功能接上。' +
      '在那之前这个表单还不能真的发布。'
    );
  };

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className="tg-banner warn">
        <span className="dot" style={{ background: 'var(--amber)' }} />
        发布接口还没接入,填完点发布会提示需要补充后台接口信息(不会真的提交)
      </div>

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
          <div>
            <div className="muted small" style={{ marginBottom: 6 }}>话题标签(逗号分隔)</div>
            <input className="text-input" style={{ width: '100%' }} value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="例如:cosplay,偷拍自拍" />
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
            <div className="muted small" style={{ marginBottom: 6 }}>图片</div>
            <div className="empty" style={{ padding: 20, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 10 }}>
              图片上传还没接入,等确认后台接口后补上
            </div>
          </div>
          {note && <div className="small" style={{ color: 'var(--amber)', lineHeight: 1.6 }}>{note}</div>}
          <button className="btn-primary" type="submit" style={{ alignSelf: 'flex-start', padding: '10px 28px' }}>发布</button>
        </form>
      </div>
    </div>
  );
}
