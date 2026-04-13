import { useState, useEffect } from 'react';
import { api, apiPost } from '../../api';

export default function ParentNotices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState(null);

  const load = () => {
    setLoading(true);
    api('/parent/notices')
      .then(setNotices)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSelect = async (notice) => {
    setSelectedNotice(notice);
    if (!notice.is_read) {
      try {
        await apiPost(`/parent/notices/${notice.id}/read`);
        setNotices(prev => prev.map(n => n.id === notice.id ? { ...n, is_read: true } : n));
      } catch (e) { console.error(e); }
    }
  };

  if (loading) {
    return <div style={styles.container}><p style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>불러오는 중...</p></div>;
  }

  // 상세 보기
  if (selectedNotice) {
    return (
      <div style={styles.container}>
        <button onClick={() => setSelectedNotice(null)} style={styles.backBtn}>
          &larr; 목록으로
        </button>
        <div style={styles.detailCard}>
          {selectedNotice.is_pinned ? (
            <span style={styles.pinnedBadge}>고정</span>
          ) : null}
          <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>{selectedNotice.title}</h2>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6b7280' }}>
            {new Date(selectedNotice.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-primary, #111)' }}>
            {selectedNotice.content}
          </div>
        </div>
        <div style={{ height: 80 }} />
      </div>
    );
  }

  // 안읽은 공지 먼저
  const sorted = [...notices].sort((a, b) => {
    if (a.is_read === b.is_read) return 0;
    return a.is_read ? 1 : -1;
  });

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>공지사항</h2>

      {sorted.length === 0 ? (
        <p style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 14 }}>공지가 없습니다.</p>
      ) : (
        sorted.map(n => (
          <div
            key={n.id}
            onClick={() => handleSelect(n)}
            style={{
              ...styles.card,
              background: n.is_read ? 'var(--bg-primary, #fff)' : 'var(--bg-secondary, #f8fafc)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!n.is_read && <span style={styles.unreadDot} />}
              {n.is_pinned ? <span style={styles.pinnedBadge}>고정</span> : null}
              <span style={{
                fontSize: 14, fontWeight: n.is_read ? 400 : 600,
                color: 'var(--text-primary, #111)',
                flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {n.title}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
              {new Date(n.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </p>
          </div>
        ))
      )}

      <div style={{ height: 80 }} />
    </div>
  );
}

const styles = {
  container: { maxWidth: 480, margin: '0 auto', padding: '16px 16px 0' },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 12 },
  card: {
    padding: '12px 14px', borderRadius: 10,
    border: '1px solid var(--border-color, #e5e7eb)',
    marginBottom: 6,
  },
  unreadDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0,
  },
  pinnedBadge: {
    display: 'inline-block', padding: '1px 6px', borderRadius: 4,
    fontSize: 10, fontWeight: 600, background: '#fef3c7', color: '#92400e',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, color: 'var(--primary-color, #4f46e5)',
    padding: '4px 0', marginBottom: 12,
  },
  detailCard: {
    padding: 16, borderRadius: 12,
    border: '1px solid var(--border-color, #e5e7eb)',
    background: 'var(--bg-primary, #fff)',
  },
};
