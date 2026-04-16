import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUser, api } from '../api';
import useMediaQuery from '../hooks/useMediaQuery';
import { useTenantConfig } from '../contexts/TenantContext';

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
  shield:      <Icon><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Icon>,
};

/* ─── Admin nav tree — 마누스 IA 블루프린트 9개 그룹 ───────────────── */
const adminNavGroups = [
  { key: 'home', label: '홈', icon: Icons.home, path: '/admin', single: true },

  { key: 'students', label: '학생', icon: Icons.userCheck, children: [
    { path: '/admin/students', label: '학생 명단', badgeKey: 'pending_users' },
    { path: '/admin/parents', label: '보호자 관리' },
    { path: '/admin/data-import', label: '데이터 가져오기' },
  ]},

  { key: 'classes', label: '학생 관리', icon: Icons.book, children: [
    { path: '/admin/classes', label: '수업/시간표' },
    { path: '/admin/attendance', label: '출결/과제', tier: 'pro' },
    { path: '/admin/scores', label: '시험/성적' },
  ]},

  { key: 'tuition', label: '수납', icon: Icons.dollar, children: [
    { path: '/admin/tuition', label: '청구/납부' },
  ]},

  { key: 'consult', label: '상담', icon: Icons.message, children: [
    { path: '/admin/consultations', label: '상담 일지' },
    { path: '/admin/leads', label: '상담 관리(리드)' },
    { path: '/admin/clinic', label: '클리닉', tier: 'pro', badgeKey: 'pending_clinic' },
  ]},

  { key: 'messages', label: '메시지', icon: Icons.mail, children: [
    { path: '/admin/sms', label: '문자 발송' },
    { path: '/admin/notices', label: '공지 작성' },
  ]},

  { key: 'automation', label: '자동화', icon: Icons.zap, tier: 'pro', children: [
    { path: '/admin/automation', label: '자동화 관리', tier: 'pro' },
    { path: '/admin/automation?tab=queue', label: '업무 큐', tier: 'pro' },
  ]},

  { key: 'reports', label: '리포트', icon: Icons.barChart, tier: 'pro', children: [
    { path: '/admin/reports', label: '수업 레포트', tier: 'pro' },
    { path: '/admin/hall-of-fame', label: '명예의 전당' },
  ]},

  { key: 'premium', label: 'First Class', icon: Icons.diamond, feature: 'gamification', children: [
    { path: '/admin/gamification', label: '게이미피케이션', tier: 'first_class' },
    { path: '/admin/portfolios', label: '포트폴리오', tier: 'first_class' },
    { path: '/admin/ai', label: 'AI 보조', tier: 'first_class' },
  ]},

  { key: 'settings', label: '설정', icon: Icons.settings, children: [
    { path: '/admin/settings', label: '학원 정보' },
    { path: '/admin/settings/roles', label: '역할·권한' },
    { path: '/admin/subscription', label: '구독 관리' },
    { path: '/admin/profile', label: '프로필' },
    { path: '/admin/backup', label: '백업' },
    { path: '/admin/audit-logs', label: '감사 로그' },
  ]},
];

const TIER_BADGE_STYLE = {
  pro: { bg: 'oklch(95% 0.04 260)', color: 'oklch(45% 0.15 260)', label: 'Pro' },
  first_class: { bg: 'oklch(95% 0.05 300)', color: 'oklch(45% 0.18 300)', label: 'First Class' },
  // 레거시 호환 (기존 데이터/코드 호환용)
  growth: { bg: 'oklch(95% 0.04 260)', color: 'oklch(45% 0.15 260)', label: 'Pro' },
  premium: { bg: 'oklch(95% 0.05 300)', color: 'oklch(45% 0.18 300)', label: 'First Class' },
};

/* ─── Super admin nav ────────────────────────────────────────────── */
const superadminPages = [
  { path: '/superadmin', label: '대시보드', desc: '플랫폼 전체 현황', icon: Icons.home },
  { path: '/superadmin/kpi', label: 'KPI 대시보드', desc: '북극성/퍼널/경고 지표', icon: Icons.chart || Icons.home },
  { divider: true, label: '비즈니스' },
  { path: '/superadmin/revenue', label: '매출 관리', desc: '결제/환불/MRR', icon: Icons.dollar },
  { path: '/superadmin/promotions', label: '프로모션', desc: '기프트/쿠폰/이용권', icon: Icons.star },
  { divider: true, label: '운영' },
  { path: '/superadmin/usage', label: '사용 현황', desc: '학원별 접속/체류/기능 분석', icon: Icons.barChart },
  { path: '/superadmin/academies', label: '학원 목록', desc: '활성/비활성 학원 관리', icon: Icons.clipboard },
  { path: '/superadmin/academy/new', label: '학원 생성', desc: '새 학원 등록', icon: Icons.userPlus },
  { divider: true, label: '시스템' },
  { path: '/superadmin/backup-security', label: '백업/보안', desc: '데이터 백업 및 보안', icon: Icons.save },
  { divider: true, label: '학원 관리 바로가기' },
  { path: '/admin', label: '관리자 페이지', desc: '학원 관리 화면으로', icon: Icons.settings },
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
  const { hasFeature } = useTenantConfig();
  if (!user) return null;

  const isSuperAdminPage = location.pathname.startsWith('/superadmin');
  const isAdminPage = location.pathname.startsWith('/admin') || isSuperAdminPage;
  const isAdminUser = user.role === 'admin' || user.role === 'superadmin' || user.school === '조교';

  /* ── Screen size ── */
  const isLg = useMediaQuery('(min-width: 1600px)');
  const SIDEBAR_W = isLg ? 260 : 230;
  const NAV_H = isLg ? 58 : 52;

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

  // 사이드바 외부 클릭 시 자동 닫힘 (모바일 비고정 상태에서만)
  // 데스크탑에서는 카테고리/사이드바 모두 그대로 유지
  useEffect(() => {
    if (!isAdminPage || isDesktop || pinned || !sidebarOpen) return;

    const handleClick = (e) => {
      const sidebar = document.getElementById('admin-sidebar');
      const openBtn = document.getElementById('sidebar-open-btn');
      if (sidebar && sidebar.contains(e.target)) return;
      if (openBtn && openBtn.contains(e.target)) return;

      // 모바일에서 카테고리 자동 접힘 + 사이드바 닫힘
      setCollapsedCats(prev => {
        let changed = false;
        const next = {};
        Object.keys(prev).forEach(key => {
          if (prev[key] === false) {
            next[key] = false;
          } else if (prev[key] === true) {
            changed = true;
          }
        });
        if (!changed) return prev;
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
        return next;
      });

      setSidebarOpen(false);
      localStorage.setItem(SIDEBAR_KEY, 'false');
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

  /* ── admin 9-group accordion renderer ── */
  const visibleGroups = adminNavGroups.filter(g => !g.feature || hasFeature(g.feature));

  // 정확 매칭이 필요한 경로들 (상위 경로가 하위 경로를 포함하지 않도록)
  const EXACT_MATCH_PATHS = new Set(['/admin/settings']);
  const isChildActive = (path) => {
    if (EXACT_MATCH_PATHS.has(path)) return location.pathname === path;
    return (
      location.pathname === path ||
      (path !== '/admin' && location.pathname.startsWith(path + '/'))
    );
  };

  const groupBadgeSum = (group) => {
    if (!group.children) return 0;
    return group.children.reduce(
      (sum, c) => sum + (c.badgeKey && badgeCounts[c.badgeKey] ? badgeCounts[c.badgeKey] : 0),
      0
    );
  };

  // 현재 경로가 속한 그룹은 자동 펼침 (사용자가 직접 접지 않은 경우)
  const autoExpandedKey = visibleGroups.find(
    g => g.children && g.children.some(c => isChildActive(c.path))
  )?.key;

  const isGroupExpanded = (group) => {
    const explicit = collapsedCats[group.key];
    if (explicit === true) return true;          // 사용자가 열었음
    if (explicit === false) return false;         // 사용자가 닫았음
    return group.key === autoExpandedKey;         // 기본: 현재 경로 그룹만 열림
  };

  const renderTierBadge = (tier) => {
    const style = TIER_BADGE_STYLE[tier];
    if (!style) return null;
    return (
      <span style={{
        background: style.bg, color: style.color,
        fontSize: 9, fontWeight: 700,
        padding: '2px 6px', borderRadius: 999,
        letterSpacing: '0.02em', flexShrink: 0,
      }}>{style.label}</span>
    );
  };

  const renderAdminMenu = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: isLg ? '10px 10px' : '8px 8px' }}>
      {visibleGroups.map(group => {
        // single 항목 (홈/대시보드)
        if (group.single) {
          const active = isChildActive(group.path);
          return (
            <button key={group.key} onClick={() => navigate(group.path)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: isLg ? '10px 12px' : '9px 10px', borderRadius: 8,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: isLg ? 14 : 13, fontWeight: active ? 700 : 600,
              background: active ? 'rgba(16,32,68,0.08)' : 'transparent',
              color: active ? 'var(--primary)' : 'var(--foreground)',
              marginBottom: 2, textAlign: 'left',
            }}>
              <span style={{ color: active ? 'var(--primary)' : 'var(--neutral-500)', display: 'flex' }}>{group.icon}</span>
              <span style={{ flex: 1 }}>{group.label}</span>
              {active && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)' }} />}
            </button>
          );
        }

        const expanded = isGroupExpanded(group);
        const catSum = groupBadgeSum(group);
        const groupContainsActive = group.children?.some(c => isChildActive(c.path));

        return (
          <div key={group.key} style={{ marginBottom: 2 }}>
            <button onClick={() => toggleCategory(group.key)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: isLg ? '10px 12px' : '9px 10px', borderRadius: 8,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: isLg ? 14 : 13,
              fontWeight: groupContainsActive ? 700 : 600,
              background: groupContainsActive ? 'rgba(16,32,68,0.06)' : 'transparent',
              color: groupContainsActive ? 'var(--primary)' : 'var(--foreground)',
              textAlign: 'left',
            }}>
              <span style={{ color: groupContainsActive ? 'var(--primary)' : 'var(--neutral-500)', display: 'flex' }}>
                {group.icon}
              </span>
              <span style={{ flex: 1 }}>{group.label}</span>
              {group.tier && renderTierBadge(group.tier)}
              {catSum > 0 && (
                <span style={{
                  minWidth: 16, height: 16, borderRadius: 8,
                  background: 'var(--destructive)', color: 'white',
                  fontSize: 9, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px',
                }}>{catSum > 99 ? '99+' : catSum}</span>
              )}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ transform: expanded ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0, opacity: 0.5 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {expanded && (
              <div style={{ paddingLeft: 10, marginTop: 2, borderLeft: '1px solid var(--border)', marginLeft: isLg ? 22 : 20 }}>
                {group.children.map(item => {
                  const active = isChildActive(item.path);
                  const badgeCount = item.badgeKey ? badgeCounts[item.badgeKey] : 0;
                  const isPulse = item.badgeKey === 'pending_users' && badgeCount > 0;
                  return (
                    <button key={item.path} onClick={() => navigate(item.path)} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: isLg ? '7px 10px' : '6px 9px', borderRadius: 6,
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: isLg ? 13 : 12,
                      fontWeight: active ? 700 : 500,
                      background: active ? 'rgba(16,32,68,0.1)' : 'transparent',
                      color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                      transition: 'background 0.12s', marginBottom: 1, textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--neutral-50)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.tier && renderTierBadge(item.tier)}
                      {badgeCount > 0 && (
                        <span style={{
                          minWidth: 16, height: 16, borderRadius: 8,
                          background: 'var(--destructive)', color: 'white',
                          fontSize: 9, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 4px', flexShrink: 0,
                          ...(isPulse ? { animation: 'badgePulse 2s ease-in-out infinite' } : {}),
                        }}>{badgeCount > 99 ? '99+' : badgeCount}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderSuperAdminMenu = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
      {superadminPages.map((item, idx) => {
        if (item.divider) {
          return (
            <div key={idx} style={{
              fontSize: 11, fontWeight: 700, color: 'var(--neutral-400)',
              padding: '16px 10px 6px', letterSpacing: '0.04em',
            }}>
              {item.label}
            </div>
          );
        }
        const isActive = location.pathname === item.path;
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
            {isActive && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)' }} />}
          </button>
        );
      })}
    </div>
  );

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
      {user.role === 'superadmin' && !isSuperAdminPage && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <button onClick={() => onNavigate('/superadmin')} style={{
            width: '100%', padding: '9px', borderRadius: 8,
            border: '1px solid var(--border)', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            background: 'var(--warning-light)', color: 'var(--foreground)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'background 0.12s',
          }}>
            플랫폼 관리로
          </button>
        </div>
      )}
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
          position: 'fixed', top: NAV_H, left: 0, bottom: 0,
          width: sidebarOpen ? SIDEBAR_W : 0,
          background: 'var(--card)', zIndex: 180,
          borderRight: sidebarOpen ? '1px solid var(--border)' : 'none',
          transition: 'width 0.22s cubic-bezier(0.16,1,0.3,1)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          fontFamily: FONT,
        }}>
          <div style={{ width: SIDEBAR_W, minWidth: SIDEBAR_W, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Sidebar header */}
            <div style={{
              padding: isLg ? '14px 16px' : '12px 14px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: isLg ? 14 : 13, fontWeight: 700, color: 'var(--muted-foreground)', margin: 0, letterSpacing: '0.02em' }}>
                  {isSuperAdminPage ? '플랫폼 관리' : '관리자 메뉴'}
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
            {isSuperAdminPage ? renderSuperAdminMenu() : renderAdminMenu()}
            {renderSwitchButton(navigate)}
          </div>
        </div>

        {/* 모바일 사이드바 오버레이 (고정 안 된 경우) */}
        {!isDesktop && sidebarOpen && !pinned && (
          <div onClick={toggleSidebar} style={{
            position: 'fixed', inset: 0, top: NAV_H,
            background: 'rgba(0,0,0,0.3)', zIndex: 179,
            transition: 'opacity 0.2s',
          }} />
        )}

        {/* Collapsed: open button — 모바일에서만 */}
        {!sidebarOpen && !isDesktop && (
          <button onClick={toggleSidebar} style={{
            position: 'fixed', top: NAV_H + 10, left: 8, zIndex: 180,
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
          .content, .main-content { margin-left: ${sidebarOpen ? SIDEBAR_W + 'px' : '0'} !important; transition: margin-left 0.22s cubic-bezier(0.16,1,0.3,1); }
          @media (max-width: 768px) { .content, .main-content { margin-left: ${pinned && sidebarOpen ? SIDEBAR_W + 'px' : '0'} !important; } }
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
          position: 'fixed', left: 14, top: fabY, zIndex: 210,
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
