const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: getHeaders(),
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

export async function apiPost(path, body) {
  return api(path, { method: 'POST', body: JSON.stringify(body) });
}

export async function apiPut(path, body) {
  return api(path, { method: 'PUT', body: JSON.stringify(body) });
}

export async function apiDelete(path) {
  return api(path, { method: 'DELETE' });
}

// FormData 전송 (파일 업로드용)
export async function apiUpload(path, formData) {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Content-Type은 설정하지 않음 (브라우저가 boundary 자동 설정)
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

export function saveAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  window.dispatchEvent(new Event('auth-changed'));
}

export function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('auth-changed'));
}

export function isLoggedIn() {
  return !!getToken();
}

export async function apiGet(path) {
  return api(path);
}
