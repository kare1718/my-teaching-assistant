import { useState, useEffect, lazy, Suspense } from 'react';
import { api } from '../../api';
import useMediaQuery from '../../hooks/useMediaQuery';

const HomeworkManage = lazy(() => import('./HomeworkManage'));

export default function AttendanceManage() {
  const isLg = useMediaQuery('(min-width: 1024px)');
  const [todayData, setTodayData] = useState(null);
  const [absentList, setAbsentList] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [statsMonth, setStatsMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const loadToday = () => {
    Promise.all([
      api(`/attendance/today?date=${selectedDate}`).catch(() => null),
      api(`/attendance/absent?date=${selectedDate}`).catch(() => []),
    ]).then(([today, absent]) => {
      setTodayData(today);
      const absentRows = Array.isArray(absent) ? absent : [];
      setAbsentList(absentRows.filter(s => !s.role || s.role === 'student'));
      setLoading(false);
    }).catch(() => {
      setError('데이터를 불러올 수 없습니다.');
      setLoading(false);
    });
  };

  const loadStats = () => {
    const [y, m] = statsMonth.split('-');
    api(`/attendance/stats?year=${y}&month=${m}`).then(setStats).catch(() => setStats(null));
  };

  useEffect(() => { loadToday(); }, [selectedDate]);
  useEffect(() => { loadStats(); }, [statsMonth]);

  if (loading) return <div className="main-content" style={{ padding: 20 }}>로딩 중...</div>;
  if (error) return <div className="main-content" style={{ padding: 20, color: 'oklch(48% 0.20 25)' }}>{error}</div>;

  const summary = todayData || {};
  const total = summary.total || 0;
  const present = summary.present ?? summary.checkedIn ?? 0;
  const absent = summary.absent || 0;
  const late = summary.late || 0;

  return (
    <div className="main-content" style={{ padding: '20px 20px', maxWidth: 1400, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5em', fontWeight: 800, marginBottom: 20 }}>출결 / 과제 관리</h2>

      {/* 2열 레이아웃: 좌측 출결 + 우측 과제 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isLg ? '1fr 1fr' : '1fr',
        gap: 20,
        alignItems: 'start',
      }}>
        {/* ═══ 좌측: 출결 관리 ═══ */}
        <div>
          <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9',
            padding: 20, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#102044' }}>📋 출결 현황</h3>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit' }}
              />
            </div>

            {/* 요약 카드 (2x2) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: '총원', value: total, bg: '#f0f4ff', color: '#102044' },
                { label: '출석', value: present, bg: '#ecfdf5', color: '#059669' },
                { label: '미출석', value: absent, bg: '#fef2f2', color: '#dc2626' },
                { label: '지각', value: late, bg: '#fffbeb', color: '#d97706' },
              ].map(c => (
                <div key={c.label} style={{
                  background: c.bg, borderRadius: 10, padding: '14px 16px', textAlign: 'center',
                }}>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>{c.label}</p>
                  <p style={{ fontSize: 28, fontWeight: 800, color: c.color, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* 미출석자 목록 */}
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: '#102044' }}>미출석 학생</h4>
              {absentList.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>미출석 학생이 없습니다 ✅</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {absentList.map((s, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca',
                    }}>
                      <div>
                        <span style={{ fontWeight: 700, color: '#102044', fontSize: 14 }}>{s.name}</span>
                        <span style={{ marginLeft: 8, fontSize: 12, color: '#94a3b8' }}>{s.school} {s.grade}</span>
                      </div>
                      {s.parent_phone && (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.parent_phone}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 월간 통계 */}
          <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9',
            padding: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#102044' }}>📊 월간 출석 통계</h3>
              <input
                type="month"
                value={statsMonth}
                onChange={e => setStatsMonth(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit' }}
              />
            </div>
            {stats && stats.daily ? (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'flex', gap: 2, minWidth: stats.daily.length * 24 }}>
                  {stats.daily.map((d, i) => {
                    const rate = d.total > 0 ? Math.round((d.present / d.total) * 100) : 0;
                    const height = Math.max(8, rate * 0.8);
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 22 }}>
                        <div style={{
                          width: 16, height, borderRadius: 4,
                          background: rate >= 90 ? '#059669' : rate >= 70 ? '#d97706' : '#dc2626',
                          marginBottom: 4,
                        }} />
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>{d.day}</span>
                      </div>
                    );
                  })}
                </div>
                {stats.average !== undefined && (
                  <p style={{ marginTop: 12, fontSize: 14, color: '#64748b' }}>
                    월 평균 출석률: <strong style={{ color: '#102044' }}>{stats.average}%</strong>
                  </p>
                )}
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>통계 데이터가 없습니다</p>
            )}
          </div>
        </div>

        {/* ═══ 우측: 과제 관리 ═══ */}
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9',
          padding: 20, minHeight: 300,
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#102044' }}>📝 과제 관리</h3>
          <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>로딩 중...</div>}>
            <HomeworkManage embedded />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
