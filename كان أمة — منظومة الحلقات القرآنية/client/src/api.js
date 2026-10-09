// طبقة الاتصال بالـ API — تحلّ المسار بالنسبة لصفحة النشر (أو /p/<id>/)
export const API_BASE = new URL('api/', document.baseURI).href.replace(/\/$/, '');

export function apiUrl(path) {
  return `${API_BASE}/${String(path || '').replace(/^\//, '')}`;
}

const TOKEN_KEY = 'kan_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function request(path, { method = 'GET', body, silent } = {}) {
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(apiUrl(path), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    throw new ApiError('تعذّر الاتصال بالخادم. تحقّقي من الشبكة ثم أعيدي المحاولة.', 0);
  }
  let data = null;
  const text = await res.text();
  if (text) { try { data = JSON.parse(text); } catch (e) { data = { raw: text }; } }
  if (!res.ok) {
    const msg = (data && data.error) || 'حدث خطأ غير متوقع.';
    if (res.status === 401 && !silent) { setToken(''); window.dispatchEvent(new Event('kan:unauthorized')); }
    throw new ApiError(msg, res.status);
  }
  return data;
}

export const api = {
  get: (p, o) => request(p, o),
  post: (p, body, o) => request(p, { ...o, method: 'POST', body }),
  patch: (p, body, o) => request(p, { ...o, method: 'PATCH', body }),
  put: (p, body, o) => request(p, { ...o, method: 'PUT', body }),
  del: (p, o) => request(p, { ...o, method: 'DELETE' })
};

export function fileUrl(name) {
  return name ? apiUrl(`common/files/${encodeURIComponent(name)}`) : '';
}

export function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('تعذّر قراءة الملف.'));
    reader.readAsDataURL(file);
  });
}

export function fmtDate(value) {
  if (!value) return '—';
  const d = String(value).slice(0, 10);
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
export function fmtDateTime(value) {
  if (!value) return '—';
  const s = String(value).replace('T', ' ');
  return `${fmtDate(s)} — ${s.slice(11, 16)}`;
}
export function today() { return new Date().toISOString().slice(0, 10); }
export function monthNow() { return new Date().toISOString().slice(0, 7); }
export function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
