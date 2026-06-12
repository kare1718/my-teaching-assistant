import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { askConfirm } from '../../lib/feedback';
import { PageLoading, StatusBadge } from '../../components/ui';

const CLASS_TYPES = [
  { value: 'regular', label: '정규반' },
  { value: 'intensive', label: '특강' },
  { value: 'private', label: '1:1' },
  { value: 'online', label: '온라인' },
];

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const badgeColor = (type) => {
  const map = { regular: '#3b82f6', intensive: '#f59e0b', private: '#8b5cf6', online: '#10b981' };
  return map[type] || '#6b7280';
};

const statusLabel = (s) => {
  const map = { active: '운영중', paused: '일시정지', closed: '종료' };
  return map[s] || s;
};

export default function ClassManage() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // 모달
  const [showForm, setShowForm] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [form, setForm] = useState({ name: '', class_type: 'regular', subject: '', teacher_id: '', capacity: '', room: '', start_date: '', end_date: '', memo: '' });

  // 상세
  const [detail, setDetail] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  // 참조 데이터
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [enrollStudentId, setEnrollStudentId] = useState('');

  // 반복 일정 폼
  const [recurForm, setRecurForm] = useState({ day_of_week: 1, start_time: '09:00', end_time: '10:00' });

  // 세션 생성 폼
  const [sessionRange, setSessionRange] = useState({ from: '', to: '' });

  const loadClasses = () => {
    let url = '/classes';
    const params = [];
    if (filterType) params.push(`class_type=${filterType}`);
    if (filterStatus) params.push(`status=${filterStatus}`);
    if (params.length) url += '?' + params.join('&');
    api(url).then(data => { setClasses(Array.isArray(data) ? data : []); setLoading(false); }).catch(() => { setClasses([]); setLoading(false); });
  };

  useEffect(() => { loadClasses(); }, [filterType, filterStatus]);
  useEffect(() => {
    api('/clinic/admin/students').then(setStudents).catch(() => []);
    api('/clinic/admin/students').then(data => {
      // teachers = admin/조교/선생님 역할의 유저 — 간단히 학생 API 재활용이 어려우므로 별도 처리
    }).catch(() => {});
    // 강사 목록은 간단하게 classes API가 teacher_name을 이미 제공
  }, []);

  const showMessage = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const handleSave = async () => {
    if (!form.name) { showMessage('반 이름을 입력하세요.'); return; }
    try {
      const payload = { ...form, capacity: form.capacity ? parseInt(form.capacity) : null, teacher_id: form.teacher_id || null };
      if (editingClass) {
        await apiPut(`/classes/${editingClass.id}`, payload);
        showMessage('반 정보가 수정되었습니다.');
      } else {
        await apiPost('/classes', payload);
        showMessage('반이 생성되었습니다.');
      }
      setShowForm(false);
      setEditingClass(null);
      setForm({ name: '', class_type: 'regular', subject: '', teacher_id: '', capacity: '', room: '', start_date: '', end_date: '', memo: '' });
      loadClasses();
    } catch (e) { showMessage(e.message); }
  };

  const handleClose = async (id) => {
    if (!await askConfirm('이 반을 종료하시겠습니까?')) return;
    try {
      await apiDelete(`/classes/${id}`);
      showMessage('반이 종료되었습니다.');
      loadClasses();
      if (detail && detail.id === id) setShowDetail(false);
    } catch (e) { showMessage(e.message); }
  };

  const openEdit = (cls) => {
    setEditingClass(cls);
    setForm({
      name: cls.name || '', class_type: cls.class_type || 'regular', subject: cls.subject || '',
      teacher_id: cls.teacher_id || '', capacity: cls.capacity || '', room: cls.room || '',
      start_date: cls.start_date ? cls.start_date.slice(0, 10) : '', end_date: cls.end_date ? cls.end_date.slice(0, 10) : '',
      memo: cls.memo || '',
    });
    setShowForm(true);
  };

  const openDetail = async (id) => {
    try {
      const data = await api(`/classes/${id}`);
      setDetail(data);
      setShowDetail(true);
    } catch (e) { showMessage(e.message); }
  };

  const handleEnroll = async () => {
    if (!enrollStudentId || !detail) return;
    try {
      const result = await apiPost(`/classes/${detail.id}/enroll`, { student_id: parseInt(enrollStudentId) });
      showMessage(result.message);
      setEnrollStudentId('');
      const data = await api(`/classes/${detail.id}`);
      setDetail(data);
      loadClasses();
    } catch (e) { showMessage(e.message); }
  };

  const handleDrop = async (studentId) => {
    if (!detail || !await askConfirm('수강을 취소하시겠습니까?')) return;
    try {
      await apiDelete(`/classes/${detail.id}/students/${studentId}`);
      showMessage('수강이 취소되었습니다.');
      const data = await api(`/classes/${detail.id}`);
      setDetail(data);
      loadClasses();
    } catch (e) { showMessage(e.message); }
  };

  const handleAddRecurring = async () => {
    if (!detail) return;
    try {
      await apiPost(`/classes/${detail.id}/recurring`, recurForm);
      showMessage('반복 일정이 추가되었습니다.');
      const data = await api(`/classes/${detail.id}`);
      setDetail(data);
    } catch (e) { showMessage(e.message); }
  };

  const handleDeleteRecurring = async (recurId) => {
    try {
      await apiDelete(`/classes/recurring/${recurId}`);
      showMessage('반복 일정이 삭제되었습니다.');
      const data = await api(`/classes/${detail.id}`);
      setDetail(data);
    } catch (e) { showMessage(e.message); }
  };

  const handleGenerateSessions = async () => {
    if (!detail || !sessionRange.from || !sessionRange.to) { showMessage('날짜 범위를 입력하세요.'); return; }
    try {
      const result = await apiPost(`/classes/${detail.id}/sessions/generate`, sessionRange);
      showMessage(result.message);
      const data = await api(`/classes/${detail.id}`);
      setDetail(data);
    } catch (e) { showMessage(e.message); }
  };

  if (loading) return <PageLoading wrap="main-content" />;

  return (
    <div className="main-content p-5 max-w-[1200px] mx-auto">
      <h2 className="text-2xl font-extrabold text-[var(--primary)] tracking-tight mb-4">수업 관리</h2>

      <div className="flex gap-2 mb-5">
        <button className="px-5 py-2.5 bg-[var(--primary)] text-white border-none rounded-lg font-bold text-[13px] cursor-default">
          반 관리
        </button>
        <Link to="/admin/schedules" className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-[13px] no-underline hover:bg-slate-50 transition-colors">
          시간표
        </Link>
      </div>

      {msg && (
        <div className="px-4 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 mb-4 text-sm font-semibold">
          {msg}
        </div>
      )}

      {/* 필터 + 추가 */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]">
            <option value="">전체 유형</option>
            {CLASS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]">
            <option value="">전체 상태</option>
            <option value="active">운영중</option>
            <option value="paused">일시정지</option>
            <option value="closed">종료</option>
          </select>
        </div>
        <button onClick={() => { setShowForm(true); setEditingClass(null); setForm({ name: '', class_type: 'regular', subject: '', teacher_id: '', capacity: '', room: '', start_date: '', end_date: '', memo: '' }); }}
          className="bg-[var(--cta)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display cursor-pointer border-none transition-opacity">
          + 반 추가
        </button>
      </div>

      {/* 반 카드 목록 */}
      {classes.length === 0 ? (
        <div className="p-10 text-center text-slate-400 bg-white rounded-xl border border-slate-100 shadow-sm">
          등록된 반이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
          {classes.map(cls => (
            <div key={cls.id} onClick={() => openDetail(cls.id)}
              className="bg-white rounded-xl p-4 border border-slate-100 cursor-pointer transition-shadow"
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px oklch(0% 0 0 / 0.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              <div className="flex justify-between items-start mb-2 gap-2">
                <div className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  <span className="font-bold text-[15px] text-[var(--primary)]" title={cls.name}>{cls.name}</span>
                  <span className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
                    style={{ background: badgeColor(cls.class_type) + '20', color: badgeColor(cls.class_type) }}>
                    {CLASS_TYPES.find(t => t.value === cls.class_type)?.label || cls.class_type}
                  </span>
                </div>
                <StatusBadge variant={cls.status === 'active' ? 'success' : 'neutral'} className="flex-shrink-0">
                  {statusLabel(cls.status)}
                </StatusBadge>
              </div>
              <div className="text-[13px] text-slate-600 flex flex-col gap-1">
                {cls.subject && <div>과목: {cls.subject}</div>}
                {cls.teacher_name && <div>강사: {cls.teacher_name}</div>}
                {cls.room && <div>강의실: {cls.room}</div>}
                <div>정원: {cls.current_count || 0}{cls.capacity ? ` / ${cls.capacity}명` : '명'}</div>
              </div>
              <div className="flex gap-1.5 mt-2.5">
                <button onClick={e => { e.stopPropagation(); openEdit(cls); }}
                  className="px-2.5 py-1 rounded-md border border-slate-200 cursor-pointer bg-white text-xs text-slate-600 hover:bg-slate-50 transition-colors">수정</button>
                {cls.status !== 'closed' && (
                  <button onClick={e => { e.stopPropagation(); handleClose(cls.id); }}
                    className="px-2.5 py-1 rounded-md border-none cursor-pointer bg-red-50 text-red-600 text-xs hover:bg-red-100 transition-colors">종료</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 반 생성/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-5"
          onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-[480px] max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[var(--primary)] mb-4">{editingClass ? '반 수정' : '반 추가'}</h3>
            <div className="flex flex-col gap-3">
              <input placeholder="반 이름 *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
              <select value={form.class_type} onChange={e => setForm({ ...form, class_type: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]">
                {CLASS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input placeholder="과목" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
              <input placeholder="정원" type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
              <input placeholder="강의실" value={form.room} onChange={e => setForm({ ...form, room: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">시작일</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="w-full box-border px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">종료일</label>
                  <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className="w-full box-border px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
                </div>
              </div>
              <textarea placeholder="메모" value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })}
                rows={3} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)] resize-y" />
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-lg border border-slate-200 cursor-pointer bg-white text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors">취소</button>
              <button onClick={handleSave}
                className="px-5 py-2 rounded-lg border-none cursor-pointer bg-[var(--cta)] text-white font-bold text-sm hover:opacity-90 font-display transition-opacity">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 반 상세 모달 */}
      {showDetail && detail && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-5"
          onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-[640px] max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[var(--primary)]">{detail.name}</h3>
              <button onClick={() => setShowDetail(false)} className="bg-transparent border-none text-xl cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">X</button>
            </div>

            {/* 기본 정보 */}
            <div className="text-sm text-slate-600 mb-4 flex flex-wrap gap-x-4 gap-y-1">
              <span>유형: {CLASS_TYPES.find(t => t.value === detail.class_type)?.label}</span>
              {detail.subject && <span>과목: {detail.subject}</span>}
              {detail.teacher_name && <span>강사: {detail.teacher_name}</span>}
              {detail.room && <span>강의실: {detail.room}</span>}
              <span>정원: {detail.current_count || 0}{detail.capacity ? ` / ${detail.capacity}` : ''}명</span>
            </div>

            {/* 수강생 관리 */}
            <div className="mb-5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">수강생 ({detail.students?.length || 0}명)</h4>
              <div className="flex gap-2 mb-2">
                <select value={enrollStudentId} onChange={e => setEnrollStudentId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]">
                  <option value="">학생 선택</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school})</option>)}
                </select>
                <button onClick={handleEnroll}
                  className="px-3.5 py-2 rounded-lg border-none cursor-pointer bg-[var(--cta)] text-white font-bold text-[13px] hover:opacity-90 font-display transition-opacity">등록</button>
              </div>
              {detail.students?.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {detail.students.map(s => (
                    <div key={s.student_id} className="flex justify-between items-center px-2.5 py-1.5 bg-slate-50 rounded-lg text-[13px]">
                      <span>{s.student_name} ({s.school} {s.grade})</span>
                      <button onClick={() => handleDrop(s.student_id)}
                        className="px-2 py-0.5 rounded-md border-none cursor-pointer bg-red-50 text-red-600 text-[11px] hover:bg-red-100 transition-colors">해제</button>
                    </div>
                  ))}
                </div>
              ) : <div className="text-[13px] text-slate-400">등록된 수강생이 없습니다.</div>}
            </div>

            {/* 반복 일정 */}
            <div className="mb-5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">반복 일정</h4>
              <div className="flex gap-2 mb-2 flex-wrap">
                <select value={recurForm.day_of_week} onChange={e => setRecurForm({ ...recurForm, day_of_week: parseInt(e.target.value) })}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]">
                  {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}요일</option>)}
                </select>
                <input type="time" value={recurForm.start_time} onChange={e => setRecurForm({ ...recurForm, start_time: e.target.value })}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
                <input type="time" value={recurForm.end_time} onChange={e => setRecurForm({ ...recurForm, end_time: e.target.value })}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
                <button onClick={handleAddRecurring}
                  className="px-3.5 py-2 rounded-lg border-none cursor-pointer bg-[var(--cta)] text-white font-bold text-[13px] hover:opacity-90 font-display transition-opacity">추가</button>
              </div>
              {detail.recurring?.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {detail.recurring.map(r => (
                    <div key={r.id} className="flex justify-between items-center px-2.5 py-1.5 bg-slate-50 rounded-lg text-[13px]">
                      <span>{DAY_LABELS[r.day_of_week]}요일 {r.start_time?.slice(0, 5)} ~ {r.end_time?.slice(0, 5)}</span>
                      <button onClick={() => handleDeleteRecurring(r.id)}
                        className="px-2 py-0.5 rounded-md border-none cursor-pointer bg-red-50 text-red-600 text-[11px] hover:bg-red-100 transition-colors">삭제</button>
                    </div>
                  ))}
                </div>
              ) : <div className="text-[13px] text-slate-400">반복 일정이 없습니다.</div>}
            </div>

            {/* 세션 생성 */}
            <div className="mb-5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">수업 세션</h4>
              <div className="flex gap-2 mb-2 flex-wrap">
                <input type="date" value={sessionRange.from} onChange={e => setSessionRange({ ...sessionRange, from: e.target.value })}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
                <span className="self-center text-[13px]">~</span>
                <input type="date" value={sessionRange.to} onChange={e => setSessionRange({ ...sessionRange, to: e.target.value })}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
                <button onClick={handleGenerateSessions}
                  className="px-3.5 py-2 rounded-lg border-none cursor-pointer bg-[var(--cta)] text-white font-bold text-[13px] hover:opacity-90 font-display transition-opacity">자동 생성</button>
              </div>
              {detail.sessions?.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {detail.sessions.map(s => (
                    <div key={s.id} className="flex justify-between items-center px-2.5 py-1.5 bg-slate-50 rounded-lg text-[13px]">
                      <span>
                        {s.session_date?.slice(0, 10)} {s.start_time?.slice(0, 5)}~{s.end_time?.slice(0, 5)}
                        {s.is_makeup && <span className="ml-1 text-amber-500 font-semibold">[보강]</span>}
                      </span>
                      <StatusBadge variant={s.status === 'scheduled' ? 'info' : s.status === 'cancelled' ? 'danger' : 'success'}>
                        {s.status === 'scheduled' ? '예정' : s.status === 'completed' ? '완료' : s.status === 'cancelled' ? '휴강' : s.status}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              ) : <div className="text-[13px] text-slate-400">세션이 없습니다. 반복 일정을 추가하고 자동 생성하세요.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
