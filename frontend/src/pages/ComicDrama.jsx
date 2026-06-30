import { useState } from 'react';

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
  const [charA, setCharA] = useState('');
  const [charB, setCharB] = useState('');
  const [charADesc, setCharADesc] = useState('');
  const [charBDesc, setCharBDesc] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loadingScript, setLoadingScript] = useState(false);

  const toggleTag = (tag) => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const buildAiPrompt = () =>
    `请为我写一段漫剧剧本，风格：${selectedStyle || '都市爱情'}，场景元素：${selectedTags.join('、') || '随机'}。\n格式：【场景描述】\n角色名（动作）：台词\n共10-14句对白，结尾留悬念。`;

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

      {/* ══ Step 1：角色 + 分镜确认 ══ */}
      {step === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
          {/* 左：角色设定 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="tool-card">
              <h3 style={{ marginTop: 0, fontSize: 15 }}>角色A（男/女主）</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div><label style={labelStyle}>角色名</label><input value={charA} onChange={e => setCharA(e.target.value)} placeholder="如：陈默、林清雪..." style={inputStyle} /></div>
                <div><label style={labelStyle}>外貌描述</label><textarea value={charADesc} onChange={e => setCharADesc(e.target.value)} placeholder="身高、发色、眼睛、服装特征..." rows={3} style={{ ...inputStyle, resize: 'none' }} /></div>
              </div>
            </div>
            <div className="tool-card">
              <h3 style={{ marginTop: 0, fontSize: 15 }}>角色B</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div><label style={labelStyle}>角色名</label><input value={charB} onChange={e => setCharB(e.target.value)} placeholder="如：林夏、温砚..." style={inputStyle} /></div>
                <div><label style={labelStyle}>外貌描述</label><textarea value={charBDesc} onChange={e => setCharBDesc(e.target.value)} placeholder="身高、发色、眼睛、服装特征..." rows={3} style={{ ...inputStyle, resize: 'none' }} /></div>
              </div>
            </div>
            <div style={{ padding: 12, background: '#6c5ce711', borderRadius: 10, border: '1px solid #6c5ce733', fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
              💡 角色描述越详细，生成的图片一致性越高。建议包含发色、瞳色、服装颜色。
            </div>
          </div>

          {/* 右：分镜列表 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>
                共 <b style={{ color: 'var(--text)' }}>{boards.length}</b> 个分镜 · 预计 <b style={{ color: '#6c5ce7' }}>{totalDur}s</b>
              </div>
              <button onClick={() => { setBoards(parseScriptToBoards(script)); }} style={{ ...outlineBtn, fontSize: 12 }}>🔄 重新拆解</button>
              <button onClick={addBoard} style={{ ...outlineBtn, fontSize: 12, color: '#6c5ce7', borderColor: '#6c5ce744' }}>+ 添加</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
              {boards.map((b, i) => (
                <BoardCard key={b.id} board={b} idx={i} total={boards.length}
                  onChange={data => updateBoard(b.id, data)}
                  onDelete={deleteBoard} onMove={moveBoard} />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep(0)} style={outlineBtn}>← 返回剧本</button>
              <button className="btn-primary" onClick={() => setStep(2)} style={{ flex: 1 }} disabled={boards.length === 0}>
                下一步：生图 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Step 2：生图 ══ */}
      {step === 2 && (
        <div style={{ maxWidth: 760 }}>
          <div className="tool-card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>生成角色图</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>使用以下工具为每个分镜生成对应画面，注意保持角色一致性</p>

            {/* 角色提示词 */}
            {(charA || charB) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {charA && (
                  <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: '#6c5ce7', fontWeight: 600, marginBottom: 4 }}>{charA}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{charADesc || '暂无描述'}</div>
                  </div>
                )}
                {charB && (
                  <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: '#e17055', fontWeight: 600, marginBottom: 4 }}>{charB}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{charBDesc || '暂无描述'}</div>
                  </div>
                )}
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
