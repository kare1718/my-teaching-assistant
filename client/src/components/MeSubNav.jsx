import { useNavigate, useLocation } from 'react-router-dom';

const ITEMS = [
  { path: '/student/avatar',  label: '아바타', d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { path: '/student/shop',    label: '상점',   d: 'M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9z' },
  { path: '/student/reviews', label: '후기',   d: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 0 0 .95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 0 0-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 0 0-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 0 0-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 0 0 .951-.69l1.519-4.674z' },
];

const ME_PATHS = ITEMS.map(i => i.path);

export default function MeSubNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!ME_PATHS.includes(pathname)) return null;

  return (
    <div className="s-tab-pills" style={{ marginBottom: 'var(--space-3)' }}>
      {ITEMS.map(item => {
        const isActive = pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`s-tab-pill${isActive ? ' active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.d} />
            </svg>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
