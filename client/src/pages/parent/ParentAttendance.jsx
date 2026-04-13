import { useState, useEffect } from 'react';
import { api } from '../../api';

const STATUS_COLORS = {
  present: { bg: '#dcfce7', color: '#15803d', label: '출석' },
  late: { bg: '#fef9c3', color: '#a16207', label: '지각' },
  absent: { bg: '#fee2e2', color: '#dc2626', label: '결석' },
  excused: { bg: '#e0e7ff', color: '#4338ca', label: '사유결석' },
};

export default function ParentAttendance() {
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [records, setRecords] = useState([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/parent/children').then((data) => {
      setChildren(data);
      if (data.length > 0) setSelectedChild(data[0]);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedChild) return;
    setLoading(true);
    api(`/parent/children/${selectedChild.id}/attendance?month=${month}`)
      .then(setRecords)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedChild, month]);

  // 캘린더 그리드 계산
  const [year, mon] = month.split('-').map(Number);
  const firstDay = new Date(year, mon - 1, 1).getDay();
  const daysInMonth = new Date(year, mon, 0).getDate();
  const recordMap = {};
  records.forEach(r => {
    const day = new Date(r.date).getDate();
    recordMap[day] = r.status;
  });

  const totalDays = records.length;
  const presentDays = records.filter(r => r.status === 'present' || r.status === 'late').length;
  const rate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null;

  const handleMonthChange = (delta) => {
    const d = new Date(year, mon - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  if (loading && children.length === 0) {
    return <div style={styles.container}><p style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>불러오는 중...</p></div>;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>출결 현황</h2>

      {children.length > 1 && (
        <select
          value={selectedChild?.id || ''}
          onChange={(e) => setSelectedChild(children.find(c => c.id === Number(e.target.value)))}
          style={styles.select}
        >
          {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      {/* 월 네비게이션 */}
      <div style={styles.monthNav}>
        <button onClick={() => handleMonthChange(-1)} style={styles.navBtn}>&lt;</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{year}년 {mon}월</span>
        <button onClick={() => handleMonthChange(1)} style={styles.navBtn}>&gt;</button>
      </div>

      {/* 출석률 */}
      {rate !== null && (
        <div style={styles.rateBar}>
          <span>이번달 출석률</span>
          <span style={{ fontWeight: 700, color: rate >= 80 ? '#15803d' : '#dc2626' }}>{rate}%</span>
        </div>
      )}

      {/* 캘린더 그리드 */}
      <div style={styles.calendarWrap}>
        {['일', '월', '화', '수', '목', '금', '토'].map(d => (
          <div key={d} style={styles.dayHeader}>{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const status = recordMap[day];
          const sc = STATUS_COLORS[status];
          return (
            <div key={day} style={{
              ...styles.dayCell,
              background: sc ? sc.bg : 'transparent',
              color: sc ? sc.color : 'var(--text-primary, #111)',
            }}>
              {day}
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div style={styles.legend}>
        {Object.entries(STATUS_COLORS).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: val.bg, border: `1px solid ${val.color}` }} />
            <span style={{ fontSize: 12 }}>{val.label}</span>
          </div>
        ))}
      </div>

      {/* 목록 뷰 */}
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: '20px 0 8px' }}>상세 기록</h3>
      {records.length === 0 ? (
        <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', padding: 20 }}>출결 기록이 없습니다.</p>
      ) : (
        records.map(r => {
          const sc = STATUS_COLORS[r.status] || { bg: '#f3f4f6', color: '#6b7280', label: r.status };
          return (
            <div key={r.id} style={styles.listItem}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  {new Date(r.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                </span>
                {r.check_in_at && (
                  <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
                    {new Date(r.check_in_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: sc.bg, color: sc.color,
              }}>
                {sc.label}
              </span>
            </div>
          );
        })
      )}

      <div style={{ height: 80 }} />
    </div>
  );
}

const styles = {
  container: { maxWidth: 480, margin: '0 auto', padding: '16px 16px 0' },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 12 },
  select: {
    width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8,
    border: '1px solid var(--border-color, #e5e7eb)',
    background: 'var(--bg-primary, #fff)', marginBottom: 12,
  },
  monthNav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  navBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 18, padding: '4px 12px', color: 'var(--text-primary, #111)',
  },
  rateBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 12px', borderRadius: 8,
    background: 'var(--bg-secondary, #f9fafb)', marginBottom: 12,
    fontSize: 14,
  },
  calendarWrap: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
    marginBottom: 8,
  },
  dayHeader: {
    textAlign: 'center', fontSize: 12, fontWeight: 600,
    color: 'var(--text-secondary, #6b7280)', padding: '4px 0',
  },
  dayCell: {
    textAlign: 'center', fontSize: 13, fontWeight: 500,
    padding: '6px 0', borderRadius: 6,
  },
  legend: {
    display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 8,
    flexWrap: 'wrap',
  },
  listItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border-color, #e5e7eb)', marginBottom: 6,
  },
};
