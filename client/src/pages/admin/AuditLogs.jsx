import { useState, useEffect } from 'react';
import { apiGet } from '../../api';

// 액션 배지 색상 매핑
const ACTION_STYLES = {
  delete: 'bg-red-50 text-red-700 border border-red-100',
  create: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  update: 'bg-blue-50 text-blue-700 border border-blue-100',
  approve: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
  reject: 'bg-rose-50 text-rose-700 border border-rose-100',
  cancel: 'bg-orange-50 text-orange-700 border border-orange-100',
  send: 'bg-sky-50 text-sky-700 border border-sky-100',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  failed: 'bg-red-50 text-red-700 border border-red-100',
  close: 'bg-slate-100 text-slate-700 border border-slate-200',
  schedule: 'bg-violet-50 text-violet-700 border border-violet-100',
  adjust: 'bg-amber-50 text-amber-700 border border-amber-100',
  refund: 'bg-pink-50 text-pink-700 border border-pink-100',
  reset: 'bg-yellow-50 text-yellow-700 border border-yellow-100',
  modify: 'bg-blue-50 text-blue-700 border border-blue-100',
  change: 'bg-blue-50 text-blue-700 border border-blue-100',
  update_: 'bg-blue-50 text-blue-700 border border-blue-100',
};

function actionBadgeClass(action) {
  if (!action) return 'bg-slate-100 text-slate-600 border border-slate-200';
  for (const key of Object.keys(ACTION_STYLES)) {
    if (action.includes(key)) return ACTION_STYLES[key];
  }
  return 'bg-slate-100 text-slate-600 border border-slate-200';
}

const ACTION_LABELS = {
  student_delete: '학생 삭제',
  student_update: '학생 수정',
  student_status_change: '학생 상태 변경',
  tuition_adjust: '수납 조정',
  tuition_refund_request: '환불 요청',
  tuition_refund_approve: '환불 승인',
  tuition_refund_complete: '환불 완료',
  settlement_close: '월마감',
  permissions_update: '권한 변경',
  academy_settings_update: '학원 설정 변경',
  subscription_cancel: '구독 해지',
  sms_send: 'SMS 발송',
  sms_schedule: 'SMS 예약',
  consultation_delete: '상담 삭제',
  attendance_modify: '출결 정정',
  payment_success: '결제 성공',
  payment_failed: '결제 실패',
  password_reset: '비밀번호 초기화',
  user_approve: '가입 승인',
  user_reject: '가입 거절',
};

const RESOURCE_TYPES = [
  'student', 'tuition_record', 'tuition_refund', 'settlement',
  'permissions', 'academy', 'subscription', 'sms', 'sms_schedule',
  'consultation', 'attendance', 'payment', 'user',
];

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return iso; }
}

function prettyJSON(obj) {
  if (obj === null || obj === undefined) return null;
  try {
    const parsed = typeof obj === 'string' ? JSON.parse(obj) : obj;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(obj);
  }
}

export default function AuditLogs() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ action: '', resource_type: '', from: '', to: '' });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const limit = 50;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.action) params.set('action', filters.action);
      if (filters.resource_type) params.set('resource_type', filters.resource_type);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));
      const data = await apiGet(`/audit-logs?${params.toString()}`);
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e.message || '감사 로그 조회 실패');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page]);

  const handleApplyFilters = () => {
    setPage(0);
    load();
  };

  const handleResetFilters = () => {
    setFilters({ action: '', resource_type: '', from: '', to: '' });
    setPage(0);
    setTimeout(load, 0);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto" style={{ fontFamily: 'Paperlogy, sans-serif' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[var(--primary)] tracking-tight">감사 로그</h1>
        <p className="text-sm text-slate-500 mt-1">누가 언제 무엇을 바꿨는지 전체 이력을 확인합니다.</p>
      </div>

      {/* 필터 바 */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">액션</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--cta)]/20"
              value={filters.action}
              onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))}
            >
              <option value="">전체</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">리소스 타입</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--cta)]/20"
              value={filters.resource_type}
              onChange={(e) => setFilters(f => ({ ...f, resource_type: e.target.value }))}
            >
              <option value="">전체</option>
              {RESOURCE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">시작일</label>
            <input
              type="date"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={filters.from}
              onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">종료일</label>
            <input
              type="date"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={filters.to}
              onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
            />
          </div>
          <button
            onClick={handleApplyFilters}
            className="bg-[var(--cta)] hover:bg-[#0039c0] text-white text-sm font-bold rounded-lg px-5 py-2 transition-colors"
          >
            조회
          </button>
          <button
            onClick={handleResetFilters}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg px-4 py-2 transition-colors"
          >
            초기화
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 text-sm">{error}</div>
        )}
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="bg-[#f3f4f5]">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">시간</th>
              <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">사용자</th>
              <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">액션</th>
              <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">리소스</th>
              <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-slate-400 text-sm">불러오는 중…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-slate-400 text-sm">조건에 해당하는 로그가 없습니다.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(r)}>
                <td className="px-5 py-3 text-sm text-slate-700 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                <td className="px-5 py-3 text-sm text-slate-700">
                  <div className="font-semibold text-[var(--primary)]">{r.user_name || '—'}</div>
                  <div className="text-xs text-slate-400">{r.user_role || ''}</div>
                </td>
                <td className="px-5 py-3 text-sm">
                  <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${actionBadgeClass(r.action)}`}>
                    {ACTION_LABELS[r.action] || r.action}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-slate-700">
                  <div>{r.resource_type}</div>
                  {r.resource_id && <div className="text-xs text-slate-400">#{r.resource_id}</div>}
                </td>
                <td className="px-5 py-3 text-xs text-slate-500 font-mono">{r.ip_address || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* 페이지네이션 */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            전체 <span className="font-bold text-[var(--primary)]">{total.toLocaleString()}</span>건 · {page * limit + 1}–{Math.min((page + 1) * limit, total)}
          </div>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >이전</button>
            <button
              disabled={(page + 1) * limit >= total}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >다음</button>
          </div>
        </div>
      </div>

      {/* 상세 모달 */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: 'Paperlogy, sans-serif' }}
          >
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">감사 로그 상세</div>
                <div className="text-lg font-extrabold text-[var(--primary)] mt-0.5">
                  {ACTION_LABELS[selected.action] || selected.action}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >×</button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">작성자</div>
                  <div className="text-[var(--primary)] font-semibold">{selected.user_name || '—'} <span className="text-xs text-slate-400 font-normal">({selected.user_role || '—'})</span></div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">시간</div>
                  <div className="text-[var(--primary)]">{formatDateTime(selected.created_at)}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">IP</div>
                  <div className="text-[var(--primary)] font-mono text-xs">{selected.ip_address || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">리소스</div>
                  <div className="text-[var(--primary)]">{selected.resource_type}{selected.resource_id ? ` #${selected.resource_id}` : ''}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">User Agent</div>
                  <div className="text-xs text-slate-500 break-all">{selected.user_agent || '—'}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">변경 전 (before)</div>
                {selected.before_data === null || selected.before_data === undefined ? (
                  <div className="text-xs text-slate-400 italic">로그만 (변경 전 데이터 없음)</div>
                ) : (
                  <pre className="bg-slate-50 rounded-lg p-4 text-xs text-slate-700 overflow-x-auto border border-slate-100">
{prettyJSON(selected.before_data)}
                  </pre>
                )}
              </div>

              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">변경 후 (after)</div>
                {selected.after_data === null || selected.after_data === undefined ? (
                  <div className="text-xs text-slate-400 italic">—</div>
                ) : (
                  <pre className="bg-slate-50 rounded-lg p-4 text-xs text-slate-700 overflow-x-auto border border-slate-100">
{prettyJSON(selected.after_data)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
