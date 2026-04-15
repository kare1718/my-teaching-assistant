import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';
import useMediaQuery from '../../hooks/useMediaQuery';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const STATUS_MAP = {
  pending: { text: '대기', bg: 'var(--warning-light)', color: 'oklch(35% 0.12 75)', border: 'var(--warning)' },
  approved: { text: '승인', bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)', border: 'var(--success)' },
  rejected: { text: '거절', bg: 'var(--destructive-light)', color: 'oklch(35% 0.15 25)', border: 'var(--destructive)' },
  completed: { text: '완료', bg: 'oklch(92% 0.04 280)', color: 'oklch(28% 0.10 280)', border: 'oklch(50% 0.20 280)' },
};

const DEFAULT_TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'
];

const DEFAULT_TOPICS = [
  '수업 내용 질문', '시험 분석', '학습 방법 상담',
  '진도 점검', '오답 분석', '보충 수업', '시험 대비', '재시험', '기타'
];

const NOTE_GUIDE = {
  good: [
    '학생이 비문학 과학 지문의 논증 구조 파악에 어려움을 보임. 전제-결론 분리 연습을 진행했고, 3번째 연습에서 스스로 구조를 파악함. 다음 시간에 기술 지문으로 확장 연습 필요.',
    '모의고사 30번 문항 오답 분석. 선지 ③과 ④를 혼동한 원인: 지문의 조건절을 간과함. 조건절 밑줄 긋기 습관 형성이 필요. 유사 문항 3개 추가 제공함.',
  ],
  bad: [
    '문법 질문 답변함',
    '모의고사 분석했음. 잘 이해함.',
  ],
  template: '1. 학생 질문/문제 영역:\n2. 진행한 내용:\n3. 학생 이해도 (상/중/하):\n4. 다음 클리닉 권장사항:',
};

const CONSULT_TAGS = ['클리닉상담', '학습상담', '진로상담', '학부모상담', '생활지도', '성적관리'];

export default function ClinicManage() {
  const { config } = useTenantConfig();
  const isLg = useMediaQuery('(min-width: 1600px)');
  const TIME_SLOTS = config.clinicSettings?.timeSlots || DEFAULT_TIME_SLOTS;
  const TOPICS = config.clinicSettings?.topics || DEFAULT_TOPICS;
  const [appointments, setAppointments] = useState([]);
  const [view, setView] = useState('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [msg, setMsg] = useState('');
  const [noteForm, setNoteForm] = useState({});

  // 필터
  const [filterSchool, setFilterSchool] = useState('');
  const [filterGrade, setFilterGrade] = useState('');

  // 클리닉 입력 폼
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [createForm, setCreateForm] = useState({
    student_id: '', appointment_date: '', time_slot: '', topic: '', detail: ''
  });
  const [creating, setCreating] = useState(false);

  // 상세 모달
  const [detailAppt, setDetailAppt] = useState(null);
  const [apptNotes, setApptNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [showNoteGuide, setShowNoteGuide] = useState(false);

  // 학생별 히스토리
  const [studentList, setStudentList] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentHistory, setStudentHistory] = useState([]);

  // 상담 연동
  const [linkedConsultation, setLinkedConsultation] = useState(null);
  const [showConsultForm, setShowConsultForm] = useState(false);
  const [consultContent, setConsultContent] = useState('');
  const [consultTag, setConsultTag] = useState('클리닉상담');

  const load = () => {
    api(`/clinic/admin/all?year=${currentYear}&month=${currentMonth}`).then(setAppointments).catch(console.error);
  };
  useEffect(() => { load(); }, [currentYear, currentMonth]);

  // 필터 옵션 계산
  const schools = [...new Set(appointments.map(a => a.school).filter(Boolean))].sort();
  const grades = [...new Set(
    appointments.filter(a => !filterSchool || a.school === filterSchool).map(a => a.grade).filter(Boolean)
  )].sort();

  // 필터 적용된 appointments
  const filteredAppointments = appointments.filter(a => {
    if (filterSchool && a.school !== filterSchool) return false;
    if (filterGrade && a.grade !== filterGrade) return false;
    return true;
  });

  // 클리닉 입력 폼 열 때 학생 목록 로드
  useEffect(() => {
    if (showCreateForm && allStudents.length === 0) {
      api('/clinic/admin/students').then(setAllStudents).catch(console.error);
    }
  }, [showCreateForm]);

  const handleCreate = async () => {
    if (!createForm.student_id || !createForm.appointment_date || !createForm.time_slot || !createForm.topic) {
      setMsg('학생, 날짜, 시간, 주제를 모두 입력해주세요.');
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    setCreating(true);
    try {
      const res = await apiPost('/clinic/admin/create', createForm);
      setMsg(res.message);
      setCreateForm({ student_id: '', appointment_date: '', time_slot: '', topic: '', detail: '' });
      setStudentSearch('');
      setShowCreateForm(false);
      load();
    } catch (e) {
      setMsg(e.message);
    }
    setCreating(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const filteredStudents = allStudents.filter(s =>
    !studentSearch || s.name.includes(studentSearch) || s.school.includes(studentSearch)
  );

  // 학생별 뷰 로드
  useEffect(() => {
    if (view === 'students') {
      api(`/clinic/admin/all`).then(data => {
        const map = {};
        data.forEach(a => {
          if (!map[a.student_id]) map[a.student_id] = { id: a.student_id, name: a.student_name, school: a.school, grade: a.grade, count: 0 };
          map[a.student_id].count++;
        });
        setStudentList(Object.values(map).sort((a, b) => b.count - a.count));
      }).catch(console.error);
    }
  }, [view]);

  const loadStudentHistory = async (studentId) => {
    try {
      const data = await api(`/clinic/admin/student/${studentId}/history`);
      setStudentHistory(data);
      setSelectedStudent(studentId);
    } catch (e) { console.error(e); }
  };

  const handleStatus = async (id, status) => {
    try {
      const note = noteForm[id] || '';
      await apiPut(`/clinic/admin/${id}/status`, { status, admin_note: note || undefined });
      setMsg(`클리닉이 ${STATUS_MAP[status].text} 처리되었습니다.`);
      load();
      if (detailAppt && detailAppt.id === id) {
        setDetailAppt({ ...detailAppt, status });
      }
      setTimeout(() => setMsg(''), 2000);
    } catch (e) { setMsg(e.message); }
  };

  const handleAttendance = async (id, attended) => {
    try {
      await apiPut(`/clinic/admin/${id}/attendance`, { attended });
      setMsg(attended ? '출석 처리되었습니다.' : '결석 처리되었습니다.');
      load();
      if (detailAppt && detailAppt.id === id) {
        setDetailAppt({ ...detailAppt, attended, status: attended && detailAppt.status === 'approved' ? 'completed' : detailAppt.status });
      }
      setTimeout(() => setMsg(''), 2000);
    } catch (e) { setMsg(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 클리닉 신청을 삭제하시겠습니까?')) return;
    await apiDelete(`/clinic/admin/${id}`);
    setMsg('삭제되었습니다.');
    setDetailAppt(null);
    load();
    setTimeout(() => setMsg(''), 2000);
  };

  // 상세 모달 내 학생 누적 이력
  const [detailStudentHistory, setDetailStudentHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 노트 관련
  const openDetail = async (appt) => {
    setDetailAppt(appt);
    setNewNote('');
    setShowNoteGuide(false);
    setLoadingNotes(true);
    setLoadingHistory(true);
    setLinkedConsultation(null);
    setShowConsultForm(false);
    setConsultContent('');
    try {
      const notes = await api(`/clinic/admin/${appt.id}/notes`);
      setApptNotes(notes);
    } catch (e) { setApptNotes([]); }
    setLoadingNotes(false);
    try {
      const history = await api(`/clinic/admin/student/${appt.student_id}/history`);
      setDetailStudentHistory(history);
    } catch (e) { setDetailStudentHistory([]); }
    setLoadingHistory(false);
    // 연결된 상담 기록 로드
    try {
      const consultation = await api(`/clinic/admin/${appt.id}/linked-consultation`);
      setLinkedConsultation(consultation);
    } catch (e) { setLinkedConsultation(null); }
  };

  const addNote = async () => {
    if (!newNote.trim() || !detailAppt) return;
    try {
      await apiPost(`/clinic/admin/${detailAppt.id}/notes`, { content: newNote.trim() });
      const notes = await api(`/clinic/admin/${detailAppt.id}/notes`);
      setApptNotes(notes);
      setNewNote('');
    } catch (e) { setMsg(e.message); }
  };

  const deleteNote = async (noteId) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/clinic/admin/notes/${noteId}`);
      setApptNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (e) { setMsg(e.message); }
  };

  const handleLinkConsultation = async () => {
    if (!consultContent.trim() || !detailAppt) return;
    try {
      await apiPost(`/clinic/admin/${detailAppt.id}/link-consultation`, {
        content: consultContent.trim(), tags: consultTag
      });
      setMsg('상담 기록이 연결되었습니다.');
      const consultation = await api(`/clinic/admin/${detailAppt.id}/linked-consultation`);
      setLinkedConsultation(consultation);
      setShowConsultForm(false);
      setConsultContent('');
      setTimeout(() => setMsg(''), 2000);
    } catch (e) { setMsg(e.message); }
  };

  const prevMonth = () => {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  // 캘린더 데이터 계산
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const getDateAppts = (day) => {
    if (!day) return [];
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredAppointments.filter(a => a.appointment_date === dateStr);
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const pendingCount = filteredAppointments.filter(a => a.status === 'pending').length;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
  };

  const getAttendanceBadge = (a) => {
    if (a.attended === true) return { text: '출석', bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)' };
    if (a.attended === false) return { text: '결석', bg: 'var(--destructive-light)', color: 'oklch(35% 0.15 25)' };
    return null;
  };

  const renderAppointmentCard = (a, showDate = true) => {
    const st = STATUS_MAP[a.status] || STATUS_MAP.pending;
    const attBadge = getAttendanceBadge(a);
    return (
      <div key={a.id} style={{
        border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 8,
        borderLeft: `4px solid ${st.border}`, cursor: 'pointer'
      }} onClick={() => openDetail(a)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{a.student_name}</span>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', marginLeft: 6 }}>{a.school} {a.grade}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {attBadge && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 8,
                background: attBadge.bg, color: attBadge.color
              }}>{attBadge.text}</span>
            )}
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: st.bg, color: st.color
            }}>{st.text}</span>
          </div>
        </div>
        <div style={{ fontSize: 13, marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>{showDate ? `${formatDate(a.appointment_date)} ` : ''}{a.time_slot}</span>
        </div>
        <div style={{ fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>{a.topic}</span>
          {a.detail && <span style={{ color: 'var(--muted-foreground)', marginLeft: 6 }}>{a.detail}</span>}
        </div>
        {a.admin_note && (
          <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 4 }}>💬 {a.admin_note}</div>
        )}
      </div>
    );
  };

  // 상세 모달
  const renderDetailModal = () => {
    if (!detailAppt) return null;
    const a = detailAppt;
    const st = STATUS_MAP[a.status] || STATUS_MAP.pending;

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'oklch(0% 0 0 / 0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
      }} onClick={() => setDetailAppt(null)}>
        <div style={{
          background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 520,
          maxHeight: '90vh', overflow: 'auto', padding: 20
        }} onClick={e => e.stopPropagation()}>
          {/* 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>클리닉 상세</h3>
            <button onClick={() => setDetailAppt(null)} style={{
              background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted-foreground)'
            }}>✕</button>
          </div>

          {/* 기본 정보 */}
          <div style={{
            background: 'var(--background)', borderRadius: 10, padding: 14, marginBottom: 16,
            borderLeft: `4px solid ${st.border}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{a.student_name}</span>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', marginLeft: 6 }}>{a.school} {a.grade}</span>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 10,
                background: st.bg, color: st.color
              }}>{st.text}</span>
            </div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>📅 {formatDate(a.appointment_date)} {a.time_slot}</div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>📝 {a.topic}</div>
            {a.detail && <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{a.detail}</div>}
            {a.admin_note && <div style={{ fontSize: 13, color: 'var(--primary)', marginTop: 6 }}>💬 관리자 메모: {a.admin_note}</div>}
          </div>

          {/* 상태 변경 버튼 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {a.status === 'pending' && (
              <>
                <input
                  placeholder="메모 (선택)"
                  value={noteForm[a.id] || ''}
                  onChange={e => setNoteForm({ ...noteForm, [a.id]: e.target.value })}
                  style={{ flex: 1, minWidth: 120, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
                />
                <button className="btn btn-success btn-sm" onClick={() => handleStatus(a.id, 'approved')} style={{ fontWeight: 700 }}>승인</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleStatus(a.id, 'rejected')}>거절</button>
              </>
            )}
            {a.status === 'approved' && (
              <button className="btn btn-sm" onClick={() => handleStatus(a.id, 'completed')}
                style={{ background: 'oklch(50% 0.20 280)', color: 'white', border: 'none' }}>완료 처리</button>
            )}
            <button className="btn btn-outline btn-sm" onClick={() => handleDelete(a.id)} style={{ fontSize: 11 }}>삭제</button>
            <button className="btn btn-outline btn-sm" onClick={() => loadStudentHistory(a.student_id)}
              style={{ fontSize: 11, marginLeft: 'auto' }}>📊 학생 이력</button>
          </div>

          {/* 출석 체크 */}
          {(a.status === 'approved' || a.status === 'completed') && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
              padding: '10px 14px', background: 'var(--background)', borderRadius: 10
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, marginRight: 4 }}>출석 확인:</span>
              <button onClick={() => handleAttendance(a.id, true)} style={{
                padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: a.attended === true ? '2px solid var(--success)' : '1px solid var(--border)',
                background: a.attended === true ? 'var(--success-light)' : 'white',
                color: a.attended === true ? 'oklch(30% 0.12 145)' : 'var(--muted-foreground)',
                transition: 'all 0.2s'
              }}>출석</button>
              <button onClick={() => handleAttendance(a.id, false)} style={{
                padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: a.attended === false ? '2px solid var(--destructive)' : '1px solid var(--border)',
                background: a.attended === false ? 'var(--destructive-light)' : 'white',
                color: a.attended === false ? 'oklch(35% 0.15 25)' : 'var(--muted-foreground)',
                transition: 'all 0.2s'
              }}>결석</button>
              {a.attended == null && (
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>미확인</span>
              )}
            </div>
          )}

          {/* 이번 클리닉 기록(노트) */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 14 }}>📋 이번 클리닉 기록</h4>

            {loadingNotes ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>로딩 중...</p>
            ) : apptNotes.length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13, marginBottom: 10 }}>아직 기록이 없습니다.</p>
            ) : (
              <div style={{ marginBottom: 12 }}>
                {apptNotes.map(n => (
                  <div key={n.id} style={{
                    background: 'var(--secondary)', borderRadius: 8, padding: 10, marginBottom: 6,
                    fontSize: 13, position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{n.author_name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                          {new Date(n.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button onClick={() => deleteNote(n.id)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--destructive)', padding: 0
                        }}>✕</button>
                      </div>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{n.content}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 작성 가이드 토글 */}
            <button onClick={() => setShowNoteGuide(!showNoteGuide)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
              color: 'var(--info)', fontWeight: 600, padding: 0, marginBottom: 8, display: 'block'
            }}>
              {showNoteGuide ? '▼ 작성 가이드 닫기' : '▶ 작성 가이드 보기'}
            </button>

            {showNoteGuide && (
              <div style={{
                background: 'var(--info-light)', border: '1px solid oklch(70% 0.10 240)',
                borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 12, lineHeight: 1.6
              }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: 'oklch(30% 0.10 240)' }}>좋은 기록 예시</div>
                {NOTE_GUIDE.good.map((g, i) => (
                  <div key={i} style={{
                    background: 'oklch(96% 0.02 145)', borderRadius: 6, padding: '8px 10px',
                    marginBottom: 6, borderLeft: '3px solid var(--success)'
                  }}>{g}</div>
                ))}
                <div style={{ fontWeight: 700, marginBottom: 8, marginTop: 10, color: 'oklch(35% 0.15 25)' }}>나쁜 기록 예시</div>
                {NOTE_GUIDE.bad.map((b, i) => (
                  <div key={i} style={{
                    background: 'oklch(96% 0.02 25)', borderRadius: 6, padding: '8px 10px',
                    marginBottom: 6, borderLeft: '3px solid var(--destructive)',
                    textDecoration: 'line-through', color: 'var(--muted-foreground)'
                  }}>{b}</div>
                ))}
                <button onClick={() => setNewNote(NOTE_GUIDE.template)} style={{
                  marginTop: 6, padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: 'oklch(50% 0.14 240)', color: 'white', border: 'none', cursor: 'pointer'
                }}>템플릿 사용하기</button>
              </div>
            )}

            {/* 기록 추가 */}
            <div style={{ display: 'flex', gap: 6 }}>
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="클리닉 내용을 기록하세요..."
                rows={3}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5
                }}
              />
              <button className="btn btn-primary btn-sm" onClick={addNote}
                disabled={!newNote.trim()} style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}>
                기록 추가
              </button>
            </div>
          </div>

          {/* 상담 일지 연동 */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 14 }}>📝 상담 기록 연동</h4>

            {linkedConsultation ? (
              <div style={{
                background: 'var(--secondary)', borderRadius: 10, padding: 12, fontSize: 13
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                    {linkedConsultation.counselor_name}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
                    background: 'oklch(92% 0.04 200)', color: 'oklch(35% 0.10 200)'
                  }}>{linkedConsultation.tags}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{linkedConsultation.content}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 6 }}>
                  {new Date(linkedConsultation.created_at).toLocaleString('ko-KR')}
                </div>
              </div>
            ) : showConsultForm ? (
              <div style={{
                border: '1px solid var(--border)', borderRadius: 10, padding: 12
              }}>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>상담 유형</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {CONSULT_TAGS.map(tag => (
                      <button key={tag} onClick={() => setConsultTag(tag)} style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                        border: consultTag === tag ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: consultTag === tag ? 'oklch(92% 0.04 250)' : 'white',
                        fontWeight: consultTag === tag ? 700 : 400
                      }}>{tag}</button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={consultContent}
                  onChange={e => setConsultContent(e.target.value)}
                  placeholder="상담 내용을 작성하세요..."
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                    fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, marginBottom: 8
                  }}
                />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowConsultForm(false)}>취소</button>
                  <button className="btn btn-primary btn-sm" onClick={handleLinkConsultation}
                    disabled={!consultContent.trim()}>상담 기록 저장</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowConsultForm(true)} style={{
                width: '100%', padding: '10px', borderRadius: 8, border: '1px dashed var(--border)',
                background: 'var(--background)', cursor: 'pointer', fontSize: 13, color: 'var(--muted-foreground)',
                transition: 'all 0.2s'
              }}>
                + 상담 기록 작성
              </button>
            )}
          </div>

          {/* 학생 누적 클리닉 이력 */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              📊 {a.student_name} 누적 클리닉 이력
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                background: 'oklch(92% 0.04 280)', color: 'oklch(28% 0.10 280)'
              }}>총 {detailStudentHistory.length}회</span>
            </h4>

            {/* 출석 통계 */}
            {detailStudentHistory.length > 0 && (() => {
              const attended = detailStudentHistory.filter(h => h.attended === true).length;
              const absent = detailStudentHistory.filter(h => h.attended === false).length;
              const rate = detailStudentHistory.length > 0
                ? Math.round((attended / detailStudentHistory.length) * 100) : 0;
              return (
                <div style={{
                  display: 'flex', gap: 12, marginBottom: 10, padding: '8px 12px',
                  background: 'var(--background)', borderRadius: 8, fontSize: 12, fontWeight: 600
                }}>
                  <span style={{ color: 'oklch(30% 0.12 145)' }}>출석 {attended}회</span>
                  <span style={{ color: 'oklch(35% 0.15 25)' }}>결석 {absent}회</span>
                  <span style={{ color: 'var(--primary)' }}>출석률 {rate}%</span>
                </div>
              );
            })()}

            {loadingHistory ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>로딩 중...</p>
            ) : detailStudentHistory.length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>이력이 없습니다.</p>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {detailStudentHistory.map(h => {
                  const hst = STATUS_MAP[h.status] || STATUS_MAP.pending;
                  const isCurrent = h.id === a.id;
                  const hAtt = getAttendanceBadge(h);
                  return (
                    <div key={h.id} style={{
                      border: isCurrent ? '2px solid var(--info)' : '1px solid var(--border)',
                      borderRadius: 8, padding: 10, marginBottom: 6,
                      borderLeft: `4px solid ${hst.border}`,
                      background: isCurrent ? 'var(--info-light)' : 'var(--card)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          📅 {formatDate(h.appointment_date)} {h.time_slot}
                          {isCurrent && <span style={{ fontSize: 10, color: 'var(--info)', marginLeft: 6, fontWeight: 700 }}>← 현재</span>}
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {hAtt && (
                            <span style={{
                              fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 6,
                              background: hAtt.bg, color: hAtt.color
                            }}>{hAtt.text}</span>
                          )}
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8,
                            background: hst.bg, color: hst.color
                          }}>{hst.text}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ fontWeight: 600 }}>{h.topic}</span>
                        {h.detail && <span style={{ color: 'var(--muted-foreground)', marginLeft: 4 }}>{h.detail}</span>}
                      </div>
                      {h.admin_note && (
                        <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 2 }}>💬 {h.admin_note}</div>
                      )}
                      {h.notes && h.notes.length > 0 && (
                        <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px dashed var(--border)' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 2 }}>📝 기록 {h.notes.length}건</div>
                          {h.notes.map(n => (
                            <div key={n.id} style={{ fontSize: 11, background: 'var(--background)', borderRadius: 4, padding: 4, marginBottom: 2 }}>
                              <span style={{ fontWeight: 600 }}>{n.author_name}</span>
                              <span style={{ color: 'var(--muted-foreground)', marginLeft: 4, fontSize: 10 }}>
                                {new Date(n.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <div style={{ marginTop: 1, whiteSpace: 'pre-wrap', lineHeight: 1.3 }}>{n.content}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 학생 이력 모달
  const renderStudentHistoryModal = () => {
    if (!selectedStudent) return null;
    const info = studentList.find(s => s.id === selectedStudent) || studentHistory[0] || {};

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', zIndex: 1001,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
      }} onClick={() => setSelectedStudent(null)}>
        <div style={{
          background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 560,
          maxHeight: '90vh', overflow: 'auto', padding: 20
        }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>📊 {info.student_name || info.name} 클리닉 이력</h3>
            <button onClick={() => setSelectedStudent(null)} style={{
              background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted-foreground)'
            }}>✕</button>
          </div>

          {studentHistory.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: 20 }}>클리닉 이력이 없습니다.</p>
          ) : (
            studentHistory.map(h => {
              const st = STATUS_MAP[h.status] || STATUS_MAP.pending;
              const hAtt = getAttendanceBadge(h);
              return (
                <div key={h.id} style={{
                  border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10,
                  borderLeft: `4px solid ${st.border}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>📅 {formatDate(h.appointment_date)} {h.time_slot}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {hAtt && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 8,
                          background: hAtt.bg, color: hAtt.color
                        }}>{hAtt.text}</span>
                      )}
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        background: st.bg, color: st.color
                      }}>{st.text}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>{h.topic}{h.detail ? ` — ${h.detail}` : ''}</div>
                  {h.admin_note && <div style={{ fontSize: 12, color: 'var(--primary)', marginBottom: 4 }}>💬 {h.admin_note}</div>}

                  {h.notes && h.notes.length > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--muted-foreground)' }}>📋 기록 ({h.notes.length}건)</div>
                      {h.notes.map(n => (
                        <div key={n.id} style={{
                          background: 'var(--background)', borderRadius: 6, padding: 8, marginBottom: 4, fontSize: 12
                        }}>
                          <span style={{ fontWeight: 600 }}>{n.author_name}</span>
                          <span style={{ color: 'var(--muted-foreground)', marginLeft: 6 }}>
                            {new Date(n.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div style={{ marginTop: 2, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{n.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="content max-w-7xl mx-auto w-full">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>클리닉 관리</span>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      {/* 뷰 전환 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className={`btn ${view === 'calendar' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setView('calendar'); setSelectedDate(null); }}>📅 캘린더</button>
        <button className={`btn ${view === 'list' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setView('list')}>📋 목록</button>
        <button className={`btn ${view === 'students' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setView('students')}>👤 학생별</button>
        <button className="btn" onClick={() => setShowCreateForm(!showCreateForm)}
          style={{ background: 'oklch(52% 0.14 160)', color: 'white', border: 'none', fontWeight: 700 }}>
          ✏️ 클리닉 입력
        </button>
        {pendingCount > 0 && (
          <span style={{
            background: 'var(--destructive)', color: 'white', borderRadius: 20,
            padding: '4px 12px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center'
          }}>대기 {pendingCount}건</span>
        )}
      </div>

      {/* 학교/학년 필터 */}
      {schools.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>필터:</span>
          <select
            value={filterSchool}
            onChange={e => { setFilterSchool(e.target.value); setFilterGrade(''); }}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
          >
            <option value="">전체 학교</option>
            {schools.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterGrade}
            onChange={e => setFilterGrade(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
          >
            <option value="">전체 학년</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          {(filterSchool || filterGrade) && (
            <button onClick={() => { setFilterSchool(''); setFilterGrade(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--destructive)', fontWeight: 600 }}>
              초기화
            </button>
          )}
        </div>
      )}

      {/* 클리닉 입력 폼 */}
      {showCreateForm && (
        <div className="card" style={{ padding: 16, marginBottom: 12, border: '2px solid oklch(52% 0.14 160)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>✏️ 클리닉 입력 (학생 대신 등록)</h3>
            <button onClick={() => setShowCreateForm(false)} style={{
              background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--muted-foreground)'
            }}>✕</button>
          </div>

          {/* 학생 선택 */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4, display: 'block' }}>학생 선택</label>
            <input
              placeholder="학생 이름 또는 학교로 검색..."
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, marginBottom: 6 }}
            />
            {createForm.student_id ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                background: 'var(--success-light)', borderRadius: 6, fontSize: 13
              }}>
                <span style={{ fontWeight: 600 }}>
                  ✅ {allStudents.find(s => s.id === createForm.student_id)?.name}
                </span>
                <span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>
                  {allStudents.find(s => s.id === createForm.student_id)?.school}{' '}
                  {allStudents.find(s => s.id === createForm.student_id)?.grade}
                </span>
                <button onClick={() => { setCreateForm({ ...createForm, student_id: '' }); setStudentSearch(''); }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
            ) : (
              <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                {filteredStudents.slice(0, 30).map(s => (
                  <div key={s.id} onClick={() => { setCreateForm({ ...createForm, student_id: s.id }); setStudentSearch(s.name); }}
                    style={{
                      padding: '6px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    <span style={{ color: 'var(--muted-foreground)', marginLeft: 6, fontSize: 11 }}>{s.school} {s.grade}</span>
                  </div>
                ))}
                {filteredStudents.length === 0 && (
                  <div style={{ padding: 10, color: 'var(--muted-foreground)', fontSize: 12, textAlign: 'center' }}>검색 결과 없음</div>
                )}
              </div>
            )}
          </div>

          {/* 날짜, 시간, 주제 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4, display: 'block' }}>날짜</label>
              <input type="date" value={createForm.appointment_date}
                onChange={e => setCreateForm({ ...createForm, appointment_date: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4, display: 'block' }}>시간</label>
              <select value={createForm.time_slot}
                onChange={e => setCreateForm({ ...createForm, time_slot: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
              >
                <option value="">시간 선택</option>
                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4, display: 'block' }}>주제</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TOPICS.map(t => (
                <button key={t} onClick={() => setCreateForm({ ...createForm, topic: t })}
                  style={{
                    padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    border: createForm.topic === t ? '2px solid oklch(52% 0.14 160)' : '1px solid var(--border)',
                    background: createForm.topic === t ? 'var(--success-light)' : 'var(--card)',
                    fontWeight: createForm.topic === t ? 700 : 400,
                  }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4, display: 'block' }}>상세 내용 (선택)</label>
            <textarea value={createForm.detail}
              onChange={e => setCreateForm({ ...createForm, detail: e.target.value })}
              placeholder="클리닉 세부 내용을 입력하세요..."
              rows={2}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setShowCreateForm(false)}>취소</button>
            <button className="btn" onClick={handleCreate} disabled={creating}
              style={{ background: 'oklch(52% 0.14 160)', color: 'white', border: 'none', fontWeight: 700 }}>
              {creating ? '등록 중...' : '클리닉 등록'}
            </button>
          </div>
        </div>
      )}

      {/* 캘린더 뷰 */}
      {view === 'calendar' && !selectedDate && (
        <div className="card" style={{ padding: isLg ? 24 : 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLg ? 20 : 16 }}>
            <button className="btn btn-outline btn-sm" onClick={prevMonth}>&lt;</button>
            <h2 style={{ margin: 0, fontSize: isLg ? 22 : 18 }}>{currentYear}년 {currentMonth}월</h2>
            <button className="btn btn-outline btn-sm" onClick={nextMonth}>&gt;</button>
          </div>

          {/* 요일 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isLg ? 4 : 2, marginBottom: isLg ? 6 : 4 }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{
                textAlign: 'center', fontSize: isLg ? 14 : 12, fontWeight: 700,
                color: d === '일' ? 'var(--destructive)' : d === '토' ? 'var(--info)' : 'var(--muted-foreground)',
                padding: isLg ? '6px 0' : '4px 0'
              }}>{d}</div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isLg ? 4 : 2 }}>
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;
              const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayAppts = getDateAppts(day);
              const isToday = dateStr === todayStr;
              const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();

              return (
                <div key={day} onClick={() => dayAppts.length > 0 ? setSelectedDate(dateStr) : null}
                  style={{
                    minHeight: isLg ? 90 : 70, padding: isLg ? '5px' : '3px', borderRadius: 6, cursor: dayAppts.length > 0 ? 'pointer' : 'default',
                    border: isToday ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: dayAppts.length > 0 ? 'var(--background)' : 'var(--card)',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                  }}>
                  <div style={{
                    fontSize: isLg ? 14 : 11, fontWeight: isToday ? 800 : 500, textAlign: 'center', marginBottom: isLg ? 4 : 2,
                    color: dayOfWeek === 0 ? 'var(--destructive)' : dayOfWeek === 6 ? 'var(--info)' : 'var(--foreground)'
                  }}>{day}</div>
                  {dayAppts.sort((a, b) => a.time_slot.localeCompare(b.time_slot)).slice(0, 3).map(a => {
                    const st = STATUS_MAP[a.status] || STATUS_MAP.pending;
                    return (
                      <div key={a.id} style={{
                        fontSize: isLg ? 11 : 9, lineHeight: isLg ? '16px' : '13px', padding: isLg ? '2px 3px' : '1px 2px', marginBottom: 1,
                        borderRadius: 3, background: st.bg, color: st.color,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {a.time_slot.slice(0, 5)} {a.student_name}
                        {a.attended === true && ' ✓'}
                        {a.attended === false && ' ✗'}
                      </div>
                    );
                  })}
                  {dayAppts.length > 3 && (
                    <div style={{ fontSize: isLg ? 10 : 8, color: 'var(--muted-foreground)', textAlign: 'center' }}>+{dayAppts.length - 3}건</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 범례 */}
          <div style={{ display: 'flex', gap: isLg ? 16 : 12, marginTop: isLg ? 16 : 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {Object.entries(STATUS_MAP).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: isLg ? 13 : 11, color: 'var(--muted-foreground)' }}>
                <div style={{ width: isLg ? 10 : 8, height: isLg ? 10 : 8, borderRadius: 2, background: val.border }} /> {val.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 선택 날짜 상세 */}
      {view === 'calendar' && selectedDate && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>📅 {formatDate(selectedDate)} 클리닉</h2>
            <button className="btn btn-outline btn-sm" onClick={() => setSelectedDate(null)}>← 캘린더</button>
          </div>
          {filteredAppointments.filter(a => a.appointment_date === selectedDate)
            .sort((a, b) => a.time_slot.localeCompare(b.time_slot))
            .map(a => renderAppointmentCard(a, false))}
          {filteredAppointments.filter(a => a.appointment_date === selectedDate).length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: 20 }}>이 날짜에 클리닉 신청이 없습니다.</p>
          )}
        </div>
      )}

      {/* 목록 뷰 */}
      {view === 'list' && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <button className="btn btn-outline btn-sm" onClick={prevMonth}>&lt; 이전달</button>
            <h2 style={{ margin: 0, fontSize: 16 }}>{currentYear}년 {currentMonth}월</h2>
            <button className="btn btn-outline btn-sm" onClick={nextMonth}>다음달 &gt;</button>
          </div>
          {filteredAppointments.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: 30 }}>이번 달 클리닉 신청이 없습니다.</p>
          ) : (
            filteredAppointments
              .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date) || a.time_slot.localeCompare(b.time_slot))
              .map(a => renderAppointmentCard(a))
          )}
        </div>
      )}

      {/* 학생별 뷰 */}
      {view === 'students' && (
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: 16 }}>👤 학생별 클리닉</h2>
          {studentList.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: 30 }}>클리닉 데이터가 없습니다.</p>
          ) : (
            studentList.map(s => (
              <div key={s.id} onClick={() => loadStudentHistory(s.id)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)',
                marginBottom: 6, cursor: 'pointer', transition: 'background 0.2s'
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--background)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--card)'}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)', marginLeft: 6 }}>{s.school} {s.grade}</span>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 10,
                  background: 'oklch(92% 0.04 280)', color: 'oklch(28% 0.10 280)'
                }}>{s.count}회</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* 모달 렌더링 */}
      {renderDetailModal()}
      {renderStudentHistoryModal()}
    </div>
  );
}
