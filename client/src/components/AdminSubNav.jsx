import { useNavigate, useLocation } from 'react-router-dom';
import useMediaQuery from '../hooks/useMediaQuery';

const CATEGORIES = [
  {
    label: '학생',
    pages: [
      { path: '/admin/pending',        label: '가입 승인' },
      { path: '/admin/pre-registered', label: '사전 등록' },
      { path: '/admin/edit-requests',  label: '정보 수정' },
    ],
  },
  {
    label: '소통',
    pages: [
      { path: '/admin/notices',  label: '공지 작성' },
      { path: '/admin/clinic',   label: '클리닉' },
      { path: '/admin/homework', label: '과제' },
      { path: '/admin/qna',      label: '질문' },
    ],
  },
  {
    label: '수업',
    pages: [
      { path: '/admin/schedules', label: '수업/시험 일정' },
      { path: '/admin/scores',    label: '시험 성적' },
      { path: '/admin/reports',   label: '레포트' },
    ],
  },
  {
    label: '콘텐츠',
    pages: [
      { path: '/admin/gamification', label: '게임' },
      { path: '/admin/reviews',      label: '후기' },
      { path: '/admin/hall-of-fame', label: '명예의 전당' },
    ],
  },
  {
    label: '운영',
    pages: [
      { path: '/admin/ta-schedule', label: '조교 근무' },
      { path: '/admin/sms',         label: '문자' },
      { path: '/admin/profile',     label: '강사 프로필' },
      { path: '/admin/backup',      label: '백업' },
    ],
  },
];

export default function AdminSubNav() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const currentPath = location.pathname;
  const isLg = useMediaQuery('(min-width: 1600px)');

  const category = CATEGORIES.find(cat =>
    cat.pages.some(p => currentPath === p.path || currentPath.startsWith(p.path + '/'))
  );

  if (!category) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: isLg ? 8 : 6, flexWrap: 'wrap',
      marginBottom: 'var(--space-4)',
      padding: isLg ? '8px 0' : '6px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{
        fontSize: isLg ? 13 : 11, fontWeight: 700, color: 'var(--neutral-400)',
        letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 2,
      }}>
        {category.label}
      </span>
      {category.pages.map(page => {
        const isActive = currentPath === page.path || currentPath.startsWith(page.path + '/');
        return (
          <button
            key={page.path}
            onClick={() => navigate(page.path)}
            style={{
              padding: isLg ? '7px 16px' : '5px 12px',
              borderRadius: 20,
              border: isActive ? 'none' : '1px solid var(--border)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: isLg ? 14 : 12,
              fontWeight: isActive ? 600 : 400,
              background: isActive ? 'var(--primary)' : 'transparent',
              color: isActive ? 'white' : 'var(--foreground)',
              transition: 'all 0.12s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--neutral-100)'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          >
            {page.label}
          </button>
        );
      })}
    </div>
  );
}
