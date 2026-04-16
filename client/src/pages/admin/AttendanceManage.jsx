import { useState, useEffect, lazy, Suspense } from 'react';
import { api } from '../../api';
import useMediaQuery from '../../hooks/useMediaQuery';

const HomeworkManage = lazy(() => import('./HomeworkManage'));

export default function AttendanceManage() {
  const [mainTab, setMainTab] = useState('attendance');
  const isLg = useMediaQuery('(min-width: 1600px)');
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
    <div className="main-content" style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'attendance', label: '출결 관리' },
          { key: 'homework', label: '과제 관리' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key)}
            style={{
              padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700,
              background: mainTab === t.key ? '#102044' : '#fff',
              color: mainTab === t.key ? '#fff' : '#64748b',
              border: '1px solid #e2e8f0', cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mainTab === 'homework' ? (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>로딩 중...</div>}>
          <HomeworkManage />
        </Suspense>
      ) : (
      <>
      <h2 style={{ fontSize: '1.5em', fontWeight: 800, marginBottom: 20 }}>출결 관리</h2>

      {/* 날짜 선택 */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }}
        />
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isLg ? 160 : 130}px, 1fr))`, gap: isLg ? 16 : 12, marginBottom: isLg ? 28 : 24 }}>
        {[
          { label: '총원', value: total, bg: 'oklch(97% 0.02 230)', color: 'oklch(38% 0.10 230)' },
          { label: '출석', value: present, bg: 'var(--success-light)', color: 'oklch(52% 0.14 160)' },
          { label: '미출석', value: absent, bg: 'var(--destructive-light)', color: 'oklch(48% 0.20 25)' },
          { label: '지각', value: late, bg: 'oklch(97% 0.04 85)', color: 'oklch(55% 0.14 85)' },
        ].map(c => (
          <div key={c.label} style={{
            background: c.bg, borderRadius: 12, padding: isLg ? 20 : 16, textAlign: 'center',
          }}>
            <p style={{ fontSize: isLg ? 15 : 13, color: 'var(--neutral-500)', marginBottom: isLg ? 6 : 4 }}>{c.label}</p>
            <p style={{ fontSize: isLg ? 34 : 28, fontWeight: 800, color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* 미출석자 목록 */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, marginBottom: 24, border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>미출석 학생</h3>
        {absentList.length === 0 ? (
          <p style={{ color: 'var(--neutral-500)', fontSize: 14 }}>미출석 학생이 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {absentList.map((s, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: 8, background: 'var(--destructive-light)',
              }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--neutral-500)' }}>{s.school} {s.grade}</span>
                </div>
                {s.parent_phone && (
                  <span style={{ fontSize: 13, color: 'var(--neutral-500)' }}>{s.parent_phone}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 월간 통계 */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>월간 출석 통계</h3>
          <input
            type="month"
            value={statsMonth}
            onChange={e => setStatsMonth(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }}
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
                      background: rate >= 90 ? 'var(--success)' : rate >= 70 ? 'var(--warning)' : 'var(--destructive)',
                      marginBottom: 4,
                    }} />
                    <span style={{ fontSize: 10, color: 'var(--neutral-400)' }}>{d.day}</span>
                  </div>
                );
              })}
            </div>
            {stats.average !== undefined && (
              <p style={{ marginTop: 12, fontSize: 14, color: 'var(--neutral-500)' }}>
                월 평균 출석률: <strong style={{ color: 'var(--primary)' }}>{stats.average}%</strong>
              </p>
            )}
          </div>
        ) : (
          <p style={{ color: 'var(--neutral-500)', fontSize: 14 }}>통계 데이터가 없습니다.</p>
        )}
      </section>
      </>
      )}
    </div>
  );
}
