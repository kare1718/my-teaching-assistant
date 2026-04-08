import { useNavigate, useLocation } from 'react-router-dom';

const ITEMS = [
  { path: '/student/scores',    label: '성적',   d: 'M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10m6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v14' },
  { path: '/student/notices',   label: '공지',   d: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9' },
  { path: '/student/materials', label: '자료',   d: 'M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z' },
  { path: '/student/qna',       label: '질문',   d: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
  { path: '/student/timer',     label: '타이머', d: 'M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
  { path: '/student/clinic',    label: '클리닉', d: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2' },
  { path: '/student/ox-quiz',   label: 'OX퀴즈', d: 'M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
  { path: '/student/ai',        label: 'AI',     d: 'M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  { path: '/student/study-rankings', label: '랭킹', d: 'M8 21h8m-4-4v4m-4.65-4h9.3c.58 0 .87 0 1.09-.11a1 1 0 0 0 .44-.44c.11-.22.11-.51.11-1.09V6.64c0-.58 0-.87-.11-1.09a1 1 0 0 0-.44-.44C17.52 5 17.23 5 16.65 5H7.35c-.58 0-.87 0-1.09.11a1 1 0 0 0-.44.44C5.71 5.77 5.71 6.06 5.71 6.64v9.72c0 .58 0 .87.11 1.09a1 1 0 0 0 .44.44c.22.11.51.11 1.09.11zM12 3l2 2-2 2-2-2 2-2z' },
];

const STUDY_PATHS = ITEMS.map(i => i.path);

export default function StudySubNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!STUDY_PATHS.includes(pathname)) return null;

  return (
    <div className="s-tab-pills" style={{ marginBottom: 'var(--space-3)' }}>
      {ITEMS.map(item => {
        const isActive = pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`s-tab-pill${isActive ? ' active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.d} />
            </svg>
            <span style={{ fontSize: 12 }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
