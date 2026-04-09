import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUser, api } from '../api';
import ThemeToggle from './ThemeToggle';

/* ─── SVG Icon primitives ─────────────────────────────────────────── */
const Icon = ({ d, size = 16, children, viewBox = '0 0 24 24' }) => (
  <svg
    width={size} height={size} viewBox={viewBox}
    fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    {d ? <path d={d} /> : children}
  </svg>
);

const Icons = {
  home:        <Icon><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Icon>,
  userCheck:   <Icon><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></Icon>,
  userPlus:    <Icon><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></Icon>,
  edit:        <Icon><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></Icon>,
  bell:        <Icon><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Icon>,
  calendar:    <Icon><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Icon>,
  fileText:    <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></Icon>,
  message:     <Icon><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></Icon>,
  barChart:    <Icon><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Icon>,
  file:        <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></Icon>,
  zap:         <Icon><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Icon>,
  star:        <Icon><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Icon>,
  award:       <Icon><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></Icon>,
  clock:       <Icon><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Icon>,
  mail:        <Icon><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></Icon>,
  user:        <Icon><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icon>,
  save:        <Icon><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></Icon>,
  chevronLeft: <Icon><polyline points="15 18 9 12 15 6"/></Icon>,
  chevronRight:<Icon><polyline points="9 18 15 12 9 6"/></Icon>,
  menu:        <Icon><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></Icon>,
  close:       <Icon><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Icon>,
  clipboard:   <Icon><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></Icon>,
  stethoscope: <Icon><path d="M4.8 2.655A.5.5 0 0 1 5.5 2h3a.5.5 0 0 1 .354.854L7.5 4.207V9.5a4.5 4.5 0 0 0 9 0V6"/><circle cx="18" cy="6" r="2"/></Icon>,
  settings:    <Icon><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></Icon>,
  dollar:      <Icon><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></Icon>,
  phone:       <Icon><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></Icon>,
  diamond:     <Icon><path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0z"/></Icon>,
  eye:         <Icon><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></Icon>,
  robot:       <Icon><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="9" cy="16" r="1"/><circle cx="15" cy="16" r="1"/></Icon>,
  palette:     <Icon><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></Icon>,
  book:        <Icon><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></Icon>,
  shoppingCart:<Icon><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></Icon>,
  trendingUp:  <Icon><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Icon>,
  info:        <Icon><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></Icon>,
  checkCircle: <Icon><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></Icon>,
};

/* ─── Admin nav tree ──────────────────────────────────────────────── */
const adminPages = [
  { path: '/admin', label: '대시보드', icon: Icons.home },

  { divider: true, label: '학생 관리' },
  { path: '/admin/attendance', label: '출결 관리', desc: '출석/결석 관리', icon: Icons.clipboard },
  { path: '/admin/pending', label: '가입 승인', desc: '신규 승인/거절', badgeKey: 'pending_users', icon: Icons.userCheck },
  { path: '/admin/edit-requests', label: '정보 수정 요청', desc: '수정 요청 처리', badgeKey: 'edit_requests', icon: Icons.edit },
  { path: '/admin/consultations', label: '상담 일지', desc: '학생/학부모 상담', icon: Icons.message },

  { divider: true, label: '수업 및 운영' },
  { path: '/admin/schedules', label: '수업 일정 관리', desc: '일정 등록/관리', icon: Icons.calendar },
  { path: '/admin/scores', label: '시험 성적 관리', desc: '성적 입력/관리', icon: Icons.barChart },
  { path: '/admin/clinic', label: '클리닉 관리', desc: '클리닉 승인', badgeKey: 'pending_clinic', icon: Icons.stethoscope },
  { path: '/admin/ta-schedule', label: '조교 근무표', desc: '근무 일정 관리', icon: Icons.clock },
  { path: '/admin/homework', label: '과제 관리', desc: '과제 확인/채점', icon: Icons.fileText },
  { path: '/admin/reports', label: '수업 레포트', desc: '수업 기록', icon: Icons.file },

  { divider: true, label: '소통' },
  { path: '/admin/qna', label: '질문 관리', desc: '학생 질문 답변', badgeKey: 'pending_questions', icon: Icons.message },
  { path: '/admin/sms', label: '문자 발송', desc: '학생/학부모 문자', icon: Icons.mail },
  { path: '/admin/notices', label: '안내사항 관리', desc: '공지사항 작성', icon: Icons.bell },

  { divider: true, label: '콘텐츠 관리' },
  { path: '/admin/reviews', label: '후기 관리', desc: '후기 승인/반려', badgeKey: 'pending_reviews', icon: Icons.star },
  { path: '/admin/hall-of-fame', label: '명예의 전당', desc: '우수학생 관리', icon: Icons.award },
  { path: '/admin/gamification', label: '게임 관리', desc: 'XP/포인트/퀴즈', icon: Icons.zap },
  { path: '/admin/portfolios', label: '포트폴리오', desc: '포트폴리오 관리', icon: Icons.palette },
  { path: '/admin/ai', label: 'AI 어시스턴트', desc: 'AI 설정/관리', icon: Icons.robot },
  { path: '/admin/pre-registered', label: '사전등록', desc: '학생 미리 등록', icon: Icons.userPlus },
  { path: '/admin/profile', label: '프로필 관리', desc: '강사 프로필 설정', icon: Icons.user },
  { path: '/admin/backup', label: '백업 관리', desc: '데이터 백업', icon: Icons.save },

  { divider: true, label: '운영 및 결제' },
  { path: '/admin/tuition', label: '수납 관리', desc: '수업료 수납', icon: Icons.dollar },
  { path: '/admin/sms-credits', label: 'SMS 충전', desc: 'SMS 크레딧 충전', icon: Icons.phone },
  { path: '/admin/subscription', label: '구독 관리', desc: '구독 플랜 관리', icon: Icons.diamond },

  { divider: true, label: '설정' },
  { path: '/admin/settings', label: '학원 설정', desc: '학원 기본 설정', icon: Icons.settings },
];

/* ─── Student nav (FAB) ───────────────────────────────────────────── */
const studentPages = [
  { path: '/student', label: '홈', icon: Icons.home },
  { path: '/student/attendance', label: '출석 체크', icon: Icons.checkCircle },
  { path: '/student/scores', label: '성적', icon: Icons.barChart },
  { path: '/student/qna', label: '질문', icon: Icons.message },
  { path: '/student/notices', label: '안내', icon: Icons.bell },
  { path: '/student/materials', label: '자료', icon: Icons.book },
  { path: '/student/game', label: '게임', icon: Icons.zap },
  { path: '/student/rankings', label: '랭킹', icon: Icons.award },
  { path: '/student/shop', label: '상점', icon: Icons.shoppingCart },
  { path: '/student/portfolio', label: '포트폴리오', icon: Icons.palette },
  { path: '/student/clinic', label: '클리닉 신청', icon: Icons.fileText },
  { path: '/student/reviews', label: '후기', icon: Icons.star },
  { path: '/student/timer', label: '공부 타이머', icon: Icons.clock },
  { path: '/student/study-rankings', label: '공부 랭킹', icon: Icons.trendingUp },
  { path: '/student/ai', label: 'AI 허브', icon: Icons.robot },
  { path: '/student/info', label: '정보 허브', icon: Icons.info },
];

const STORAGE_KEY   = 'menuFabY';
const SIDEBAR_KEY   = 'adminSidebarOpen';
const COLLAPSED_KEY = 'adminNavCollapsed';
const PINNED_KEY    = 'adminSidebarPinned';
const FONT = "'Paperlogy', 'Noto Sans KR', system-ui, sans-serif";

export default function SideNav() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = getUser();
  if (!user) return null;

  const isAdminPage = location.pathname.startsWith('/admin');
  const isAdminUser = user.role === 'admin' || user.school === '조교';

  /* ── Admin sidebar state ── */
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth > 768);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const [pinned, setPinned] = useState(() => {
    const saved = localStorage.getItem(PINNED_KEY);
    return saved !== null ? saved === 'true' : false;
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (!isAdminPage) return false;
    if (typeof window !== 'undefined' && window.innerWidth > 768) return true; // 데스크톱은 항상 열림
    const saved = localStorage.getItem(PINNED_KEY);
    return saved === 'true';
  });

  const toggleSidebar = () => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    localStorage.setItem(SIDEBAR_KEY, String(next));
  };

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    localStorage.setItem(PINNED_KEY, String(next));
    if (next) { setSidebarOpen(true); localStorage.setItem(SIDEBAR_KEY, 'true'); }
  };

  // 데스크톱 전환 시 자동 열기
  useEffect(() => {
    if (isAdminPage && isDesktop) {
      setSidebarOpen(true);
    }
  }, [isDesktop, isAdminPage]);

  // 다른 곳 클릭 시 닫기 (모바일에서만, 고정 안 된 경우)
  useEffect(() => {
    if (!isAdminPage || isDesktop || pinned || !sidebarOpen) return;
    const handleClick = (e) => {
      const sidebar = document.getElementById('admin-sidebar');
      const openBtn = document.getElementById('sidebar-open-btn');
      if (sidebar && !sidebar.contains(e.target) && openBtn && !openBtn.contains(e.target)) {
        setSidebarOpen(false);
        localStorage.setItem(SIDEBAR_KEY, 'false');
      }
    };
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 100);
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClick); };
  }, [isAdminPage, isDesktop, pinned, sidebarOpen]);

  useEffect(() => {
    if (isAdminPage) {
      if (isDesktop) {
        setSidebarOpen(true);
      } else {
        const isPinned = localStorage.getItem(PINNED_KEY) === 'true';
        setPinned(isPinned);
        setSidebarOpen(isPinned);
      }
    }
  }, [isAdminPage]);

  // 설정 페이지에서 사이드바 고정 변경 시 즉시 반영
  useEffect(() => {
    const onPinChange = () => {
      const next = localStorage.getItem(PINNED_KEY) === 'true';
      setPinned(next);
      setSidebarOpen(next);
    };
    window.addEventListener('sidebarPinChanged', onPinChange);
    return () => window.removeEventListener('sidebarPinChanged', onPinChange);
  }, []);

  /* ── Category collapse state ── */
  const [collapsedCats, setCollapsedCats] = useState(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const toggleCategory = (label) => {
    setCollapsedCats(prev => {
      const next = { ...prev, [label]: !prev[label] };
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      return next;
    });
  };

  /* ── Badge counts (admin) ── */
  const [badgeCounts, setBadgeCounts] = useState({});

  useEffect(() => {
    if (!isAdminPage) return;
    const fetchBadges = () => {
      api('/admin/badge-counts').then(setBadgeCounts).catch(() => {});
    };
    fetchBadges();
    const interval = setInterval(fetchBadges, 60000);
    return () => clearInterval(interval);
  }, [isAdminPage]);

  const totalBadge = Object.values(badgeCounts).reduce((a, b) => a + b, 0);

  /* ── Student FAB state ── */
  const [open,   setOpen]   = useState(false);
  const [fabY,   setFabY]   = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const val = saved ? Number(saved) : window.innerHeight * 0.45;
    return Math.max(60, Math.min(val, window.innerHeight - 60));
  });
  const dragging       = useRef(false);
  const dragStartY     = useRef(0);
  const dragStartFabY  = useRef(0);
  const hasMoved       = useRef(false);

  const onPointerDown = (e) => {
    if (open) return;
    dragging.current = true; hasMoved.current = false;
    dragStartY.current = e.clientY; dragStartFabY.current = fabY;
    e.target.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    const dy = e.clientY - dragStartY.current;
    if (Math.abs(dy) > 5) hasMoved.current = true;
    setFabY(Math.max(60, Math.min(window.innerHeight - 130, dragStartFabY.current + dy)));
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    localStorage.setItem(STORAGE_KEY, String(fabY));
  };
  const onFabClick = () => { if (!hasMoved.current) setOpen(!open); };
  const handleNav  = (path) => { navigate(path); setOpen(false); };

  /* ── shared menu renderer (student FAB / admin sidebar) ── */
  const getCategoryBadgeSum = (startIdx) => {
    let sum = 0;
    for (let i = startIdx + 1; i < adminPages.length; i++) {
      if (adminPages[i].divider) break;
      if (adminPages[i].badgeKey && badgeCounts[adminPages[i].badgeKey]) {
        sum += badgeCounts[adminPages[i].badgeKey];
      }
    }
    return sum;
  };

  const renderAdminMenu = () => {
    let currentCat = null;
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {adminPages.map((item, idx) => {
          if (item.divider) {
            currentCat = item.label;
            const catSum = getCategoryBadgeSum(idx);
            const isCollapsed = collapsedCats[item.label];
            return (
              <button key={idx} onClick={() => toggleCategory(item.label)} style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                fontSize: 11, fontWeight: 700, color: 'var(--neutral-400)',
                padding: '16px 10px 6px', letterSpacing: '0.04em',
                margin: 0, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.15s', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
                {item.label}
                {catSum > 0 && (
                  <span style={{
                    minWidth: 16, height: 16, borderRadius: 8,
                    background: 'var(--destructive)', color: 'white',
                    fontSize: 9, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px',
                  }}>
                    {catSum > 99 ? '99+' : catSum}
                  </span>
                )}
              </button>
            );
          }

          // 대시보드(첫 항목)는 항상 표시, 카테고리 내 항목은 접기 상태 확인
          if (currentCat && collapsedCats[currentCat]) return null;

          const isActive = location.pathname === item.path ||
            (item.path !== '/admin' && location.pathname.startsWith(item.path + '/'));
          const badgeCount = item.badgeKey ? badgeCounts[item.badgeKey] : 0;
          const isPulse = item.badgeKey === 'pending_users' && badgeCount > 0;
          return (
            <button key={item.path} onClick={() => navigate(item.path)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '8px 10px', borderRadius: 7,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: isActive ? 600 : 400,
              background: isActive ? 'var(--primary-lighter)' : 'transparent',
              color: isActive ? 'var(--primary)' : 'var(--foreground)',
              transition: 'background 0.12s', marginBottom: 1, textAlign: 'left',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--neutral-50)'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ color: isActive ? 'var(--primary)' : 'var(--neutral-500)', display: 'flex' }}>
                {item.icon}
              </span>
              <div style={{ flex: 1 }}>
                <span>{item.label}</span>
                {item.desc && <div style={{ fontSize: 11, color: 'var(--neutral-400)', fontWeight: 400, marginTop: 2 }}>{item.desc}</div>}
              </div>
              {badgeCount > 0 && (
                <span style={{
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: 'var(--destructive)', color: 'white',
                  fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 5px', flexShrink: 0,
                  ...(isPulse ? { animation: 'badgePulse 2s ease-in-out infinite' } : {}),
                }}>
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
              {!badgeCount && isActive && (
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)' }} />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const renderStudentMenu = (onNavigate) => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
      {studentPages.map(item => {
        const isActive = location.pathname === item.path;
        return (
          <button key={item.path} onClick={() => onNavigate(item.path)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: '10px var(--space-3)', borderRadius: 'var(--radius)',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 'var(--text-sm)', fontWeight: isActive ? 600 : 400,
            background: isActive ? 'var(--primary-lighter)' : 'transparent',
            color: isActive ? 'var(--primary)' : 'var(--foreground)',
            transition: 'background 0.12s', marginBottom: 2, textAlign: 'left',
          }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--neutral-50)'; }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ display: 'flex', alignItems: 'center', width: 18 }}>{item.icon}</span>
            <span>{item.label}</span>
            {isActive && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />}
          </button>
        );
      })}
    </div>
  );

  const renderSwitchButton = (onNavigate) => (
    <div style={{ marginTop: 'auto' }}>
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
        <ThemeToggle />
      </div>
      {isAdminUser && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <button onClick={() => onNavigate(isAdminPage ? '/student' : '/admin')} style={{
            width: '100%', padding: '9px', borderRadius: 8,
            border: '1px solid var(--border)', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            background: isAdminPage ? 'var(--info-light)' : 'var(--warning-light)',
            color: isAdminPage ? 'var(--primary)' : 'var(--foreground)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'background 0.12s',
          }}>
            {isAdminPage ? '학생 페이지로' : '관리자 페이지로'}
          </button>
        </div>
      )}
    </div>
  );

  /* ══════════════════════════════════════
     관리자: 고정 사이드바
  ══════════════════════════════════════ */
  if (isAdminPage) {
    return (
      <>
        {/* Sidebar panel */}
        <div id="admin-sidebar" style={{
          position: 'fixed', top: 52, left: 0, bottom: 0,
          width: sidebarOpen ? 230 : 0,
          background: 'var(--card)', zIndex: 180,
          borderRight: sidebarOpen ? '1px solid var(--border)' : 'none',
          transition: 'width 0.22s cubic-bezier(0.16,1,0.3,1)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          fontFamily: FONT,
        }}>
          <div style={{ width: 230, minWidth: 230, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Sidebar header */}
            <div style={{
              padding: '12px 14px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted-foreground)', margin: 0, letterSpacing: '0.02em' }}>
                  관리자 메뉴
                </span>
                {totalBadge > 0 && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 9,
                    background: 'var(--destructive)', color: 'white',
                    fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 5px',
                  }}>
                    {totalBadge > 99 ? '99+' : totalBadge}
                  </span>
                )}
              </div>
              {/* 모바일에서만 닫기/고정 버튼 표시 */}
              {!isDesktop && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button onClick={togglePin} title={pinned ? '메뉴 고정 해제' : '메뉴 고정'} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    color: pinned ? 'var(--primary)' : 'var(--neutral-400)', display: 'flex', alignItems: 'center',
                    borderRadius: 5, transition: 'color 0.2s',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2z"/>
                    </svg>
                  </button>
                  <button onClick={toggleSidebar} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    color: 'var(--neutral-400)', display: 'flex', alignItems: 'center',
                    borderRadius: 5,
                  }}>
                    {Icons.chevronLeft}
                  </button>
                </div>
              )}
            </div>
            {renderAdminMenu()}
            {renderSwitchButton(navigate)}
          </div>
        </div>

        {/* Collapsed: open button — 모바일에서만 */}
        {!sidebarOpen && !isDesktop && (
          <button onClick={toggleSidebar} style={{
            position: 'fixed', top: 62, left: 8, zIndex: 180,
            width: 32, height: 32, borderRadius: 7,
            background: 'var(--card)', border: '1px solid var(--border)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)', color: 'var(--primary)',
          }}>
            {Icons.chevronRight}
            {totalBadge > 0 && (
              <div style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, background: 'var(--destructive)' }} />
            )}
          </button>
        )}

        {/* Push content right — 데스크톱은 항상, 모바일은 고정 시만 */}
        <style>{`
          .content, .main-content { margin-left: ${sidebarOpen ? '230px' : '0'} !important; transition: margin-left 0.22s cubic-bezier(0.16,1,0.3,1); }
          @media (max-width: 768px) { .content, .main-content { margin-left: ${pinned && sidebarOpen ? '230px' : '0'} !important; } }
          @keyframes badgePulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        `}</style>
      </>
    );
  }

  /* ══════════════════════════════════════
     학생: 플로팅 FAB 메뉴
  ══════════════════════════════════════ */
  return (
    <>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onFabClick}
        style={{
          position: 'fixed', left: 14, top: fabY, zIndex: 200,
          width: 46, height: 46, borderRadius: '50%',
          background: open
            ? 'linear-gradient(135deg, oklch(20% 0.06 260), oklch(25% 0.08 260))'
            : 'linear-gradient(135deg, oklch(30% 0.08 260), oklch(40% 0.12 250))',
          color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: open ? '0 4px 14px oklch(20% 0.06 260 / 0.4)' : '0 4px 14px oklch(30% 0.08 260 / 0.4)',
          cursor: open ? 'pointer' : 'grab',
          touchAction: 'none', userSelect: 'none',
          transition: dragging.current ? 'none' : 'background 0.25s, box-shadow 0.25s',
        }}
      >
        {open ? Icons.close : Icons.menu}
      </div>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
          zIndex: 190, transition: 'opacity 0.2s',
        }} />
      )}

      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 260, background: 'var(--card)', zIndex: 195,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: open ? '4px 0 20px rgba(0,0,0,0.15)' : 'none',
        display: 'flex', flexDirection: 'column', paddingTop: 56,
      }}>
        <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', margin: 0 }}>메뉴</p>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2, marginBottom: 0 }}>{user.name}님</p>
        </div>
        {renderStudentMenu(handleNav)}
        {renderSwitchButton(handleNav)}
      </div>
    </>
  );
}
