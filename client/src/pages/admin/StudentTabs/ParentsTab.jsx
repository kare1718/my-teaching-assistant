import { useEffect, useState } from 'react';
import { api } from '../../../api';
import { Card, Loading, Empty } from './_shared';

export default function ParentsTab({ studentId, student }) {
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api(`/parents?student_id=${studentId}`)
      .then(d => { if (!cancel) setParents(Array.isArray(d) ? d : []); })
      .catch(() => { if (!cancel) setParents([]); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [studentId]);

  if (loading) return <Loading />;

  // Fallback to inline parent info from student object
  const fallbackParents = parents.length === 0 && (student?.parent_name || student?.parent_phone)
    ? [{ id: 'fallback', name: student.parent_name, phone: student.parent_phone, relationship: '보호자', is_primary: true }]
    : parents;

  return (
    <div className="space-y-6">
      <Card label="보호자" title={`연결된 보호자 ${fallbackParents.length}명`}>
        {fallbackParents.length === 0 ? <Empty icon="family_restroom" text="연결된 보호자가 없습니다" /> : (
          <div className="space-y-3">
            {fallbackParents.map(p => (
              <div key={p.id} className="p-4 rounded-lg bg-[#f8f9fa] border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-bold text-[var(--primary)]">{p.name || '-'}</div>
                  <div className="flex gap-1.5">
                    {p.is_primary && <span className="rounded-full px-3 py-0.5 text-xs font-bold bg-[var(--cta)]/10 text-[var(--cta)]">주 보호자</span>}
                    {p.is_payer && <span className="rounded-full px-3 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-700">납부자</span>}
                  </div>
                </div>
                <div className="text-xs text-slate-500 font-semibold">
                  {p.relationship || '보호자'} · {p.phone || '연락처 없음'}
                </div>
                {p.email && <div className="text-xs text-slate-400 font-semibold mt-0.5">{p.email}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
