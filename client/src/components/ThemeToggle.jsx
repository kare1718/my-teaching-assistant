import { useUIStore } from '../stores/useUIStore';

const THEMES = ['system', 'light', 'dark'];
const ICONS = { system: '🖥️', light: '☀️', dark: '🌙' };
const LABELS = { system: '시스템', light: '라이트', dark: '다크' };

export default function ThemeToggle() {
  const { theme, setTheme } = useUIStore();

  const cycle = () => {
    const idx = THEMES.indexOf(theme);
    setTheme(THEMES[(idx + 1) % THEMES.length]);
  };

  return (
    <button
      onClick={cycle}
      title={`테마: ${LABELS[theme]}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)', background: 'var(--card)',
        color: 'var(--foreground)', cursor: 'pointer',
        fontSize: 'var(--text-sm)', fontWeight: 500,
        transition: 'background var(--duration-fast) var(--ease-out)',
      }}
    >
      <span style={{ fontSize: 14 }}>{ICONS[theme]}</span>
      <span>{LABELS[theme]}</span>
    </button>
  );
}
