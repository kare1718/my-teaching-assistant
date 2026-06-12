import { useState, useEffect, lazy, Suspense } from 'react';
import { api } from '../../api';
import useMediaQuery from '../../hooks/useMediaQuery';
import { PageLoading } from '../../components/ui';

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

  if (loading) return <PageLoading wrap="main-content" />;
  if (error) return <div className="main-content p-5 text-[#ba1a1a]">{error}</div>;

  const summary = todayData || {};
  const total = summary.total || 0;
  const present = summary.present ?? summary.checkedIn ?? 0;
  const absent = summary.absent || 0;
  const late = summary.late || 0;

  return (
    <div className="main-content p-5 max-w-[1400px] mx-auto">
      <h2 className="text-2xl font-extrabold text-[var(--primary)] tracking-tight mb-5">출결 / 과제 관리</h2>

      {/* 2열 레이아웃: 좌측 출결 + 우측 과제 */}
      <div
        className="grid gap-5 items-start"
        style={{ gridTemplateColumns: isLg ? '1fr 1fr' : '1fr' }}
      >
        {/* ═══ 좌측: 출결 관리 ═══ */}
        <div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="m-0 text-base font-extrabold text-[var(--primary)]">📋 출결 현황</h3>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]"
              />
            </div>

            {/* 요약 카드 (2x2) */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {[
                { label: '총원', value: total, bg: '#f0f4ff', color: '#102044' },
                { label: '출석', value: present, bg: '#ecfdf5', color: '#059669' },
                { label: '미출석', value: absent, bg: '#fef2f2', color: '#dc2626' },
                { label: '지각', value: late, bg: '#fffbeb', color: '#d97706' },
              ].map(c => (
                <div key={c.label} className="rounded-lg px-4 py-3.5 text-center" style={{ background: c.bg }}>
                  <p className="text-xs text-slate-400 mb-1 font-semibold">{c.label}</p>
                  <p className="text-[28px] font-extrabold m-0 tabular-nums" style={{ color: c.color }}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* 미출석자 목록 */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">미출석 학생</h4>
              {absentList.length === 0 ? (
                <p className="text-slate-400 text-[13px] text-center py-4">미출석 학생이 없습니다 ✅</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {absentList.map((s, i) => (
                    <div key={i} className="flex justify-between items-center px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200">
                      <div>
                        <span className="font-bold text-[var(--primary)] text-sm">{s.name}</span>
                        <span className="ml-2 text-xs text-slate-400">{s.school} {s.grade}</span>
                      </div>
                      {s.parent_phone && (
                        <span className="text-xs text-slate-400">{s.parent_phone}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 월간 통계 */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="m-0 text-base font-extrabold text-[var(--primary)]">📊 월간 출석 통계</h3>
              <input
                type="month"
                value={statsMonth}
                onChange={e => setStatsMonth(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]"
              />
            </div>
            {stats && stats.daily ? (
              <div className="overflow-x-auto">
                <div className="flex gap-0.5" style={{ minWidth: stats.daily.length * 24 }}>
                  {stats.daily.map((d, i) => {
                    const rate = d.total > 0 ? Math.round((d.present / d.total) * 100) : 0;
                    const height = Math.max(8, rate * 0.8);
                    return (
                      <div key={i} className="flex flex-col items-center flex-1 min-w-[22px]">
                        <div
                          className="w-4 rounded mb-1"
                          style={{
                            height,
                            background: rate >= 90 ? '#059669' : rate >= 70 ? '#d97706' : '#dc2626',
                          }}
                        />
                        <span className="text-[10px] text-slate-400">{d.day}</span>
                      </div>
                    );
                  })}
                </div>
                {stats.average !== undefined && (
                  <p className="mt-3 text-sm text-slate-500">
                    월 평균 출석률: <strong className="text-[var(--primary)]">{stats.average}%</strong>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-slate-400 text-[13px] text-center py-4">통계 데이터가 없습니다</p>
            )}
          </div>
        </div>

        {/* ═══ 우측: 과제 관리 ═══ */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 min-h-[300px]">
          <h3 className="mt-0 mb-4 text-base font-extrabold text-[var(--primary)]">📝 과제 관리</h3>
          <Suspense fallback={<div className="p-10 text-center text-slate-400">로딩 중...</div>}>
            <HomeworkManage embedded />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
