import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';
import { SkeletonPage, ErrorState, EmptyState } from '../../components/StudentStates';

export default function Notices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const load = () => {
    setLoading(true);
    setLoadError('');
    api('/students/my-notices')
      .then((data) => { setNotices(data); setLoading(false); })
      .catch((err) => { setLoading(false); setLoadError(err.message || '데이터를 불러올 수 없습니다.'); });
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (notice) => {
    const nextId = expandedId === notice.id ? null : notice.id;
    setExpandedId(nextId);

    if (nextId && !notice.is_read) {
      try {
        await apiPost(`/students/notices/${notice.id}/read`);
        setNotices(prev => prev.map(n => n.id === notice.id ? { ...n, is_read: 1 } : n));
      } catch { /* 읽음 처리 실패해도 UI에는 영향 없음 */ }
    }
  };

  const unreadCount = notices.filter(n => !n.is_read).length;

  if (loading) return (
    <div className="content s-page">
      <SkeletonPage />
      <BottomTabBar />
    </div>
  );

  if (loadError) return (
    <div className="content s-page">
      <ErrorState message={loadError} onRetry={load} />
      <BottomTabBar />
    </div>
  );

  return (
    <div className="content s-page">
      <div className="breadcrumb">
        <Link to="/student">홈</Link> &gt; <span>안내사항</span>
      </div>

      <div className="s-card">
        <div className="s-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          안내사항
          {unreadCount > 0 && (
            <span style={{
              background: 'var(--destructive)', color: 'white', fontSize: 11, fontWeight: 700,
              padding: '2px 8px', borderRadius: 10, minWidth: 20, textAlign: 'center'
            }}>
              {unreadCount}
            </span>
          )}
        </div>

        {notices.length === 0 ? (
          <EmptyState message="안내사항이 없습니다." />
        ) : (
          notices.map((n) => {
            const isExpanded = expandedId === n.id;
            const isUnread = !n.is_read;
            return (
              <div
                key={n.id}
                onClick={() => handleToggle(n)}
                style={{
                  padding: '12px 14px', marginBottom: 8, borderRadius: 10, cursor: 'pointer',
                  background: isUnread ? 'var(--primary-lighter)' : 'var(--card)',
                  borderLeft: isUnread ? '3px solid var(--primary)' : '3px solid transparent',
                  border: `1px solid ${isUnread ? 'var(--primary-light)' : 'var(--student-border)'}`,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: isUnread ? 700 : 500, fontSize: 14,
                      color: isUnread ? 'var(--primary)' : 'var(--warm-800)',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}>
                      {isUnread && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />}
                      {n.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 4 }}>
                      {new Date(n.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  <span style={{ fontSize: 16, color: 'var(--warm-400)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    ▼
                  </span>
                </div>

                {isExpanded && (
                  <div style={{
                    marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--student-border)',
                    fontSize: 13, color: 'var(--warm-800)', lineHeight: 1.7, whiteSpace: 'pre-wrap'
                  }}>
                    {n.content}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <BottomTabBar />
    </div>
  );
}
