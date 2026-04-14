import { useEffect, useState } from 'react';
import { api } from '../../../api';
import { Card, Loading, Empty, formatDate } from './_shared';

export default function ClassesTab({ studentId }) {
  const [classes, setClasses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([
      api(`/admin/students/${studentId}/classes`).catch(() => []),
      api(`/admin/students/${studentId}/stats`).catch(() => null),
    ]).then(([c, s]) => {
      if (!cancel) { setClasses(c || []); setStats(s); }
    }).finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [studentId]);

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <Card label="수강 현황" title="수강 중인 반">
        {classes.length === 0 ? <Empty icon="menu_book" text="수강 중인 반이 없습니다" /> : (
          <div className="space-y-2">
            {classes.map(c => (
              <div key={c.id} className="p-4 rounded-lg bg-[#f8f9fa] border border-slate-100 hover:bg-slate-100 transition-colors flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#102044]">{c.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {c.teacher_name && `${c.teacher_name} · `}{c.schedule_text || '-'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                    c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {c.status === 'active' ? '수강 중' : '수강 종료'}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">{formatDate(c.enrolled_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card label="출결 통계" title="월별 출석 현황 (최근 6개월)">
        {!stats?.monthlyAttendance?.length ? <Empty icon="event_available" text="출결 기록이 없습니다" /> : (
          <div className="space-y-2">
            {stats.monthlyAttendance.map(m => {
              const total = Number(m.total) || 0;
              const present = Number(m.present) || 0;
              const rate = total > 0 ? Math.round((present / total) * 100) : 0;
              return (
                <div key={m.month} className="p-3 rounded-lg bg-[#f8f9fa] border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-[#102044]">{m.month}</span>
                    <span className="text-xs font-bold text-[#004bf0]">{rate}%</span>
                  </div>
                  <div className="w-full h-2 bg-white rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${rate}%` }} />
                  </div>
                  <div className="text-xs text-slate-400 mt-1 font-semibold">
                    출석 {present} · 결석 {Number(m.absent) || 0} · 지각 {Number(m.late) || 0}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
