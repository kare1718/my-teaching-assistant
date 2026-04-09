const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
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

export function saveAuth(token, user, rememberMe = false) {
  if (rememberMe) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('rememberMe', 'true');
    // sessionStorage 쪽 클리어
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  } else {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(user));
    // localStorage 쪽 클리어
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
  }
  window.dispatchEvent(new Event('auth-changed'));
}

export function getUser() {
  const user = localStorage.getItem('user') || sessionStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('rememberMe');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  window.dispatchEvent(new Event('auth-changed'));
}

export function isLoggedIn() {
  return !!getToken();
}

// JWT 만료 체크 — 앱 로드 시 호출
export function checkTokenExpiry() {
  const token = getToken();
  if (!token) return;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) {
      logout();
      window.location.href = '/login';
    }
  } catch {
    // 토큰 파싱 실패 시 무시 (서버에서 401로 처리)
  }
}

export async function apiGet(path) {
  return api(path);
}

export async function apiRaw(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    logout();
    window.location.href = '/login';
    throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
  }
  return res;
}
