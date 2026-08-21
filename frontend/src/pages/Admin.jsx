import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getUser } from '../api/client.js';
import { TOOLS } from '../toolsConfig.js';

function fmtDate(s) {
  if (!s) return '—';
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

function ToolPicker({ selected, onChange }) {
  const allOn = TOOLS.every((t) => selected.includes(t.key));
  return (
    <div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13, color: 'var(--text-soft)' }}>
        <input type="checkbox" checked={allOn} onChange={(e) => onChange(e.target.checked ? TOOLS.map((t) => t.key) : [])} />
        全选/全不选
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {TOOLS.map((t) => (
          <label key={t.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={selected.includes(t.key)}
              onChange={(e) => onChange(e.target.checked ? [...selected, t.key] : selected.filter((k) => k !== t.key))}
            />
            {t.title}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const me = getUser();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [newTools, setNewTools] = useState(TOOLS.map((t) => t.key));
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editTools, setEditTools] = useState([]);
  const [savingTools, setSavingTools] = useState(false);

  const load = () => {
    setLoading(true);
    api.listUsers().then(setUsers).catch((err) => setError(err.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const createUser = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) return setError('请输入账号和密码');
    if (password.length < 6) return setError('密码至少 6 位');
    setCreating(true);
    try {
      await api.createUser(username.trim(), password, nickname.trim(), newTools);
      setUsername(''); setPassword(''); setNickname(''); setNewTools(TOOLS.map((t) => t.key));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const resetPassword = async (u) => {
    const pwd = window.prompt(`给「${u.nickname || u.username}」设置新密码(至少 6 位):`);
    if (!pwd) return;
    if (pwd.length < 6) return alert('密码至少 6 位');
    try {
      await api.resetUserPassword(u.id, pwd);
      alert('密码已重置');
    } catch (err) {
      alert(err.message);
    }
  };

  const removeUser = async (u) => {
    if (!window.confirm(`确认删除账号「${u.nickname || u.username}」?`)) return;
    try {
      await api.deleteUser(u.id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const openToolEditor = (u) => {
    setEditingId(u.id);
    setEditTools(u.tools || TOOLS.map((t) => t.key));
  };

  const saveTools = async (id) => {
    setSavingTools(true);
    try {
      await api.updateUserTools(id, editTools);
      setEditingId(null);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingTools(false);
    }
  };

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate('/')}>← 返回工作台</button>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-head">新增账号</div>
        <div className="card-body">
          <form onSubmit={createUser} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input className="text-input" style={{ flex: '1 1 160px' }} placeholder="账号(登录用)" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input className="text-input" style={{ flex: '1 1 160px' }} placeholder="密码(至少6位)" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
            <input className="text-input" style={{ flex: '1 1 160px' }} placeholder="昵称(可选,显示用)" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            <button className="btn-primary" disabled={creating}>{creating ? '创建中…' : '创建账号'}</button>
          </form>
          <div style={{ marginTop: 14 }}>
            <div className="muted" style={{ marginBottom: 8 }}>能看到哪些工作工具(默认全选,取消勾选就不会显示给这个账号):</div>
            <ToolPicker selected={newTools} onChange={setNewTools} />
          </div>
          {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-head">账号列表 <span className="muted">· 共 {users.length} 个</span></div>
        <table>
          <thead>
            <tr>
              <th>账号</th>
              <th>昵称</th>
              <th>角色</th>
              <th>可见工具</th>
              <th>创建时间</th>
              <th style={{ textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!loading && users.length === 0 && (
              <tr><td colSpan={6} className="empty" style={{ padding: 26 }}>还没有账号</td></tr>
            )}
            {users.map((u) => (
              <Fragment key={u.id}>
                <tr>
                  <td>{u.username}</td>
                  <td>{u.nickname || '—'}</td>
                  <td>{u.isAdmin ? '管理员' : '成员'}</td>
                  <td>{u.isAdmin || !u.tools ? '全部' : `${u.tools.length} 个`}</td>
                  <td>{fmtDate(u.created_at)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {!u.isAdmin && (
                      <span className="link" style={{ cursor: 'pointer', marginRight: 12 }} onClick={() => (editingId === u.id ? setEditingId(null) : openToolEditor(u))}>
                        {editingId === u.id ? '收起' : '权限设置'}
                      </span>
                    )}
                    <span className="link" style={{ cursor: 'pointer', marginRight: 12 }} onClick={() => resetPassword(u)}>重置密码</span>
                    {u.username !== me?.username && (
                      <span className="link" style={{ cursor: 'pointer' }} onClick={() => removeUser(u)}>删除</span>
                    )}
                  </td>
                </tr>
                {editingId === u.id && (
                  <tr>
                    <td colSpan={6} style={{ background: 'var(--surface-2)', padding: 16 }}>
                      <ToolPicker selected={editTools} onChange={setEditTools} />
                      <button className="btn-primary" style={{ marginTop: 12, padding: '6px 18px' }} disabled={savingTools} onClick={() => saveTools(u.id)}>
                        {savingTools ? '保存中…' : '保存权限'}
                      </button>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
