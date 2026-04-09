import { create } from 'zustand';

function getInitialTheme() {
  try {
    return localStorage.getItem('theme') || 'light';
  } catch {
    return 'light';
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

// 앱 로드 시 즉시 테마 적용 (다크 모드 깜빡임 방지)
const initialTheme = getInitialTheme();
applyTheme(initialTheme);

export const useUIStore = create((set) => ({
  theme: initialTheme,

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    applyTheme(theme);
    set({ theme });
  },
}));
