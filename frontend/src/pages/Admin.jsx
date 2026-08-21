import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getUser } from '../api/client.js';

function fmtDate(s) {
  if (!s) return '—';
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
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
  const [creating, setCreating] = useState(false);

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
      await api.createUser(username.trim(), password, nickname.trim());
      setUsername(''); setPassword(''); setNickname('');
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
              <th>创建时间</th>
              <th style={{ textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!loading && users.length === 0 && (
              <tr><td colSpan={5} className="empty" style={{ padding: 26 }}>还没有账号</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.nickname || '—'}</td>
                <td>{u.isAdmin ? '管理员' : '成员'}</td>
                <td>{fmtDate(u.created_at)}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <span className="link" style={{ cursor: 'pointer', marginRight: 12 }} onClick={() => resetPassword(u)}>重置密码</span>
                  {u.username !== me?.username && (
                    <span className="link" style={{ cursor: 'pointer' }} onClick={() => removeUser(u)}>删除</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
