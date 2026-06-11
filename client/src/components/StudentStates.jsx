/* Shared loading/error/empty states for student pages */
import { useNavigate } from 'react-router-dom';
import { getUser } from '../api';

export function SkeletonCard({ lines = 3, style }) {
  return (
    <div className="s-skeleton-card" style={style}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="s-skeleton s-skeleton-line"
          style={{ width: i === lines - 1 ? '60%' : i === 0 ? '40%' : '90%' }} />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 3 }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="s-skeleton-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="s-skeleton s-skeleton-circle" style={{ width: 44, height: 44, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="s-skeleton s-skeleton-line" style={{ width: '50%' }} />
        <div className="s-skeleton s-skeleton-line" style={{ width: '80%' }} />
      </div>
    </div>
  ));
}

export function SkeletonHero() {
  return (
    <div className="s-skeleton-card" style={{ height: 120, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="s-skeleton s-skeleton-circle" style={{ width: 64, height: 64 }} />
        <div style={{ flex: 1 }}>
          <div className="s-skeleton s-skeleton-line" style={{ width: '45%', height: 18 }} />
          <div className="s-skeleton s-skeleton-line" style={{ width: '70%' }} />
          <div className="s-skeleton s-skeleton-line" style={{ width: '100%', height: 6, marginTop: 8 }} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <SkeletonHero />
      <SkeletonCard lines={2} />
      <SkeletonCard lines={4} />
      <SkeletonList count={2} />
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)' }}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ margin: '0 auto var(--space-4)', display: 'block' }}>
        <circle cx="32" cy="32" r="28" fill="var(--soft-error-bg)" />
        <circle cx="32" cy="32" r="20" fill="var(--student-card)" />
        <path d="M24 26c0-1 1-3 3-3s3 2 3 3" stroke="var(--warm-600)" strokeWidth="2" strokeLinecap="round" />
        <path d="M34 26c0-1 1-3 3-3s3 2 3 3" stroke="var(--warm-600)" strokeWidth="2" strokeLinecap="round" />
        <path d="M26 40c1.5-2 3.5-3 6-3s4.5 1 6 3" stroke="var(--warm-600)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--warm-800)', marginBottom: 'var(--space-2)' }}>
        앗, 문제가 생겼어요
      </p>
      <p style={{ fontSize: 13, color: 'var(--warm-500)', marginBottom: 'var(--space-5)', lineHeight: 1.6 }}>
        {message || '데이터를 불러올 수 없습니다.'}
      </p>
      {onRetry && (
        <button className="s-btn s-btn-warm" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

/**
 * 학생 전용 페이지에서 API 호출이 실패했을 때 역할별 맞춤 안내를 보여줍니다.
 * - superadmin: "학생 화면 접근 불가" + 슈퍼 관리자 홈 이동
 * - admin: "관리자 계정으로는 이 페이지를 볼 수 없어요" + 관리자 홈 이동
 * - student/기타: "학생 등록이 완료되지 않았거나 일시적 오류" + 로그인으로
 *
 * Props:
 *  - message: 학생(또는 기타)에게 보여줄 추가 설명. 지정 안 하면 기본 문구 사용.
 *  - pageLabel: 이 페이지의 이름(예: "게임 허브"). 관리자/슈퍼 관리자 안내에 사용.
 *  - emoji: 상단 이모지 (기본 🧑‍🎓).
 *  - onRetry: 학생에게만 노출되는 '다시 시도' 버튼 핸들러 (선택).
 */
export function StudentAccessError({ message, pageLabel, emoji = '🧑‍🎓', onRetry }) {
  const navigate = useNavigate();
  const user = getUser();
  const isSuperadmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin';
  const label = pageLabel || '이 페이지';

  const title = isSuperadmin || isAdmin
    ? '학생 전용 페이지입니다'
    : '정보를 불러올 수 없습니다';

  const description = isSuperadmin
    ? '슈퍼 관리자 계정은 학생 화면에 접근할 수 없어요.'
    : isAdmin
      ? `관리자 계정으로는 ${label}을(를) 볼 수 없어요. 학생 계정으로 로그인해 주세요.`
      : (message || '학생 등록이 완료되지 않았거나 일시적인 오류입니다. 담당 선생님께 문의해 주세요.');

  const buttonLabel = isSuperadmin
    ? '슈퍼 관리자 홈으로'
    : isAdmin
      ? '관리자 홈으로'
      : '로그인 화면으로';

  const handleClick = () => {
    if (isSuperadmin) navigate('/superadmin');
    else if (isAdmin) navigate('/admin');
    else navigate('/login');
  };

  return (
    <div className="content" style={{ padding: '60px 20px', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{emoji}</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, color: 'var(--foreground)', wordBreak: 'keep-all' }}>
        {title}
      </h2>
      <p style={{ fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.6, marginBottom: 24, wordBreak: 'keep-all' }}>
        {description}
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {onRetry && !isSuperadmin && !isAdmin && (
          <button onClick={onRetry} style={{
            padding: '10px 20px', background: 'var(--card)', color: 'var(--foreground)',
            border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer'
          }}>
            다시 시도
          </button>
        )}
        <button onClick={handleClick} style={{
          padding: '10px 20px', background: 'var(--primary)', color: '#fff',
          border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer'
        }}>
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ message, icon }) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)' }}>
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{ margin: '0 auto var(--space-4)', display: 'block' }}>
        <circle cx="28" cy="28" r="24" fill="var(--warm-100)" />
        <rect x="18" y="16" width="20" height="24" rx="3" fill="var(--warm-200)" />
        <line x1="22" y1="23" x2="34" y2="23" stroke="var(--warm-300)" strokeWidth="2" strokeLinecap="round" />
        <line x1="22" y1="28" x2="30" y2="28" stroke="var(--warm-300)" strokeWidth="2" strokeLinecap="round" />
        <line x1="22" y1="33" x2="32" y2="33" stroke="var(--warm-300)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p style={{ fontSize: 14, color: 'var(--warm-500)', lineHeight: 1.6 }}>
        {message || '아직 데이터가 없습니다.'}
      </p>
    </div>
  );
}
