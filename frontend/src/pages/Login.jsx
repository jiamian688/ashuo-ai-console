import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken, setUser } from '../api/client.js';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, username: u, nickname, isAdmin } = await api.login(username.trim(), password);
      setToken(token);
      setUser({ username: u, nickname, isAdmin });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>ashuo-ai-console<span className="badge">V2.0</span></h1>
        <p>内容运营私人工作台 · 请输入账号密码</p>
        <input
          className="text-input"
          type="text"
          placeholder="账号"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <input
          className="text-input"
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn-primary" disabled={loading}>
          {loading ? '登录中…' : '进入工作台'}
        </button>
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
}
