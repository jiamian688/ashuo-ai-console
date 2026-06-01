import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api/client.js';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await api.login(password, 'sishuo');
      setToken(token);
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
        <p>内容运营私人工作台 · 请输入访问口令</p>
        <input
          className="text-input"
          type="password"
          placeholder="访问口令(默认 admin)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <button className="btn-primary" disabled={loading}>
          {loading ? '登录中…' : '进入工作台'}
        </button>
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
}
