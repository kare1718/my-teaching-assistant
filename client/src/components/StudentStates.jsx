/* Shared loading/error/empty states for student pages */

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
