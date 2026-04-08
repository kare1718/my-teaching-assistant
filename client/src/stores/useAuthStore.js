import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isLoggedIn: false,

  hydrate: () => {
    const token = localStorage.getItem('token');
    let user = null;
    try {
      const raw = localStorage.getItem('user');
      user = raw ? JSON.parse(raw) : null;
    } catch { /* ignore */ }
    set({ token, user, isLoggedIn: !!token });
  },

  saveAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user, isLoggedIn: true });
    window.dispatchEvent(new Event('auth-changed'));
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null, isLoggedIn: false });
    window.dispatchEvent(new Event('auth-changed'));
  },

  isTokenExpired: () => {
    const { token } = get();
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  },

  getUser: () => get().user,
}));
