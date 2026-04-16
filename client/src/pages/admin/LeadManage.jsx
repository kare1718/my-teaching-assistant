import { useState, useEffect, useCallback } from 'react';
import { api, apiPost, apiPut, apiDelete } from '../../api';

/* ─── 상수 ──────────────────────────────────────────────── */
const KANBAN_COLUMNS = [
  { key: 'new', label: '신규 문의', color: 'bg-slate-400' },
  { key: 'consulting', label: '상담중', color: 'bg-[var(--cta)]' },
  { key: 'trial', label: '체험 예정', color: 'bg-purple-500' },
  { key: 'enrolled', label: '등록 완료', color: 'bg-emerald-500' },
  { key: 'lost', label: '미등록', color: 'bg-red-500' },
];

const ALL_STATUSES = [
  { key: 'new', label: '신규 문의', color: '#94a3b8' },
  { key: 'contacted', label: '연락완료', color: '#8b5cf6' },
  { key: 'consulting', label: '상담중', color: 'var(--cta)' },
  { key: 'trial', label: '체험 예정', color: '#a855f7' },
  { key: 'enrolled', label: '등록 완료', color: '#10b981' },
  { key: 'lost', label: '미등록', color: '#ef4444' },
];

const SOURCES = ['블로그', '지인소개', '전화문의', '방문', '온라인광고', 'SNS', '학부모소개', '기타'];
const ACTIVITY_TYPES = [
  { key: 'call', label: '전화', icon: 'phone' },
  { key: 'visit', label: '방문', icon: 'person' },
  { key: 'trial_class', label: '체험수업', icon: 'school' },
  { key: 'message', label: '문자/카톡', icon: 'chat' },
  { key: 'consultation', label: '상담', icon: 'forum' },
  { key: 'status_change', label: '상태변경', icon: 'swap_horiz' },
];
const PRIORITIES = [
  { key: 'high', label: '높음', emoji: '🔴', color: '#ef4444' },
  { key: 'normal', label: '보통', emoji: '🟡', color: '#6b7280' },
  { key: 'low', label: '낮음', emoji: '⚪', color: '#9ca3af' },
];

/* ─── 유틸 ──────────────────────────────────────────────── */
const getStatusInfo = (status) => ALL_STATUSES.find(s => s.key === status) || { label: status, color: '#6b7280' };
const getPriorityInfo = (p) => PRIORITIES.find(pr => pr.key === p) || PRIORITIES[1];

const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  return diff >= 0 ? diff : 0;
};

const maskPhone = (phone) => {
  if (!phone) return '-';
  return phone.replace(/(\d{3})[-]?(\d{2})\d{2}[-]?(\d{4})/, '$1-$2**-$3');
};

/* ─── 메인 컴포넌트 ────────────────────────────────────── */
export default function LeadManage() {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('pipeline'); // pipeline | list

  // 모달 상태
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [showDetail, setShowDetail] = useState(null);
  const [detailData, setDetailData] = useState(null);

  // 활동 추가 폼
  const [actForm, setActForm] = useState({ activity_type: 'call', description: '', result: '', next_action: '' });

  // 체험수업 폼
  const [showTrialForm, setShowTrialForm] = useState(false);
  const [trialForm, setTrialForm] = useState({ class_id: '', trial_date: '', trial_time: '' });

  // 수업 목록
  const [classes, setClasses] = useState([]);

  // 리드 폼
  const [form, setForm] = useState({
    student_name: '', parent_name: '', parent_phone: '', school: '', grade: '',
    source: '', source_detail: '', interest_class_id: '', assigned_to: '', priority: 'normal', memo: '',
  });

  // 관리자 목록 (담당자 배정)
  const [admins, setAdmins] = useState([]);

  // 메모 상태 (상세 패널)
  const [memoText, setMemoText] = useState('');

  const showMessage = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  /* ─── API 호출 (기존 100% 유지) ─────────────────────── */
  const loadLeads = useCallback(async () => {
    try {
      let url = '/leads?page=' + page + '&limit=200';
      if (filterStatus) url += '&status=' + filterStatus;
      const data = await api(url);
      setLeads(data.leads || []);
      setTotal(data.total || 0);
    } catch { setLeads([]); }
    setLoading(false);
  }, [page, filterStatus]);

  const loadStats = useCallback(async () => {
    try {
      const data = await api('/leads/stats');
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    api('/classes').then(d => setClasses(Array.isArray(d) ? d : (d.classes || []))).catch(() => []);
    api('/admin/users?role=admin').then(d => setAdmins(Array.isArray(d) ? d : [])).catch(() => []);
  }, []);

  const handleSave = async () => {
    if (!form.student_name) { showMessage('학생 이름은 필수입니다.'); return; }
    try {
      const payload = { ...form, interest_class_id: form.interest_class_id || null, assigned_to: form.assigned_to || null };
      if (editingLead) {
        await apiPut(`/leads/${editingLead.id}`, payload);
        showMessage('리드가 수정되었습니다.');
      } else {
        await apiPost('/leads', payload);
        showMessage('리드가 등록되었습니다.');
      }
      setShowForm(false);
      setEditingLead(null);
      resetForm();
      loadLeads();
      loadStats();
    } catch (e) { showMessage(e.message); }
  };

  const resetForm = () => setForm({
    student_name: '', parent_name: '', parent_phone: '', school: '', grade: '',
    source: '', source_detail: '', interest_class_id: '', assigned_to: '', priority: 'normal', memo: '',
  });

  const handleDelete = async (id) => {
    if (!window.confirm('이 리드를 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/leads/${id}`);
      showMessage('삭제되었습니다.');
      loadLeads();
      loadStats();
      if (showDetail === id) { setShowDetail(null); setDetailData(null); }
    } catch (e) { showMessage(e.message); }
  };

  const openEdit = (lead) => {
    setEditingLead(lead);
    setForm({
      student_name: lead.student_name || '',
      parent_name: lead.parent_name || '',
      parent_phone: lead.parent_phone || '',
      school: lead.school || '',
      grade: lead.grade || '',
      source: lead.source || '',
      source_detail: lead.source_detail || '',
      interest_class_id: lead.interest_class_id || '',
      assigned_to: lead.assigned_to || '',
      priority: lead.priority || 'normal',
      memo: lead.memo || '',
    });
    setShowForm(true);
  };

  const openDetail = async (lead) => {
    setShowDetail(lead.id);
    try {
      const data = await api(`/leads/${lead.id}`);
      setDetailData(data);
      setMemoText(data.memo || '');
    } catch (e) { showMessage(e.message); }
  };

  const handleStatusChange = async (leadId, newStatus) => {
    let lost_reason = null;
    if (newStatus === 'lost') {
      lost_reason = prompt('미등록 사유를 입력하세요:');
      if (lost_reason === null) return;
    }
    try {
      await apiPut(`/leads/${leadId}/status`, { status: newStatus, lost_reason });
      showMessage('상태가 변경되었습니다.');
      loadLeads();
      loadStats();
      if (showDetail === leadId) openDetail({ id: leadId });
    } catch (e) { showMessage(e.message); }
  };

  const handleAddActivity = async () => {
    if (!actForm.description) { showMessage('활동 내용을 입력하세요.'); return; }
    try {
      await apiPost(`/leads/${showDetail}/activities`, actForm);
      showMessage('활동이 기록되었습니다.');
      setActForm({ activity_type: 'call', description: '', result: '', next_action: '' });
      openDetail({ id: showDetail });
    } catch (e) { showMessage(e.message); }
  };

  const handleConvert = async (leadId) => {
    if (!window.confirm('이 리드를 학생으로 등록하시겠습니까?\n\n학생 계정이 생성되고 보호자 정보가 등록됩니다.')) return;
    try {
      const result = await apiPost(`/leads/${leadId}/convert`, {});
      showMessage(`학생 등록 완료! (ID: ${result.studentId})`);
      loadLeads();
      loadStats();
      if (showDetail === leadId) openDetail({ id: leadId });
    } catch (e) { showMessage(e.message); }
  };

  const handleTrialSubmit = async () => {
    if (!trialForm.trial_date) { showMessage('체험 수업 날짜를 선택하세요.'); return; }
    try {
      await apiPost(`/leads/${showDetail}/trial`, trialForm);
      showMessage('체험 수업이 예약되었습니다.');
      setShowTrialForm(false);
      setTrialForm({ class_id: '', trial_date: '', trial_time: '' });
      openDetail({ id: showDetail });
    } catch (e) { showMessage(e.message); }
  };

  const handleMemoSave = async () => {
    if (!showDetail) return;
    try {
      await apiPut(`/leads/${showDetail}`, { memo: memoText });
      showMessage('메모가 저장되었습니다.');
      if (detailData) setDetailData({ ...detailData, memo: memoText });
    } catch (e) { showMessage(e.message); }
  };

  const totalPages = Math.ceil(total / 200);

  // 검색 필터
  const filteredLeads = leads.filter(l => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (l.student_name || '').toLowerCase().includes(q) ||
      (l.parent_name || '').toLowerCase().includes(q) ||
      (l.parent_phone || '').includes(q) ||
      (l.source || '').toLowerCase().includes(q);
  });

  // 칸반 컬럼별 리드 (contacted -> consulting에 포함)
  const getColumnLeads = (colKey) => {
    return filteredLeads.filter(l => {
      if (colKey === 'consulting') return l.status === 'consulting' || l.status === 'contacted';
      return l.status === colKey;
    });
  };

  if (loading) {
    return (
      <div className="main-content bg-[#f8f9fa] min-h-screen flex items-center justify-center">
        <div className="text-center text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-2 block animate-spin">hourglass_empty</span>
          <div className="text-sm">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content bg-[#f8f9fa] min-h-screen flex flex-col">

      {/* ─── 토스트 메시지 ──────────────────────────────── */}
      {msg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] px-6 py-2.5 rounded-xl bg-[var(--primary)] text-white text-[13px] font-semibold shadow-lg">
          {msg}
        </div>
      )}

      {/* ─── 상단 헤더 ─────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#f3f4f5] flex justify-between items-center w-full px-8 py-4">
        <div className="flex items-center gap-8">
          <h2 className="text-lg font-black text-[var(--primary)] tracking-tight">상담 관리</h2>

          {/* 뷰 토글 */}
          <div className="flex bg-[#e1e3e4] rounded-lg p-1">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${
                viewMode === 'pipeline'
                  ? 'bg-white shadow-sm text-[var(--primary)]'
                  : 'text-[#45464e] hover:text-[var(--primary)]'
              }`}
            >
              파이프라인
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                viewMode === 'list'
                  ? 'bg-white shadow-sm text-[var(--primary)] font-bold'
                  : 'text-[#45464e] hover:text-[var(--primary)]'
              }`}
            >
              리스트
            </button>
          </div>

          {/* 검색바 */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f] text-sm">search</span>
            <input
              type="text"
              placeholder="리드 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-[#e1e3e4] border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-[var(--cta)]/20 focus:bg-white transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowForm(true); setEditingLead(null); resetForm(); }}
            className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            리드 등록
          </button>
        </div>
      </header>

      {/* ─── 메인 콘텐츠 ───────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {viewMode === 'pipeline' ? (
          /* ─── 칸반 보드 (파이프라인 뷰) ─────────────── */
          <section className="flex-1 overflow-x-auto p-6 flex gap-4 items-start">
            {KANBAN_COLUMNS.map(col => {
              const colLeads = getColumnLeads(col.key);
              return (
                <div key={col.key} className="flex-shrink-0 w-80 flex flex-col max-h-full">
                  {/* 컬럼 헤더 */}
                  <div className="flex items-center justify-between mb-3 px-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.color}`} />
                      <h3 className="font-bold text-sm text-[#191c1d]">{col.label}</h3>
                      <span className="bg-[#e1e3e4] text-[#45464e] px-2 py-0.5 rounded-full text-xs font-bold">
                        {colLeads.length}
                      </span>
                    </div>
                    <button className="material-symbols-outlined text-[#75777f] text-lg">more_horiz</button>
                  </div>

                  {/* 카드 리스트 */}
                  <div className="space-y-3 overflow-y-auto pr-2 pb-4">
                    {col.key === 'enrolled' && colLeads.length === 0 ? (
                      <div className="bg-[#edeeef] rounded-lg p-4 flex flex-col items-center justify-center opacity-40 border-2 border-dashed border-[#c5c6cf]">
                        <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
                        <p className="text-xs font-bold">기록 보관됨</p>
                      </div>
                    ) : colLeads.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs">리드 없음</div>
                    ) : (
                      colLeads.map(lead => (
                        <KanbanCard key={lead.id} lead={lead} onClick={() => openDetail(lead)} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          /* ─── 리스트 뷰 ─────────────────────────────── */
          <div className="p-6 overflow-auto flex-1">
            {filteredLeads.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-100">
                <span className="material-symbols-outlined text-5xl mb-2 block">inbox</span>
                <div className="text-sm">리드가 없습니다</div>
                <div className="text-xs mt-1">"리드 등록" 버튼으로 신규 문의를 추가하세요.</div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
                <table className="w-full min-w-[780px] text-sm">
                  <thead>
                    <tr className="bg-[#f3f4f5]">
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">학생</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">보호자</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">유입</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">상태</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">우선순위</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">담당</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">다음 연락</th>
                      <th className="px-6 py-4 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredLeads.map(lead => {
                      const st = getStatusInfo(lead.status);
                      const pr = getPriorityInfo(lead.priority);
                      const isOverdue = lead.next_contact_date && new Date(lead.next_contact_date) < new Date(new Date().toDateString());
                      return (
                        <tr
                          key={lead.id}
                          onClick={() => openDetail(lead)}
                          className="cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-6 py-4 font-bold text-[var(--primary)]">{lead.student_name}</td>
                          <td className="px-6 py-4 text-slate-500">{lead.parent_name || '-'}</td>
                          <td className="px-6 py-4">
                            {lead.source && (
                              <span className="bg-[#f3f4f5] text-[11px] font-bold px-2 py-0.5 rounded-full text-slate-500">
                                {lead.source}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                              style={{ background: st.color + '14', color: st.color }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
                              {st.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold" style={{ color: pr.color }}>
                            {pr.emoji} {pr.label}
                          </td>
                          <td className="px-6 py-4 text-slate-500">{lead.assigned_name || '-'}</td>
                          <td className={`px-6 py-4 ${isOverdue ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
                            {lead.next_contact_date ? new Date(lead.next_contact_date).toLocaleDateString('ko-KR') : '-'}
                          </td>
                          <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => openEdit(lead)}
                                className="px-2 py-1 rounded-md border border-slate-200 bg-white text-[11px] text-slate-500 hover:bg-slate-50 transition-colors"
                              >수정</button>
                              <button
                                onClick={() => handleDelete(lead.id)}
                                className="px-2 py-1 rounded-md border-none bg-red-50 text-red-500 text-[11px] hover:bg-red-100 transition-colors"
                              >삭제</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 p-4 border-t border-slate-100">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                      className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs disabled:opacity-40"
                    >이전</button>
                    <span className="px-3 py-1.5 text-xs text-slate-500">{page} / {totalPages}</span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                      className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs disabled:opacity-40"
                    >다음</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 하단 통계 바 ──────────────────────────────── */}
      {stats && (
        <footer className="bg-white border-t border-[#c5c6cf] px-8 py-4 flex items-center justify-between">
          <div className="flex gap-12">
            <div>
              <p className="text-[10px] text-[#75777f] font-bold uppercase tracking-wider mb-1">월간 신규 리드</p>
              <p className="text-lg font-black text-[var(--primary)]">
                {stats.statusCounts?.new || 0}
                <span className="text-xs font-bold text-emerald-500 ml-1">+12%</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#75777f] font-bold uppercase tracking-wider mb-1">전환율</p>
              <p className="text-lg font-black text-[var(--primary)]">{stats.conversionRate || 0}%</p>
            </div>
            <div>
              <p className="text-[10px] text-[#75777f] font-bold uppercase tracking-wider mb-1">평균 리드 기간</p>
              <p className="text-lg font-black text-[var(--primary)]">{stats.avgLeadDuration ? `${Math.round(stats.avgLeadDuration)}일` : '-'}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#75777f] font-bold uppercase tracking-wider mb-1">주요 유입 경로</p>
              <p className="text-lg font-black text-[var(--primary)]">
                {stats.topSource || '-'}
                <span className="text-xs font-bold text-[#75777f] ml-1">({stats.topSourcePercent || ''}%)</span>
              </p>
            </div>
          </div>
          <button className="bg-[#f3f4f5] text-[var(--primary)] px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#e7e8e9] transition-colors">
            리포트 상세보기
          </button>
        </footer>
      )}

      {/* ─── 리드 등록/수정 모달 ───────────────────────── */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-5"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl p-7 w-full max-w-[520px] max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-black text-[var(--primary)]">
                {editingLead ? '리드 수정' : '리드 등록'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-[#e7e8e9] rounded-full transition-colors">
                <span className="material-symbols-outlined text-slate-400 text-xl">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="학생 이름 *" value={form.student_name} onChange={v => setForm({ ...form, student_name: v })} placeholder="학생 이름" />
                <FormField label="학교" value={form.school} onChange={v => setForm({ ...form, school: v })} placeholder="학교명" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="학년" value={form.grade} onChange={v => setForm({ ...form, grade: v })} placeholder="예: 고1" />
                <FormSelect label="우선순위" value={form.priority} onChange={v => setForm({ ...form, priority: v })} options={PRIORITIES.map(p => ({ value: p.key, label: p.label }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="보호자 이름" value={form.parent_name} onChange={v => setForm({ ...form, parent_name: v })} placeholder="보호자 이름" />
                <FormField label="보호자 전화" value={form.parent_phone} onChange={v => setForm({ ...form, parent_phone: v })} placeholder="010-0000-0000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormSelect label="유입 채널" value={form.source} onChange={v => setForm({ ...form, source: v })} options={[{ value: '', label: '선택' }, ...SOURCES.map(s => ({ value: s, label: s }))]} />
                <FormSelect label="관심 수업" value={form.interest_class_id} onChange={v => setForm({ ...form, interest_class_id: v })} options={[{ value: '', label: '선택' }, ...classes.map(c => ({ value: c.id, label: c.name }))]} />
              </div>
              <FormSelect label="담당자" value={form.assigned_to} onChange={v => setForm({ ...form, assigned_to: v })} options={[{ value: '', label: '미배정' }, ...admins.map(a => ({ value: a.id, label: a.name }))]} />
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">메모</label>
                <textarea
                  value={form.memo}
                  onChange={e => setForm({ ...form, memo: e.target.value })}
                  rows={3}
                  className="w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[var(--cta)]/40 focus:bg-white focus:ring-4 focus:ring-[var(--cta)]/5 text-sm resize-y"
                  placeholder="메모..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-lg border border-slate-200 text-[var(--primary)] font-bold text-sm hover:bg-slate-50 transition-colors"
              >취소</button>
              <button
                onClick={handleSave}
                className="px-5 py-2 rounded-lg bg-[var(--primary)] text-white font-bold text-sm hover:opacity-90 transition-all"
              >저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 리드 상세 슬라이드 패널 ───────────────────── */}
      {showDetail && detailData && (
        <>
          {/* 오버레이 */}
          <div
            className="fixed inset-0 bg-black/30 z-[49]"
            onClick={() => { setShowDetail(null); setDetailData(null); }}
          />

          {/* 슬라이드 패널 */}
          <aside className="fixed right-0 top-0 h-screen w-[480px] max-w-full bg-white shadow-2xl z-50 flex flex-col border-l border-[#c5c6cf]/10">

            {/* 패널 헤더 */}
            <div className="p-6 border-b border-[#edeeef]">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-black text-[var(--primary)] tracking-tight">리드 상세</h2>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: getStatusInfo(detailData.status).color + '1a',
                        color: getStatusInfo(detailData.status).color,
                      }}
                    >
                      {getStatusInfo(detailData.status).label}
                    </span>
                  </div>
                  <p className="text-[#45464e] font-medium text-sm">
                    {detailData.student_name} {detailData.grade ? `• ${detailData.grade}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => { setShowDetail(null); setDetailData(null); }}
                  className="p-2 hover:bg-[#e7e8e9] rounded-full transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* 4 액션 버튼 */}
              <div className="grid grid-cols-2 gap-4 mb-2">
                <button
                  onClick={() => document.getElementById('act-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex items-center justify-center gap-2 py-2.5 bg-[#e7e8e9] text-[var(--primary)] rounded-lg font-bold text-sm hover:opacity-80 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">add_circle</span>
                  활동 추가
                </button>
                <button
                  onClick={() => setShowTrialForm(true)}
                  className="flex items-center justify-center gap-2 py-2.5 bg-purple-100 text-purple-700 rounded-lg font-bold text-sm hover:opacity-80 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">event_available</span>
                  체험 예약
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {detailData.status !== 'enrolled' && (
                  <button
                    onClick={() => handleConvert(detailData.id)}
                    className="py-2.5 bg-emerald-500 text-white rounded-lg font-bold text-sm hover:opacity-90 transition-all"
                  >등록 처리</button>
                )}
                {detailData.status !== 'lost' && (
                  <button
                    onClick={() => handleStatusChange(detailData.id, 'lost')}
                    className="py-2.5 bg-[#e1e3e4] text-[#45464e] rounded-lg font-bold text-sm hover:bg-red-50 hover:text-red-600 transition-all"
                  >미등록 처리</button>
                )}
              </div>
            </div>

            {/* 패널 콘텐츠 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">

              {/* 기본 정보 */}
              <section>
                <h4 className="text-[10px] text-[#75777f] font-bold uppercase tracking-widest mb-4">기본 정보</h4>
                <div className="space-y-4">
                  <InfoRow label="학부모 연락처" value={detailData.parent_phone || '-'} />
                  <InfoRow label="유입 경로" value={detailData.source || '-'} />
                  <InfoRow label="우선순위" value={`${getPriorityInfo(detailData.priority).emoji} ${getPriorityInfo(detailData.priority).label}`} color={getPriorityInfo(detailData.priority).color} />
                  <InfoRow label="담당자" value={detailData.assigned_name || '미배정'} />
                  <InfoRow label="학교" value={detailData.school || '-'} />
                  <InfoRow label="학년" value={detailData.grade || '-'} />
                  <InfoRow label="보호자" value={detailData.parent_name || '-'} />
                </div>
              </section>

              {/* 상태 변경 */}
              <section>
                <h4 className="text-[10px] text-[#75777f] font-bold uppercase tracking-widest mb-4">상태 변경</h4>
                <div className="flex gap-1.5 flex-wrap">
                  {ALL_STATUSES.filter(s => s.key !== detailData.status).map(s => (
                    <button
                      key={s.key}
                      onClick={() => handleStatusChange(detailData.id, s.key)}
                      className="px-3 py-1 rounded-lg text-[11px] font-bold transition-all hover:opacity-80"
                      style={{
                        border: `1px solid ${s.color}30`,
                        background: s.color + '0a',
                        color: s.color,
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* 체험 수업 */}
              {(detailData.trials?.length > 0 || showTrialForm) && (
                <section>
                  <h4 className="text-[10px] text-[#75777f] font-bold uppercase tracking-widest mb-4">체험 수업</h4>
                  {detailData.trials?.map(t => (
                    <div key={t.id} className="bg-[#f8f9fa] rounded-lg p-3 mb-2 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-semibold text-[var(--primary)]">
                          {new Date(t.trial_date).toLocaleDateString('ko-KR')} {t.trial_time || ''}
                        </div>
                        {t.feedback && <div className="text-xs text-slate-500 mt-0.5">{t.feedback}</div>}
                      </div>
                      <span className={`text-[11px] font-bold ${
                        t.status === 'attended' ? 'text-emerald-500' : t.status === 'no_show' ? 'text-red-500' : 'text-slate-500'
                      }`}>
                        {t.status === 'scheduled' ? '예정' : t.status === 'attended' ? '참석' : t.status === 'no_show' ? '불참' : '취소'}
                      </span>
                    </div>
                  ))}
                  {showTrialForm && (
                    <div className="bg-[#f8f9fa] rounded-lg p-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400">수업</label>
                          <select
                            value={trialForm.class_id}
                            onChange={e => setTrialForm({ ...trialForm, class_id: e.target.value })}
                            className="w-full px-2 py-1.5 rounded-md border border-slate-200 text-xs bg-white"
                          >
                            <option value="">선택</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400">날짜 *</label>
                          <input
                            type="date"
                            value={trialForm.trial_date}
                            onChange={e => setTrialForm({ ...trialForm, trial_date: e.target.value })}
                            className="w-full px-2 py-1.5 rounded-md border border-slate-200 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400">시간</label>
                          <input
                            type="time"
                            value={trialForm.trial_time}
                            onChange={e => setTrialForm({ ...trialForm, trial_time: e.target.value })}
                            className="w-full px-2 py-1.5 rounded-md border border-slate-200 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-2.5 justify-end">
                        <button onClick={() => setShowTrialForm(false)} className="px-3 py-1 rounded-md border border-slate-200 bg-white text-[11px] hover:bg-slate-50">취소</button>
                        <button onClick={handleTrialSubmit} className="px-3 py-1 rounded-md bg-[var(--primary)] text-white font-bold text-[11px] hover:opacity-90">예약</button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* 활동 타임라인 */}
              <section id="act-section">
                <h4 className="text-[10px] text-[#75777f] font-bold uppercase tracking-widest mb-6">활동 타임라인</h4>

                {/* 활동 추가 폼 */}
                <div className="bg-[#f8f9fa] rounded-xl p-4 mb-6">
                  <div className="flex gap-2 mb-2">
                    <select
                      value={actForm.activity_type}
                      onChange={e => setActForm({ ...actForm, activity_type: e.target.value })}
                      className="px-3 py-1.5 rounded-md border border-slate-200 text-xs bg-white"
                    >
                      {ACTIVITY_TYPES.filter(t => t.key !== 'status_change').map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                    <input
                      value={actForm.description}
                      onChange={e => setActForm({ ...actForm, description: e.target.value })}
                      placeholder="활동 내용"
                      className="flex-1 px-3 py-1.5 rounded-md border border-slate-200 text-xs outline-none focus:border-[var(--cta)]/40 focus:ring-2 focus:ring-[var(--cta)]/5"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      value={actForm.result}
                      onChange={e => setActForm({ ...actForm, result: e.target.value })}
                      placeholder="결과"
                      className="px-3 py-1.5 rounded-md border border-slate-200 text-xs outline-none focus:border-[var(--cta)]/40"
                    />
                    <input
                      value={actForm.next_action}
                      onChange={e => setActForm({ ...actForm, next_action: e.target.value })}
                      placeholder="다음 행동"
                      className="px-3 py-1.5 rounded-md border border-slate-200 text-xs outline-none focus:border-[var(--cta)]/40"
                    />
                  </div>
                  <div className="text-right">
                    <button
                      onClick={handleAddActivity}
                      className="px-4 py-1.5 rounded-lg bg-[var(--cta)] text-white font-bold text-[11px] hover:opacity-90 transition-all"
                    >기록 추가</button>
                  </div>
                </div>

                {/* 타임라인 */}
                {detailData.activities?.length > 0 && (
                  <div className="relative space-y-8 before:content-[''] before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[2px] before:bg-[#edeeef]">
                    {detailData.activities.map((act) => {
                      const typeInfo = ACTIVITY_TYPES.find(t => t.key === act.activity_type) || { label: act.activity_type, icon: 'circle' };
                      const isCall = act.activity_type === 'call';
                      const isStatusChange = act.activity_type === 'status_change';

                      return (
                        <div key={act.id} className="relative pl-12">
                          <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center z-10 border-4 border-white ${
                            isCall ? 'bg-[var(--cta)]/10' : isStatusChange ? 'bg-purple-100' : 'bg-[#e7e8e9]'
                          }`}>
                            <span className={`material-symbols-outlined text-sm ${
                              isCall ? 'text-[var(--cta)]' : isStatusChange ? 'text-purple-500' : 'text-[#45464e]'
                            }`}>{typeInfo.icon}</span>
                          </div>
                          <div>
                            <div className="flex justify-between mb-1">
                              <p className="text-sm font-bold text-[var(--primary)]">{act.description || typeInfo.label}</p>
                              <span className="text-[10px] text-[#75777f]">
                                {act.created_at ? new Date(act.created_at).toLocaleString('ko-KR') : ''}
                              </span>
                            </div>
                            {act.result && <p className="text-xs text-[#45464e] leading-relaxed">결과: {act.result}</p>}
                            {act.next_action && <p className="text-xs text-[var(--cta)] mt-0.5">다음: {act.next_action}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* 하단 메모 */}
            <div className="p-6 bg-[#f3f4f5]">
              <textarea
                value={memoText}
                onChange={e => setMemoText(e.target.value)}
                className="w-full bg-white border-none rounded-lg text-sm p-3 focus:ring-2 focus:ring-[var(--cta)]/20 min-h-[80px] transition-all resize-y"
                placeholder="메모를 입력하세요..."
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={handleMemoSave}
                  className="bg-[var(--primary)] text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition-all"
                >저장</button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

/* ─── 서브 컴포넌트들 ─────────────────────────────────── */

function KanbanCard({ lead, onClick }) {
  const pr = getPriorityInfo(lead.priority);
  const days = daysSince(lead.created_at);

  return (
    <div
      onClick={onClick}
      className="bg-white p-4 rounded-lg shadow-sm border border-transparent hover:border-[var(--cta)]/20 transition-all cursor-pointer group"
    >
      {/* 상단: 채널 배지 + 우선순위 */}
      <div className="flex justify-between items-start mb-2 gap-2">
        {lead.source ? (
          <span className="bg-[#f3f4f5] text-[#45464e] text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap truncate max-w-[180px]" title={lead.source}>
            {lead.source}
          </span>
        ) : <span />}
        <span className="text-xs flex-shrink-0">{pr.emoji}</span>
      </div>

      {/* 이름 + 학년 */}
      <h4 className="font-bold text-base mb-1 text-[var(--primary)] truncate" title={lead.student_name}>
        {lead.student_name}
        {lead.grade && <span className="text-xs font-normal text-[#75777f] ml-1.5 whitespace-nowrap">{lead.grade}</span>}
      </h4>

      {/* 연락처 */}
      <p className="text-xs text-[#45464e] mb-4 whitespace-nowrap">{maskPhone(lead.parent_phone)}</p>

      {/* 하단: 담당자 + N일째 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
            lead.assigned_name ? 'bg-[var(--cta)] text-white' : 'bg-[#e1e3e4] text-slate-400'
          }`}>
            {lead.assigned_name ? lead.assigned_name.charAt(0) : '?'}
          </div>
          {days !== null && (
            <span className="text-[10px] text-[#75777f] font-medium">{days}일째</span>
          )}
        </div>
        {lead.next_contact_date && (
          <span className={`text-[10px] font-bold ${
            new Date(lead.next_contact_date) < new Date(new Date().toDateString())
              ? 'text-red-500' : 'text-[#45464e]'
          }`}>
            {new Date(lead.next_contact_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, color }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-[#75777f]">{label}</span>
      <span className="text-sm font-bold" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[var(--cta)]/40 focus:bg-white focus:ring-4 focus:ring-[var(--cta)]/5 text-sm"
      />
    </div>
  );
}

function FormSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[var(--cta)]/40 focus:bg-white focus:ring-4 focus:ring-[var(--cta)]/5 text-sm"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
