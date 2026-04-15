import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { useTenantConfig, getAllGrades } from '../../contexts/TenantContext';
import useMediaQuery from '../../hooks/useMediaQuery';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// 시/분 옵션 (10분 단위)
const HOURS = Array.from({ length: 14 }, (_, i) => String(i + 9).padStart(2, '0')); // 09~22
const MINUTES = ['00', '10', '20', '30', '40', '50'];

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

const DEFAULT_SPECIAL_GRADES = ['중3', '고1', '고2', '고3'];

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ScheduleManage() {
  const { config } = useTenantConfig();
  const isLg = useMediaQuery('(min-width: 1600px)');
  const SCHOOLS = config.schools || [];
  // 학원 설정의 학교 목록에서 학년 추출, 없으면 기본값
  const SPECIAL_GRADES = SCHOOLS.length > 0
    ? [...new Set(SCHOOLS.flatMap(s => s.grades || []))]
    : DEFAULT_SPECIAL_GRADES;
  const EXAM_MAJOR_CATEGORIES = config.examTypes || [];
  const EXAM_TYPES = EXAM_MAJOR_CATEGORIES.flatMap(c => c.types || []);
  const EXAM_CATEGORIES = [
    { key: 'all', label: '전체' },
    ...EXAM_MAJOR_CATEGORIES.map(c => ({ key: c.key, label: c.label, types: c.types })),
  ];
  const [tab, setTab] = useState('class');
  const [msg, setMsg] = useState('');

  // =================== 수업 일정 ===================
  const [schedules, setSchedules] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editSchedule, setEditSchedule] = useState(null);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth() + 1);

  // 정규반/특강 타입
  const [classType, setClassType] = useState('regular'); // 'regular' | 'special'

  const [form, setForm] = useState({
    title: '', schedule_date: '',
    time_start_h: '', time_start_m: '00', time_end_h: '', time_end_m: '00',
    target_school: '', target_grade: '',
    detail: '', color: '#3b82f6',
    // 특강 전용
    special_grade: '',
    // 반복 설정
    end_type: 'weeks', // 'weeks' | 'date'
    repeat_weeks: 12,
    end_date: '',
  });

  const loadSchedules = () => {
    api(`/schedules?year=${calYear}&month=${calMonth}`).then(setSchedules).catch(console.error);
  };

  useEffect(() => { if (tab === 'class') loadSchedules(); }, [calYear, calMonth, tab]);

  const resetForm = () => {
    setForm({
      title: '', schedule_date: '',
      time_start_h: '', time_start_m: '00', time_end_h: '', time_end_m: '00',
      target_school: '', target_grade: '',
      detail: '', color: '#3b82f6',
      special_grade: '',
      end_type: 'weeks', repeat_weeks: 12, end_date: '',
    });
    setEditId(null);
    setEditSchedule(null);
  };

  // 정규반: 학교+학년 → 자동 수업명
  const autoTitle = (school, grade) => {
    if (!school || !grade) return '';
    return `${school} ${grade} 정규반`;
  };

  // 시/분 → HH:MM 조합
  const buildTime = (h, m) => h ? `${h}:${m || '00'}` : '';
  // 시간 슬롯 생성 (시작~끝)
  const makeTimeSlot = () => {
    const start = buildTime(form.time_start_h, form.time_start_m);
    const end = buildTime(form.time_end_h, form.time_end_m);
    if (start && end) return `${start}~${end}`;
    if (start) return start;
    return '';
  };

  // 종강일 계산 (주 수 → 날짜)
  const calcEndDate = (startDate, weeks) => {
    if (!startDate || !weeks) return '';
    const d = new Date(startDate + 'T00:00:00');
    d.setDate(d.getDate() + (weeks - 1) * 7);
    return fmtDate(d);
  };

  // 날짜 차이 → 주 수
  const calcWeeks = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    return Math.max(1, Math.round((e - s) / (7 * 24 * 60 * 60 * 1000)) + 1);
  };

  const handleClassSubmit = async () => {
    let title, timeSlot, targetSchool, targetGrade;

    if (classType === 'regular') {
      if (!form.target_school || !form.target_grade) { flash('학교와 학년을 선택해주세요.'); return; }
      if (!form.schedule_date) { flash('개강일을 선택해주세요.'); return; }
      title = autoTitle(form.target_school, form.target_grade);
      timeSlot = makeTimeSlot();
      targetSchool = form.target_school;
      targetGrade = form.target_grade;
    } else {
      if (!form.special_grade) { flash('학년을 선택해주세요.'); return; }
      if (!form.schedule_date) { flash('개강일을 선택해주세요.'); return; }
      title = form.title || `${form.special_grade} 특강`;
      timeSlot = makeTimeSlot();
      targetSchool = '';
      targetGrade = form.special_grade;
    }

    const payload = {
      title, schedule_date: form.schedule_date, time_slot: timeSlot,
      target_school: targetSchool, target_grade: targetGrade,
      detail: form.detail, color: form.color,
    };

    try {
      if (editId) {
        // 수정 모드: 단일 수정
        await apiPut(`/schedules/${editId}`, payload);
        flash('수업 일정이 수정되었습니다.');
      } else {
        // 신규: 반복 일정 생성
        let weeks;
        if (classType === 'regular') {
          weeks = 52; // 정규반 = 매주 반복 1년
        } else {
          if (form.end_type === 'weeks') {
            weeks = parseInt(form.repeat_weeks) || 12;
          } else {
            weeks = calcWeeks(form.schedule_date, form.end_date);
          }
        }

        if (weeks <= 1) {
          await apiPost('/schedules', payload);
          flash('수업 일정이 추가되었습니다.');
        } else {
          await apiPost('/schedules/repeat', { ...payload, repeat_weeks: weeks });
          flash(`${weeks}주 반복 일정이 추가되었습니다.`);
        }
      }
      resetForm();
      loadSchedules();
    } catch (err) { flash(err.message); }
  };

  const handleEditClass = (s) => {
    // 기존 일정 편집 시 시간 파싱 (HH:MM~HH:MM → 시/분 분리)
    let sh = '', sm = '00', eh = '', em = '00';
    if (s.time_slot && s.time_slot.includes('~')) {
      const [startStr, endStr] = s.time_slot.split('~');
      const sp = startStr.trim().split(':');
      sh = sp[0] || ''; sm = sp[1] || '00';
      const ep = endStr.trim().split(':');
      eh = ep[0] || ''; em = ep[1] || '00';
    } else if (s.time_slot) {
      const sp = s.time_slot.trim().split(':');
      sh = sp[0] || ''; sm = sp[1] || '00';
    }

    // 타입 추론
    if (s.title?.includes('정규반')) {
      setClassType('regular');
    } else {
      setClassType('special');
    }

    setForm({
      title: s.title, schedule_date: s.schedule_date,
      time_start_h: sh, time_start_m: sm, time_end_h: eh, time_end_m: em,
      target_school: s.target_school || '', target_grade: s.target_grade || '',
      detail: s.detail || '', color: s.color || '#3b82f6',
      special_grade: s.target_grade || '',
      end_type: 'weeks', repeat_weeks: 12, end_date: '',
    });
    setEditId(s.id);
    setEditSchedule(s);
  };

  const handleDeleteClass = async (id) => {
    if (!confirm('이 수업 일정을 삭제하시겠습니까?')) return;
    await apiDelete(`/schedules/${id}`);
    loadSchedules();
    flash('삭제되었습니다.');
    if (editId === id) resetForm();
  };

  const handleToggleCancel = async (id) => {
    const before = schedules.find(x => x.id === id);
    const wasCancelled = before?.status === 'cancelled';
    await apiPut(`/schedules/${id}/toggle-cancel`);
    loadSchedules();
    flash(wasCancelled ? '수업이 복원되었습니다.' : '휴강 처리되었습니다.');
  };

  const handleDeleteGroup = async (groupId, futureOnly) => {
    const label = futureOnly ? '이후 반복 일정을 모두 삭제' : '이 반복 일정을 전부 삭제';
    if (!confirm(`${label}하시겠습니까?`)) return;
    await apiDelete(`/schedules/group/${groupId}${futureOnly ? '?future_only=true' : ''}`);
    loadSchedules();
    flash(futureOnly ? '이후 반복 일정이 삭제되었습니다.' : '반복 일정이 모두 삭제되었습니다.');
    resetForm();
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
    name: '', examType: '', examDate: '', examEndDate: '', school: '', grade: '', maxScore: 100,
  });
  const [isDateRange, setIsDateRange] = useState(false);

  const loadExams = () => { api('/scores/exams').then(setExams).catch(console.error); };
  useEffect(() => { if (tab === 'exam') loadExams(); }, [tab]);

  const resetExamForm = () => {
    setExamForm({ name: '', examType: '', examDate: '', examEndDate: '', school: '', grade: '', maxScore: 100 });
    setExamEditId(null);
    setIsDateRange(false);
  };

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
      examEndDate: e.exam_end_date || '',
      school: e.school || '', grade: e.grade || '', maxScore: e.max_score || 100,
    });
    setExamEditId(e.id);
    setIsDateRange(!!e.exam_end_date);
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

  // =================== 공용 ===================
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };
  const gradeOptions = form.target_school ? getAllGrades(form.target_school) : [];
  const examGradeOptions = examForm.school ? getAllGrades(examForm.school) : [];
  const todayStr = fmtDate(new Date());

  // 미니 월간 캘린더 (수업)
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
          background: isSelected ? 'var(--primary-light)' : isToday ? 'var(--primary-lighter)' : activeCount > 0 ? 'var(--success-light)' : cancelledCount > 0 ? 'var(--destructive-light)' : 'transparent',
          color: isSelected ? 'white' : isToday ? 'var(--primary)' : dayOfWeek === 0 ? 'var(--destructive)' : dayOfWeek === 6 ? 'var(--primary-light)' : 'var(--foreground)',
          border: isToday && !isSelected ? '1px solid oklch(72% 0.10 260)' : '1px solid transparent',
          position: 'relative',
        }}>
          {d}
          {daySchedules.length > 0 && !isSelected && (
            <div style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: 'var(--radius-full)', background: daySchedules[0].color || 'var(--info)' }} />
          )}
        </div>
      );
    }
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLg ? 8 : 6 }}>
          <span onClick={prevMonth} style={{ cursor: 'pointer', fontSize: isLg ? 15 : 13, padding: '2px 6px' }}>◀</span>
          <span style={{ fontSize: isLg ? 15 : 13, fontWeight: 700 }}>{calYear}.{String(calMonth).padStart(2, '0')}</span>
          <span onClick={nextMonth} style={{ cursor: 'pointer', fontSize: isLg ? 15 : 13, padding: '2px 6px' }}>▶</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isLg ? 2 : 1, marginBottom: 2 }}>
          {DAY_NAMES.map((dn, i) => (
            <div key={dn} style={{ textAlign: 'center', fontSize: isLg ? 12 : 10, fontWeight: 600, padding: isLg ? '3px 0' : '2px 0', color: i === 0 ? 'var(--destructive)' : i === 6 ? 'var(--primary-light)' : 'var(--muted-foreground)' }}>{dn}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isLg ? 2 : 1 }}>{cells}</div>
      </div>
    );
  };

  // 시험용 미니 캘린더
  const renderExamMiniCalendar = () => {
    const firstDay = new Date(examCalYear, examCalMonth - 1, 1).getDay();
    const daysInMonth = new Date(examCalYear, examCalMonth, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(<div key={`ee${i}`} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${examCalYear}-${String(examCalMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayExams = exams.filter(ex => {
                  if (!ex.exam_date) return false;
                  if (ex.exam_end_date && ex.exam_end_date !== ex.exam_date) {
                    return dateStr >= ex.exam_date && dateStr <= ex.exam_end_date;
                  }
                  return ex.exam_date === dateStr;
                });
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === examForm.examDate;
      const dayOfWeek = new Date(examCalYear, examCalMonth - 1, d).getDay();
      cells.push(
        <div key={d} onClick={() => handleExamDateClick(dateStr)} style={{
          padding: '3px 0', textAlign: 'center', borderRadius: 4, cursor: 'pointer',
          fontSize: 11, fontWeight: isToday ? 800 : isSelected ? 700 : 400,
          background: isSelected ? 'var(--warning)' : isToday ? 'var(--warning-light)' : dayExams.length > 0 ? 'var(--warning-light)' : 'transparent',
          color: isSelected ? 'white' : isToday ? 'var(--warning)' : dayOfWeek === 0 ? 'var(--destructive)' : dayOfWeek === 6 ? 'var(--primary-light)' : 'var(--foreground)',
          border: isToday && !isSelected ? '1px solid oklch(80% 0.14 85)' : '1px solid transparent',
          position: 'relative',
        }}>
          {d}
          {dayExams.length > 0 && !isSelected && (
            <div style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: 'var(--radius-full)', background: 'var(--warning)' }} />
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
            <div key={dn} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, padding: '2px 0', color: i === 0 ? 'var(--destructive)' : i === 6 ? 'var(--primary-light)' : 'var(--muted-foreground)' }}>{dn}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>{cells}</div>
      </div>
    );
  };

  const selectedDateSchedules = form.schedule_date
    ? schedules.filter(s => s.schedule_date === form.schedule_date) : [];

  const inputStyle = { width: '100%', padding: 'var(--space-2) 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box' };
  const labelStyle = { fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--neutral-600)', display: 'block', marginBottom: 'var(--space-1)' };

  return (
    <div className="content max-w-7xl mx-auto">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>수업/시험</span>
      </div>

      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab ${tab === 'class' ? 'active' : ''}`} onClick={() => setTab('class')}>📚 수업 일정</button>
        <button className={`tab ${tab === 'exam' ? 'active' : ''}`} onClick={() => setTab('exam')}>📝 시험 일정</button>
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: 12 }}>{msg}</div>}

      {/* ========== 수업 일정 탭 ========== */}
      {tab === 'class' && (
        <div className="schedule-layout" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {/* 왼쪽: 미니 캘린더 + 선택 날짜 목록 */}
          <div className="schedule-calendar" style={{ flex: isLg ? '0 0 260px' : '0 0 220px' }}>
            <div className="card" style={{ padding: isLg ? 14 : 10 }}>{renderMiniCalendar()}</div>

            {form.schedule_date && (
              <div className="card" style={{ padding: 10, marginTop: 8 }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 6, color: 'var(--primary)' }}>
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
                          borderLeft: `3px solid ${isCancelled ? 'var(--neutral-300)' : (s.color || 'var(--primary-light)')}`,
                          background: editId === s.id ? 'var(--primary-lighter)' : isCancelled ? 'var(--destructive-light)' : 'var(--neutral-50)',
                          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          opacity: isCancelled ? 0.6 : 1,
                        }} onClick={() => handleEditClass(s)}>
                          <div>
                            {isCancelled && <span style={{ color: 'var(--destructive)', fontWeight: 700, marginRight: 3 }}>휴강</span>}
                            <span style={{ fontWeight: 600, textDecoration: isCancelled ? 'line-through' : 'none' }}>
                              {s.time_slot || ''} {s.title}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span onClick={(e) => { e.stopPropagation(); handleToggleCancel(s.id); }}
                              style={{ cursor: 'pointer', fontSize: 10 }}>{isCancelled ? '✅' : '🚫'}</span>
                            <span onClick={(e) => { e.stopPropagation(); handleDeleteClass(s.id); }}
                              style={{ color: 'var(--destructive)', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>✕</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 이번 달 목록 */}
            <div className="schedule-month-list" style={{ marginTop: 8 }}>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 6 }}>
                  {calMonth}월 수업 ({schedules.length}개)
                </div>
                {schedules.length === 0 ? (
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>없음</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 300, overflowY: 'auto' }}>
                    {schedules.map(s => {
                      const d = new Date(s.schedule_date + 'T00:00:00');
                      const isCancelled = s.status === 'cancelled';
                      return (
                        <div key={s.id} style={{
                          padding: '3px 5px', borderRadius: 3, fontSize: 10, cursor: 'pointer',
                          borderLeft: `2px solid ${isCancelled ? 'var(--neutral-300)' : (s.color || 'var(--primary-light)')}`,
                          background: editId === s.id ? 'var(--primary-lighter)' : 'transparent',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          opacity: isCancelled ? 0.6 : 1,
                        }}>
                          <div onClick={() => handleEditClass(s)} style={{ flex: 1 }}>
                            <span style={{ fontWeight: 600 }}>{d.getDate()}일</span>
                            <span style={{ color: 'var(--muted-foreground)' }}> {s.time_slot || ''}</span>
                            <span style={{ textDecoration: isCancelled ? 'line-through' : 'none' }}> {s.title}</span>
                            {isCancelled && <span style={{ color: 'var(--destructive)', fontWeight: 700 }}> 휴강</span>}
                          </div>
                          <span onClick={(e) => { e.stopPropagation(); handleDeleteClass(s.id); }}
                            style={{ color: 'var(--destructive)', cursor: 'pointer', fontSize: 10, fontWeight: 600, padding: '0 var(--space-1)' }}>✕</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 오른쪽: 등록/수정 폼 */}
          <div className="schedule-form" style={{ flex: 1, minWidth: 0, maxWidth: 560 }}>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <h3 style={{ marginBottom: 14, fontSize: 'var(--text-base)' }}>
                {editId ? '수업 일정 수정' : '수업 일정 추가'}
              </h3>

              {/* 정규반 / 특강 선택 */}
              {!editId && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {[
                    { val: 'regular', label: '📚 정규반', desc: '학교+학년 = 수업명, 매주 반복' },
                    { val: 'special', label: '⭐ 특강', desc: '학년 선택, 기간 설정' },
                  ].map(t => (
                    <button key={t.val} onClick={() => { setClassType(t.val); resetForm(); }}
                      style={{
                        flex: 1, padding: 'var(--space-3) 14px', borderRadius: 'var(--radius-lg)', border: 'none', cursor: 'pointer',
                        textAlign: 'left', transition: 'all 0.2s',
                        background: classType === t.val ? (t.val === 'regular' ? 'var(--primary-light)' : 'var(--warning)') : 'var(--neutral-100)',
                        color: classType === t.val ? 'white' : 'var(--neutral-600)',
                        boxShadow: classType === t.val ? '0 4px 12px oklch(0% 0 0 / 0.15)' : 'none',
                      }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, marginBottom: 2 }}>{t.label}</div>
                      <div style={{ fontSize: 11, opacity: 0.8 }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* === 정규반 폼 === */}
              {classType === 'regular' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* 학교 + 학년 → 수업명 자동 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
                    <div>
                      <label style={labelStyle}>학교 *</label>
                      <select value={form.target_school}
                        onChange={e => setForm({ ...form, target_school: e.target.value, target_grade: '' })}
                        style={inputStyle}>
                        <option value="">선택</option>
                        {SCHOOLS.filter(s => s.name !== '조교' && s.name !== '선생님').map(s => (
                          <option key={s.name} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>학년 *</label>
                      <select value={form.target_grade}
                        onChange={e => setForm({ ...form, target_grade: e.target.value })}
                        disabled={!form.target_school} style={inputStyle}>
                        <option value="">선택</option>
                        {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* 자동 생성된 수업명 미리보기 */}
                  {form.target_school && form.target_grade && (
                    <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--primary-lighter)', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                      수업명: {autoTitle(form.target_school, form.target_grade)}
                    </div>
                  )}

                  {/* 개강일 */}
                  <div>
                    <label style={labelStyle}>개강일 *</label>
                    <input type="date" value={form.schedule_date}
                      onChange={e => setForm({ ...form, schedule_date: e.target.value })} style={inputStyle} />
                    {form.schedule_date && (
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
                        매주 {DAY_NAMES[new Date(form.schedule_date + 'T00:00:00').getDay()]}요일 반복 (1년)
                      </div>
                    )}
                  </div>

                  {/* 수업 시간 (시작~끝, 시/분 분리) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>시작 시간</label>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <select value={form.time_start_h} onChange={e => setForm({ ...form, time_start_h: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 0 }}>
                          <option value="">시</option>
                          {HOURS.map(h => <option key={h} value={h}>{h}시</option>)}
                        </select>
                        <span style={{ fontWeight: 700, color: 'var(--neutral-400)' }}>:</span>
                        <select value={form.time_start_m} onChange={e => setForm({ ...form, time_start_m: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 0 }}>
                          {MINUTES.map(m => <option key={m} value={m}>{m}분</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>끝 시간</label>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <select value={form.time_end_h} onChange={e => setForm({ ...form, time_end_h: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 0 }}>
                          <option value="">시</option>
                          {HOURS.filter(h => !form.time_start_h || h >= form.time_start_h).map(h => <option key={h} value={h}>{h}시</option>)}
                        </select>
                        <span style={{ fontWeight: 700, color: 'var(--neutral-400)' }}>:</span>
                        <select value={form.time_end_m} onChange={e => setForm({ ...form, time_end_m: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 0 }}>
                          {MINUTES.filter(m => {
                            if (!form.time_end_h || !form.time_start_h) return true;
                            if (form.time_end_h > form.time_start_h) return true;
                            return m > form.time_start_m;
                          }).map(m => <option key={m} value={m}>{m}분</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === 특강 폼 === */}
              {classType === 'special' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* 학년 선택 */}
                  <div>
                    <label style={labelStyle}>학년 *</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {SPECIAL_GRADES.map(g => (
                        <button key={g} onClick={() => setForm({ ...form, special_grade: g })}
                          style={{
                            flex: 1, padding: '10px 0', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer',
                            fontSize: 'var(--text-sm)', fontWeight: 800, transition: 'all 0.2s',
                            background: form.special_grade === g ? 'var(--warning)' : 'var(--neutral-100)',
                            color: form.special_grade === g ? 'white' : 'var(--neutral-600)',
                            boxShadow: form.special_grade === g ? '0 4px 12px oklch(0% 0 0 / 0.1)' : 'none',
                          }}>{g}</button>
                      ))}
                    </div>
                  </div>

                  {/* 수업명 */}
                  <div>
                    <label style={labelStyle}>수업명</label>
                    <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                      placeholder={form.special_grade ? `${form.special_grade} 특강` : '예: 고2 여름 특강'}
                      style={inputStyle} />
                  </div>

                  {/* 개강일 */}
                  <div>
                    <label style={labelStyle}>개강일 *</label>
                    <input type="date" value={form.schedule_date}
                      onChange={e => setForm({ ...form, schedule_date: e.target.value })} style={inputStyle} />
                    {form.schedule_date && (
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
                        매주 {DAY_NAMES[new Date(form.schedule_date + 'T00:00:00').getDay()]}요일
                      </div>
                    )}
                  </div>

                  {/* 수업 시간 (시/분 분리) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>시작 시간</label>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <select value={form.time_start_h} onChange={e => setForm({ ...form, time_start_h: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 0 }}>
                          <option value="">시</option>
                          {HOURS.map(h => <option key={h} value={h}>{h}시</option>)}
                        </select>
                        <span style={{ fontWeight: 700, color: 'var(--neutral-400)' }}>:</span>
                        <select value={form.time_start_m} onChange={e => setForm({ ...form, time_start_m: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 0 }}>
                          {MINUTES.map(m => <option key={m} value={m}>{m}분</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>끝 시간</label>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <select value={form.time_end_h} onChange={e => setForm({ ...form, time_end_h: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 0 }}>
                          <option value="">시</option>
                          {HOURS.filter(h => !form.time_start_h || h >= form.time_start_h).map(h => <option key={h} value={h}>{h}시</option>)}
                        </select>
                        <span style={{ fontWeight: 700, color: 'var(--neutral-400)' }}>:</span>
                        <select value={form.time_end_m} onChange={e => setForm({ ...form, time_end_m: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 0 }}>
                          {MINUTES.filter(m => {
                            if (!form.time_end_h || !form.time_start_h) return true;
                            if (form.time_end_h > form.time_start_h) return true;
                            return m > form.time_start_m;
                          }).map(m => <option key={m} value={m}>{m}분</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 기간 설정 */}
                  <div>
                    <label style={labelStyle}>수업 기간</label>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <button onClick={() => setForm({ ...form, end_type: 'weeks' })}
                        className={`btn btn-sm ${form.end_type === 'weeks' ? 'btn-primary' : 'btn-outline'}`}>
                        주 수 지정
                      </button>
                      <button onClick={() => setForm({ ...form, end_type: 'date' })}
                        className={`btn btn-sm ${form.end_type === 'date' ? 'btn-primary' : 'btn-outline'}`}>
                        종강일 지정
                      </button>
                    </div>

                    {form.end_type === 'weeks' ? (
                      <div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="number" value={form.repeat_weeks} min={1} max={52}
                            onChange={e => setForm({ ...form, repeat_weeks: e.target.value })}
                            style={{ ...inputStyle, width: 80 }} />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>주</span>
                        </div>
                        {form.schedule_date && form.repeat_weeks && (
                          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
                            종강일: {calcEndDate(form.schedule_date, parseInt(form.repeat_weeks))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <input type="date" value={form.end_date}
                          onChange={e => setForm({ ...form, end_date: e.target.value })}
                          min={form.schedule_date} style={inputStyle} />
                        {form.schedule_date && form.end_date && (
                          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
                            총 {calcWeeks(form.schedule_date, form.end_date)}주
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 공통: 색상 + 메모 */}
              <div style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>색상</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {COLORS.map(c => (
                      <div key={c.value} onClick={() => setForm({ ...form, color: c.value })} style={{
                        width: 24, height: 24, borderRadius: '50%', background: c.value, cursor: 'pointer',
                        border: form.color === c.value ? '3px solid var(--foreground)' : '2px solid transparent',
                      }} title={c.label} />
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>메모</label>
                  <input value={form.detail} onChange={e => setForm({ ...form, detail: e.target.value })}
                    placeholder="수업 관련 메모 (선택)" style={inputStyle} />
                </div>
              </div>

              {/* 버튼 */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary" onClick={handleClassSubmit} style={{ fontWeight: 700 }}>
                  {editId ? '수정' : classType === 'regular' ? '📚 정규반 등록 (매주 반복)' : '⭐ 특강 등록'}
                </button>
                {editId && (
                  <>
                    <button type="button" className="btn btn-outline" style={{ fontSize: 'var(--text-xs)' }}
                      onClick={() => handleToggleCancel(editId)}>
                      {editSchedule?.status === 'cancelled' ? '✅ 휴강 취소' : '🚫 휴강'}
                    </button>
                    <button type="button" className="btn btn-outline" style={{ color: 'var(--destructive)', borderColor: 'oklch(75% 0.10 25)', fontSize: 'var(--text-xs)' }}
                      onClick={() => handleDeleteClass(editId)}>삭제</button>
                    <button type="button" className="btn btn-outline" onClick={resetForm} style={{ fontSize: 'var(--text-xs)' }}>취소</button>
                  </>
                )}
              </div>

              {/* 반복 일정 그룹 관리 */}
              {editId && editSchedule?.group_id && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 'var(--radius)', background: 'var(--warning-light)', border: '1px solid oklch(80% 0.14 85)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'oklch(35% 0.12 75)', marginBottom: 6 }}>🔄 반복 일정 그룹</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-outline btn-sm"
                      style={{ fontSize: 11, background: 'var(--card)' }}
                      onClick={() => handleDeleteGroup(editSchedule.group_id, true)}>
                      이후 반복 일정 삭제
                    </button>
                    <button type="button" className="btn btn-outline btn-sm"
                      style={{ fontSize: 11, color: 'var(--destructive)', borderColor: 'oklch(75% 0.10 25)', background: 'var(--card)' }}
                      onClick={() => handleDeleteGroup(editSchedule.group_id, false)}>
                      전체 반복 일정 삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== 시험 일정 탭 ========== */}
      {tab === 'exam' && (
        <div>
          <div className="schedule-layout" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
            <div className="schedule-calendar" style={{ flex: '0 0 220px' }}>
              <div className="card" style={{ padding: 10 }}>{renderExamMiniCalendar()}</div>
              {examForm.examDate && (() => {
                const dayExams = exams.filter(ex => ex.exam_date === examForm.examDate);
                return (
                  <div className="card" style={{ padding: 10, marginTop: 8 }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, marginBottom: 6, color: 'var(--warning)' }}>
                      {(() => { const d = new Date(examForm.examDate + 'T00:00:00'); return `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`; })()}
                    </div>
                    {dayExams.length === 0 ? (
                      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>등록된 시험 없음</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {dayExams.map(ex => (
                          <div key={ex.id} onClick={() => handleEditExam(ex)} style={{
                            padding: '4px 6px', borderRadius: 4, fontSize: 11,
                            borderLeft: '3px solid var(--warning)',
                            background: examEditId === ex.id ? 'var(--warning-light)' : 'var(--neutral-50)',
                            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}>
                            <div>
                              <span style={{ fontWeight: 600 }}>{ex.name}</span>
                              <span style={{ color: 'var(--muted-foreground)', fontSize: 10 }}> ({ex.exam_type})</span>
                            </div>
                            <span onClick={(e) => { e.stopPropagation(); handleDeleteExam(ex.id); }}
                              style={{ color: 'var(--destructive)', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>✕</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="schedule-form" style={{ flex: 1, minWidth: 0, maxWidth: 560 }}>
              <div className="card" style={{ padding: 'var(--space-4)' }}>
                <h3 style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--text-base)' }}>{examEditId ? '시험 수정' : '시험 등록'}</h3>
                <form onSubmit={handleExamSubmit}>
                  <div className="form-group">
                    <label>시험 분류 *</label>
                    <select value={examForm.examType} onChange={e => handleExamTypeChange(e.target.value)}>
                      {EXAM_MAJOR_CATEGORIES.map(cat => (
                        <optgroup key={cat.key} label={cat.label?.replace(/^[^\s]+\s/, '') || cat.key}>
                          {(cat.types || []).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>시험명 *</label>
                    <input value={examForm.name} onChange={e => setExamForm({ ...examForm, name: e.target.value })}
                      placeholder="예: 3월 학력평가" required />
                  </div>
                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                      <label style={{ margin: 0 }}>시험 날짜</label>
                      <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: 'var(--muted-foreground)', margin: 0, fontWeight: 400 }}>
                        <input type="checkbox" checked={isDateRange}
                          onChange={e => {
                            setIsDateRange(e.target.checked);
                            if (!e.target.checked) setExamForm({ ...examForm, examEndDate: '' });
                          }}
                          style={{ width: 14, height: 14, accentColor: 'var(--primary)' }} />
                        기간으로 설정
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <input type="date" value={examForm.examDate}
                        onChange={e => setExamForm({ ...examForm, examDate: e.target.value })}
                        style={{ flex: 1 }} />
                      {isDateRange && (
                        <>
                          <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>~</span>
                          <input type="date" value={examForm.examEndDate}
                            onChange={e => setExamForm({ ...examForm, examEndDate: e.target.value })}
                            min={examForm.examDate || undefined}
                            style={{ flex: 1 }} />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>만점</label>
                    <input type="number" value={examForm.maxScore}
                      onChange={e => setExamForm({ ...examForm, maxScore: e.target.value })} min="1" />
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
                        <button type="button" className="btn btn-outline" style={{ color: 'var(--destructive)', borderColor: 'oklch(75% 0.10 25)', fontSize: 'var(--text-xs)' }}
                          onClick={() => { handleDeleteExam(examEditId); resetExamForm(); }}>삭제</button>
                        <button type="button" className="btn btn-outline" onClick={resetExamForm} style={{ fontSize: 'var(--text-xs)' }}>취소</button>
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
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
              {EXAM_CATEGORIES.map(cat => (
                <button key={cat.key} onClick={() => setExamCatFilter(cat.key)} style={{
                  padding: 'var(--space-1) 10px', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-xs)', cursor: 'pointer',
                  border: examCatFilter === cat.key ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: examCatFilter === cat.key ? 'var(--primary)' : 'var(--card)',
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
              <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 30 }}>등록된 시험이 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredExams.map(e => {
                  const upcoming = e.exam_date && e.exam_date >= todayStr;
                  const catIdx = EXAM_MAJOR_CATEGORIES.findIndex(c => (c.types || []).includes(e.exam_type));
                  const catColors = [
                    { bg: 'var(--primary-lighter)', color: 'var(--primary)' },
                    { bg: 'var(--warning-light)', color: 'oklch(35% 0.12 75)' },
                    { bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)' },
                    { bg: 'oklch(95% 0.03 300)', color: 'oklch(35% 0.18 300)' },
                    { bg: 'var(--info-light)', color: 'oklch(32% 0.12 260)' },
                  ];
                  const badgeStyle = catIdx >= 0 ? catColors[catIdx % catColors.length] : catColors[3];
                  return (
                    <div key={e.id} onClick={() => handleEditExam(e)} style={{
                      padding: '10px var(--space-3)', borderRadius: 'var(--radius)', cursor: 'pointer',
                      border: examEditId === e.id ? '2px solid var(--warning)' : '1px solid var(--border)',
                      background: examEditId === e.id ? 'var(--warning-light)' : upcoming ? 'var(--warning-light)' : 'var(--card)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 600,
                            background: badgeStyle.bg, color: badgeStyle.color,
                          }}>{e.exam_type}</span>
                          {upcoming && <span style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 600 }}>예정</span>}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{e.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                          {e.exam_date ? (() => {
                            const d = new Date(e.exam_date + 'T00:00:00');
                            let dateStr = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
                            if (e.exam_end_date && e.exam_end_date !== e.exam_date) {
                              const d2 = new Date(e.exam_end_date + 'T00:00:00');
                              dateStr += ` ~ ${d2.getMonth() + 1}.${d2.getDate()}(${DAY_NAMES[d2.getDay()]})`;
                            }
                            return dateStr;
                          })() : '날짜 미정'}
                          {' · '}{e.school || '전체'}{e.grade ? ` ${e.grade}` : ''}
                          {' · '}만점 {e.max_score}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-outline btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={(ev) => { ev.stopPropagation(); handleEditExam(e); }}>수정</button>
                        <button className="btn btn-outline btn-sm"
                          style={{ fontSize: 11, padding: '3px 8px', color: 'var(--destructive)', borderColor: 'oklch(75% 0.10 25)' }}
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
