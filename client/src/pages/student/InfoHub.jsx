import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';
import { SkeletonPage, ErrorState, EmptyState } from '../../components/StudentStates';

export default function InfoHub() {
  const [tab, setTab] = useState('notices');
  const [notices, setNotices] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expandedNoticeId, setExpandedNoticeId] = useState(null);

  const load = () => {
    setLoading(true);
    setLoadError('');
    Promise.all([
      api('/students/my-notices'),
      api('/students/my-materials'),
    ]).then(([noticesData, materialsData]) => {
      setNotices(noticesData);
      setMaterials(materialsData);
      setLoading(false);
    }).catch((err) => { setLoading(false); setLoadError(err.message || '데이터를 불러올 수 없습니다.'); });
  };

  useEffect(() => { load(); }, []);

  const handleNoticeToggle = async (notice) => {
    const nextId = expandedNoticeId === notice.id ? null : notice.id;
    setExpandedNoticeId(nextId);

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
        <Link to="/student">홈</Link> &gt; <span>안내 / 자료</span>
      </div>

      {/* 탭 */}
      <div className="s-tab-segment">
        <button className={`s-tab-seg-item ${tab === 'notices' ? 'active' : ''}`} onClick={() => setTab('notices')}>
          안내사항
          {unreadCount > 0 && (
            <span style={{
              background: 'var(--destructive)', color: 'white', fontSize: 10, fontWeight: 700,
              padding: '1px 6px', borderRadius: 8, marginLeft: 4
            }}>
              {unreadCount}
            </span>
          )}
        </button>
        <button className={`s-tab-seg-item ${tab === 'materials' ? 'active' : ''}`} onClick={() => setTab('materials')}>수업 자료</button>
      </div>

      {tab === 'notices' && (
        <div className="s-card">
          <div className="s-section-title">안내사항 ({notices.length}건)</div>
          {notices.length === 0 ? (
            <EmptyState message="안내사항이 없습니다." />
          ) : (
            notices.map(n => {
              const isExpanded = expandedNoticeId === n.id;
              const isUnread = !n.is_read;
              return (
                <div
                  key={n.id}
                  onClick={() => handleNoticeToggle(n)}
                  style={{
                    padding: '12px 14px', marginBottom: 8, borderRadius: 10, cursor: 'pointer',
                    background: isUnread ? 'var(--primary-lighter)' : 'transparent',
                    borderLeft: isUnread ? '3px solid var(--primary)' : '3px solid transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: isUnread ? 700 : 500, fontSize: 'var(--text-sm)',
                        color: isUnread ? 'var(--primary)' : 'var(--warm-800)',
                        display: 'flex', alignItems: 'center', gap: 6
                      }}>
                        {isUnread && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />}
                        {n.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 'var(--space-1)' }}>{n.created_at}</div>
                    </div>
                    <span style={{ fontSize: 14, color: 'var(--warm-400)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      ▼
                    </span>
                  </div>

                  {isExpanded && (
                    <div style={{
                      marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--student-border)',
                      fontSize: 13, color: 'var(--warm-800)', lineHeight: 1.6, whiteSpace: 'pre-wrap'
                    }}>
                      {n.content}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'materials' && (
        <div className="s-card">
          <div className="s-section-title">수업 자료 ({materials.length}건)</div>
          {materials.length === 0 ? (
            <EmptyState message="등록된 자료가 없습니다." />
          ) : (
            materials.map(m => (
              <div key={m.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--student-border)' }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{m.title}</div>
                {m.description && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--warm-500)', marginTop: 2 }}>{m.description}</div>}
                <div style={{ fontSize: 11, color: 'var(--warm-500)', marginTop: 'var(--space-1)' }}>{m.class_date}</div>
                {m.youtube_url && (
                  <a href={m.youtube_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-block', marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--accent)', fontWeight: 600 }}>
                    ▶ 영상 보기
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <BottomTabBar />
    </div>
  );
}
