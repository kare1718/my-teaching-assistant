import { useState, useEffect, useCallback } from 'react';
import { api, apiPost, apiPut, apiDelete } from '../../api';

const STATUSES = [
  { key: 'new', label: '신규', color: '#3b82f6' },
  { key: 'contacted', label: '연락완료', color: '#8b5cf6' },
  { key: 'consulting', label: '상담중', color: '#f59e0b' },
  { key: 'trial', label: '체험', color: '#06b6d4' },
  { key: 'enrolled', label: '등록', color: '#22c55e' },
  { key: 'lost', label: '미등록', color: '#ef4444' },
];

const SOURCES = ['블로그', '지인소개', '전화문의', '방문', '온라인광고', 'SNS', '학부모소개', '기타'];
const ACTIVITY_TYPES = [
  { key: 'call', label: '전화' },
  { key: 'visit', label: '방문' },
  { key: 'trial_class', label: '체험수업' },
  { key: 'message', label: '문자/카톡' },
  { key: 'consultation', label: '상담' },
];
const PRIORITIES = [
  { key: 'high', label: '높음', color: '#ef4444' },
  { key: 'normal', label: '보통', color: '#6b7280' },
  { key: 'low', label: '낮음', color: '#9ca3af' },
];

export default function LeadManage() {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

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

  const showMessage = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const loadLeads = useCallback(async () => {
    try {
      let url = '/leads?page=' + page;
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

  const getStatusInfo = (status) => STATUSES.find(s => s.key === status) || { label: status, color: '#6b7280' };
  const getPriorityInfo = (priority) => PRIORITIES.find(p => p.key === priority) || PRIORITIES[1];
  const totalPages = Math.ceil(total / 30);

  // 스타일
  const chipStyle = (active) => ({
    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: active ? 600 : 400,
    background: active ? 'var(--primary)' : 'var(--muted)', color: active ? 'white' : 'var(--foreground)', transition: 'all 0.15s',
  });
  const inputStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
  const btnPrimary = { padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' };
  const btnOutline = { padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'white', fontSize: 13, fontFamily: 'inherit' };
  const cardStyle = { background: 'var(--card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' };
  const overlayStyle = { position: 'fixed', inset: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
  const modalStyle = { background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' };
  const detailModalStyle = { ...modalStyle, maxWidth: 640 };

  if (loading) return <div className="main-content" style={{ padding: 20 }}>로딩 중...</div>;

  return (
    <div className="main-content" style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: '1.5em', fontWeight: 800, margin: 0 }}>상담 관리</h2>
        <button onClick={() => { setShowForm(true); setEditingLead(null); resetForm(); }} style={btnPrimary}>+ 리드 등록</button>
      </div>

      {msg && (
        <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--success-light)', color: 'oklch(52% 0.14 160)', marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
          {msg}
        </div>
      )}

      {/* 파이프라인 요약 바 */}
      {stats && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {STATUSES.map(s => {
            const count = stats.statusCounts?.[s.key] || 0;
            return (
              <div key={s.key} style={{ flex: '1 1 100px', minWidth: 80, textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{count}</div>
                <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginTop: 2 }}>{s.label}</div>
              </div>
            );
          })}
          <div style={{ flex: '1 1 100px', minWidth: 80, textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{stats.conversionRate}%</div>
            <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginTop: 2 }}>이달 전환율</div>
          </div>
        </div>
      )}

      {/* 상태 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => { setFilterStatus(''); setPage(1); }} style={chipStyle(!filterStatus)}>전체</button>
        {STATUSES.map(s => (
          <button key={s.key} onClick={() => { setFilterStatus(filterStatus === s.key ? '' : s.key); setPage(1); }} style={chipStyle(filterStatus === s.key)}>{s.label}</button>
        ))}
      </div>

      {/* 리드 목록 */}
      {leads.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--neutral-500)', ...cardStyle }}>
          리드가 없습니다. "리드 등록" 버튼으로 신규 문의를 추가하세요.
        </div>
      ) : (
        <>
          {/* 모바일에서도 보기 좋은 카드 + 테이블 하이브리드 */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--muted)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>학생</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>학부모</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>유입채널</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>상태</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>우선순위</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>담당자</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>다음 연락일</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}></th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => {
                  const st = getStatusInfo(lead.status);
                  const pr = getPriorityInfo(lead.priority);
                  const isOverdue = lead.next_contact_date && new Date(lead.next_contact_date) < new Date(new Date().toDateString());
                  return (
                    <tr key={lead.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => openDetail(lead)}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{lead.student_name}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--neutral-600)' }}>{lead.parent_name || '-'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--neutral-600)' }}>{lead.source || '-'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: st.color + '20', color: st.color }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 12, color: pr.color, fontWeight: 600 }}>{pr.label}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--neutral-600)' }}>{lead.assigned_name || '-'}</td>
                      <td style={{ padding: '10px 12px', color: isOverdue ? '#ef4444' : 'var(--neutral-600)', fontWeight: isOverdue ? 600 : 400 }}>
                        {lead.next_contact_date ? new Date(lead.next_contact_date).toLocaleDateString('ko-KR') : '-'}
                      </td>
                      <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => openEdit(lead)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: 'white', fontSize: 12, fontFamily: 'inherit' }}>수정</button>
                          <button onClick={() => handleDelete(lead.id)} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--destructive-light)', color: 'oklch(48% 0.20 25)', fontSize: 12, fontFamily: 'inherit' }}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ ...btnOutline, opacity: page <= 1 ? 0.4 : 1 }}>이전</button>
              <span style={{ padding: '8px 12px', fontSize: 14 }}>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ ...btnOutline, opacity: page >= totalPages ? 0.4 : 1 }}>다음</button>
            </div>
          )}
        </>
      )}

      {/* ─── 리드 등록/수정 모달 ──────────────────────────────── */}
      {showForm && (
        <div style={overlayStyle} onClick={() => setShowForm(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{editingLead ? '리드 수정' : '리드 등록'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>학생 이름 *</label>
                  <input value={form.student_name} onChange={e => setForm({ ...form, student_name: e.target.value })} style={inputStyle} placeholder="학생 이름" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>학교</label>
                  <input value={form.school} onChange={e => setForm({ ...form, school: e.target.value })} style={inputStyle} placeholder="학교" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>학년</label>
                  <input value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} style={inputStyle} placeholder="예: 고1" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>우선순위</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={inputStyle}>
                    {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>보호자 이름</label>
                  <input value={form.parent_name} onChange={e => setForm({ ...form, parent_name: e.target.value })} style={inputStyle} placeholder="보호자 이름" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>보호자 전화</label>
                  <input value={form.parent_phone} onChange={e => setForm({ ...form, parent_phone: e.target.value })} style={inputStyle} placeholder="010-0000-0000" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>유입 채널</label>
                  <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} style={inputStyle}>
                    <option value="">선택</option>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>관심 수업</label>
                  <select value={form.interest_class_id} onChange={e => setForm({ ...form, interest_class_id: e.target.value })} style={inputStyle}>
                    <option value="">선택</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>담당자</label>
                <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} style={inputStyle}>
                  <option value="">미배정</option>
                  {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>유입 상세/메모</label>
                <textarea value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="메모..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={btnOutline}>취소</button>
              <button onClick={handleSave} style={btnPrimary}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 리드 상세 모달 ───────────────────────────────────── */}
      {showDetail && detailData && (
        <div style={overlayStyle} onClick={() => { setShowDetail(null); setDetailData(null); }}>
          <div style={detailModalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{detailData.student_name}</h3>
              <button onClick={() => { setShowDetail(null); setDetailData(null); }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--neutral-500)' }}>x</button>
            </div>

            {/* 기본 정보 */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
                <div><span style={{ color: 'var(--neutral-500)' }}>학교:</span> {detailData.school || '-'}</div>
                <div><span style={{ color: 'var(--neutral-500)' }}>학년:</span> {detailData.grade || '-'}</div>
                <div><span style={{ color: 'var(--neutral-500)' }}>보호자:</span> {detailData.parent_name || '-'}</div>
                <div><span style={{ color: 'var(--neutral-500)' }}>전화:</span> {detailData.parent_phone || '-'}</div>
                <div><span style={{ color: 'var(--neutral-500)' }}>유입:</span> {detailData.source || '-'}</div>
                <div><span style={{ color: 'var(--neutral-500)' }}>담당:</span> {detailData.assigned_name || '미배정'}</div>
              </div>
              {detailData.memo && <div style={{ marginTop: 8, fontSize: 14, color: 'var(--neutral-600)' }}>{detailData.memo}</div>}
            </div>

            {/* 상태 변경 버튼들 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {STATUSES.filter(s => s.key !== detailData.status).map(s => (
                <button key={s.key} onClick={() => handleStatusChange(detailData.id, s.key)}
                  style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${s.color}40`, cursor: 'pointer', background: s.color + '10', color: s.color, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                  {s.label}
                </button>
              ))}
              {detailData.status !== 'enrolled' && (
                <button onClick={() => handleConvert(detailData.id)}
                  style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#22c55e', color: 'white', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
                  학생 등록 전환
                </button>
              )}
            </div>

            {/* 체험수업 */}
            {detailData.trials && detailData.trials.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>체험 수업</h4>
                {detailData.trials.map(t => (
                  <div key={t.id} style={{ ...cardStyle, marginBottom: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{new Date(t.trial_date).toLocaleDateString('ko-KR')} {t.trial_time || ''}</span>
                      <span style={{ fontWeight: 600, color: t.status === 'attended' ? '#22c55e' : t.status === 'no_show' ? '#ef4444' : '#6b7280' }}>
                        {t.status === 'scheduled' ? '예정' : t.status === 'attended' ? '참석' : t.status === 'no_show' ? '불참' : '취소'}
                      </span>
                    </div>
                    {t.feedback && <div style={{ fontSize: 13, marginTop: 4, color: 'var(--neutral-600)' }}>{t.feedback}</div>}
                    {t.satisfaction != null && <div style={{ fontSize: 12, marginTop: 2, color: 'var(--neutral-500)' }}>만족도: {t.satisfaction}/5</div>}
                  </div>
                ))}
              </div>
            )}

            {/* 체험수업 예약 */}
            {!showTrialForm ? (
              <button onClick={() => setShowTrialForm(true)} style={{ ...btnOutline, fontSize: 12, marginBottom: 16 }}>+ 체험 수업 예약</button>
            ) : (
              <div style={{ ...cardStyle, marginBottom: 16, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600 }}>수업</label>
                    <select value={trialForm.class_id} onChange={e => setTrialForm({ ...trialForm, class_id: e.target.value })} style={{ ...inputStyle, fontSize: 12 }}>
                      <option value="">선택</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600 }}>날짜 *</label>
                    <input type="date" value={trialForm.trial_date} onChange={e => setTrialForm({ ...trialForm, trial_date: e.target.value })} style={{ ...inputStyle, fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600 }}>시간</label>
                    <input type="time" value={trialForm.trial_time} onChange={e => setTrialForm({ ...trialForm, trial_time: e.target.value })} style={{ ...inputStyle, fontSize: 12 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowTrialForm(false)} style={{ ...btnOutline, fontSize: 12, padding: '4px 10px' }}>취소</button>
                  <button onClick={handleTrialSubmit} style={{ ...btnPrimary, fontSize: 12, padding: '4px 10px' }}>예약</button>
                </div>
              </div>
            )}

            {/* 활동 추가 */}
            <div style={{ ...cardStyle, marginBottom: 16, padding: 12 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>활동 기록 추가</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, alignItems: 'start' }}>
                <select value={actForm.activity_type} onChange={e => setActForm({ ...actForm, activity_type: e.target.value })} style={{ ...inputStyle, fontSize: 12 }}>
                  {ACTIVITY_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <input value={actForm.description} onChange={e => setActForm({ ...actForm, description: e.target.value })} style={{ ...inputStyle, fontSize: 12 }} placeholder="활동 내용" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <input value={actForm.result} onChange={e => setActForm({ ...actForm, result: e.target.value })} style={{ ...inputStyle, fontSize: 12 }} placeholder="결과" />
                <input value={actForm.next_action} onChange={e => setActForm({ ...actForm, next_action: e.target.value })} style={{ ...inputStyle, fontSize: 12 }} placeholder="다음 행동" />
              </div>
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <button onClick={handleAddActivity} style={{ ...btnPrimary, fontSize: 12, padding: '4px 12px' }}>기록</button>
              </div>
            </div>

            {/* 활동 타임라인 */}
            {detailData.activities && detailData.activities.length > 0 && (
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>활동 이력</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detailData.activities.map(act => (
                    <div key={act.id} style={{ padding: '10px 12px', borderLeft: `3px solid ${act.activity_type === 'status_change' ? '#8b5cf6' : act.activity_type === 'call' ? '#3b82f6' : act.activity_type === 'trial_class' ? '#06b6d4' : '#6b7280'}`, background: 'var(--muted)', borderRadius: '0 8px 8px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--neutral-500)', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{ACTIVITY_TYPES.find(t => t.key === act.activity_type)?.label || act.activity_type}</span>
                        <span>{act.created_at ? new Date(act.created_at).toLocaleString('ko-KR') : ''} {act.created_by_name ? `(${act.created_by_name})` : ''}</span>
                      </div>
                      <div style={{ fontSize: 13 }}>{act.description}</div>
                      {act.result && <div style={{ fontSize: 12, color: 'var(--neutral-600)', marginTop: 2 }}>결과: {act.result}</div>}
                      {act.next_action && <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 2 }}>다음: {act.next_action}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
