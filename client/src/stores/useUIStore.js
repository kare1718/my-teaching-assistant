import { create } from 'zustand';

function getInitialTheme() {
  try {
    return localStorage.getItem('theme') || 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(theme) {
  const el = document.documentElement;
  if (theme === 'dark') {
    el.dataset.theme = 'dark';
  } else if (theme === 'light') {
    el.dataset.theme = 'light';
  } else {
    delete el.dataset.theme;
  }
}

export const useUIStore = create((set) => ({
  theme: getInitialTheme(),

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    applyTheme(theme);
    set({ theme });
  },
}));
