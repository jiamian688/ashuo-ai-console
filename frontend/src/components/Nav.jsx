import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, clearToken, getUser } from '../api/client.js';
import { ACCENTS } from '../accents.js';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function AccentPicker({ accent, onSetAccent }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = ACCENTS.find((a) => a.key === accent) || ACCENTS[0];
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  return (
    <div className="accent-picker" ref={ref}>
      <button className="icon-btn accent-btn" onClick={() => setOpen((v) => !v)} title="切换主题背景">
        <span className="accent-dot" style={{ background: current.color }} />
      </button>
      {open && (
        <div className="accent-menu">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              className={`accent-option ${a.key === accent ? 'active' : ''}`}
              onClick={() => { onSetAccent(a.key); setOpen(false); }}
            >
              <span className="accent-dot" style={{ background: a.color }} />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Nav({ crumb, theme, onToggleTheme, accent, onSetAccent }) {
  const navigate = useNavigate();
  const user = getUser();
  const now = useClock();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const logout = async () => {
    try { await api.logout(); } catch { /* 日志记不上也不挡退出 */ }
    clearToken();
    navigate('/login');
  };

  return (
    <header className="nav">
      <Link to="/" className="brand">
        ashuo-ai-console<span className="badge">V2.0</span>
      </Link>
      {crumb && (
        <div className="crumb">
          <span className="sep">›</span>
          <span>{crumb}</span>
        </div>
      )}
      <div className="spacer" />
      <span className="nav-item nav-clock" title={tz}>{now.toLocaleTimeString('zh-CN', { hour12: false })}</span>
      <span className="nav-item">{user?.nickname || user?.username || '未登录'}</span>
      <button className="icon-btn" onClick={onToggleTheme} title="切换明暗">
        {theme === 'dark' ? '☀' : '☾'}
      </button>
      <AccentPicker accent={accent} onSetAccent={onSetAccent} />
      {user?.isAdmin && <Link to="/activity" className="nav-item">日志</Link>}
      {user?.isAdmin && <Link to="/admin" className="nav-item">管理</Link>}
      <button className="nav-item icon-btn" onClick={logout}>退出</button>
    </header>
  );
}
