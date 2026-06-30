import { useState, useRef, useEffect } from 'react';

/* ─── 常量 ─── */
const STYLES = [
  { id: 'guochao', label: '国潮漫画', emoji: '🏮', color: '#e17055' },
  { id: 'wuxia', label: '武侠国漫', emoji: '⚔️', color: '#6c5ce7' },
  { id: 'realistic', label: '写实武侠', emoji: '🌿', color: '#00b894' },
  { id: '3d', label: '3D仙侠', emoji: '✨', color: '#0984e3' },
  { id: 'fantasy', label: '奇幻插画', emoji: '🔮', color: '#a855f7' },
  { id: 'cyber', label: '赛博朋克', emoji: '🌃', color: '#fd79a8' },
  { id: 'anime', label: '日式动漫', emoji: '🌸', color: '#fdcb6e' },
  { id: 'modern', label: '都市写实', emoji: '🏙', color: '#74b9ff' },
];

const SCENE_TAGS = [
  '丹霞红','剪纸窗花','糖画','丹青','腊八','青砖黛瓦','石屋',
  '吊脚楼群','牌坊','画廊','拱门','钟楼','钟鼎','蛟龙','凤凰',
  '水墨','竹影','飞白','云海','流萤','红梅','瀑布','枯叶蝶','敦煌',
  '麒麟','门神','汉服','庙会','孔明灯','年画','灯笼','状元','云纹',
  '荷花','长城','红包',
];

const RANDOM_EXAMPLES = [
  '【凌晨2点，老旧公寓电梯内，暖黄灯光忽明忽暗】男主陈默背着满是古籍的帆布包，指尖沾着墨迹，是夜班图书管理员；女主林夏抱着画夹，眼下带着青黑，是赶稿的...',
  '【霜绕竹间，温砚（男主）握柄青竹剑，剑尖轻挑竹露——他守着祖传"竹编剑法"残页，以为剑三十年。沈蔬（女主）持玫骨扇闯入，扇面"嗒"地展开，扇骨寒光...',
  '【烛火映着斑驳的神像，凌锋（男主）握柄玄铁长刀立在祠中，刀身泛着冷光——他寻《寒锋诀》五年，终于查到在叶梧手中。叶梧（女主）持双剑护在神龛前，剑柄...',
];

/* ─── 角色库（男 / 女） ─── */
const CHAR_LIBRARY = [
  // ── 男性 ──
  { id: 'm1', gender: 'male', name: '白衣剑仙', style: '仙侠', icon: '⚔️',
    grad: 'linear-gradient(160deg,#1a1a2e 0%,#16213e 40%,#0f3460 70%,#e94560 100%)',
    prompt: '1 male character, white ancient chinese robe, silver long hair tied up, xianxia cultivator, jade pendant, sword, full body portrait, white background, high quality anime style' },
  { id: 'm2', gender: 'male', name: '黑袍战士', style: '武侠', icon: '🗡️',
    grad: 'linear-gradient(160deg,#0d0d0d 0%,#1a1a1a 40%,#2d2d2d 70%,#4a4a4a 100%)',
    prompt: '1 male character, black ancient chinese robe with silver trim, dark hair, martial artist warrior, intense gaze, full body portrait, white background, high quality anime style' },
  { id: 'm3', gender: 'male', name: '青衣公子', style: '古风', icon: '🎋',
    grad: 'linear-gradient(160deg,#0a2e1a 0%,#1a4a2a 40%,#2a6a3a 70%,#00d2b4 100%)',
    prompt: '1 male character, teal cyan ancient chinese scholar robe, elegant young scholar, black hair with hairpin, fan in hand, full body portrait, white background, high quality anime style' },
  { id: 'm4', gender: 'male', name: '金甲武将', style: '战将', icon: '🏆',
    grad: 'linear-gradient(160deg,#2a1500 0%,#4a2500 40%,#8a4500 70%,#ffd700 100%)',
    prompt: '1 male character, golden chinese armor general, commanding presence, black hair, decorated helmet, battle ready, full body portrait, white background, high quality anime style' },
  { id: 'm5', gender: 'male', name: '紫袍魔尊', style: '魔道', icon: '🔮',
    grad: 'linear-gradient(160deg,#1a0a2e 0%,#2d1066 40%,#4a1a8a 70%,#a855f7 100%)',
    prompt: '1 male character, dark purple robe demon lord, silver white hair flowing, sinister yet handsome, magical aura, full body portrait, white background, high quality anime style' },
  { id: 'm6', gender: 'male', name: '红衣刀客', style: '武侠', icon: '🔴',
    grad: 'linear-gradient(160deg,#2e0a0a 0%,#4a1010 40%,#8a1a1a 70%,#e74c3c 100%)',
    prompt: '1 male character, red ancient chinese robe, fierce warrior, black hair, large dao sword on back, scars, confident pose, full body portrait, white background, high quality anime style' },
  { id: 'm7', gender: 'male', name: '银发仙人', style: '仙侠', icon: '🌟',
    grad: 'linear-gradient(160deg,#1a1a2e 0%,#2a2a4a 40%,#3a3a6a 70%,#c0c0e0 100%)',
    prompt: '1 male character, silver white flowing long hair, immortal white robe with celestial patterns, ethereal cultivator, serene expression, full body portrait, white background, high quality anime style' },
  { id: 'm8', gender: 'male', name: '儒袍书生', style: '古风', icon: '📖',
    grad: 'linear-gradient(160deg,#0a1a2e 0%,#1a2a4a 40%,#2a3a6a 70%,#6699cc 100%)',
    prompt: '1 male character, light blue ancient chinese scholar robe, gentle young scholar, black hair with jade hairpin, holding a scroll, kind eyes, full body portrait, white background, high quality anime style' },
  { id: 'm9', gender: 'male', name: '暗金铠甲', style: '战将', icon: '⚡',
    grad: 'linear-gradient(160deg,#1a1200 0%,#2a2000 40%,#4a3800 70%,#b8860b 100%)',
    prompt: '1 male character, dark gold ornate chinese armor, battle hardened warrior, stern expression, battle scars, imposing physique, full body portrait, white background, high quality anime style' },
  { id: 'm10', gender: 'male', name: '素衣侠客', style: '武侠', icon: '🌙',
    grad: 'linear-gradient(160deg,#1a1a1a 0%,#2a2a2a 40%,#3a3a3a 70%,#888888 100%)',
    prompt: '1 male character, plain white grey ancient chinese traveler robe, wandering swordsman, dark hair, calm expression, simple sword, full body portrait, white background, high quality anime style' },

  // ── 女性 ──
  { id: 'f1', gender: 'female', name: '红衣宫主', style: '宫廷', icon: '👑',
    grad: 'linear-gradient(160deg,#2e0a0a 0%,#6a1515 40%,#a01e1e 70%,#e74c3c 100%)',
    prompt: '1 female character, elaborate red chinese imperial empress dress, silver crown with jewels, powerful and beautiful, black long hair decorated, full body portrait, white background, high quality anime style' },
  { id: 'f2', gender: 'female', name: '素衣仙子', style: '仙侠', icon: '🌸',
    grad: 'linear-gradient(160deg,#1a2a1a 0%,#2a4a2a 40%,#3a6a4a 70%,#7ecfa0 100%)',
    prompt: '1 female character, pure white flowing immortal dress, gentle fairy cultivator, black hair with flowers, ethereal aura, serene smile, full body portrait, white background, high quality anime style' },
  { id: 'f3', gender: 'female', name: '紫衣女王', style: '魔道', icon: '💜',
    grad: 'linear-gradient(160deg,#1a0a2e 0%,#2d1066 40%,#4a1a8a 70%,#a855f7 100%)',
    prompt: '1 female character, deep purple ancient chinese dress, mysterious sorceress, silver hair with purple highlights, magical staff, commanding presence, full body portrait, white background, high quality anime style' },
  { id: 'f4', gender: 'female', name: '金凤皇女', style: '宫廷', icon: '🔱',
    grad: 'linear-gradient(160deg,#2a1500 0%,#5a3000 40%,#8a5000 70%,#ffd700 100%)',
    prompt: '1 female character, golden phoenix embroidered chinese imperial princess dress, noble princess, black hair with golden phoenix hairpin, elegant pose, full body portrait, white background, high quality anime style' },
  { id: 'f5', gender: 'female', name: '白衣医仙', style: '仙侠', icon: '✨',
    grad: 'linear-gradient(160deg,#1a1a2e 0%,#2a2a4a 40%,#e8e8f8 70%,#ffffff 100%)',
    prompt: '1 female character, pure white ancient chinese healer robe with floral patterns, gentle healer, white silver hair, warm kind eyes, holding medicine pouch, full body portrait, white background, high quality anime style' },
  { id: 'f6', gender: 'female', name: '黑衣刺客', style: '武侠', icon: '🌑',
    grad: 'linear-gradient(160deg,#0d0d0d 0%,#1a1a1a 40%,#252525 70%,#555555 100%)',
    prompt: '1 female character, black form fitting ancient chinese assassin outfit, mysterious masked beauty, black hair, daggers on belt, confident lethal pose, full body portrait, white background, high quality anime style' },
  { id: 'f7', gender: 'female', name: '粉衣少女', style: '古风', icon: '🌺',
    grad: 'linear-gradient(160deg,#2e0a1a 0%,#5a1a3a 40%,#8a3a6a 70%,#ffb6c1 100%)',
    prompt: '1 female character, soft pink ancient chinese young lady dress, sweet innocent girl, black hair with pink ribbons, cute expression, camellia flowers, full body portrait, white background, high quality anime style' },
  { id: 'f8', gender: 'female', name: '碧衣剑客', style: '武侠', icon: '💚',
    grad: 'linear-gradient(160deg,#0a2e1a 0%,#1a5a3a 40%,#2a8a5a 70%,#00b894 100%)',
    prompt: '1 female character, emerald green ancient chinese swordswoman outfit, athletic female warrior, black hair in ponytail, twin swords, determined expression, full body portrait, white background, high quality anime style' },
  { id: 'f9', gender: 'female', name: '蓝衣圣女', style: '仙侠', icon: '💙',
    grad: 'linear-gradient(160deg,#0a0a2e 0%,#1a1a5a 40%,#2a2a8a 70%,#4169e1 100%)',
    prompt: '1 female character, celestial blue ancient chinese priestess robe with divine patterns, holy maiden, silver white long hair, glowing blue eyes, divine light, full body portrait, white background, high quality anime style' },
  { id: 'f10', gender: 'female', name: '云鬓美人', style: '宫廷', icon: '🌙',
    grad: 'linear-gradient(160deg,#1a0a2a 0%,#2a1040 40%,#3a1a5a 70%,#9b59b6 100%)',
    prompt: '1 female character, lavender purple elaborate chinese court lady dress, delicate beauty, black hair in elaborate cloud bun with jade ornaments, gentle elegant pose, full body portrait, white background, high quality anime style' },
];

const EMPTY_CHAR = { id: null, name: '', gender: 'female', age: '', identity: '', height: '', weight: '', eyeColor: '', hairColor: '', desc: '', traits: '', img: null };

const TOOL_LINKS = [
  { label: 'Leonardo AI', sub: '角色图生成', url: 'https://leonardo.ai', color: '#6c5ce7' },
  { label: '即梦 AI', sub: '图转视频·字节出品', url: 'https://jimeng.jianying.com', color: '#0984e3' },
  { label: '海螺 AI', sub: '口型同步视频', url: 'https://hailuoai.com', color: '#00b894' },
  { label: '剪映', sub: '配音·字幕·剪辑', url: 'https://www.capcut.cn', color: '#e17055' },
];

/* ─── 自动拆解分镜 ─── */
function parseScriptToBoards(text) {
  if (!text.trim()) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const boards = [];
  let currentScene = '';
  let id = 1;

  for (const line of lines) {
    const sceneMatch = line.match(/^[【\[(](.+?)[】\])]/) || line.match(/^场景[：:]\s*(.+)/);
    if (sceneMatch) { currentScene = sceneMatch[1] || line; continue; }

    const narMatch = line.match(/^[（(]旁白[）)][：:]?\s*(.+)/);
    if (narMatch) {
      boards.push({ id: id++, scene: currentScene || '延续场景', role: '旁白', action: '画外音', dialog: narMatch[1], dur: 3 });
      continue;
    }

    const dialogMatch = line.match(/^([^：:（(]{1,10})(?:[（(]([^）)]+)[）)])?[：:]\s*(.+)/);
    if (dialogMatch) {
      const role = dialogMatch[1].trim();
      const action = dialogMatch[2] || '';
      const dialog = dialogMatch[3].trim();
      if (role.length <= 8 && dialog.length > 0) {
        boards.push({ id: id++, scene: currentScene || '延续场景', role, action, dialog, dur: Math.max(3, Math.ceil(dialog.length / 8)) });
        continue;
      }
    }
    if (line.length > 2 && !line.startsWith('#') && !line.startsWith('-')) currentScene = line;
  }

  if (boards.length === 0) {
    for (let i = 0; i < lines.length; i += 2)
      boards.push({ id: id++, scene: lines[i] || '场景', role: '角色', action: '', dialog: lines[i + 1] || '', dur: 4 });
  }
  return boards;
}

/* ─── 样式 ─── */
const labelStyle = { fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 };
const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' };
const outlineBtn = { padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', cursor: 'pointer', fontSize: 13 };
const smallBtn = { width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 };

/* ─── 进度条 ─── */
function ProgressBar({ step }) {
  const steps = ['剧本', '角色', '生图', '完成'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, margin: '0 0 28px 0' }}>
      {steps.map((s, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 28px', borderRadius: i === 0 ? '24px 0 0 24px' : i === steps.length - 1 ? '0 24px 24px 0' : 0,
              background: active ? 'linear-gradient(90deg,#00d2b4,#6c5ce7)' : done ? '#6c5ce744' : 'var(--card)',
              border: `1px solid ${active ? 'transparent' : done ? '#6c5ce755' : 'var(--border)'}`,
              color: active ? '#fff' : done ? '#6c5ce7' : 'var(--muted)',
              fontWeight: active ? 700 : 400, fontSize: 15,
              transition: 'all .3s',
              position: 'relative', zIndex: active ? 1 : 0,
            }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: active ? 'rgba(255,255,255,.25)' : done ? '#6c5ce7' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: active ? '#fff' : done ? '#fff' : 'var(--muted)' }}>
                {done ? '✓' : i + 1}
              </span>
              {s}
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 0, height: 0, borderTop: '22px solid transparent', borderBottom: '22px solid transparent', borderLeft: `12px solid ${done ? '#6c5ce744' : 'var(--card)'}`, marginLeft: -1, position: 'relative', zIndex: 2 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── 分镜卡片 ─── */
function BoardCard({ board, idx, total, onChange, onDelete, onMove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...board });
  const save = () => { onChange(draft); setEditing(false); };

  return (
    <div style={{ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ minWidth: 24, height: 24, borderRadius: '50%', background: '#6c5ce7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{idx + 1}</span>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{board.scene}</span>
        <div style={{ display: 'flex', gap: 3 }}>
          <button onClick={() => onMove(idx, -1)} disabled={idx === 0} style={{ ...smallBtn, opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
          <button onClick={() => onMove(idx, 1)} disabled={idx === total - 1} style={{ ...smallBtn, opacity: idx === total - 1 ? 0.3 : 1 }}>↓</button>
          <button onClick={() => setEditing(!editing)} style={{ ...smallBtn, color: '#6c5ce7' }}>✏️</button>
          <button onClick={() => onDelete(board.id)} style={{ ...smallBtn, color: '#e17055' }}>✕</button>
        </div>
      </div>
      {!editing ? (
        <div style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 10, alignItems: 'start' }}>
          <div><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>角色</div><div style={{ fontSize: 13, fontWeight: 600, color: '#6c5ce7' }}>{board.role}</div>{board.action && <div style={{ fontSize: 11, color: 'var(--muted)' }}>（{board.action}）</div>}</div>
          <div><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>台词</div><div style={{ fontSize: 13 }}>"{board.dialog}"</div></div>
          <div style={{ textAlign: 'right' }}><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>时长</div><div style={{ fontSize: 13, fontWeight: 600 }}>{board.dur}s</div></div>
        </div>
      ) : (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={labelStyle}>场景</label><input value={draft.scene} onChange={e => setDraft(d => ({ ...d, scene: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>角色名</label><input value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>动作/表情</label><input value={draft.action} onChange={e => setDraft(d => ({ ...d, action: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>时长(秒)</label><input type="number" min={2} max={10} value={draft.dur} onChange={e => setDraft(d => ({ ...d, dur: Number(e.target.value) }))} style={inputStyle} /></div>
          </div>
          <div><label style={labelStyle}>台词</label><textarea value={draft.dialog} onChange={e => setDraft(d => ({ ...d, dialog: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'none' }} /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={save} style={{ flex: 1, padding: 7 }}>保存</button>
            <button onClick={() => setEditing(false)} style={{ ...outlineBtn, flex: 1 }}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 工作区 ─── */
function ProjectWorkspace({ project, onBack }) {
  const [step, setStep] = useState(0);       // 0剧本 1角色 2生图 3完成
  const [scriptTab, setScriptTab] = useState('mine'); // mine | ai
  const [script, setScript] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [boards, setBoards] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [chars, setChars] = useState([{ ...EMPTY_CHAR }, { ...EMPTY_CHAR }]); // slot 0 = A, slot 1 = B
  const [activeSlot, setActiveSlot] = useState(0);
  const [libFilter, setLibFilter] = useState('all'); // all | male | female
  const [customChars, setCustomChars] = useState([]);
  const [charImgs, setCharImgs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('comic_char_imgs') || '{}'); } catch { return {}; }
  });
  const autoGenRunning = useRef(false);
  const uploadRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const [loadingScript, setLoadingScript] = useState(false);

  // 持久化到 localStorage
  useEffect(() => {
    const toSave = {};
    Object.entries(charImgs).forEach(([k, v]) => { if (v.url) toSave[k] = { url: v.url, status: 'done' }; });
    localStorage.setItem('comic_char_imgs', JSON.stringify(toSave));
  }, [charImgs]);

  // 进入角色步骤时自动批量生图
  useEffect(() => {
    if (step !== 1 || autoGenRunning.current) return;
    autoGenRunning.current = true;
    const token = localStorage.getItem('yule_token');
    if (!token) return;

    const need = CHAR_LIBRARY.filter(lc => !charImgs[lc.id]?.url);
    if (need.length === 0) { autoGenRunning.current = false; return; }

    // 标记全部为 loading
    setCharImgs(prev => {
      const next = { ...prev };
      need.forEach(lc => { if (!next[lc.id]?.url) next[lc.id] = { status: 'loading', url: null }; });
      return next;
    });

    // 提交所有任务
    const submit = async (lc) => {
      try {
        const r = await fetch('/api/comic/txt2img', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ prompt: lc.prompt, width: 768, height: 1024, n: 1 }),
        });
        const d = await r.json();
        return { lc, taskId: d.taskId };
      } catch { return { lc, taskId: null }; }
    };

    const pollTask = (lc, taskId) => {
      const check = async () => {
        try {
          const r = await fetch(`/api/comic/task/${taskId}`, { headers: { Authorization: `Bearer ${token}` } });
          const d = await r.json();
          if (d.status === 'completed' && d.outputs?.[0]?.url) {
            const url = d.outputs[0].url;
            setCharImgs(prev => ({ ...prev, [lc.id]: { status: 'done', url } }));
          } else if (d.status === 'failed') {
            setCharImgs(prev => ({ ...prev, [lc.id]: { status: 'error', url: null } }));
          } else {
            setTimeout(check, 5000);
          }
        } catch { setTimeout(check, 5000); }
      };
      setTimeout(check, 5000);
    };

    // 分批：每批 5 个，间隔 1s 避免并发过高
    const runBatch = async () => {
      const BATCH = 5;
      for (let i = 0; i < need.length; i += BATCH) {
        const batch = need.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(submit));
        results.forEach(({ lc, taskId }) => { if (taskId) pollTask(lc, taskId); });
        if (i + BATCH < need.length) await new Promise(r => setTimeout(r, 1000));
      }
      autoGenRunning.current = false;
    };
    runBatch();
  }, [step]); // eslint-disable-line

  const toggleTag = (tag) => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const buildAiPrompt = () => {
    const charNames = chars.filter(c => c.name).map(c => c.name).join('、');
    return `请为我写一段漫剧剧本，风格：${selectedStyle || '都市爱情'}，场景元素：${selectedTags.join('、') || '随机'}。${charNames ? `主要角色：${charNames}。` : ''}\n格式：【场景描述】\n角色名（动作）：台词\n共10-14句对白，结尾留悬念。`;
  };

  const generateAiScript = async () => {
    setLoadingScript(true); setScript('');
    try {
      const res = await fetch('/api/comic/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('yule_token')}` },
        body: JSON.stringify({ prompt: buildAiPrompt() }),
      });
      const data = await res.json();
      setScript(data.script || '');
    } catch {
      setScript(buildAiPrompt() + '\n\n（后端未配置 AI Key，请复制提示词到 Claude 手动生成后粘贴回来）');
    } finally { setLoadingScript(false); }
  };

  const autoParseBoards = () => {
    if (!script.trim()) return;
    setParsing(true);
    setTimeout(() => {
      setBoards(parseScriptToBoards(script));
      setParsing(false);
      setStep(1);
    }, 600);
  };

  const updateBoard = (id, data) => setBoards(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
  const deleteBoard = (id) => setBoards(prev => prev.filter(b => b.id !== id));
  const moveBoard = (idx, dir) => setBoards(prev => {
    const arr = [...prev]; const to = idx + dir;
    if (to < 0 || to >= arr.length) return arr;
    [arr[idx], arr[to]] = [arr[to], arr[idx]]; return arr;
  });
  const addBoard = () => setBoards(prev => [...prev, { id: Date.now(), scene: '新场景', role: '角色', action: '', dialog: '台词', dur: 4 }]);
  const totalDur = boards.reduce((s, b) => s + b.dur, 0);

  return (
    <div className="page">
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={outlineBtn}>← 返回</button>
        <h2 style={{ margin: 0, fontSize: 17 }}>{project.title}</h2>
        {boards.length > 0 && <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#6c5ce722', color: '#6c5ce7', border: '1px solid #6c5ce744' }}>{boards.length} 个分镜 · {totalDur}s</span>}
      </div>

      <ProgressBar step={step} />

      {/* ══ Step 0：剧本 ══ */}
      {step === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
          {/* 左侧：风格 + 场景元素 */}
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>风格</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {STYLES.map(s => (
                  <div key={s.id} onClick={() => setSelectedStyle(s.id === selectedStyle ? '' : s.id)}
                    style={{ borderRadius: 10, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${selectedStyle === s.id ? s.color : 'var(--border)'}`, transition: 'border-color .2s', position: 'relative' }}>
                    <div style={{ height: 72, background: `linear-gradient(135deg, ${s.color}33, ${s.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{s.emoji}</div>
                    <div style={{ padding: '6px 8px', fontSize: 12, fontWeight: selectedStyle === s.id ? 700 : 400, color: selectedStyle === s.id ? s.color : 'var(--text)', background: 'var(--card)', textAlign: 'center' }}>{s.label}</div>
                    {selectedStyle === s.id && <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: s.color, color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>场景元素 <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>（不选则默认随机使用场景）</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SCENE_TAGS.map(tag => (
                  <span key={tag} onClick={() => toggleTag(tag)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${selectedTags.includes(tag) ? '#6c5ce7' : 'var(--border)'}`, background: selectedTags.includes(tag) ? '#6c5ce722' : 'var(--bg)', color: selectedTags.includes(tag) ? '#6c5ce7' : 'var(--text)', transition: 'all .15s' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧：剧本输入 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Tab 切换 */}
            <div style={{ display: 'flex', gap: 0, background: 'var(--card)', borderRadius: 24, padding: 4, border: '1px solid var(--border)', alignSelf: 'flex-start' }}>
              {[{ key: 'mine', label: '采用我的剧本' }, { key: 'ai', label: '智能剧本' }].map(t => (
                <button key={t.key} onClick={() => setScriptTab(t.key)} style={{ padding: '8px 22px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: scriptTab === t.key ? 700 : 400, background: scriptTab === t.key ? 'linear-gradient(90deg,#00d2b4,#6c5ce7)' : 'transparent', color: scriptTab === t.key ? '#fff' : 'var(--muted)', transition: 'all .2s' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {scriptTab === 'mine' ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
                  请输入至少1000字的剧本，以确保情节完整度<br />
                  剧本内容请必与选择的风格相符合，否则可能生成的场景图不符合预期哦<br />
                  <span style={{ color: '#6c5ce7' }}>参考示例：</span><br />
                  京都大学，经管系新生接待处。<br />
                  穿着一袭白色长裙的林清雪安然的坐在新生接待处的椅子上。<br />
                  柔顺的黑色长发披肩，在阳光的照耀下呈现出微微波浪卷度。
                </div>
                <div style={{ position: 'relative', flex: 1 }}>
                  <textarea value={script} onChange={e => setScript(e.target.value)}
                    placeholder="在此粘贴或输入你的剧本..."
                    rows={12}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.8, fontFamily: 'inherit', fontSize: 14 }} />
                  <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 11, color: 'var(--muted)' }}>{script.length} / 20000</div>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>选择风格和场景元素后，AI 将为你生成完整剧本</div>
                <button className="btn-primary" onClick={generateAiScript} disabled={loadingScript} style={{ alignSelf: 'flex-start', padding: '10px 24px' }}>
                  {loadingScript ? '生成中...' : '✨ 一键生成剧本'}
                </button>
                {script && (
                  <div style={{ position: 'relative' }}>
                    <textarea value={script} onChange={e => setScript(e.target.value)} rows={12} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.8, fontFamily: 'inherit', fontSize: 14 }} />
                    <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 11, color: 'var(--muted)' }}>{script.length} / 20000</div>
                  </div>
                )}
              </div>
            )}

            {/* 随机生成示例 */}
            {!script && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 14, fontWeight: 600 }}>
                  随机生成
                  <span style={{ fontSize: 18, cursor: 'pointer', color: '#6c5ce7' }} onClick={() => {}}>↺</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {RANDOM_EXAMPLES.map((ex, i) => (
                    <div key={i} onClick={() => setScript(ex)} style={{ padding: 12, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, cursor: 'pointer', transition: 'border-color .2s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#6c5ce7'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = ''}>
                      {ex.slice(0, 80)}...
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 拆解分镜按钮 */}
            <button
              onClick={autoParseBoards}
              disabled={!script.trim() || parsing}
              style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', cursor: script.trim() ? 'pointer' : 'not-allowed', fontSize: 15, fontWeight: 700, background: script.trim() ? 'linear-gradient(90deg,#6c5ce7,#a855f7)' : 'var(--card)', color: script.trim() ? '#fff' : 'var(--muted)', transition: 'all .2s' }}>
              {parsing ? '拆解中...' : '🎞 拆解分镜'}
            </button>
          </div>
        </div>
      )}

      {/* ══ Step 1：角色 ══ */}
      {step === 1 && (() => {
        const curChar = chars[activeSlot];
        const setCharField = (field, val) => setChars(prev => prev.map((c, i) => i === activeSlot ? { ...c, [field]: val } : c));

        const pickLibChar = (lc) => {
          const img = charImgs[lc.id]?.url || null;
          setChars(prev => prev.map((c, i) => i === activeSlot ? { ...c, id: lc.id, name: lc.name, gender: lc.gender, img } : c));
        };

        const retryGenChar = async (lc, e) => {
          e.stopPropagation();
          if (charImgs[lc.id]?.status === 'loading') return;
          const token = localStorage.getItem('yule_token');
          setCharImgs(prev => ({ ...prev, [lc.id]: { status: 'loading', url: null } }));
          try {
            const r = await fetch('/api/comic/txt2img', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ prompt: lc.prompt, width: 768, height: 1024, n: 1 }),
            });
            const d = await r.json();
            if (!d.taskId) throw new Error('no taskId');
            const poll = async () => {
              try {
                const td = await (await fetch(`/api/comic/task/${d.taskId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
                if (td.status === 'completed' && td.outputs?.[0]?.url) {
                  setCharImgs(prev => ({ ...prev, [lc.id]: { status: 'done', url: td.outputs[0].url } }));
                } else if (td.status === 'failed') {
                  setCharImgs(prev => ({ ...prev, [lc.id]: { status: 'error', url: null } }));
                } else setTimeout(poll, 5000);
              } catch { setTimeout(poll, 5000); }
            };
            setTimeout(poll, 5000);
          } catch { setCharImgs(prev => ({ ...prev, [lc.id]: { status: 'error', url: null } })); }
        };

        const filteredLib = [...CHAR_LIBRARY, ...customChars].filter(c => libFilter === 'all' || c.gender === libFilter);

        const handleUpload = (e) => {
          const file = e.target.files[0]; if (!file) return;
          const url = URL.createObjectURL(file);
          const newChar = { id: `custom_${Date.now()}`, gender: 'custom', name: '自定义角色', img: url, placeholder: false };
          setCustomChars(prev => [newChar, ...prev]);
          setChars(prev => prev.map((c, i) => i === activeSlot ? { ...c, ...newChar } : c));
        };

        return (
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 20, minHeight: '70vh' }}>
          {/* ─ 左：选中角色卡 + 详情表单 ─ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 两个角色槽 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {chars.map((c, i) => (
                <div key={i} onClick={() => setActiveSlot(i)}
                  style={{ borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${activeSlot === i ? '#00d2b4' : 'var(--border)'}`, transition: 'border-color .2s', position: 'relative', background: 'var(--card)' }}>
                  {c.img ? (
                    <img src={c.img} alt={c.name} style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', gap: 8 }}>
                      <div style={{ fontSize: 32 }}>👤</div>
                      <div style={{ fontSize: 12 }}>点击选择角色</div>
                    </div>
                  )}
                  {activeSlot === i && (
                    <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: '#00d2b4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13 }}>✓</div>
                  )}
                  <div style={{ padding: '8px 10px', background: 'var(--card)', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: '#00d2b4', fontWeight: 600 }}>角色{i === 0 ? 'A' : 'B'}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name || '未选择'}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 角色详情表单 */}
            <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#00d2b4', marginBottom: 2 }}>角色{activeSlot === 0 ? 'A' : 'B'} 详情</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><label style={labelStyle}>角色名称</label><input value={curChar.name} onChange={e => setCharField('name', e.target.value)} placeholder="如：韩立" style={inputStyle} /></div>
                <div><label style={labelStyle}>性别</label>
                  <select value={curChar.gender} onChange={e => setCharField('gender', e.target.value)} style={inputStyle}>
                    <option value="male">男</option><option value="female">女</option>
                  </select>
                </div>
                <div><label style={labelStyle}>年龄</label><input value={curChar.age} onChange={e => setCharField('age', e.target.value)} placeholder="如：25" style={inputStyle} /></div>
                <div><label style={labelStyle}>身份</label><input value={curChar.identity} onChange={e => setCharField('identity', e.target.value)} placeholder="如：修仙者" style={inputStyle} /></div>
                <div><label style={labelStyle}>眼睛颜色</label><input value={curChar.eyeColor} onChange={e => setCharField('eyeColor', e.target.value)} placeholder="如：幽蓝" style={inputStyle} /></div>
                <div><label style={labelStyle}>头发颜色</label><input value={curChar.hairColor} onChange={e => setCharField('hairColor', e.target.value)} placeholder="如：白银" style={inputStyle} /></div>
              </div>
              <div><label style={labelStyle}>描述</label><textarea value={curChar.desc} onChange={e => setCharField('desc', e.target.value)} placeholder="外貌、气质、服装特征..." rows={2} style={{ ...inputStyle, resize: 'none' }} /></div>
              <div><label style={labelStyle}>独特特征</label><input value={curChar.traits} onChange={e => setCharField('traits', e.target.value)} placeholder="如：左手有一道剑疤" style={inputStyle} /></div>
              <input ref={uploadRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
              <button onClick={() => uploadRef.current?.click()} style={{ ...outlineBtn, width: '100%', padding: '10px', fontSize: 13, color: '#00d2b4', borderColor: '#00d2b444', textAlign: 'center' }}>
                📷 上传我的角色
              </button>
            </div>

            {/* 底部按钮 */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(0)} style={outlineBtn}>← 返回</button>
              <button className="btn-primary" onClick={() => setStep(2)} style={{ flex: 1, background: 'linear-gradient(90deg,#00d2b4,#6c5ce7)' }}>
                下一步 →
              </button>
            </div>
          </div>

          {/* ─ 右：角色库 ─ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>角色库</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['all','全部'],['male','男性'],['female','女性']].map(([v,l]) => (
                  <button key={v} onClick={() => setLibFilter(v)} style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${libFilter===v?'#00d2b4':'var(--border)'}`, background: libFilter===v?'#00d2b422':'transparent', color: libFilter===v?'#00d2b4':'var(--muted)', cursor: 'pointer', fontSize: 13, transition: 'all .15s' }}>{l}</button>
                ))}
              </div>
              <button onClick={() => uploadRef.current?.click()} style={{ marginLeft: 'auto', ...outlineBtn, fontSize: 12, color: '#00d2b4', borderColor: '#00d2b444' }}>+ 上传角色</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, overflowY: 'auto', maxHeight: '72vh', paddingRight: 4 }}>
              {filteredLib.map(lc => {
                const imgInfo = charImgs[lc.id];
                const isActive = chars[activeSlot]?.id === lc.id;
                const selected = chars.some(c => c.id === lc.id);
                return (
                  <div key={lc.id} onClick={() => pickLibChar(lc)}
                    style={{ borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${isActive ? '#00d2b4' : selected ? '#6c5ce766' : 'transparent'}`, transition: 'border-color .15s, transform .15s', position: 'relative', boxShadow: '0 2px 12px #0004' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = ''}>

                    {/* Portrait area */}
                    <div style={{ height: 180, position: 'relative', background: lc.grad || '#1a1a2e' }}>
                      {imgInfo?.url ? (
                        <img src={imgInfo.url} alt={lc.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <div style={{ fontSize: 36, filter: 'drop-shadow(0 2px 8px #0008)' }}>{lc.icon}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', background: 'rgba(0,0,0,.3)', padding: '2px 8px', borderRadius: 10 }}>{lc.style}</div>
                        </div>
                      )}

                      {/* 生成状态 */}
                      {!imgInfo?.url && (
                        <button
                          onClick={(e) => imgInfo?.status === 'error' ? retryGenChar(lc, e) : e.stopPropagation()}
                          style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', padding: '4px 12px', borderRadius: 20, border: 'none', background: imgInfo?.status === 'loading' ? 'rgba(0,0,0,.55)' : imgInfo?.status === 'error' ? 'rgba(231,76,60,.85)' : 'rgba(0,210,180,.75)', color: '#fff', fontSize: 11, cursor: imgInfo?.status === 'error' ? 'pointer' : 'default', whiteSpace: 'nowrap', fontWeight: 600, backdropFilter: 'blur(4px)' }}>
                          {imgInfo?.status === 'loading' ? '⏳ 生成中...' : imgInfo?.status === 'error' ? '⚠️ 重试' : '🎨 生成中'}
                        </button>
                      )}

                      {/* 选中标记 */}
                      {isActive && (
                        <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: '#00d2b4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 2px 8px #00d2b480' }}>✓</div>
                      )}
                    </div>

                    {/* Name bar */}
                    <div style={{ padding: '7px 10px', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{lc.name}</span>
                      <span style={{ fontSize: 10, color: lc.gender === 'male' ? '#74b9ff' : '#fd79a8', background: lc.gender === 'male' ? '#74b9ff22' : '#fd79a822', padding: '2px 6px', borderRadius: 8 }}>{lc.gender === 'male' ? '男' : '女'}</span>
                    </div>
                  </div>
                );
              })}

              {/* 自定义上传卡 */}
              <div onClick={() => uploadRef.current?.click()}
                style={{ borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: '2px dashed var(--border)', transition: 'border-color .15s, transform .15s', minHeight: 218, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--card)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#00d2b4'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = ''; }}>
                <div style={{ fontSize: 28, color: '#00d2b4' }}>+</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5, padding: '0 10px' }}>上传<br />自定义角色</div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ══ Step 2：生图 ══ */}
      {step === 2 && (
        <div style={{ maxWidth: 760 }}>
          <div className="tool-card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>生成角色图</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>使用以下工具为每个分镜生成对应画面，注意保持角色一致性</p>

            {/* 角色提示词 */}
            {chars.some(c => c.name) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {chars.map((c, i) => c.name && (
                  <div key={i} style={{ padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {c.img && <img src={c.img} alt={c.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                    <div>
                      <div style={{ fontSize: 12, color: i === 0 ? '#00d2b4' : '#e17055', fontWeight: 600, marginBottom: 2 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{[c.gender === 'male' ? '男' : '女', c.age && `${c.age}岁`, c.identity, c.hairColor && `${c.hairColor}发`, c.eyeColor && `${c.eyeColor}眼`].filter(Boolean).join(' · ')}</div>
                      {c.desc && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{c.desc}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { name: 'Leonardo AI', tag: '推荐免费', url: 'https://leonardo.ai', color: '#6c5ce7', tip: '每日150积分，用 Character Reference 保持角色一致' },
                { name: '即梦 AI', tag: '国产免费', url: 'https://jimeng.jianying.com', color: '#0984e3', tip: '字节出品，免费额度多，可直接图转视频' },
                { name: '海螺 AI', tag: '口型同步', url: 'https://hailuoai.com', color: '#00b894', tip: '支持嘴型同步，对话漫剧效果好' },
                { name: 'Midjourney', tag: '质量最高', url: 'https://midjourney.com', color: '#e17055', tip: '用 --cref 固定角色，付费订阅' },
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

            <div style={{ marginTop: 14, padding: 12, background: 'var(--bg)', borderRadius: 8, fontSize: 13, color: 'var(--muted)', border: '1px dashed var(--border)' }}>
              💡 生成完成后，将图片上传到 即梦/海螺 转成3-5秒视频片段，再回到合成步骤
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(1)} style={outlineBtn}>← 返回</button>
            <button className="btn-primary" onClick={() => setStep(3)} style={{ flex: 1 }}>完成 →</button>
          </div>
        </div>
      )}

      {/* ══ Step 3：完成 ══ */}
      {step === 3 && (
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <h2 style={{ marginBottom: 8 }}>漫剧创作完成！</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
            {boards.length} 个分镜 · 预计 {totalDur} 秒 · 风格：{STYLES.find(s => s.id === selectedStyle)?.label || '默认'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { name: '抖音', icon: '🎵', desc: '最大流量，竖屏' },
              { name: '小红书', icon: '📕', desc: '高质量用户' },
              { name: 'B站', icon: '📺', desc: '二次元聚集' },
            ].map(p => (
              <div key={p.name} style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{p.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{p.desc}</div>
              </div>
            ))}
          </div>

          <button className="btn-primary" onClick={() => { setStep(0); setScript(''); setBoards([]); setSelectedStyle(''); setSelectedTags([]); }} style={{ width: '100%', padding: 13, fontSize: 15 }}>
            开始下一集 →
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── 项目卡片 ─── */
function ProjectCard({ project, onClick }) {
  const style = STYLES.find(s => s.id === project.styleId);
  return (
    <div onClick={onClick} style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border)', transition: 'transform .15s, box-shadow .15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px #0002'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
      <div style={{ height: 100, background: style ? `linear-gradient(135deg,${style.color}55,${style.color}99)` : 'linear-gradient(135deg,#2d1066,#6c5ce7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
        {style?.emoji || '🎭'}
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{project.date}</div>
        <div style={{ fontSize: 11, color: style?.color || '#6c5ce7' }}>{style?.label || '未设风格'}</div>
      </div>
    </div>
  );
}

/* ─── 主页面 ─── */
export default function ComicDrama() {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const createProject = () => {
    if (!newTitle.trim()) return;
    const p = { id: Date.now(), title: newTitle.trim(), date: new Date().toLocaleDateString('zh-CN'), styleId: '' };
    setProjects(prev => [p, ...prev]);
    setNewTitle(''); setCreating(false);
    setActiveProject(p);
  };

  if (activeProject) return <ProjectWorkspace project={activeProject} onBack={() => setActiveProject(null)} />;

  return (
    <div className="page">
      <section className="hero" style={{ background: 'linear-gradient(135deg,#1a0533,#2d1066)', marginBottom: 0 }}>
        <h1 style={{ fontSize: 22 }}>🎭 漫剧生产</h1>
        <div className="sub" style={{ maxWidth: 560, fontSize: 13, lineHeight: 1.7 }}>
          <b>漫剧</b>是一种由AI生成的"会动的漫画"，它用少量动态和镜头语言，让静态画面演出完整故事。
        </div>
      </section>

      {/* 流程说明 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, margin: '20px 0' }}>
        {[
          { no: 1, icon: '📝', title: '剧本', desc: '写剧本或AI生成，选风格' },
          { no: 2, icon: '🎭', title: '角色', desc: '设定角色外貌，确认分镜' },
          { no: 3, icon: '🎨', title: '生图', desc: '生成每帧画面，图转视频' },
          { no: 4, icon: '🚀', title: '完成', desc: '合成导出，发布平台' },
        ].map(s => (
          <div key={s.no} style={{ background: 'var(--card)', borderRadius: 10, padding: '14px 12px', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Step {s.no}：{s.title}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.desc}</div>
          </div>
        ))}
      </div>

      {/* 我的漫剧 */}
      <div className="section-head">
        <h2>我的漫剧</h2>
        <button onClick={() => setCreating(true)} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#6c5ce7', color: '#fff', cursor: 'pointer' }}>+ 新建</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 32 }}>
        {!creating ? (
          <div onClick={() => setCreating(true)} style={{ background: 'var(--card)', borderRadius: 12, cursor: 'pointer', border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 170, transition: 'border-color .2s, background .2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6c5ce7'; e.currentTarget.style.background = '#6c5ce711'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = ''; }}>
            <div style={{ fontSize: 40, color: '#6c5ce7', marginBottom: 8 }}>+</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6c5ce7' }}>创建我的漫剧</div>
          </div>
        ) : (
          <div style={{ background: 'var(--card)', borderRadius: 12, border: '2px solid #6c5ce7', minHeight: 170, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6c5ce7' }}>📝 输入漫剧标题</div>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createProject()} placeholder="如：都市爱情第一集" autoFocus style={{ ...inputStyle, fontSize: 14 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={createProject} style={{ flex: 1 }}>创建</button>
              <button onClick={() => { setCreating(false); setNewTitle(''); }} style={outlineBtn}>取消</button>
            </div>
          </div>
        )}
        {projects.map(p => <ProjectCard key={p.id} project={p} onClick={() => setActiveProject(p)} />)}
      </div>

      {/* 常用工具 */}
      <div className="section-head"><h2>常用工具</h2><span className="hint">快捷跳转</span></div>
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
