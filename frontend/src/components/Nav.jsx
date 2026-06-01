import { Link, useNavigate } from 'react-router-dom';
import { clearToken } from '../api/client.js';

export default function Nav({ crumb, theme, onToggleTheme }) {
  const navigate = useNavigate();
  const logout = () => {
    clearToken();
    navigate('/login');
  };
  return (
    <header className="nav">
      <Link to="/" className="brand">
        Yule AgentCenter<span className="badge">V2.0</span>
      </Link>
      {crumb && (
        <div className="crumb">
          <span className="sep">›</span>
          <span>{crumb}</span>
        </div>
      )}
      <div className="spacer" />
      <span className="nav-item">sishuo</span>
      <button className="icon-btn" onClick={onToggleTheme} title="切换主题">
        {theme === 'dark' ? '☀' : '☾'}
      </button>
      <Link to="/" className="nav-item">管理</Link>
      <button className="nav-item icon-btn" onClick={logout}>退出</button>
    </header>
  );
}
