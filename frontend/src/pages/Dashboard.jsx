import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getUser } from '../api/client.js';
import { TOOLS } from '../toolsConfig.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
}

const fmtTok = (n) => {
  n = Number(n) || 0;
  return n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(n);
};
const fmtUsd = (n) => '$' + (Number(n) || 0).toFixed(4);

function TodoPanel({ title, bucket, items, onAdd, onToggle, onDelete, placeholder }) {
  const [value, setValue] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(value, bucket);
    setValue('');
  };
  return (
    <div className="todo-panel">
      <h3>{title}</h3>
      <form className="todo-input" onSubmit={submit}>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
        <button className="btn-primary">添加</button>
      </form>
      <ul className="todo-list">
        {items.length === 0 && <li className="empty">暂无待办</li>}
        {items.map((t) => (
          <li key={t.id} className={t.done ? 'done' : ''}>
            <input type="checkbox" checked={!!t.done} onChange={() => onToggle(t.id, !t.done)} />
            <span>{t.content}</span>
            <button className="del" onClick={() => onDelete(t.id)}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TODAY_STAT_NAMES = ['今日活跃', '今日注册', '今日VIP充值', '今日金币充值', '今日总充值', '今日充值成功率', '新用户订单'];
const TODAY_STAT_COLORS = {
  今日注册: '#6c5ce7',
  今日活跃: '#3b6fe0',
  今日VIP充值: '#f59e0b',
  今日金币充值: '#f97316',
  今日总充值: '#16a34a',
  今日充值成功率: '#0d9b6c',
  新用户订单: '#e0446c',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ done: 0, queued: 0, failed: 0, xAccounts: 0, tokensTeam: 0, costTeam: 0, tokensYou: 0, costYou: 0 });
  const [todos, setTodos] = useState([]);
  const [todayStats, setTodayStats] = useState([]);
  const [submenuTool, setSubmenuTool] = useState(null);

  const loadStats = () => api.stats().then(setStats).catch(() => {});
  const loadTodos = () => api.listTodos().then(setTodos).catch(() => {});
  const loadTodayStats = () => api.todayHomeStats()
    .then((d) => setTodayStats((d.stats || []).filter((s) => TODAY_STAT_NAMES.includes(s.name))))
    .catch(() => {});
  useEffect(() => {
    loadStats();
    loadTodos();
    loadTodayStats();
  }, []);

  const addTodo = async (content, bucket) => {
    await api.addTodo(content, bucket);
    loadTodos();
  };
  const toggleTodo = async (id, done) => {
    await api.toggleTodo(id, done);
    loadTodos();
  };
  const deleteTodo = async (id) => {
    await api.deleteTodo(id);
    loadTodos();
  };

  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' });
  const user = getUser();
  const visibleTools = (user?.isAdmin || !user?.tools) ? TOOLS : TOOLS.filter((t) => user.tools.includes(t.key));

  return (
    <div className="page">
      <section className="hero">
        <div className="status"><span className="dot" /> 服务运行中</div>
        <div className="hero-body">
          <div className="hero-left">
            <h1>{greeting()}，<span className="name">{user?.nickname || user?.username || '你'}</span></h1>
            <div className="sub">{today} · 你的私人工作台 · 仅显示你的任务</div>
            <div className="token-pill">🌗 今日团队 <b>{fmtTok(stats.tokensTeam)}</b> token · <b>{fmtUsd(stats.costTeam)}</b> · 你 {fmtTok(stats.tokensYou)} / {fmtUsd(stats.costYou)}</div>
          </div>
          {todayStats.length > 0 && (
            <div className="hero-today">
              {todayStats.map((s) => (
                <div key={s.name} className="hero-today-item">
                  <div className="hero-today-label">{s.name}</div>
                  <div className="hero-today-value" style={{ color: TODAY_STAT_COLORS[s.name] }}>{s.number}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="stats">
        <div className="stat-card"><div className="stat-icon purple">✓</div><div><div className="label">今日完成</div><div className="value">{stats.done}</div></div></div>
        <div className="stat-card"><div className="stat-icon blue">◷</div><div><div className="label">当前队列</div><div className="value">{stats.queued}</div></div></div>
        <div className="stat-card"><div className="stat-icon amber">⚠</div><div><div className="label">今日失败</div><div className="value">{stats.failed}</div></div></div>
        <div className="stat-card"><div className="stat-icon green">👥</div><div><div className="label">X 账号活跃</div><div className="value">{stats.xAccounts}</div></div></div>
      </div>

      <div className="section-head" style={{ marginTop: 8 }}>
        <h2>工作工具</h2>
        <span className="hint">选择一个工具开始工作</span>
      </div>
      <div className="tools">
        {visibleTools.map((t) => (
          <div
            key={t.key}
            className={`tool-card ${t.external ? 'disabled' : 'clickable'}`}
            onClick={() => {
              if (t.external) return;
              if (t.submenu) setSubmenuTool(t);
              else navigate(t.to);
            }}
          >
            <div className="tool-icon" style={{ background: t.tint, color: t.color }}>{t.icon}</div>
            <h3>{t.title}{t.external && <span className="tag">外部应用 ↗</span>}</h3>
            <div className="desc">{t.desc}</div>
            <div className="foot">
              {t.key === 'clips' && <><span><b>0</b> 今日</span><span><b>0</b> 累计</span></>}
            </div>
          </div>
        ))}
      </div>

      <div className="todos">
        <TodoPanel title="今日待办" bucket="today" placeholder="新增今日待办,回车提交"
          items={todos.filter((t) => t.bucket === 'today')}
          onAdd={addTodo} onToggle={toggleTodo} onDelete={deleteTodo} />
        <TodoPanel title="明日待办" bucket="tomorrow" placeholder="提前规划明天,回车提交"
          items={todos.filter((t) => t.bucket === 'tomorrow')}
          onAdd={addTodo} onToggle={toggleTodo} onDelete={deleteTodo} />
      </div>

      {submenuTool && (
        <div className="modal-overlay" onClick={() => setSubmenuTool(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              {submenuTool.title}
              <button className="ghost-btn" onClick={() => setSubmenuTool(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {submenuTool.submenu.map((s) => (
                <div
                  key={s.key}
                  className="tool-card clickable"
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}
                  onClick={() => { setSubmenuTool(null); navigate(s.to); }}
                >
                  <div className="tool-icon" style={{ background: submenuTool.tint, color: submenuTool.color }}>{s.icon}</div>
                  <div>
                    <h3 style={{ margin: 0 }}>{s.title}</h3>
                    <div className="desc" style={{ margin: 0 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
