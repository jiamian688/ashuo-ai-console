const TOKEN_KEY = 'yule_token';
// 生产环境把请求指向独立部署的后端;本地为空,走 vite 代理
const BASE = import.meta.env.VITE_API_BASE || '';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    if (location.pathname !== '/login') location.href = '/login';
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

export const api = {
  login: (password, username) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ password, username }) }),
  stats: () => request('/tasks/stats'),
  listTasks: () => request('/tasks'),
  uploadTasks: (formData) => request('/tasks', { method: 'POST', body: formData }),
  listTodos: () => request('/todos'),
  addTodo: (content, bucket) =>
    request('/todos', { method: 'POST', body: JSON.stringify({ content, bucket }) }),
  toggleTodo: (id, done) =>
    request(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) }),
  deleteTodo: (id) => request(`/todos/${id}`, { method: 'DELETE' }),
  genCopy: (keyword, count) =>
    request('/ai/copy', { method: 'POST', body: JSON.stringify({ keyword, count }) }),
  telegramStatus: () => request('/telegram/status'),
  telegramTest: () => request('/telegram/test', { method: 'POST', body: JSON.stringify({ sendPing: true }) }),
  processClip: (formData) => request('/clips/process', { method: 'POST', body: formData }),
  socialStatus: () => request('/social/status'),
  socialTest: () => request('/social/test', { method: 'POST' }),
  postTweet: (text) => request('/social/post', { method: 'POST', body: JSON.stringify({ text }) }),
};

// 把后端返回的 /files/... 相对路径拼成可访问地址(生产环境加后端基址）
export function fileUrl(p) {
  return p ? `${BASE}${p}` : '';
}
