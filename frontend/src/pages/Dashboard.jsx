import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const TOOLS = [
  { key: 'clips', icon: '🖼', tint: '#eef0fb', color: '#6c5ce7', title: '剪辑管理', desc: '视频剪辑和封面图生成', to: '/clips' },
  { key: 'community', icon: '💬', tint: '#e7f6ec', color: '#16a34a', title: '社群管理', desc: '管理 TG 社群内容发布', to: '/community' },
  { key: 'social', icon: '➤', tint: '#e8effe', color: '#3b6fe0', title: '社媒管理', desc: 'AI 推特文案生成器 · 关键词→文案', to: '/social' },
  { key: 'meeting', icon: '🎥', tint: '#f3eafe', color: '#8b5cf6', title: 'Agent 会议室', desc: 'Fathom 会议 · AI 跟会记录 · 纪要导出 Word/PDF', to: '/meeting' },
];

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

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ done: 0, queued: 0, failed: 0, xAccounts: 0, tokensTeam: 0, costTeam: 0, tokensYou: 0, costYou: 0 });
  const [todos, setTodos] = useState([]);

  const loadStats = () => api.stats().then(setStats).catch(() => {});
  const loadTodos = () => api.listTodos().then(setTodos).catch(() => {});
  useEffect(() => {
    loadStats();
    loadTodos();
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

  return (
    <div className="page">
      <section className="hero">
        <div className="status"><span className="dot" /> 服务运行中</div>
        <h1>{greeting()}，<span className="name">sishuo</span></h1>
        <div className="sub">{today} · 你的私人工作台 · 仅显示你的任务</div>
        <div className="token-pill">🌗 今日团队 <b>{fmtTok(stats.tokensTeam)}</b> token · <b>{fmtUsd(stats.costTeam)}</b> · 你 {fmtTok(stats.tokensYou)} / {fmtUsd(stats.costYou)}</div>
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
        {TOOLS.map((t) => (
          <div
            key={t.key}
            className={`tool-card ${t.external ? 'disabled' : 'clickable'}`}
            onClick={() => !t.external && navigate(t.to)}
          >
            <div className="tool-icon" style={{ background: t.tint, color: t.color }}>{t.icon}</div>
            <h3>{t.title}{t.external && <span className="tag">外部应用 ↗</span>}</h3>
            <div className="desc">{t.desc}</div>
            <div className="foot">
              {t.key === 'community' && <><span><b>0</b> 队列</span><span><b>0</b> 今日发</span></>}
              {t.key === 'clips' && <><span><b>0</b> 今日</span><span><b>0</b> 累计</span></>}
              {t.key === 'social' && <span>输入关键词 · 生成多版本 · 复制手动发布</span>}
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
    </div>
  );
}
