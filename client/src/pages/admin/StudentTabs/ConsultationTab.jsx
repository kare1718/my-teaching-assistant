import { useEffect, useState } from 'react';
import { api } from '../../../api';
import { Card, Loading, Empty, formatDate } from './_shared';

export default function ConsultationTab({ studentId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api(`/consultation/student/${studentId}`)
      .then(d => { if (!cancel) setLogs(Array.isArray(d) ? d : []); })
      .catch(e => console.error('consultation load:', e))
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [studentId]);

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <Card label="상담 이력" title={`총 ${logs.length}건의 상담 기록`}>
        {logs.length === 0 ? <Empty icon="forum" text="상담 기록이 없습니다" /> : (
          <div className="space-y-3">
            {logs.map(l => (
              <div key={l.id} className="p-4 rounded-lg bg-[#f8f9fa] border border-slate-100 hover:bg-slate-100 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-[#102044]">{l.title || '상담'}</div>
                    <div className="text-xs text-slate-400 font-semibold mt-0.5">{formatDate(l.created_at)}</div>
                  </div>
                  {l.follow_up_needed && (
                    <span className="rounded-full px-3 py-0.5 text-xs font-bold bg-purple-100 text-purple-700">후속 필요</span>
                  )}
                </div>
                {l.content && (
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {l.content.length > 200 ? l.content.slice(0, 200) + '...' : l.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
