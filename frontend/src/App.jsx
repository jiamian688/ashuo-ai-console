import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Community from './pages/Community.jsx';
import SocialMedia from './pages/SocialMedia.jsx';
import ClipManagement from './pages/ClipManagement.jsx';
import MeetingRoom from './pages/MeetingRoom.jsx';
import ComicDrama from './pages/ComicDrama.jsx';
import CommentReview from './pages/CommentReview.jsx';
import BusinessData from './pages/BusinessData.jsx';
import Admin from './pages/Admin.jsx';
import ActivityLog from './pages/ActivityLog.jsx';
import PostReview from './pages/PostReview.jsx';
import CommunityPost from './pages/CommunityPost.jsx';
import { getToken, getUser } from './api/client.js';

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('yule_theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('yule_theme', theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

function Protected({ children, crumb, theme, onToggleTheme, adminOnly }) {
  const location = useLocation();
  if (!getToken()) return <Navigate to="/login" replace state={{ from: location }} />;
  if (adminOnly && !getUser()?.isAdmin) return <Navigate to="/" replace />;
  return (
    <>
      <Nav crumb={crumb} theme={theme} onToggleTheme={onToggleTheme} />
      {children}
    </>
  );
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const guard = (el, crumb, adminOnly) => (
    <Protected crumb={crumb} theme={theme} onToggleTheme={toggleTheme} adminOnly={adminOnly}>
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
      <Route path="/comic" element={guard(<ComicDrama />, '漫剧生产')} />
      <Route path="/comment-review" element={guard(<CommentReview />, '评论审核助手')} />
      <Route path="/business-data" element={guard(<BusinessData />, '经营数据看板')} />
      <Route path="/admin" element={guard(<Admin />, '账号管理', true)} />
      <Route path="/activity" element={guard(<ActivityLog />, '操作日志', true)} />
      <Route path="/post-review" element={guard(<PostReview />, '帖子审核')} />
      <Route path="/community-post" element={guard(<CommunityPost />, '社区发布')} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
