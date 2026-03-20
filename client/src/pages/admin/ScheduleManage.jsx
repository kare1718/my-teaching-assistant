import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { SCHOOLS, EXAM_TYPES, EXAM_CATEGORIES, getAllGrades } from '../../config';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const TIME_SLOTS = [];
for (let h = 9; h <= 21; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

const COLORS = [
  { value: '#3b82f6', label: '파랑' },
  { value: '#22c55e', label: '초록' },
  { value: '#f59e0b', label: '주황' },
  { value: '#ef4444', label: '빨강' },
  { value: '#8b5cf6', label: '보라' },
  { value: '#ec4899', label: '분홍' },
  { value: '#06b6d4', label: '하늘' },
  { value: '#64748b', label: '회색' },
];

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ScheduleManage() {
  const [tab, setTab] = useState('class');
  const [msg, setMsg] = useState('');

  // =================== 수업 일정 ===================
  const [schedules, setSchedules] = useState([]);
  const [editId, setEditId] = useState(null);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth() + 1);

  const [form, setForm] = useState({
    title: '', schedule_date: '', time_slot: '', target_school: '', target_grade: '',
    detail: '', color: '#3b82f6',
  });

  const loadSchedules = () => {
    api(`/schedules?year=${calYear}&month=${calMonth}`).then(setSchedules).catch(console.error);
  };

  useEffect(() => { if (tab === 'class') loadSchedules(); }, [calYear, calMonth, tab]);

  const resetForm = () => {
    setForm({ title: '', schedule_date: '', time_slot: '', target_school: '', target_grade: '', detail: '', color: '#3b82f6' });
    setEditId(null);
  };

  const handleClassSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await apiPut(`/schedules/${editId}`, form);
        flash('수업 일정이 수정되었습니다.');
      } else {
        await apiPost('/schedules', form);
        flash('수업 일정이 추가되었습니다.');
      }
      resetForm();
      loadSchedules();
    } catch (err) { flash(err.message); }
  };

  const handleRepeatWeeks = async () => {
    if (!form.title || !form.schedule_date) { flash('수업명과 날짜를 먼저 입력해주세요.'); return; }
    const defaultWeeks = editId ? '12' : '12';
    const weeks = prompt(editId ? '이 일정 이후로 몇 주 반복할까요?' : '몇 주 동안 반복할까요? (시작일 포함)', defaultWeeks);
    if (!weeks || parseInt(weeks) < 1) return;
    try {
      if (editId) {
        // 수정 모드: 먼저 현재 폼 내용으로 수정 후 반복 추가
        await apiPut(`/schedules/${editId}`, form);
        await apiPost(`/schedules/${editId}/make-repeat`, { repeat_weeks: parseInt(weeks) });
        flash(`수정 저장 + ${weeks}주 반복이 추가되었습니다.`);
      } else {
        await apiPost('/schedules/repeat', { ...form, repeat_weeks: parseInt(weeks) });
        flash(`${weeks}주 반복 일정이 추가되었습니다.`);
      }
      resetForm(); setEditSchedule(null);
      loadSchedules();
    } catch (err) { flash(err.message); }
  };

  const handleRepeatForever = async () => {
    if (!form.title || !form.schedule_date) { flash('수업명과 날짜를 먼저 입력해주세요.'); return; }
    if (!confirm(editId ? '이 일정 이후로 매주 반복(52주)을 추가합니다. 진행할까요?' : '매주 반복으로 1년(52주)간 일정을 추가합니다. 진행할까요?')) return;
    try {
      if (editId) {
        await apiPut(`/schedules/${editId}`, form);
        await apiPost(`/schedules/${editId}/make-repeat-forever`);
        flash('수정 저장 + 매주 반복(52주)이 추가되었습니다.');
      } else {
        await apiPost('/schedules/repeat-forever', form);
        flash('매주 반복 일정이 1년(52주) 추가되었습니다.');
      }
      resetForm(); setEditSchedule(null);
      loadSchedules();
    } catch (err) { flash(err.message); }
  };

  const [editSchedule, setEditSchedule] = useState(null); // 수정 중인 원본 데이터

  const handleEditClass = (s) => {
    setForm({
      title: s.title, schedule_date: s.schedule_date, time_slot: s.time_slot || '',
      target_school: s.target_school || '', target_grade: s.target_grade || '',
      detail: s.detail || '', color: s.color || '#3b82f6',
    });
    setEditId(s.id);
    setEditSchedule(s);
  };

  const handleDeleteClass = async (id) => {
    if (!confirm('이 수업 일정을 삭제하시겠습니까?')) return;
    await apiDelete(`/schedules/${id}`);
    loadSchedules();
    flash('삭제되었습니다.');
    if (editId === id) { resetForm(); setEditSchedule(null); }
  };

  const handleToggleCancel = async (id) => {
    await apiPut(`/schedules/${id}/toggle-cancel`);
    loadSchedules();
    const s = schedules.find(x => x.id === id);
    flash(s?.status === 'cancelled' ? '수업이 복원되었습니다.' : '휴강 처리되었습니다.');
  };

  const handleDeleteGroup = async (groupId, futureOnly) => {
    const label = futureOnly ? '이후 반복 일정을 모두 삭제' : '이 반복 일정을 전부 삭제';
    if (!confirm(`${label}하시겠습니까?`)) return;
    await apiDelete(`/schedules/group/${groupId}${futureOnly ? '?future_only=true' : ''}`);
    loadSchedules();
    flash(futureOnly ? '이후 반복 일정이 삭제되었습니다.' : '반복 일정이 모두 삭제되었습니다.');
    resetForm();
    setEditSchedule(null);
  };

  const handleDateClick = (dateStr) => {
    resetForm();
    setForm(f => ({ ...f, schedule_date: dateStr }));
  };

  const prevMonth = () => {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  };

  // =================== 시험 일정 ===================
  const [exams, setExams] = useState([]);
  const [examEditId, setExamEditId] = useState(null);
  const [examCatFilter, setExamCatFilter] = useState('all');
  const [examCalYear, setExamCalYear] = useState(today.getFullYear());
  const [examCalMonth, setExamCalMonth] = useState(today.getMonth() + 1);
  const [examForm, setExamForm] = useState({
    name: '', examType: '학력평가 모의고사', examDate: '', school: '', grade: '', maxScore: 100,
  });

  const loadExams = () => { api('/scores/exams').then(setExams).catch(console.error); };
  useEffect(() => { if (tab === 'exam') loadExams(); }, [tab]);

  const resetExamForm = () => {
    setExamForm({ name: '', examType: '학력평가 모의고사', examDate: '', school: '', grade: '', maxScore: 100 });
    setExamEditId(null);
  };

  // 시험 유형 선택 시 이름 자동 세팅
  const handleExamTypeChange = (newType) => {
    const autoName = examForm.name === '' || EXAM_TYPES.includes(examForm.name);
    setExamForm({ ...examForm, examType: newType, name: autoName ? newType : examForm.name });
  };

  const handleExamSubmit = async (e) => {
    e.preventDefault();
    try {
      if (examEditId) {
        await apiPut(`/scores/exams/${examEditId}`, examForm);
        flash('시험이 수정되었습니다.');
      } else {
        await apiPost('/scores/exams', examForm);
        flash('시험이 등록되었습니다.');
      }
      resetExamForm();
      loadExams();
    } catch (err) { flash(err.message); }
  };

  const handleEditExam = (e) => {
    setExamForm({
      name: e.name, examType: e.exam_type, examDate: e.exam_date || '',
      school: e.school || '', grade: e.grade || '', maxScore: e.max_score || 100,
    });
    setExamEditId(e.id);
  };

  const handleDeleteExam = async (id) => {
    if (!confirm('이 시험을 삭제하시겠습니까? 관련 성적도 함께 삭제됩니다.')) return;
    await apiDelete(`/scores/exams/${id}`);
    loadExams();
    flash('시험이 삭제되었습니다.');
    if (examEditId === id) resetExamForm();
  };

  const handleExamDateClick = (dateStr) => {
    setExamForm(f => ({ ...f, examDate: dateStr }));
  };

  const filteredExams = examCatFilter === 'all'
    ? exams
    : exams.filter(e => {
        const cat = EXAM_CATEGORIES.find(c => c.key === examCatFilter);
        return cat?.types?.includes(e.exam_type);
      });

  const examPrevMonth = () => {
    if (examCalMonth === 1) { setExamCalYear(y => y - 1); setExamCalMonth(12); }
    else setExamCalMonth(m => m - 1);
  };
  const examNextMonth = () => {
    if (examCalMonth === 12) { setExamCalYear(y => y + 1); setExamCalMonth(1); }
    else setExamCalMonth(m => m + 1);
  };

  // 시험용 미니 캘린더
  const renderExamMiniCalendar = () => {
    const firstDay = new Date(examCalYear, examCalMonth - 1, 1).getDay();
    const daysInMonth = new Date(examCalYear, examCalMonth, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(<div key={`ee${i}`} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${examCalYear}-${String(examCalMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayExams = exams.filter(ex => ex.exam_date === dateStr);
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === examForm.examDate;
      const dayOfWeek = new Date(examCalYear, examCalMonth - 1, d).getDay();
      cells.push(
        <div key={d} onClick={() => handleExamDateClick(dateStr)} style={{
          padding: '3px 0', textAlign: 'center', borderRadius: 4, cursor: 'pointer',
          fontSize: 11, fontWeight: isToday ? 800 : isSelected ? 700 : 400,
          background: isSelected ? '#f59e0b' : isToday ? '#fffbeb' : dayExams.length > 0 ? '#fef3c7' : 'transparent',
          color: isSelected ? 'white' : isToday ? '#d97706' : dayOfWeek === 0 ? '#ef4444' : dayOfWeek === 6 ? '#3b82f6' : 'var(--foreground)',
          border: isToday && !isSelected ? '1px solid #fbbf24' : '1px solid transparent',
          position: 'relative',
        }}>
          {d}
          {dayExams.length > 0 && !isSelected && (
            <div style={{
              position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)',
              width: 4, height: 4, borderRadius: '50%', background: '#f59e0b',
            }} />
          )}
        </div>
      );
    }
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span onClick={examPrevMonth} style={{ cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}>◀</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{examCalYear}.{String(examCalMonth).padStart(2, '0')}</span>
          <span onClick={examNextMonth} style={{ cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}>▶</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 2 }}>
          {DAY_NAMES.map((dn, i) => (
            <div key={dn} style={{
              textAlign: 'center', fontSize: 10, fontWeight: 600, padding: '2px 0',
              color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : 'var(--muted-foreground)',
            }}>{dn}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
          {cells}
        </div>
      </div>
    );
  };

  // =================== 공용 ===================
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };
  const gradeOptions = form.target_school ? getAllGrades(form.target_school) : [];
  const examGradeOptions = examForm.school ? getAllGrades(examForm.school) : [];
  const todayStr = fmtDate(new Date());

  // 미니 월간 캘린더
  const renderMiniCalendar = () => {
    const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daySchedules = schedules.filter(s => s.schedule_date === dateStr);
      const activeCount = daySchedules.filter(s => s.status !== 'cancelled').length;
      const cancelledCount = daySchedules.filter(s => s.status === 'cancelled').length;
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === form.schedule_date;
      const dayOfWeek = new Date(calYear, calMonth - 1, d).getDay();

      cells.push(
        <div key={d} onClick={() => handleDateClick(dateStr)} style={{
          padding: '3px 0', textAlign: 'center', borderRadius: 4, cursor: 'pointer',
          fontSize: 11, fontWeight: isToday ? 800 : isSelected ? 700 : 400,
          background: isSelected ? '#3b82f6' : isToday ? '#eff6ff' : activeCount > 0 ? '#f0fdf4' : cancelledCount > 0 ? '#fef2f2' : 'transparent',
          color: isSelected ? 'white' : isToday ? '#2563eb' : dayOfWeek === 0 ? '#ef4444' : dayOfWeek === 6 ? '#3b82f6' : 'var(--foreground)',
          border: isToday && !isSelected ? '1px solid #93c5fd' : '1px solid transparent',
          position: 'relative',
        }}>
          {d}
          {daySchedules.length > 0 && !isSelected && (
            <div style={{
              position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)',
              width: 4, height: 4, borderRadius: '50%',
              background: daySchedules[0].color || '#3b82f6',
            }} />
          )}
        </div>
      );
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span onClick={prevMonth} style={{ cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}>◀</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{calYear}.{String(calMonth).padStart(2, '0')}</span>
          <span onClick={nextMonth} style={{ cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}>▶</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 2 }}>
          {DAY_NAMES.map((dn, i) => (
            <div key={dn} style={{
              textAlign: 'center', fontSize: 10, fontWeight: 600, padding: '2px 0',
              color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : 'var(--muted-foreground)',
            }}>{dn}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
          {cells}
        </div>
      </div>
    );
  };

  // 선택된 날짜 일정 목록
  const selectedDateSchedules = form.schedule_date
    ? schedules.filter(s => s.schedule_date === form.schedule_date)
    : [];

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>일정 관리</span>
      </div>

      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab ${tab === 'class' ? 'active' : ''}`} onClick={() => setTab('class')}>📚 수업 일정</button>
        <button className={`tab ${tab === 'exam' ? 'active' : ''}`} onClick={() => setTab('exam')}>📝 시험 일정</button>
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: 12 }}>{msg}</div>}

      {/* ========== 수업 일정 탭 ========== */}
      {tab === 'class' && (
        <div className="schedule-layout" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {/* 왼쪽: 미니 캘린더 */}
          <div className="schedule-calendar" style={{ flex: '0 0 220px' }}>
            <div className="card" style={{ padding: 10 }}>
              {renderMiniCalendar()}
            </div>

            {/* 선택된 날짜의 일정 목록 */}
            {form.schedule_date && (
              <div className="card" style={{ padding: 10, marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--primary)' }}>
                  {(() => {
                    const d = new Date(form.schedule_date + 'T00:00:00');
                    return `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
                  })()}
                </div>
                {selectedDateSchedules.length === 0 ? (
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>등록된 수업 없음</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {selectedDateSchedules.map(s => {
                      const isCancelled = s.status === 'cancelled';
                      return (
                        <div key={s.id} style={{
                          padding: '4px 6px', borderRadius: 4, fontSize: 11,
                          borderLeft: `3px solid ${isCancelled ? '#d1d5db' : (s.color || '#3b82f6')}`,
                          background: editId === s.id ? '#eff6ff' : isCancelled ? '#fef2f2' : '#f8fafc',
                          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          opacity: isCancelled ? 0.6 : 1,
                        }} onClick={() => handleEditClass(s)}>
                          <div>
                            {isCancelled && <span style={{ color: '#ef4444', fontWeight: 700, marginRight: 3 }}>휴강</span>}
                            <span style={{ fontWeight: 600, textDecoration: isCancelled ? 'line-through' : 'none' }}>
                              {s.time_slot || ''} {s.title}
                            </span>
                            {s.target_school && (
                              <span style={{ color: 'var(--muted-foreground)', fontSize: 10 }}> ({s.target_school})</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span onClick={(e) => { e.stopPropagation(); handleToggleCancel(s.id); }}
                              style={{ cursor: 'pointer', fontSize: 10 }} title={isCancelled ? '복원' : '휴강'}>
                              {isCancelled ? '✅' : '🚫'}
                            </span>
                            <span onClick={(e) => { e.stopPropagation(); handleDeleteClass(s.id); }}
                              style={{ color: '#ef4444', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>✕</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 이번 달 전체 목록 (모바일에서는 숨김) */}
            <div className="schedule-month-list" style={{ marginTop: 8 }}>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  {calMonth}월 수업 ({schedules.length}개)
                </div>
                {schedules.length === 0 ? (
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>없음</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto' }}>
                    {schedules.map(s => {
                      const d = new Date(s.schedule_date + 'T00:00:00');
                      return (
                        <div key={s.id} onClick={() => handleEditClass(s)} style={{
                          padding: '3px 5px', borderRadius: 3, fontSize: 10, cursor: 'pointer',
                          borderLeft: `2px solid ${s.color || '#3b82f6'}`,
                          background: editId === s.id ? '#eff6ff' : 'transparent',
                        }}>
                          <span style={{ fontWeight: 600 }}>{d.getDate()}일</span>
                          <span style={{ color: 'var(--muted-foreground)' }}> {s.time_slot || ''}</span>
                          <span> {s.title}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 오른쪽: 등록/수정 폼 */}
          <div className="schedule-form" style={{ flex: 1, minWidth: 0 }}>
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ marginBottom: 12, fontSize: 16 }}>
                {editId ? '수업 일정 수정' : '수업 일정 추가'}
              </h3>
              <form onSubmit={handleClassSubmit}>
                <div className="form-group">
                  <label>수업명 *</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="예: 계성고 2학년 정규반" required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>날짜 *</label>
                    <input type="date" value={form.schedule_date}
                      onChange={e => setForm({ ...form, schedule_date: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>시간</label>
                    <select value={form.time_slot} onChange={e => setForm({ ...form, time_slot: e.target.value })}>
                      <option value="">선택 안함</option>
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>학교</label>
                    <select value={form.target_school}
                      onChange={e => setForm({ ...form, target_school: e.target.value, target_grade: '' })}>
                      <option value="">전체</option>
                      {SCHOOLS.filter(s => s.name !== '조교' && s.name !== '선생님').map(s => (
                        <option key={s.name} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>학년</label>
                    <select value={form.target_grade}
                      onChange={e => setForm({ ...form, target_grade: e.target.value })}
                      disabled={!form.target_school}>
                      <option value="">전체</option>
                      {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>색상</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {COLORS.map(c => (
                      <div key={c.value} onClick={() => setForm({ ...form, color: c.value })} style={{
                        width: 24, height: 24, borderRadius: '50%', background: c.value, cursor: 'pointer',
                        border: form.color === c.value ? '3px solid var(--foreground)' : '2px solid transparent',
                      }} title={c.label} />
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>메모</label>
                  <input value={form.detail} onChange={e => setForm({ ...form, detail: e.target.value })}
                    placeholder="수업 관련 메모 (선택)" />
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="submit" className="btn btn-primary">
                    {editId ? '수정' : '추가'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={handleRepeatWeeks}
                    style={{ fontSize: 12 }}>
                    🔄 N주 반복
                  </button>
                  <button type="button" onClick={handleRepeatForever}
                    style={{
                      fontSize: 12, padding: '6px 12px', borderRadius: 'var(--radius)', cursor: 'pointer',
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white',
                      border: 'none', fontWeight: 600,
                    }}>
                    ♾️ 매주 반복
                  </button>
                  {editId && (
                    <>
                      <button type="button" className="btn btn-outline" style={{ fontSize: 12 }}
                        onClick={() => handleToggleCancel(editId)}>
                        {editSchedule?.status === 'cancelled' ? '✅ 휴강 취소' : '🚫 휴강'}
                      </button>
                      <button type="button" className="btn btn-outline" style={{ color: '#ef4444', borderColor: '#fca5a5', fontSize: 12 }}
                        onClick={() => { handleDeleteClass(editId); resetForm(); setEditSchedule(null); }}>
                        삭제
                      </button>
                      <button type="button" className="btn btn-outline" onClick={() => { resetForm(); setEditSchedule(null); }} style={{ fontSize: 12 }}>
                        취소
                      </button>
                    </>
                  )}
                </div>

                {/* 반복 일정 그룹 관리 */}
                {editId && editSchedule?.group_id && (
                  <div style={{
                    marginTop: 10, padding: 10, borderRadius: 8,
                    background: '#fef3c7', border: '1px solid #fbbf24',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
                      🔄 반복 일정 그룹
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-outline btn-sm"
                        style={{ fontSize: 11, background: 'white' }}
                        onClick={() => handleDeleteGroup(editSchedule.group_id, true)}>
                        이후 반복 일정 삭제
                      </button>
                      <button type="button" className="btn btn-outline btn-sm"
                        style={{ fontSize: 11, color: '#ef4444', borderColor: '#fca5a5', background: 'white' }}
                        onClick={() => handleDeleteGroup(editSchedule.group_id, false)}>
                        전체 반복 일정 삭제
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========== 시험 일정 탭 ========== */}
      {tab === 'exam' && (
        <div>
          {/* 시험 등록: 캘린더 + 폼 */}
          <div className="schedule-layout" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
            {/* 왼쪽: 미니 캘린더 */}
            <div className="schedule-calendar" style={{ flex: '0 0 220px' }}>
              <div className="card" style={{ padding: 10 }}>
                {renderExamMiniCalendar()}
              </div>
              {/* 선택된 날짜의 시험 */}
              {examForm.examDate && (() => {
                const dayExams = exams.filter(ex => ex.exam_date === examForm.examDate);
                return (
                  <div className="card" style={{ padding: 10, marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#d97706' }}>
                      {(() => {
                        const d = new Date(examForm.examDate + 'T00:00:00');
                        return `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
                      })()}
                    </div>
                    {dayExams.length === 0 ? (
                      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>등록된 시험 없음</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {dayExams.map(ex => (
                          <div key={ex.id} onClick={() => handleEditExam(ex)} style={{
                            padding: '4px 6px', borderRadius: 4, fontSize: 11,
                            borderLeft: '3px solid #f59e0b',
                            background: examEditId === ex.id ? '#fef3c7' : '#f8fafc',
                            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}>
                            <div>
                              <span style={{ fontWeight: 600 }}>{ex.name}</span>
                              <span style={{ color: 'var(--muted-foreground)', fontSize: 10 }}> ({ex.exam_type})</span>
                            </div>
                            <span onClick={(e) => { e.stopPropagation(); handleDeleteExam(ex.id); }}
                              style={{ color: '#ef4444', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>✕</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* 오른쪽: 등록/수정 폼 */}
            <div className="schedule-form" style={{ flex: 1, minWidth: 0 }}>
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ marginBottom: 12, fontSize: 16 }}>
                  {examEditId ? '시험 수정' : '시험 등록'}
                </h3>
                <form onSubmit={handleExamSubmit}>
                  <div className="form-group">
                    <label>시험 분류 *</label>
                    <select value={examForm.examType} onChange={e => handleExamTypeChange(e.target.value)}>
                      <optgroup label="모의고사">
                        <option value="학력평가 모의고사">학력평가 모의고사</option>
                        <option value="서강인T 자체 모의고사">서강인T 자체 모의고사</option>
                      </optgroup>
                      <optgroup label="정규반">
                        <option value="정규반 내신 테스트">정규반 내신 테스트</option>
                      </optgroup>
                      <optgroup label="1학기 중간">
                        <option value="1학기 중간고사">1학기 중간고사</option>
                        <option value="1학기 중간 내신 파이널">1학기 중간 내신 파이널</option>
                      </optgroup>
                      <optgroup label="1학기 기말">
                        <option value="1학기 기말고사">1학기 기말고사</option>
                        <option value="1학기 기말 내신 파이널">1학기 기말 내신 파이널</option>
                      </optgroup>
                      <optgroup label="2학기 중간">
                        <option value="2학기 중간고사">2학기 중간고사</option>
                        <option value="2학기 중간 내신 파이널">2학기 중간 내신 파이널</option>
                      </optgroup>
                      <optgroup label="2학기 기말">
                        <option value="2학기 기말고사">2학기 기말고사</option>
                        <option value="2학기 기말 내신 파이널">2학기 기말 내신 파이널</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>시험명 *</label>
                    <input value={examForm.name} onChange={e => setExamForm({ ...examForm, name: e.target.value })}
                      placeholder="예: 3월 학력평가" required />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>시험 날짜</label>
                      <input type="date" value={examForm.examDate}
                        onChange={e => setExamForm({ ...examForm, examDate: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>만점</label>
                      <input type="number" value={examForm.maxScore}
                        onChange={e => setExamForm({ ...examForm, maxScore: e.target.value })} min="1" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>학교 (비우면 전체)</label>
                      <select value={examForm.school}
                        onChange={e => setExamForm({ ...examForm, school: e.target.value, grade: '' })}>
                        <option value="">전체</option>
                        {SCHOOLS.filter(s => s.name !== '조교' && s.name !== '선생님').map(s => (
                          <option key={s.name} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>학년 (비우면 전체)</label>
                      <select value={examForm.grade}
                        onChange={e => setExamForm({ ...examForm, grade: e.target.value })}
                        disabled={!examForm.school}>
                        <option value="">전체</option>
                        {examGradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="submit" className="btn btn-primary">{examEditId ? '수정' : '등록'}</button>
                    {examEditId && (
                      <>
                        <button type="button" className="btn btn-outline" style={{ color: '#ef4444', borderColor: '#fca5a5', fontSize: 12 }}
                          onClick={() => { handleDeleteExam(examEditId); resetExamForm(); }}>삭제</button>
                        <button type="button" className="btn btn-outline" onClick={resetExamForm} style={{ fontSize: 12 }}>취소</button>
                      </>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* 시험 목록 */}
          <div className="card">
            <h3 style={{ marginBottom: 10 }}>시험 목록</h3>
            {/* 카테고리 탭 */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
              {EXAM_CATEGORIES.map(cat => (
                <button key={cat.key} onClick={() => setExamCatFilter(cat.key)} style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                  border: examCatFilter === cat.key ? '2px solid #1e40af' : '1px solid #d1d5db',
                  background: examCatFilter === cat.key ? '#1e40af' : 'white',
                  color: examCatFilter === cat.key ? 'white' : 'var(--foreground)',
                  fontWeight: examCatFilter === cat.key ? 700 : 400,
                }}>
                  {cat.label}
                  {cat.key !== 'all' && (() => {
                    const cnt = exams.filter(e => cat.types?.includes(e.exam_type)).length;
                    return cnt > 0 ? ` (${cnt})` : '';
                  })()}
                </button>
              ))}
            </div>
            {filteredExams.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center', padding: 30 }}>등록된 시험이 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredExams.map(e => {
                  const upcoming = e.exam_date && e.exam_date >= todayStr;
                  const isFinal = e.exam_type.includes('내신 파이널');
                  return (
                    <div key={e.id} onClick={() => handleEditExam(e)} style={{
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      border: examEditId === e.id ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                      background: examEditId === e.id ? '#fffbeb' : upcoming ? '#fefce8' : 'white',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 600,
                            background: isFinal ? '#fef3c7' : e.exam_type.includes('모의고사') ? '#eff6ff' : e.exam_type.includes('정규반') ? '#f0fdf4' : '#fae8ff',
                            color: isFinal ? '#92400e' : e.exam_type.includes('모의고사') ? '#1e40af' : e.exam_type.includes('정규반') ? '#166534' : '#7e22ce',
                          }}>
                            {e.exam_type}
                          </span>
                          {upcoming && (
                            <span style={{ fontSize: 10, color: '#d97706', fontWeight: 600 }}>예정</span>
                          )}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{e.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                          {e.exam_date ? (() => {
                            const d = new Date(e.exam_date + 'T00:00:00');
                            return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
                          })() : '날짜 미정'}
                          {' · '}{e.school || '전체'}{e.grade ? ` ${e.grade}` : ''}
                          {' · '}만점 {e.max_score}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-outline btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={(ev) => { ev.stopPropagation(); handleEditExam(e); }}>수정</button>
                        <button className="btn btn-outline btn-sm"
                          style={{ fontSize: 11, padding: '3px 8px', color: '#ef4444', borderColor: '#fca5a5' }}
                          onClick={(ev) => { ev.stopPropagation(); handleDeleteExam(e.id); }}>삭제</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .schedule-layout { flex-direction: column !important; }
          .schedule-calendar { flex: 1 !important; width: 100% !important; }
          .schedule-month-list { display: none; }
        }
      `}</style>
    </div>
  );
}
