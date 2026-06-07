import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Community from './pages/Community.jsx';
import SocialMedia from './pages/SocialMedia.jsx';
import ClipManagement from './pages/ClipManagement.jsx';
import MeetingRoom from './pages/MeetingRoom.jsx';
import { getToken } from './api/client.js';

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('yule_theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('yule_theme', theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

function Protected({ children, crumb, theme, onToggleTheme }) {
  const location = useLocation();
  if (!getToken()) return <Navigate to="/login" replace state={{ from: location }} />;
  return (
    <>
      <Nav crumb={crumb} theme={theme} onToggleTheme={onToggleTheme} />
      {children}
    </>
  );
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const guard = (el, crumb) => (
    <Protected crumb={crumb} theme={theme} onToggleTheme={toggleTheme}>
      {el}
    </Protected>
  );

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={guard(<Dashboard />)} />
      <Route path="/community" element={guard(<Community />, '社群管理')} />
      <Route path="/social" element={guard(<SocialMedia />, '社媒管理')} />
      <Route path="/clips" element={guard(<ClipManagement />, '剪辑管理')} />
      <Route path="/meeting" element={guard(<MeetingRoom />, 'Agent 会议室')} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
