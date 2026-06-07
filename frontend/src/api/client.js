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
};

// 把后端返回的 /files/... 相对路径拼成可访问地址(生产环境加后端基址）
export function fileUrl(p) {
  return p ? `${BASE}${p}` : '';
}
