import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUser } from '../api';

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const adminPages = [
  { path: '/admin', label: '대시보드', icon: '🏠' },
  { divider: true, label: '수업 및 운영' },
  { path: '/admin/schedules', label: '수업 일정 관리', icon: '📅' },
  { path: '/admin/scores', label: '시험 성적 관리', icon: '📊' },
  { path: '/admin/clinic', label: '클리닉 관리', icon: '🩺' },
  { path: '/admin/ta-schedule', label: '조교 근무표', icon: '📋' },
  { path: '/admin/homework', label: '과제 관리', icon: '📝' },
  { path: '/admin/reports', label: '수업 레포트', icon: '📄' },
  { divider: true, label: '소통 및 승인' },
  { path: '/admin/pending', label: '가입 승인', icon: '✅' },
  { path: '/admin/qna', label: '질문 관리', icon: '❓' },
  { path: '/admin/sms', label: '문자 발송', icon: '💬' },
  { path: '/admin/edit-requests', label: '정보 수정 요청', icon: '✏️' },
  { divider: true, label: '콘텐츠 관리' },
  { path: '/admin/notices', label: '안내사항 관리', icon: '📢' },
  { path: '/admin/reviews', label: '후기 관리', icon: '⭐' },
  { path: '/admin/hall-of-fame', label: '명예의 전당', icon: '🏆' },
  { path: '/admin/gamification', label: '게임 관리', icon: '🎮' },
  { divider: true, label: '설정' },
  { path: '/student', label: '학생 페이지 보기', icon: '👀' },
];

const studentPages = [
  { path: '/student', label: '홈', icon: '🏠' },
  { path: '/student/scores', label: '성적', icon: '📊' },
  { path: '/student/qna', label: '질문', icon: '❓' },
  { path: '/student/notices', label: '안내', icon: '📢' },
  { path: '/student/materials', label: '자료', icon: '📚' },
  { path: '/student/game', label: '게임', icon: '🎮' },
  { path: '/student/rankings', label: '랭킹', icon: '🏆' },
  { path: '/student/shop', label: '상점', icon: '🛒' },
  { path: '/student/clinic', label: '클리닉 신청', icon: '📋' },
  { path: '/student/reviews', label: '후기', icon: '⭐' },
];

const STORAGE_KEY = 'menuFabY';
const SWITCH_FAB_KEY = 'switchFabY';

export default function SideNav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  if (!user) return null;

  const isAdminPage = location.pathname.startsWith('/admin');
  const isAdminUser = user.role === 'admin' || user.school === '조교';
  const pages = isAdminPage ? adminPages : studentPages;

  // 메뉴 플로팅 드래그 상태
  const [fabY, setFabY] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : window.innerHeight * 0.45;
  });
  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartFabY = useRef(0);
  const hasMoved = useRef(false);

  // 전환 플로팅 버튼 드래그 상태
  const [switchFabY, setSwitchFabY] = useState(() => {
    const saved = localStorage.getItem(SWITCH_FAB_KEY);
    return saved ? Number(saved) : window.innerHeight * 0.55;
  });
  const switchDragging = useRef(false);
  const switchDragStartY = useRef(0);
  const switchDragStartFabY = useRef(0);
  const switchHasMoved = useRef(false);

  const onPointerDown = (e) => {
    if (open) return; // 패널 열려있을 때는 드래그 안함
    dragging.current = true;
    hasMoved.current = false;
    dragStartY.current = e.clientY;
    dragStartFabY.current = fabY;
    e.target.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging.current) return;
    const dy = e.clientY - dragStartY.current;
    if (Math.abs(dy) > 5) hasMoved.current = true;
    const newY = Math.max(60, Math.min(window.innerHeight - 130, dragStartFabY.current + dy));
    setFabY(newY);
  };

  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    localStorage.setItem(STORAGE_KEY, String(fabY));
  };

  const onFabClick = () => {
    if (!hasMoved.current) {
      setOpen(!open);
    }
  };

  const handleNav = (path) => {
    navigate(path);
    setOpen(false);
  };

  // 전환 버튼 드래그 핸들러
  const onSwitchPointerDown = (e) => {
    switchDragging.current = true;
    switchHasMoved.current = false;
    switchDragStartY.current = e.clientY;
    switchDragStartFabY.current = switchFabY;
    e.target.setPointerCapture(e.pointerId);
  };
  const onSwitchPointerMove = (e) => {
    if (!switchDragging.current) return;
    const dy = e.clientY - switchDragStartY.current;
    if (Math.abs(dy) > 5) switchHasMoved.current = true;
    const newY = Math.max(60, Math.min(window.innerHeight - 130, switchDragStartFabY.current + dy));
    setSwitchFabY(newY);
  };
  const onSwitchPointerUp = () => {
    if (!switchDragging.current) return;
    switchDragging.current = false;
    localStorage.setItem(SWITCH_FAB_KEY, String(switchFabY));
  };
  const onSwitchClick = () => {
    if (!switchHasMoved.current) {
      navigate(isAdminPage ? '/student' : '/admin');
    }
  };

  return (
    <>
      {/* 관리자↔학생 전환 플로팅 버튼 (드래그 가능) */}
      {isAdminUser && (
        <div
          onPointerDown={onSwitchPointerDown}
          onPointerMove={onSwitchPointerMove}
          onPointerUp={onSwitchPointerUp}
          onClick={onSwitchClick}
          style={{
            position: 'fixed',
            right: 14,
            top: switchFabY,
            zIndex: 1001,
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: isAdminPage
              ? 'linear-gradient(135deg, #3b82f6, #60a5fa)'
              : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isAdminPage
              ? '0 4px 14px rgba(59,130,246,0.45)'
              : '0 4px 14px rgba(99,102,241,0.45)',
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none',
            transition: switchDragging.current ? 'none' : 'background 0.3s, box-shadow 0.3s',
          }}
        >
          {isAdminPage ? (
            <>
              <span style={{ fontSize: 18, lineHeight: 1 }}>👀</span>
              <span style={{ fontSize: 8, fontWeight: 700, marginTop: 1, lineHeight: 1 }}>학생</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              <span style={{ fontSize: 8, fontWeight: 700, marginTop: 1, lineHeight: 1 }}>관리자</span>
            </>
          )}
        </div>
      )}

      {/* 플로팅 메뉴 버튼 */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onFabClick}
        style={{
          position: 'fixed',
          left: 14,
          top: open ? fabY : fabY,
          zIndex: open ? 200 : 200,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: open
            ? 'linear-gradient(135deg, #ef4444, #f87171)'
            : (isAdminPage
              ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
              : 'linear-gradient(135deg, #3b82f6, #60a5fa)'),
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: open
            ? '0 4px 14px rgba(239,68,68,0.45)'
            : (isAdminPage
              ? '0 4px 14px rgba(245,158,11,0.45)'
              : '0 4px 14px rgba(59,130,246,0.45)'),
          cursor: open ? 'pointer' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
          transition: dragging.current ? 'none' : 'background 0.3s, box-shadow 0.3s',
        }}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </div>

      {/* 오버레이 */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.3)', zIndex: 190,
            transition: 'opacity 0.2s',
          }}
        />
      )}

      {/* 사이드바 패널 */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 260, background: 'white', zIndex: 195,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: open ? '4px 0 20px rgba(0,0,0,0.15)' : 'none',
        display: 'flex', flexDirection: 'column',
        paddingTop: 56,
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '16px 20px 12px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>
            {isAdminPage ? '📌 관리자 메뉴' : '📌 메뉴'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>
            {user.name}님
          </div>
        </div>

        {/* 메뉴 리스트 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {pages.map((item, idx) => {
            if (item.divider) {
              return (
                <div key={idx} style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)',
                  padding: '12px 10px 6px', textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>
                  {item.label}
                </div>
              );
            }
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 14, fontWeight: isActive ? 700 : 500,
                  background: isActive ? 'var(--primary-lighter)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--foreground)',
                  transition: 'all 0.15s', marginBottom: 2,
                  textAlign: 'left',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.label}</span>
                {isActive && (
                  <div style={{
                    marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--primary)'
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* 하단 - 역할 전환 */}
        {(user.role === 'admin' || user.school === '조교') && (
          <div style={{
            padding: '10px 14px', borderTop: '1px solid var(--border)',
          }}>
            <button
              onClick={() => handleNav(isAdminPage ? '/student' : '/admin')}
              style={{
                width: '100%', padding: '10px', borderRadius: 8,
                border: '1px solid var(--border)', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                background: isAdminPage ? '#eff6ff' : '#fef3c7',
                color: isAdminPage ? '#1e40af' : '#92400e',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {isAdminPage ? '👀 학생 페이지로' : '🔒 관리자 페이지로'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
