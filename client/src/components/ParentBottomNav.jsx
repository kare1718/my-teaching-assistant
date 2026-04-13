import { useNavigate, useLocation } from 'react-router-dom';

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const CalendarIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const WalletIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/><circle cx="18" cy="15" r="1"/>
  </svg>
);
const BellIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const MoreIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
  </svg>
);

const tabs = [
  { path: '/parent', label: '홈', Icon: HomeIcon, exact: true },
  { path: '/parent/attendance', label: '출결', Icon: CalendarIcon },
  { path: '/parent/tuition', label: '수납', Icon: WalletIcon },
  { path: '/parent/notices', label: '공지', Icon: BellIcon },
  { path: '/parent/more', label: '더보기', Icon: MoreIcon },
];

export default function ParentBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--bg-primary, #fff)',
      borderTop: '1px solid var(--border-color, #e5e7eb)',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      height: 60, zIndex: 1000,
      paddingBottom: 'env(safe-area-inset-bottom, 0)',
      boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
    }}>
      {tabs.map((tab) => {
        const isActive = tab.exact
          ? location.pathname === tab.path
          : location.pathname.startsWith(tab.path);
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 2,
              background: 'none', border: 'none', cursor: 'pointer',
              color: isActive ? 'var(--primary-color, #4f46e5)' : 'var(--text-secondary, #9ca3af)',
              fontWeight: isActive ? 600 : 400,
              fontSize: 11, padding: '4px 12px',
              transition: 'color 0.15s',
            }}
          >
            <tab.Icon />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
