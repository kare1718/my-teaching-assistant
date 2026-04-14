import { useEffect, useState } from 'react';
import { api } from '../../../api';
import { Card, Loading, Empty, formatDate } from './_shared';

export default function StudyTab({ studentId }) {
  const [stats, setStats] = useState(null);
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([
      api(`/admin/students/${studentId}/stats`).catch(() => null),
      api(`/homework/student/${studentId}`).catch(() => []),
    ]).then(([s, hw]) => {
      if (!cancel) { setStats(s); setHomework(Array.isArray(hw) ? hw : []); }
    }).finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [studentId]);

  if (loading) return <Loading />;

  const exams = stats?.examTrend || [];
  const maxScore = Math.max(100, ...exams.map(e => Number(e.max_score) || 100));
  const completedHw = homework.filter(h => h.status === 'completed' || h.completed).length;
  const hwRate = homework.length > 0 ? Math.round((completedHw / homework.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card label="성적 추이" title="최근 시험 결과">
        {exams.length === 0 ? <Empty icon="analytics" text="성적 데이터가 없습니다" /> : (
          <div className="space-y-2">
            {exams.map((e, i) => {
              const rate = Math.round((Number(e.score) / maxScore) * 100);
              return (
                <div key={i} className="p-3 rounded-lg bg-[#f8f9fa] border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-[#102044]">{e.exam_name}</span>
                    <span className="text-sm font-extrabold text-[#004bf0] bg-[#004bf0]/10 px-2.5 py-0.5 rounded-full">
                      {e.score}점
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white rounded-full overflow-hidden">
                    <div className="h-full bg-[#004bf0]" style={{ width: `${rate}%` }} />
                  </div>
                  <div className="text-xs text-slate-400 mt-1 font-semibold">{formatDate(e.exam_date)}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card label="과제 이행률" title={`${hwRate}% (${completedHw}/${homework.length})`}>
        {homework.length === 0 ? <Empty icon="assignment" text="과제 기록이 없습니다" /> : (
          <div className="space-y-2">
            {homework.slice(0, 10).map((h, i) => (
              <div key={i} className="p-3 rounded-lg bg-[#f8f9fa] border border-slate-100 flex justify-between items-center">
                <div>
                  <div className="text-sm font-bold text-[#102044]">{h.class_name || h.title || '과제'}</div>
                  <div className="text-xs text-slate-400 font-semibold">{formatDate(h.date)}</div>
                </div>
                <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                  h.status === 'completed' || h.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {h.status === 'completed' || h.completed ? '완료' : '미완료'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
