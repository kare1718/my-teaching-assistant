import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const STATUS_MAP = {
  pending: { text: '대기', bg: 'var(--warning-light)', color: 'oklch(35% 0.12 75)', border: 'var(--warning)' },
  approved: { text: '승인', bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)', border: 'var(--success)' },
  rejected: { text: '거절', bg: 'var(--destructive-light)', color: 'oklch(35% 0.15 25)', border: 'var(--destructive)' },
  completed: { text: '완료', bg: 'oklch(92% 0.04 280)', color: 'oklch(28% 0.10 280)', border: 'oklch(50% 0.20 280)' },
};

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'
];

const TOPICS = [
  '수업 내용 질문', '모의고사 분석', '학습 방법 상담',
  '진도 점검', '오답 분석', '보충 수업', '시험 대비', '재시험', '기타'
];

export default function ClinicManage() {
  const [appointments, setAppointments] = useState([]);
  const [view, setView] = useState('calendar'); // calendar | list | students
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [msg, setMsg] = useState('');
  const [noteForm, setNoteForm] = useState({});

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

  // 학생별 히스토리
  const [studentList, setStudentList] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentHistory, setStudentHistory] = useState([]);

  const load = () => {
    api(`/clinic/admin/all?year=${currentYear}&month=${currentMonth}`).then(setAppointments).catch(console.error);
  };
  useEffect(() => { load(); }, [currentYear, currentMonth]);

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
    setLoadingNotes(true);
    setLoadingHistory(true);
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
    return appointments.filter(a => a.appointment_date === dateStr);
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const pendingCount = appointments.filter(a => a.status === 'pending').length;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
  };

  const renderAppointmentCard = (a, showDate = true) => {
    const st = STATUS_MAP[a.status] || STATUS_MAP.pending;
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
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
            background: st.bg, color: st.color
          }}>{st.text}</span>
        </div>
        <div style={{ fontSize: 13, marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>📅 {showDate ? `${formatDate(a.appointment_date)} ` : ''}{a.time_slot}</span>
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
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

            {/* 기록 추가 */}
            <div style={{ display: 'flex', gap: 6 }}>
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="클리닉 내용을 기록하세요..."
                rows={2}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: 13, resize: 'vertical', fontFamily: 'inherit'
                }}
              />
              <button className="btn btn-primary btn-sm" onClick={addNote}
                disabled={!newNote.trim()} style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}>
                기록 추가
              </button>
            </div>
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

            {loadingHistory ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>로딩 중...</p>
            ) : detailStudentHistory.length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>이력이 없습니다.</p>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {detailStudentHistory.map(h => {
                  const hst = STATUS_MAP[h.status] || STATUS_MAP.pending;
                  const isCurrent = h.id === a.id;
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
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8,
                          background: hst.bg, color: hst.color
                        }}>{hst.text}</span>
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
              return (
                <div key={h.id} style={{
                  border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10,
                  borderLeft: `4px solid ${st.border}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>📅 {formatDate(h.appointment_date)} {h.time_slot}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                      background: st.bg, color: st.color
                    }}>{st.text}</span>
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>{h.topic}{h.detail ? ` — ${h.detail}` : ''}</div>
                  {h.admin_note && <div style={{ fontSize: 12, color: 'var(--primary)', marginBottom: 4 }}>💬 {h.admin_note}</div>}

                  {/* 누적 노트 */}
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
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>클리닉 관리</span>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      {/* 뷰 전환 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
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
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <button className="btn btn-outline btn-sm" onClick={prevMonth}>&lt;</button>
            <h2 style={{ margin: 0, fontSize: 18 }}>{currentYear}년 {currentMonth}월</h2>
            <button className="btn btn-outline btn-sm" onClick={nextMonth}>&gt;</button>
          </div>

          {/* 요일 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{
                textAlign: 'center', fontSize: 12, fontWeight: 700,
                color: d === '일' ? 'var(--destructive)' : d === '토' ? 'var(--info)' : 'var(--muted-foreground)',
                padding: '4px 0'
              }}>{d}</div>
            ))}
          </div>

          {/* 날짜 그리드 - 가시적 시간/이름 표시 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;
              const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayAppts = getDateAppts(day);
              const isToday = dateStr === todayStr;
              const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();

              return (
                <div key={day} onClick={() => dayAppts.length > 0 ? setSelectedDate(dateStr) : null}
                  style={{
                    minHeight: 70, padding: '3px', borderRadius: 6, cursor: dayAppts.length > 0 ? 'pointer' : 'default',
                    border: isToday ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: dayAppts.length > 0 ? 'var(--background)' : 'var(--card)',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                  }}>
                  <div style={{
                    fontSize: 11, fontWeight: isToday ? 800 : 500, textAlign: 'center', marginBottom: 2,
                    color: dayOfWeek === 0 ? 'var(--destructive)' : dayOfWeek === 6 ? 'var(--info)' : 'var(--foreground)'
                  }}>{day}</div>
                  {dayAppts.sort((a, b) => a.time_slot.localeCompare(b.time_slot)).slice(0, 3).map(a => {
                    const st = STATUS_MAP[a.status] || STATUS_MAP.pending;
                    return (
                      <div key={a.id} style={{
                        fontSize: 9, lineHeight: '13px', padding: '1px 2px', marginBottom: 1,
                        borderRadius: 3, background: st.bg, color: st.color,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {a.time_slot.slice(0, 5)} {a.student_name}
                      </div>
                    );
                  })}
                  {dayAppts.length > 3 && (
                    <div style={{ fontSize: 8, color: 'var(--muted-foreground)', textAlign: 'center' }}>+{dayAppts.length - 3}건</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 범례 */}
          <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {Object.entries(STATUS_MAP).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted-foreground)' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: val.border }} /> {val.text}
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
          {appointments.filter(a => a.appointment_date === selectedDate)
            .sort((a, b) => a.time_slot.localeCompare(b.time_slot))
            .map(a => renderAppointmentCard(a, false))}
          {appointments.filter(a => a.appointment_date === selectedDate).length === 0 && (
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
          {appointments.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: 30 }}>이번 달 클리닉 신청이 없습니다.</p>
          ) : (
            appointments
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
