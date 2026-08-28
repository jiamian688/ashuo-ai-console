const TOKEN_KEY = 'yule_token';
const USER_KEY = 'yule_user';
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
  localStorage.removeItem(USER_KEY);
}
export function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}
export function setUser(u) {
  localStorage.setItem(USER_KEY, JSON.stringify(u));
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
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  listUsers: () => request('/users'),
  createUser: (username, password, nickname, tools) =>
    request('/users', { method: 'POST', body: JSON.stringify({ username, password, nickname, tools }) }),
  resetUserPassword: (id, password) =>
    request(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
  updateUserTools: (id, tools) =>
    request(`/users/${id}/tools`, { method: 'POST', body: JSON.stringify({ tools }) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  stats: () => request('/tasks/stats'),
  listTasks: () => request('/tasks'),
  // 用 XHR 上传:fetch 无法回报上传进度,XHR 的 upload.onprogress 可以。
  // onProgress({ percent, loaded, total }) 会在传输过程中被多次回调。
  // signal: 可选 AbortSignal,abort() 时取消上传(reject 一个 name='AbortError' 的错误)。
  uploadTasks: (formData, onProgress, signal) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/api/tasks`);
      const token = getToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (signal) {
        if (signal.aborted) { xhr.abort(); }
        signal.addEventListener('abort', () => xhr.abort());
      }
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({ percent: Math.round((e.loaded / e.total) * 100), loaded: e.loaded, total: e.total });
        }
      };
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        if (xhr.status === 401) {
          clearToken();
          if (location.pathname !== '/login') location.href = '/login';
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || `请求失败 (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('网络错误,上传失败'));
      xhr.onabort = () => { const err = new Error('已取消'); err.name = 'AbortError'; reject(err); };
      xhr.send(formData);
    }),
  listTodos: () => request('/todos'),
  addTodo: (content, bucket) =>
    request('/todos', { method: 'POST', body: JSON.stringify({ content, bucket }) }),
  toggleTodo: (id, done) =>
    request(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) }),
  deleteTodo: (id) => request(`/todos/${id}`, { method: 'DELETE' }),
  genCopy: (keyword, count) =>
    request('/ai/copy', { method: 'POST', body: JSON.stringify({ keyword, count }) }),
  organizeMeeting: (raw) =>
    request('/ai/meeting-notes', { method: 'POST', body: JSON.stringify({ raw }) }),
  telegramStatus: () => request('/telegram/status'),
  telegramTest: () => request('/telegram/test', { method: 'POST', body: JSON.stringify({ sendPing: true }) }),
  processClip: (formData) => request('/clips/process', { method: 'POST', body: formData }),
  makeCover: (formData) => request('/clips/cover', { method: 'POST', body: formData }),
  socialStatus: () => request('/social/status'),
  socialTest: () => request('/social/test', { method: 'POST' }),
  postTweet: (text) => request('/social/post', { method: 'POST', body: JSON.stringify({ text }) }),
  commentReviewStatus: () => request('/comment-review/status'),
  commentReviewTodayStats: () => request('/comment-review/today-stats'),
  listPendingComments: (source, page = 1, limit = 20) => request(`/comment-review/list?source=${source}&page=${page}&limit=${limit}`),
  commentReviewHistory: (source, page = 1, limit = 20) => request(`/comment-review/history?source=${source}&page=${page}&limit=${limit}`),
  aiReviewComments: (items) => request('/comment-review/ai-review', { method: 'POST', body: JSON.stringify({ items }) }),
  autoReviewComments: (source, limit = 50, onlyToday = false) => request('/comment-review/auto-review', { method: 'POST', body: JSON.stringify({ source, limit, onlyToday }) }),
  passComment: (source, id) => request('/comment-review/pass', { method: 'POST', body: JSON.stringify({ source, id }) }),
  passComments: (source, ids) => request('/comment-review/pass-batch', { method: 'POST', body: JSON.stringify({ source, ids }) }),
  rejectComment: (source, id, reason) => request('/comment-review/reject', { method: 'POST', body: JSON.stringify({ source, id, reason }) }),
  rejectComments: (source, ids, reason) => request('/comment-review/reject-batch', { method: 'POST', body: JSON.stringify({ source, ids, reason }) }),
  businessDataStatus: () => request('/business-data/status'),
  listDailyBusinessData: (limit = 30) => request(`/business-data/daily?limit=${limit}`),
  todayHomeStats: () => request('/business-data/today'),
  postAdminStatus: () => request('/post-admin/status'),
  postAdminTodayStats: () => request('/post-admin/today-stats'),
  listPendingPosts: (page = 1, limit = 20) => request(`/post-admin/list?page=${page}&limit=${limit}&status=0`),
  passPost: (id) => request('/post-admin/pass', { method: 'POST', body: JSON.stringify({ id }) }),
  rejectPost: (id, reason) => request('/post-admin/reject', { method: 'POST', body: JSON.stringify({ id, reason }) }),
  aiReviewPosts: (items) => request('/post-admin/ai-review', { method: 'POST', body: JSON.stringify({ items }) }),
  autoReviewPosts: (limit = 20) => request('/post-admin/auto-review', { method: 'POST', body: JSON.stringify({ limit }) }),
  uploadCommunityPostImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/post-admin/upload-image', { method: 'POST', body: formData });
  },
  createCommunityPost: (payload) => request('/post-admin/create', { method: 'POST', body: JSON.stringify(payload) }),
};

// 把后端返回的 /files/... 相对路径拼成可访问地址(生产环境加后端基址）
export function fileUrl(p) {
  return p ? `${BASE}${p}` : '';
}
