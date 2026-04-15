import { useEffect, useState } from 'react';
import { api } from '../../../api';
import { Card, Stat, Loading, Icon, formatMoney, formatDate } from './_shared';

export default function OverviewTab({ studentId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api(`/admin/students/${studentId}/overview`)
      .then(d => { if (!cancel) setData(d); })
      .catch(e => console.error('overview load:', e))
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [studentId]);

  if (loading) return <Loading />;
  if (!data) return null;

  const { student, attendance, tuition, lastConsultation, consecutiveAbsent } = data;

  return (
    <div className="space-y-6">
      <Card label="상태 요약" title="최근 30일 핵심 지표">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="출석률" value={attendance.rate != null ? `${attendance.rate}%` : '-'} accent="#004bf0" />
          <Stat label="출석/결석/지각" value={`${attendance.present}/${attendance.absent}/${attendance.late}`} />
          <Stat label="미납 건" value={`${tuition.overdueCount}건`} accent={tuition.overdueCount > 0 ? '#ba1a1a' : '#102044'} />
          <Stat label="미납 금액" value={formatMoney(tuition.overdueAmount)} accent={tuition.overdueAmount > 0 ? '#ba1a1a' : '#102044'} />
        </div>
      </Card>

      {(consecutiveAbsent >= 2 || tuition.overdueCount > 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <Icon name="warning" className="text-amber-600 text-2xl" filled />
            <div className="flex-1">
              <div className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1">최근 이슈</div>
              <ul className="text-sm text-amber-900 font-semibold space-y-1">
                {consecutiveAbsent >= 2 && <li>• {consecutiveAbsent}회 연속 결석 중 — 연락/상담 필요</li>}
                {tuition.overdueCount > 0 && <li>• {tuition.overdueCount}건 미납 ({formatMoney(tuition.overdueAmount)})</li>}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card label="보호자 정보" title="연락처">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-lg bg-[#f8f9fa]">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">학부모명</div>
            <div className="text-sm font-semibold text-[#102044]">{student.parent_name || '-'}</div>
          </div>
          <div className="p-4 rounded-lg bg-[#f8f9fa]">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">학부모 연락처</div>
            <div className="text-sm font-semibold text-[#102044]">{student.parent_phone || '-'}</div>
          </div>
        </div>
      </Card>

      <Card label="최근 상담" title="마지막 상담 기록">
        {lastConsultation ? (
          <div className="p-4 rounded-lg bg-[#f8f9fa] border border-slate-100">
            <div className="text-xs font-bold text-slate-400 mb-1">{formatDate(lastConsultation.created_at)}</div>
            <div className="text-sm font-semibold text-[#102044]">{lastConsultation.title || '제목 없음'}</div>
          </div>
        ) : (
          <div className="text-sm text-slate-400">상담 기록이 없습니다.</div>
        )}
      </Card>
    </div>
  );
}
