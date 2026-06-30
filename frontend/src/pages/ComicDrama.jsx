import { useState, useRef } from 'react';

/* ─── 常量 ─── */
const FLOW_STEPS = [
  { no: 1, icon: '📝', title: '剧本与分镜设计', desc: 'AI生成剧本与分镜', color: '#6c5ce7' },
  { no: 2, icon: '🎨', title: '画面生成制作', desc: 'AI生成人物与场景', color: '#0984e3' },
  { no: 3, icon: '✨', title: '动态分镜处理', desc: 'AI创作镜头与特效', color: '#00b894' },
  { no: 4, icon: '🎙', title: '音效与配音生成', desc: 'AI自动生成配音与音效', color: '#e17055' },
  { no: 5, icon: '🎬', title: '视频片段合成', desc: 'AI合成动漫画片段', color: '#fd79a8' },
  { no: 6, icon: '🚀', title: '发布与观看', desc: '分享并观看动漫画剧', color: '#fdcb6e' },
];

const GENRES = ['都市爱情', '甜宠日常', '搞笑反转', '职场对话', '古风言情', '武侠奇谭'];

const TOOL_LINKS = [
  { label: 'Leonardo AI', sub: '角色图生成', url: 'https://leonardo.ai', color: '#6c5ce7' },
  { label: '即梦 AI', sub: '图转视频·字节出品', url: 'https://jimeng.jianying.com', color: '#0984e3' },
  { label: '海螺 AI', sub: '口型同步视频', url: 'https://hailuoai.com', color: '#00b894' },
  { label: '剪映', sub: '配音·字幕·剪辑', url: 'https://www.capcut.cn', color: '#e17055' },
];

const INIT_PROJECTS = [];

const STEP_LABELS = ['剧本', '分镜', '角色图', '视频片段', '合成', '发布'];

/* ─── 自动拆解分镜算法 ─── */
function parseScriptToBoards(text) {
  if (!text.trim()) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const boards = [];
  let currentScene = '';
  let id = 1;

  for (const line of lines) {
    // 场景行：【...】或 (场景：...) 或纯描述行（无冒号）
    const sceneMatch = line.match(/^[【\[(](.+?)[】\])]/) || line.match(/^场景[：:]\s*(.+)/);
    if (sceneMatch) {
      currentScene = sceneMatch[1] || line;
      continue;
    }

    // 旁白行
    const narMatch = line.match(/^[（(]旁白[）)][：:]?\s*(.+)/);
    if (narMatch) {
      boards.push({ id: id++, scene: currentScene || '延续场景', role: '旁白', action: '画外音', dialog: narMatch[1], dur: 3, locked: false });
      continue;
    }

    // 对白行：角色名：台词 / 角色名（动作）：台词
    const dialogMatch = line.match(/^([^：:（(]{1,10})(?:[（(]([^）)]+)[）)])?[：:]\s*(.+)/);
    if (dialogMatch) {
      const role = dialogMatch[1].trim();
      const action = dialogMatch[2] || '';
      const dialog = dialogMatch[3].trim();
      // 过滤掉明显是标题或说明的行
      if (role.length <= 8 && dialog.length > 0) {
        boards.push({ id: id++, scene: currentScene || '延续场景', role, action, dialog, dur: Math.max(3, Math.ceil(dialog.length / 8)), locked: false });
        continue;
      }
    }

    // 没匹配到，当作场景描述
    if (line.length > 2 && !line.startsWith('#') && !line.startsWith('-')) {
      currentScene = line;
    }
  }

  // 若解析结果为空，按每2行强制切割
  if (boards.length === 0) {
    const chunks = [];
    for (let i = 0; i < lines.length; i += 2) {
      chunks.push({ id: id++, scene: lines[i] || '场景', role: '角色', action: '', dialog: lines[i + 1] || '', dur: 4, locked: false });
    }
    return chunks;
  }
  return boards;
}

/* ─── 样式常量 ─── */
const labelStyle = { fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 };
const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' };
const outlineBtn = { padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', cursor: 'pointer', fontSize: 13 };
const smallBtn = { width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 };

/* ─── 片段列表组件 ─── */
function ClipList({ clips, boards, onMove, onRemove }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {clips.map((c, i) => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <span style={{ color: '#6c5ce7', fontWeight: 700, minWidth: 28 }}>#{i + 1}</span>
          {boards[i] && (
            <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--card)', padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap', border: '1px solid var(--border)' }}>
              {boards[i].role}：{boards[i].dialog.slice(0, 12)}…
            </span>
          )}
          <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)' }}>{c.name}</span>
          {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#6c5ce7' }}>预览</a>}
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => onMove(i, -1)} disabled={i === 0} style={{ ...smallBtn, opacity: i === 0 ? 0.3 : 1 }}>↑</button>
            <button onClick={() => onMove(i, 1)} disabled={i === clips.length - 1} style={{ ...smallBtn, opacity: i === clips.length - 1 ? 0.3 : 1 }}>↓</button>
            <button onClick={() => onRemove(c.id)} style={{ ...smallBtn, color: '#e17055', borderColor: '#e1705544' }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── AI 自动生成卡片 ─── */
function AutoGenCard({ board, idx, task, onSubmit, onAddClip }) {
  const [imageUrl, setImageUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [expanded, setExpanded] = useState(false);

  const statusColor = { submitting: '#fdcb6e', processing: '#0984e3', completed: '#00b894', failed: '#e17055' };
  const statusLabel = { submitting: '提交中...', processing: '生成中...', completed: '已完成', failed: '失败' };

  return (
    <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <span style={{ minWidth: 28, height: 28, borderRadius: '50%', background: '#6c5ce7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{idx + 1}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#6c5ce7' }}>{board.role}</span>
        <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{board.dialog}"</span>
        {task.status && (
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${statusColor[task.status]}22`, color: statusColor[task.status], border: `1px solid ${statusColor[task.status]}44` }}>
            {statusLabel[task.status]}
          </span>
        )}
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div style={{ padding: 14 }}>
          {task.status === 'completed' && task.urls?.length > 0 ? (
            <div>
              <div style={{ fontSize: 13, color: '#00b894', fontWeight: 600, marginBottom: 10 }}>✅ 视频已生成</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {task.urls.map((url, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <video src={url} controls style={{ width: 160, borderRadius: 8, border: '1px solid var(--border)' }} />
                    <button onClick={() => onAddClip(url)} className="btn-primary" style={{ fontSize: 12, padding: '5px 10px' }}>
                      + 加入合成列表
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : task.status === 'processing' || task.status === 'submitting' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: '#0984e311', borderRadius: 8 }}>
              <div style={{ width: 16, height: 16, border: '2px solid #0984e3', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13, color: '#0984e3' }}>AI 正在生成视频，约需 30-60 秒...</span>
            </div>
          ) : task.status === 'failed' ? (
            <div style={{ padding: 10, background: '#e1705522', borderRadius: 8, fontSize: 13, color: '#e17055', marginBottom: 10 }}>
              生成失败：{task.error}
            </div>
          ) : null}

          {(!task.status || task.status === 'failed') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: task.status === 'failed' ? 0 : 0 }}>
              <div>
                <label style={labelStyle}>分镜图片 URL（从 Leonardo/即梦 复制）</label>
                <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://... 粘贴图片链接" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>运动提示词（可选，默认用台词）</label>
                <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={`默认：${board.dialog}`} style={inputStyle} />
              </div>
              <button className="btn-primary" onClick={() => onSubmit(imageUrl, prompt || board.dialog)} disabled={!imageUrl.trim()} style={{ opacity: imageUrl.trim() ? 1 : 0.5 }}>
                🎬 生成此分镜视频（{board.dur}s）
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── 分镜卡片组件 ─── */
function BoardCard({ board, idx, total, onChange, onDelete, onMove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...board });

  const save = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft({ ...board }); setEditing(false); };

  return (
    <div style={{
      background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)',
      overflow: 'hidden', transition: 'box-shadow .15s',
    }}>
      {/* 卡片头 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ minWidth: 28, height: 28, borderRadius: '50%', background: '#6c5ce7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
          {idx + 1}
        </span>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {board.scene}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onMove(idx, -1)} disabled={idx === 0} style={{ ...smallBtn, opacity: idx === 0 ? 0.3 : 1 }} title="上移">↑</button>
          <button onClick={() => onMove(idx, 1)} disabled={idx === total - 1} style={{ ...smallBtn, opacity: idx === total - 1 ? 0.3 : 1 }} title="下移">↓</button>
          <button onClick={() => setEditing(!editing)} style={{ ...smallBtn, color: '#6c5ce7', borderColor: '#6c5ce744' }} title="编辑">✏️</button>
          <button onClick={() => onDelete(board.id)} style={{ ...smallBtn, color: '#e17055', borderColor: '#e1705544' }} title="删除">✕</button>
        </div>
      </div>

      {/* 卡片内容 */}
      {!editing ? (
        <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>角色</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6c5ce7' }}>{board.role}</div>
            {board.action && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>（{board.action}）</div>}
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>台词</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>"{board.dialog}"</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>时长</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{board.dur}s</div>
          </div>
        </div>
      ) : (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>场景背景</label>
              <input value={draft.scene} onChange={e => setDraft(d => ({ ...d, scene: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>角色名</label>
              <input value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>动作/表情</label>
              <input value={draft.action} onChange={e => setDraft(d => ({ ...d, action: e.target.value }))} placeholder="如：皱眉、微笑、转身..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>时长（秒）</label>
              <input type="number" min={2} max={10} value={draft.dur} onChange={e => setDraft(d => ({ ...d, dur: Number(e.target.value) }))} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>台词</label>
            <textarea value={draft.dialog} onChange={e => setDraft(d => ({ ...d, dialog: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={save} style={{ flex: 1, padding: '7px' }}>保存</button>
            <button onClick={cancel} style={{ ...outlineBtn, flex: 1 }}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 项目卡片 ─── */
function ProjectCard({ project, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--card)', borderRadius: 12, overflow: 'hidden',
      cursor: 'pointer', border: '1px solid var(--border)',
      transition: 'transform .15s, box-shadow .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px #0002'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{ height: 100, background: 'linear-gradient(135deg,#2d1066,#6c5ce7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🎭</div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>{project.date}</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {STEP_LABELS.map((l, i) => (
            <span key={l} style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 4,
              background: i < project.step ? '#6c5ce7' : 'var(--bg)',
              color: i < project.step ? '#fff' : 'var(--muted)',
              border: `1px solid ${i < project.step ? '#6c5ce7' : 'var(--border)'}`,
            }}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── 工作区 ─── */
function ProjectWorkspace({ project, onBack, onSave }) {
  const [activeStep, setActiveStep] = useState(0);
  const [genre, setGenre] = useState('');
  const [theme, setTheme] = useState('');
  const [charA, setCharA] = useState('');
  const [charB, setCharB] = useState('');
  const [script, setScript] = useState('');
  const [loadingScript, setLoadingScript] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [boards, setBoards] = useState([]); // 分镜列表
  const [copied, setCopied] = useState(false);
  const [clips, setClips] = useState([]);
  const [imgTasks, setImgTasks] = useState({}); // boardId → { taskId, status, urls[], prompt }
  const [clipMode, setClipMode] = useState('upload'); // 'upload' | 'auto'
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState(null);
  const [mergeError, setMergeError] = useState('');
  const [balance, setBalance] = useState(null);
  const clipInputRef = useRef(null);

  const loadBalance = async () => {
    try {
      const res = await fetch('/api/comic/balance', { headers: { Authorization: `Bearer ${localStorage.getItem('yule_token')}` } });
      if (res.ok) setBalance(await res.json());
    } catch {}
  };

  const submitImg2Video = async (board, imageUrl, prompt) => {
    setImgTasks(prev => ({ ...prev, [board.id]: { taskId: null, status: 'submitting', urls: [], prompt } }));
    try {
      const res = await fetch('/api/comic/img2video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('yule_token')}` },
        body: JSON.stringify({ imageUrl, prompt: prompt || board.dialog, duration: board.dur, width: 1080, height: 1920 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const taskId = data.taskId;
      setImgTasks(prev => ({ ...prev, [board.id]: { taskId, status: 'processing', urls: [], prompt } }));
      // 开始轮询
      pollTask(board.id, taskId);
    } catch (err) {
      setImgTasks(prev => ({ ...prev, [board.id]: { taskId: null, status: 'failed', urls: [], prompt, error: err.message } }));
    }
  };

  const pollTask = (boardId, taskId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/comic/task/${taskId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('yule_token')}` } });
        const data = await res.json();
        if (data.status === 'completed') {
          clearInterval(interval);
          const urls = (data.outputs || []).map(o => o.url).filter(Boolean);
          setImgTasks(prev => ({ ...prev, [boardId]: { ...prev[boardId], status: 'completed', urls } }));
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setImgTasks(prev => ({ ...prev, [boardId]: { ...prev[boardId], status: 'failed', error: data.error } }));
        }
      } catch { clearInterval(interval); }
    }, 4000);
  };

  const addClipFromUrl = (url, name) => {
    setClips(prev => [...prev, { id: Date.now(), file: null, name: name || url.split('/').pop(), url }]);
  };

  const buildPrompt = () => {
    const g = genre || '都市爱情'; const t = theme || '偶遇重逢';
    const a = charA || '男主'; const b = charB || '女主';
    return `请为我写一段漫剧剧本，要求：
- 类型：${g}，主题：${t}
- 角色A（${a}）：性格鲜明，有反差感
- 角色B（${b}）：情绪丰富，对话有张力
- 格式：每个场景用【场景描述】标注，然后写 角色名：台词，共8-12句对白
- 示例格式：
【咖啡厅，午后阳光】
${a}：你怎么在这里？
${b}（微愣）：这句话应该我来问你。
- 风格：节奏紧凑，适合1-3分钟短视频，结尾留悬念`;
  };

  const generateScript = async () => {
    setLoadingScript(true); setScript('');
    try {
      const res = await fetch('/api/comic/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('yule_token')}` },
        body: JSON.stringify({ prompt: buildPrompt() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setScript(data.script || '');
    } catch {
      // 后端未接入时，展示示例剧本便于演示
      const g = genre || '都市爱情'; const a = charA || '男主'; const b = charB || '女主';
      setScript(`【咖啡厅窗边，午后阳光斜射进来】
${a}：你怎么在这里？
${b}（微愣，随即恢复冷静）：这句话应该我来问你。
${a}（靠近一步）：三年了，你还是一点没变。
${b}：你变了很多。（低头，手指轻轻绕着杯沿）
${a}：哪里变了？
${b}：你学会撒谎了。

【窗外，一辆黑色轿车缓缓停下】
${a}（神色微变）：我从没骗过你。
${b}：那当初——（话未说完，手机震动）
${b}（看了一眼屏幕，站起身）：我先走了。
${a}（抓住她的手腕）：等等，我有话说。
${b}（停顿，背对着他）：有些话，晚了三年，说了也没用。`);
    } finally { setLoadingScript(false); }
  };

  // 自动拆解分镜
  const autoParseBoards = () => {
    if (!script.trim()) return;
    setParsing(true);
    setTimeout(() => {
      const result = parseScriptToBoards(script);
      setBoards(result);
      setParsing(false);
      setActiveStep(1); // 跳到分镜步骤
    }, 600);
  };

  const updateBoard = (id, newData) => setBoards(prev => prev.map(b => b.id === id ? { ...b, ...newData } : b));
  const deleteBoard = (id) => setBoards(prev => prev.filter(b => b.id !== id));
  const moveBoard = (idx, dir) => {
    setBoards(prev => {
      const arr = [...prev];
      const to = idx + dir;
      if (to < 0 || to >= arr.length) return arr;
      [arr[idx], arr[to]] = [arr[to], arr[idx]];
      return arr;
    });
  };
  const addBoard = () => setBoards(prev => [...prev, { id: Date.now(), scene: '新场景', role: '角色', action: '', dialog: '台词内容', dur: 4, locked: false }]);
  const totalDur = boards.reduce((s, b) => s + b.dur, 0);

  const copyText = (text) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const handleClipUpload = (e) => {
    const files = Array.from(e.target.files);
    setClips(prev => [...prev, ...files.map((f, i) => ({ id: Date.now() + i, file: f, name: f.name }))]);
  };
  const removeClip = (id) => setClips(prev => prev.filter(c => c.id !== id));
  const moveClip = (idx, dir) => {
    setClips(prev => {
      const arr = [...prev];
      const to = idx + dir;
      if (to < 0 || to >= arr.length) return arr;
      [arr[idx], arr[to]] = [arr[to], arr[idx]];
      return arr;
    });
  };

  const mergeClips = async () => {
    if (clips.length < 2) return setMergeError('请至少上传2个视频片段');
    setMerging(true); setMergeError(''); setMergeResult(null);
    try {
      const form = new FormData();
      clips.forEach(c => form.append('clips', c.file));
      const res = await fetch('/api/comic/merge', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('yule_token')}` },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMergeResult(data.url);
    } catch (err) {
      setMergeError('合成失败：' + err.message + '（后端接口待接入）');
    } finally { setMerging(false); }
  };

  const WORKSPACE_STEPS = [
    { label: '剧本生成', icon: '📝' },
    { label: `分镜脚本${boards.length ? `(${boards.length})` : ''}`, icon: '🎞' },
    { label: '角色图', icon: '🎨' },
    { label: `视频片段${clips.length ? `(${clips.length})` : ''}`, icon: '🎬' },
    { label: '合成导出', icon: '✂️' },
    { label: '发布', icon: '🚀' },
  ];

  return (
    <div className="page">
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={outlineBtn}>← 返回</button>
        <h2 style={{ margin: 0, fontSize: 18 }}>{project.title}</h2>
        {boards.length > 0 && (
          <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#6c5ce722', color: '#6c5ce7', border: '1px solid #6c5ce744' }}>
            {boards.length} 个分镜 · 约 {totalDur}s
          </span>
        )}
        <button onClick={() => onSave(activeStep + 1)} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, border: 'none', background: '#6c5ce7', color: '#fff', cursor: 'pointer', fontSize: 13 }}>保存进度</button>
      </div>

      {/* 步骤条 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--card)', borderRadius: 12, padding: 4, border: '1px solid var(--border)', overflowX: 'auto' }}>
        {WORKSPACE_STEPS.map((s, i) => (
          <button key={i} onClick={() => setActiveStep(i)} style={{
            flex: 1, minWidth: 80, padding: '10px 6px', border: 'none', borderRadius: 8, cursor: 'pointer',
            background: activeStep === i ? '#6c5ce7' : 'transparent',
            color: activeStep === i ? '#fff' : 'var(--muted)',
            fontSize: 11, fontWeight: activeStep === i ? 700 : 400, transition: 'all .15s',
          }}>
            <div style={{ fontSize: 18, marginBottom: 2 }}>{s.icon}</div>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Step 0: 剧本 ── */}
      {activeStep === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="tool-card">
            <h3 style={{ marginTop: 0 }}>剧本设定</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={labelStyle}>漫剧类型</label>
                <select value={genre} onChange={e => setGenre(e.target.value)} style={inputStyle}>
                  <option value="">选择类型...</option>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>情节主题</label>
                <input value={theme} onChange={e => setTheme(e.target.value)} placeholder="偶遇重逢、误会解开..." style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>角色A（男/女主）</label>
                <input value={charA} onChange={e => setCharA(e.target.value)} placeholder="霸道总裁、普通上班族..." style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>角色B</label>
                <input value={charB} onChange={e => setCharB(e.target.value)} placeholder="独立设计师、邻家女孩..." style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn-primary" onClick={generateScript} disabled={loadingScript} style={{ flex: 1 }}>
                {loadingScript ? '生成中...' : '✨ AI 生成剧本'}
              </button>
              <button onClick={() => copyText(buildPrompt())} style={outlineBtn}>{copied ? '已复制' : '复制提示词'}</button>
            </div>
          </div>

          <div className="tool-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>剧本内容</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                {script && <button onClick={() => copyText(script)} style={{ ...outlineBtn, fontSize: 12, padding: '4px 10px' }}>{copied ? '已复制' : '复制'}</button>}
              </div>
            </div>
            <textarea
              value={script}
              onChange={e => setScript(e.target.value)}
              placeholder={`点击「AI 生成剧本」或直接粘贴你的剧本...\n\n格式建议：\n【场景描述】\n角色名：台词\n角色名（动作）：台词`}
              rows={13}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7, flex: 1, fontFamily: 'inherit' }}
            />
            <button
              className="btn-primary"
              onClick={autoParseBoards}
              disabled={!script.trim() || parsing}
              style={{ marginTop: 10, background: parsing ? '#999' : 'linear-gradient(90deg,#6c5ce7,#a855f7)', fontSize: 14, padding: '11px' }}
            >
              {parsing ? '拆解中...' : `🎞 自动拆解分镜${script.trim() ? '' : '（请先填写剧本）'}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: 分镜 ── */}
      {activeStep === 1 && (
        <div>
          {/* 工具栏 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              {boards.length > 0 ? (
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  共 <b style={{ color: 'var(--text)' }}>{boards.length}</b> 个分镜 · 预计总时长 <b style={{ color: '#6c5ce7' }}>{totalDur} 秒</b>
                </span>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>暂无分镜，请返回剧本步骤自动拆解，或手动添加</span>
              )}
            </div>
            <button onClick={() => { setBoards(parseScriptToBoards(script)); }} disabled={!script.trim()} style={{ ...outlineBtn, fontSize: 12 }}>
              🔄 重新拆解
            </button>
            <button onClick={addBoard} style={{ ...outlineBtn, fontSize: 12, color: '#6c5ce7', borderColor: '#6c5ce744' }}>
              + 新增分镜
            </button>
            {boards.length > 0 && (
              <button onClick={() => copyText(boards.map((b, i) => `#${i + 1} [${b.scene}] ${b.role}${b.action ? `（${b.action}）` : ''}：${b.dialog}`).join('\n'))}
                style={{ ...outlineBtn, fontSize: 12 }}>
                {copied ? '已复制' : '导出分镜表'}
              </button>
            )}
          </div>

          {/* 分镜卡片列表 */}
          {boards.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {boards.map((b, i) => (
                <BoardCard
                  key={b.id}
                  board={b}
                  idx={i}
                  total={boards.length}
                  onChange={data => updateBoard(b.id, data)}
                  onDelete={deleteBoard}
                  onMove={moveBoard}
                />
              ))}
              {/* 底部总计 + 下一步 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>
                  {boards.length} 个分镜 · 总时长约 {totalDur}s · 建议每个分镜生成一张角色图后转视频
                </div>
                <button onClick={addBoard} style={{ ...outlineBtn, fontSize: 12 }}>+ 添加</button>
                <button className="btn-primary" onClick={() => setActiveStep(2)}>下一步：角色图 →</button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed var(--border)', borderRadius: 12 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎞</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>还没有分镜</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>返回剧本步骤点击「自动拆解分镜」，或手动添加</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => setActiveStep(0)} style={outlineBtn}>← 去生成剧本</button>
                <button onClick={addBoard} className="btn-primary">手动添加分镜</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: 角色图 ── */}
      {activeStep === 2 && (
        <div style={{ maxWidth: 760 }}>
          {/* 分镜速览 */}
          {boards.length > 0 && (
            <div className="tool-card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>分镜速览（{boards.length} 个）</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {boards.map((b, i) => (
                  <div key={b.id} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                    <span style={{ color: '#6c5ce7', fontWeight: 700 }}>#{i + 1}</span> {b.role}：{b.dialog.slice(0, 10)}{b.dialog.length > 10 ? '...' : ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="tool-card">
            <h3 style={{ marginTop: 0 }}>角色图生成工具</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>为每个分镜生成对应画面，<b>角色一致性</b>是关键</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              {[
                { name: 'Leonardo AI', tag: '推荐免费', url: 'https://leonardo.ai', color: '#6c5ce7', tip: '每日150积分，用 Character Reference 保持角色一致' },
                { name: 'Midjourney', tag: '质量最高', url: 'https://midjourney.com', color: '#0984e3', tip: '用 --cref 参数固定角色，付费订阅' },
                { name: '即梦 AI', tag: '国产免费', url: 'https://jimeng.jianying.com', color: '#00b894', tip: '字节出品，免费额度多，可直接图转视频' },
                { name: 'Stable Diffusion', tag: '本地免费', url: 'https://stability.ai', color: '#e17055', tip: '本地部署完全免费，需一定技术基础' },
              ].map(p => (
                <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block', padding: 14, borderRadius: 10, border: `1px solid ${p.color}44`, background: `${p.color}11`, color: 'var(--text)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                    <span style={{ fontSize: 11, background: p.color, color: '#fff', borderRadius: 4, padding: '2px 7px' }}>{p.tag}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{p.tip}</div>
                </a>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: 12, background: 'var(--bg)', borderRadius: 8, fontSize: 13, color: 'var(--muted)', border: '1px dashed var(--border)' }}>
              💡 生成后按分镜编号命名（01.png, 02.png…），再上传到即梦/海螺生成3-5秒视频片段
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={() => setActiveStep(1)} style={outlineBtn}>← 返回</button>
            <button className="btn-primary" onClick={() => setActiveStep(3)} style={{ flex: 1 }}>下一步：上传视频片段 →</button>
          </div>
        </div>
      )}

      {/* ── Step 3: 视频片段 ── */}
      {activeStep === 3 && (
        <div style={{ maxWidth: 820 }}>
          {/* 模式切换 + 余额 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', background: 'var(--card)', borderRadius: 10, padding: 3, border: '1px solid var(--border)' }}>
              {[{ key: 'upload', label: '📂 手动上传' }, { key: 'auto', label: '✨ AI 自动生成' }].map(m => (
                <button key={m.key} onClick={() => { setClipMode(m.key); if (m.key === 'auto') loadBalance(); }}
                  style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: clipMode === m.key ? 700 : 400, background: clipMode === m.key ? '#6c5ce7' : 'transparent', color: clipMode === m.key ? '#fff' : 'var(--muted)', transition: 'all .15s' }}>
                  {m.label}
                </button>
              ))}
            </div>
            {balance && (
              <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: '#00b89422', color: '#00b894', border: '1px solid #00b89444' }}>
                FRW 余额：{balance.creditsRemaining} 积分
              </span>
            )}
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
              已收集 <b style={{ color: '#6c5ce7' }}>{clips.length}</b> 个片段
            </span>
          </div>

          {/* ── 手动上传模式 ── */}
          {clipMode === 'upload' && (
            <div className="tool-card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>手动上传视频片段</h3>
              <label style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: 10, padding: '24px', textAlign: 'center', cursor: 'pointer', marginBottom: 16, background: 'var(--bg)', transition: 'border-color .2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#6c5ce7'}
                onMouseLeave={e => e.currentTarget.style.borderColor = ''}>
                <input ref={clipInputRef} type="file" accept="video/*" multiple onChange={handleClipUpload} style={{ display: 'none' }} />
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎬</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>点击上传视频片段</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>支持 MP4、MOV、AVI · 建议每片段3-5秒</div>
              </label>
              {clips.length > 0 && <ClipList clips={clips} boards={boards} onMove={moveClip} onRemove={removeClip} />}
            </div>
          )}

          {/* ── AI 自动生成模式 ── */}
          {clipMode === 'auto' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: '10px 14px', background: '#6c5ce711', borderRadius: 10, border: '1px solid #6c5ce733', fontSize: 13, color: 'var(--muted)' }}>
                💡 为每个分镜提供<b style={{ color: 'var(--text)' }}>图片URL</b>，点击生成按钮，AI自动转成3-5秒视频片段（消耗FRW积分）
              </div>

              {boards.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, border: '2px dashed var(--border)', borderRadius: 12, color: 'var(--muted)' }}>
                  请先完成分镜脚本步骤
                </div>
              )}

              {boards.map((b, i) => {
                const task = imgTasks[b.id] || {};
                return (
                  <AutoGenCard
                    key={b.id}
                    board={b}
                    idx={i}
                    task={task}
                    onSubmit={(imageUrl, prompt) => submitImg2Video(b, imageUrl, prompt)}
                    onAddClip={url => addClipFromUrl(url, `分镜${i + 1}_${b.role}.mp4`)}
                  />
                );
              })}
            </div>
          )}

          {/* 已收集片段总览 */}
          {clips.length > 0 && clipMode === 'auto' && (
            <div className="tool-card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>已收集片段（{clips.length}个）</div>
              <ClipList clips={clips} boards={boards} onMove={moveClip} onRemove={removeClip} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setActiveStep(2)} style={outlineBtn}>← 返回</button>
            <button className="btn-primary" onClick={() => setActiveStep(4)} style={{ flex: 1 }} disabled={clips.length === 0}>
              {clips.length === 0 ? '请先收集视频片段' : `下一步：合成 ${clips.length} 个片段 →`}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: 合成 ── */}
      {activeStep === 4 && (
        <div style={{ maxWidth: 760 }}>
          <div className="tool-card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>视频合成导出</h3>

            {/* 片段顺序预览 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {clips.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'var(--bg)', borderRadius: 20, border: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ color: '#6c5ce7', fontWeight: 700 }}>#{i + 1}</span>
                  <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)' }}>{c.name}</span>
                </div>
              ))}
              {clips.length === 0 && <span style={{ fontSize: 13, color: 'var(--muted)' }}>没有片段，请返回上传</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: '视频片段', value: `${clips.length} 个` },
                { label: '预计时长', value: `${clips.length * 4}s` },
                { label: '输出格式', value: '1080×1920 竖屏' },
              ].map(s => (
                <div key={s.label} style={{ padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#6c5ce7' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {mergeError && <div style={{ padding: 10, borderRadius: 8, background: '#e1705522', color: '#e17055', fontSize: 13, marginBottom: 12 }}>{mergeError}</div>}

            {mergeResult ? (
              <div style={{ padding: 14, background: '#00b89422', borderRadius: 10, border: '1px solid #00b89444', marginBottom: 12 }}>
                <div style={{ fontWeight: 600, color: '#00b894', marginBottom: 8 }}>✅ 合成成功！</div>
                <a href={mergeResult} download style={{ display: 'inline-block', padding: '8px 16px', background: '#00b894', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13 }}>⬇ 下载视频</a>
              </div>
            ) : (
              <button className="btn-primary" onClick={mergeClips} disabled={merging || clips.length < 2} style={{ width: '100%', fontSize: 15, padding: '13px' }}>
                {merging ? '合成中...' : `🎬 开始合成视频（${clips.length} 个片段）`}
              </button>
            )}
            {clips.length < 2 && <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 6 }}>至少需要2个片段</div>}
          </div>

          {/* 手动合成说明 */}
          <div className="tool-card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🎞 手动合成（剪映）</div>
            {['导入所有片段，按分镜顺序排列', '添加AI配音（男声/女声对应角色）', '开启自动字幕识别', '添加轻音乐背景', '导出1080P → 上传平台'].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: 13 }}>
                <div style={{ minWidth: 20, height: 20, borderRadius: '50%', background: '#6c5ce7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{i + 1}</div>
                {s}
              </div>
            ))}
            <a href="https://www.capcut.cn" target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', padding: 8, marginTop: 10, background: '#6c5ce7', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13 }}>打开剪映 ↗</a>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={() => setActiveStep(3)} style={outlineBtn}>← 返回</button>
            <button className="btn-primary" onClick={() => setActiveStep(5)} style={{ flex: 1 }}>下一步：发布 →</button>
          </div>
        </div>
      )}

      {/* ── Step 5: 发布 ── */}
      {activeStep === 5 && (
        <div className="tool-card" style={{ maxWidth: 760 }}>
          <h3 style={{ marginTop: 0 }}>🚀 发布与观看</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { name: '抖音', icon: '🎵', color: '#000', desc: '最大流量，竖屏1080×1920' },
              { name: '小红书', icon: '📕', color: '#ff2442', desc: '高质量用户，适合漫剧' },
              { name: 'B站', icon: '📺', color: '#00a1d6', desc: '二次元用户，横竖均可' },
            ].map(p => (
              <div key={p.name} style={{ padding: 14, borderRadius: 10, border: `1px solid ${p.color}33`, background: `${p.color}11`, textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{p.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{p.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: 16, background: 'linear-gradient(135deg,#6c5ce722,#a855f722)', borderRadius: 10, border: '1px solid #6c5ce733', textAlign: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>🎉 第一集完成！</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>保持角色Reference图一致，系列风格才会统一</div>
            <button className="btn-primary" onClick={() => { setActiveStep(0); setScript(''); setBoards([]); setClips([]); setMergeResult(null); }}>
              开始下一集 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 主页面 ─── */
export default function ComicDrama() {
  const [projects, setProjects] = useState(INIT_PROJECTS);
  const [activeProject, setActiveProject] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const createProject = () => {
    if (!newTitle.trim()) return;
    const p = { id: Date.now(), title: newTitle.trim(), date: new Date().toLocaleDateString('zh-CN'), step: 0, episodes: 0 };
    setProjects(prev => [p, ...prev]);
    setNewTitle(''); setCreating(false);
    setActiveProject(p);
  };

  const saveProgress = (step) => setProjects(prev => prev.map(p => p.id === activeProject.id ? { ...p, step: Math.max(p.step, step) } : p));

  if (activeProject) return <ProjectWorkspace project={activeProject} onBack={() => setActiveProject(null)} onSave={saveProgress} />;

  return (
    <div className="page">
      <section className="hero" style={{ background: 'linear-gradient(135deg,#1a0533,#2d1066)', marginBottom: 0 }}>
        <h1 style={{ fontSize: 22 }}>🎭 漫剧生产</h1>
        <div className="sub" style={{ maxWidth: 560, fontSize: 13, lineHeight: 1.7 }}>
          <b>漫剧</b>是一种由AI生成的"会动的漫画"，它用少量动态和镜头语言，让静态画面演出完整故事。
        </div>
      </section>

      {/* 6步流程 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, margin: '20px 0', overflowX: 'auto' }}>
        {FLOW_STEPS.map(s => (
          <div key={s.no} style={{ background: 'var(--card)', borderRadius: 10, padding: '14px 10px', border: `1px solid ${s.color}33`, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 700, marginBottom: 4 }}>{s.no}、{s.title}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>{s.desc}</div>
          </div>
        ))}
      </div>

      {/* 我的漫剧 */}
      <div className="section-head">
        <h2>我的漫剧</h2>
        <button onClick={() => setCreating(true)} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#6c5ce7', color: '#fff', cursor: 'pointer' }}>+ 新建</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 32 }}>
        {/* 新建卡片 */}
        {!creating ? (
          <div onClick={() => setCreating(true)} style={{ background: 'var(--card)', borderRadius: 12, cursor: 'pointer', border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 170, transition: 'border-color .2s, background .2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6c5ce7'; e.currentTarget.style.background = '#6c5ce711'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = ''; }}>
            <div style={{ fontSize: 40, color: '#6c5ce7', marginBottom: 8 }}>+</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6c5ce7' }}>创建我的漫剧</div>
          </div>
        ) : (
          <div style={{ background: 'var(--card)', borderRadius: 12, border: '2px solid #6c5ce7', minHeight: 170, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6c5ce7', marginBottom: 4 }}>📝 输入漫剧标题</div>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createProject()}
              placeholder="如：都市爱情第一集"
              autoFocus
              style={{ ...inputStyle, fontSize: 14 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={createProject} style={{ flex: 1 }}>创建</button>
              <button onClick={() => { setCreating(false); setNewTitle(''); }} style={outlineBtn}>取消</button>
            </div>
          </div>
        )}
        {projects.map(p => <ProjectCard key={p.id} project={p} onClick={() => setActiveProject(p)} />)}
      </div>

      {/* 常用工具 */}
      <div className="section-head">
        <h2>常用工具</h2>
        <span className="hint">快捷跳转</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {TOOL_LINKS.map(t => (
          <a key={t.label} href={t.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', padding: '12px 14px', borderRadius: 10, border: `1px solid ${t.color}33`, background: `${t.color}11`, display: 'block', transition: 'transform .15s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = ''}>
            <div style={{ fontWeight: 700, fontSize: 13, color: t.color }}>{t.label}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{t.sub}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
