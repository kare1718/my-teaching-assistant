import { useEffect, useState } from 'react';
import { api } from '../../../api';
import { Card, Loading, Empty, Stat, formatDate, formatMoney } from './_shared';

const STATUS_BADGE = {
  paid:     { label: '납부', cls: 'bg-emerald-100 text-emerald-700' },
  pending:  { label: '대기', cls: 'bg-slate-200 text-slate-600' },
  overdue:  { label: '미납', cls: 'bg-red-100 text-red-600' },
  refunded: { label: '환불', cls: 'bg-amber-100 text-amber-700' },
};

export default function TuitionTab({ studentId }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api(`/tuition/records?student_id=${studentId}`)
      .then(d => { if (!cancel) setRecords(Array.isArray(d) ? d : (d?.records || [])); })
      .catch(e => console.error('tuition load:', e))
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [studentId]);

  if (loading) return <Loading />;

  const totalBilled = records.reduce((s, r) => s + (Number(r.adjusted_amount ?? r.amount) || 0), 0);
  const totalPaid = records.filter(r => r.status === 'paid').reduce((s, r) => s + (Number(r.paid_amount ?? r.adjusted_amount ?? r.amount) || 0), 0);
  const overdueCount = records.filter(r => r.status === 'overdue' || (r.status === 'pending' && r.due_date && new Date(r.due_date) < new Date())).length;

  return (
    <div className="space-y-6">
      <Card label="수납 요약" title="납부 현황">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="총 청구" value={formatMoney(totalBilled)} />
          <Stat label="총 납부" value={formatMoney(totalPaid)} accent="#10b981" />
          <Stat label="미납 건" value={`${overdueCount}건`} accent={overdueCount > 0 ? '#ba1a1a' : '#102044'} />
        </div>
      </Card>

      <Card label="청구/납부 이력" title={`총 ${records.length}건`}>
        {records.length === 0 ? <Empty icon="payments" text="수납 내역이 없습니다" /> : (
          <div className="space-y-2">
            {records.map(r => {
              const badge = STATUS_BADGE[r.status] || STATUS_BADGE.pending;
              return (
                <div key={r.id} className="p-3 rounded-lg bg-[#f8f9fa] border border-slate-100 flex items-center justify-between hover:bg-slate-100 transition-colors">
                  <div>
                    <div className="text-sm font-bold text-[#102044]">{r.plan_name || r.memo || '학원비'}</div>
                    <div className="text-xs text-slate-400 font-semibold mt-0.5">마감 {formatDate(r.due_date)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-extrabold text-[#102044]">{formatMoney(r.adjusted_amount ?? r.amount)}</span>
                    <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${badge.cls}`}>{badge.label}</span>
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
