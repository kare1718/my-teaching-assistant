import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getUser } from '../../api';

export default function ParentHome() {
  const navigate = useNavigate();
  const user = getUser();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [summary, setSummary] = useState(null);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/parent/children')
      .then((data) => {
        setChildren(data);
        if (data.length > 0) setSelectedChild(data[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedChild) return;
    api(`/parent/children/${selectedChild.id}/summary`).then(setSummary).catch(console.error);
    api('/parent/notices')
      .then((data) => setNotices(data.filter(n => !n.is_read).slice(0, 1)))
      .catch(console.error);
  }, [selectedChild]);

  if (loading) return <div style={styles.container}><p style={styles.loading}>불러오는 중...</p></div>;
  if (children.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyCard}>
          <p style={{ fontSize: 16, color: 'var(--text-secondary, #6b7280)' }}>연결된 자녀가 없습니다.</p>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary, #9ca3af)', marginTop: 4 }}>학원에 자녀 연결을 요청해주세요.</p>
        </div>
      </div>
    );
  }

  const att = summary?.attendance_summary;
  const tui = summary?.tuition_summary;
  const score = summary?.recent_score;

  const statusLabel = { present: '출석', absent: '결석', late: '지각', excused: '사유결석' };

  return (
    <div style={styles.container}>
      {/* 자녀 선택 */}
      {children.length > 1 && (
        <select
          value={selectedChild?.id || ''}
          onChange={(e) => setSelectedChild(children.find(c => c.id === Number(e.target.value)))}
          style={styles.select}
        >
          {children.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.school} {c.grade})</option>
          ))}
        </select>
      )}

      {/* 프로필 카드 */}
      <div style={styles.profileCard}>
        <div style={styles.avatar}>
          {(selectedChild?.name || '?')[0]}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{selectedChild?.name}</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary, #6b7280)' }}>
            {selectedChild?.school} {selectedChild?.grade}
          </p>
        </div>
      </div>

      {/* 오늘 출결 */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>오늘 출결</span>
          <button onClick={() => navigate('/parent/attendance')} style={styles.moreBtn}>더보기</button>
        </div>
        {att?.today_status ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              ...styles.badge,
              background: att.today_status === 'present' ? '#dcfce7' : att.today_status === 'late' ? '#fef9c3' : '#fee2e2',
              color: att.today_status === 'present' ? '#15803d' : att.today_status === 'late' ? '#a16207' : '#dc2626',
            }}>
              {statusLabel[att.today_status] || att.today_status}
            </span>
            {att.today_check_in && (
              <span style={{ fontSize: 13, color: 'var(--text-secondary, #6b7280)' }}>
                {new Date(att.today_check_in).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 14, color: 'var(--text-secondary, #6b7280)', margin: 0 }}>오늘 출결 기록 없음</p>
        )}
        {att?.week_rate !== null && att?.week_rate !== undefined && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary, #6b7280)', marginTop: 8 }}>
            이번주 출석률: <b>{att.week_rate}%</b>
          </p>
        )}
      </div>

      {/* 미납 알림 */}
      {tui?.has_unpaid && (
        <div style={{ ...styles.card, background: '#fef2f2', borderColor: '#fca5a5' }}>
          <div style={styles.cardHeader}>
            <span style={{ ...styles.cardTitle, color: '#dc2626' }}>미납 안내</span>
          </div>
          <p style={{ margin: '4px 0 8px', fontSize: 14 }}>
            미납 <b>{tui.unpaid_count}건</b> / 총 <b style={{ color: '#dc2626' }}>{(tui.unpaid_total || 0).toLocaleString()}원</b>
          </p>
          {tui.next_due && (
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280' }}>
              다음 납부일: {new Date(tui.next_due).toLocaleDateString('ko-KR')}
            </p>
          )}
          <button
            onClick={() => navigate('/parent/tuition')}
            style={{ ...styles.actionBtn, background: '#dc2626' }}
          >
            결제하기
          </button>
        </div>
      )}

      {/* 최근 시험 */}
      {score && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>최근 시험</span>
            <button onClick={() => navigate('/parent/more')} style={styles.moreBtn}>더보기</button>
          </div>
          <p style={{ margin: '4px 0', fontSize: 14 }}>
            {score.exam_name}
          </p>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--primary-color, #4f46e5)' }}>
            {score.score}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-secondary, #6b7280)' }}>/{score.total_score}점</span>
            {score.rank && <span style={{ fontSize: 13, marginLeft: 8, color: 'var(--text-secondary, #6b7280)' }}>(등수: {score.rank}등)</span>}
          </p>
        </div>
      )}

      {/* 최근 공지 */}
      {notices.length > 0 && (
        <div style={styles.card} onClick={() => navigate('/parent/notices')}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>새 공지</span>
            <span style={styles.unreadDot} />
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-primary, #111)' }}>
            {notices[0].title}
          </p>
        </div>
      )}

      <div style={{ height: 80 }} />
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 480, margin: '0 auto', padding: '16px 16px 0',
  },
  loading: {
    textAlign: 'center', padding: 40, color: 'var(--text-secondary, #6b7280)',
  },
  emptyCard: {
    textAlign: 'center', padding: 40,
    background: 'var(--bg-secondary, #f9fafb)', borderRadius: 12,
  },
  select: {
    width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8,
    border: '1px solid var(--border-color, #e5e7eb)',
    background: 'var(--bg-primary, #fff)', marginBottom: 12,
    color: 'var(--text-primary, #111)',
  },
  profileCard: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 12,
    background: 'var(--bg-secondary, #f9fafb)',
    marginBottom: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'var(--primary-color, #4f46e5)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 700,
  },
  card: {
    padding: 16, borderRadius: 12,
    border: '1px solid var(--border-color, #e5e7eb)',
    background: 'var(--bg-primary, #fff)',
    marginBottom: 12, cursor: 'default',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #111)',
  },
  moreBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 13, color: 'var(--primary-color, #4f46e5)', padding: 0,
  },
  badge: {
    padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600,
  },
  actionBtn: {
    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
    color: '#fff', fontSize: 14, fontWeight: 600,
  },
  unreadDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#3b82f6',
  },
};
