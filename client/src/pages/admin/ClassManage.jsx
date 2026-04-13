import { useState, useEffect } from 'react';
import { api, apiPost, apiPut, apiDelete } from '../../api';

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
    if (!window.confirm('이 반을 종료하시겠습니까?')) return;
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
    if (!detail || !window.confirm('수강을 취소하시겠습니까?')) return;
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

  if (loading) return <div className="main-content" style={{ padding: 20 }}>로딩 중...</div>;

  return (
    <div className="main-content" style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5em', fontWeight: 800, marginBottom: 20 }}>수업 관리</h2>

      {msg && (
        <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--success-light)', color: 'oklch(52% 0.14 160)', marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
          {msg}
        </div>
      )}

      {/* 필터 + 추가 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }}>
            <option value="">전체 유형</option>
            {CLASS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }}>
            <option value="">전체 상태</option>
            <option value="active">운영중</option>
            <option value="paused">일시정지</option>
            <option value="closed">종료</option>
          </select>
        </div>
        <button onClick={() => { setShowForm(true); setEditingClass(null); setForm({ name: '', class_type: 'regular', subject: '', teacher_id: '', capacity: '', room: '', start_date: '', end_date: '', memo: '' }); }}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13 }}>
          + 반 추가
        </button>
      </div>

      {/* 반 카드 목록 */}
      {classes.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--neutral-500)', background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)' }}>
          등록된 반이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {classes.map(cls => (
            <div key={cls.id} onClick={() => openDetail(cls.id)} style={{
              background: 'var(--card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)',
              cursor: 'pointer', transition: 'box-shadow 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px oklch(0% 0 0 / 0.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{cls.name}</span>
                  <span style={{
                    marginLeft: 8, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                    background: badgeColor(cls.class_type) + '20', color: badgeColor(cls.class_type),
                  }}>
                    {CLASS_TYPES.find(t => t.value === cls.class_type)?.label || cls.class_type}
                  </span>
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                  background: cls.status === 'active' ? 'var(--success-light)' : 'var(--muted)',
                  color: cls.status === 'active' ? 'oklch(52% 0.14 160)' : 'var(--neutral-500)',
                }}>
                  {statusLabel(cls.status)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--neutral-600)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {cls.subject && <div>과목: {cls.subject}</div>}
                {cls.teacher_name && <div>강사: {cls.teacher_name}</div>}
                {cls.room && <div>강의실: {cls.room}</div>}
                <div>정원: {cls.current_count || 0}{cls.capacity ? ` / ${cls.capacity}명` : '명'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button onClick={e => { e.stopPropagation(); openEdit(cls); }}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: 'white', fontSize: 12, fontFamily: 'inherit' }}>수정</button>
                {cls.status !== 'closed' && (
                  <button onClick={e => { e.stopPropagation(); handleClose(cls.id); }}
                    style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--destructive-light)', color: 'oklch(48% 0.20 25)', fontSize: 12, fontFamily: 'inherit' }}>종료</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 반 생성/수정 모달 */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowForm(false)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{editingClass ? '반 수정' : '반 추가'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input placeholder="반 이름 *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }} />
              <select value={form.class_type} onChange={e => setForm({ ...form, class_type: e.target.value })}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }}>
                {CLASS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input placeholder="과목" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }} />
              <input placeholder="정원" type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }} />
              <input placeholder="강의실" value={form.room} onChange={e => setForm({ ...form, room: e.target.value })}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: 'var(--neutral-500)' }}>시작일</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: 'var(--neutral-500)' }}>종료일</label>
                  <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              </div>
              <textarea placeholder="메모" value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })}
                rows={3} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'white', fontSize: 14, fontFamily: 'inherit' }}>취소</button>
              <button onClick={handleSave}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 14 }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 반 상세 모달 */}
      {showDetail && detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowDetail(false)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>{detail.name}</h3>
              <button onClick={() => setShowDetail(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--neutral-500)' }}>X</button>
            </div>

            {/* 기본 정보 */}
            <div style={{ fontSize: 14, color: 'var(--neutral-600)', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
              <span>유형: {CLASS_TYPES.find(t => t.value === detail.class_type)?.label}</span>
              {detail.subject && <span>과목: {detail.subject}</span>}
              {detail.teacher_name && <span>강사: {detail.teacher_name}</span>}
              {detail.room && <span>강의실: {detail.room}</span>}
              <span>정원: {detail.current_count || 0}{detail.capacity ? ` / ${detail.capacity}` : ''}명</span>
            </div>

            {/* 수강생 관리 */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>수강생 ({detail.students?.length || 0}명)</h4>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select value={enrollStudentId} onChange={e => setEnrollStudentId(e.target.value)}
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }}>
                  <option value="">학생 선택</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school})</option>)}
                </select>
                <button onClick={handleEnroll}
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13 }}>등록</button>
              </div>
              {detail.students?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {detail.students.map(s => (
                    <div key={s.student_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--muted)', borderRadius: 8, fontSize: 13 }}>
                      <span>{s.student_name} ({s.school} {s.grade})</span>
                      <button onClick={() => handleDrop(s.student_id)}
                        style={{ padding: '2px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--destructive-light)', color: 'oklch(48% 0.20 25)', fontSize: 11, fontFamily: 'inherit' }}>해제</button>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 13, color: 'var(--neutral-500)' }}>등록된 수강생이 없습니다.</div>}
            </div>

            {/* 반복 일정 */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>반복 일정</h4>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <select value={recurForm.day_of_week} onChange={e => setRecurForm({ ...recurForm, day_of_week: parseInt(e.target.value) })}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }}>
                  {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}요일</option>)}
                </select>
                <input type="time" value={recurForm.start_time} onChange={e => setRecurForm({ ...recurForm, start_time: e.target.value })}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }} />
                <input type="time" value={recurForm.end_time} onChange={e => setRecurForm({ ...recurForm, end_time: e.target.value })}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }} />
                <button onClick={handleAddRecurring}
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13 }}>추가</button>
              </div>
              {detail.recurring?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {detail.recurring.map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--muted)', borderRadius: 8, fontSize: 13 }}>
                      <span>{DAY_LABELS[r.day_of_week]}요일 {r.start_time?.slice(0, 5)} ~ {r.end_time?.slice(0, 5)}</span>
                      <button onClick={() => handleDeleteRecurring(r.id)}
                        style={{ padding: '2px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--destructive-light)', color: 'oklch(48% 0.20 25)', fontSize: 11, fontFamily: 'inherit' }}>삭제</button>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 13, color: 'var(--neutral-500)' }}>반복 일정이 없습니다.</div>}
            </div>

            {/* 세션 생성 */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>수업 세션</h4>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <input type="date" value={sessionRange.from} onChange={e => setSessionRange({ ...sessionRange, from: e.target.value })}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }} />
                <span style={{ alignSelf: 'center', fontSize: 13 }}>~</span>
                <input type="date" value={sessionRange.to} onChange={e => setSessionRange({ ...sessionRange, to: e.target.value })}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }} />
                <button onClick={handleGenerateSessions}
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'oklch(55% 0.15 250)', color: 'white', fontWeight: 600, fontSize: 13 }}>자동 생성</button>
              </div>
              {detail.sessions?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {detail.sessions.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--muted)', borderRadius: 8, fontSize: 13 }}>
                      <span>
                        {s.session_date?.slice(0, 10)} {s.start_time?.slice(0, 5)}~{s.end_time?.slice(0, 5)}
                        {s.is_makeup && <span style={{ marginLeft: 4, color: '#f59e0b', fontWeight: 600 }}>[보강]</span>}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: s.status === 'scheduled' ? 'var(--info-light)' : s.status === 'cancelled' ? 'var(--destructive-light)' : 'var(--success-light)',
                        color: s.status === 'scheduled' ? 'oklch(48% 0.18 260)' : s.status === 'cancelled' ? 'oklch(48% 0.20 25)' : 'oklch(52% 0.14 160)',
                      }}>
                        {s.status === 'scheduled' ? '예정' : s.status === 'completed' ? '완료' : s.status === 'cancelled' ? '휴강' : s.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 13, color: 'var(--neutral-500)' }}>세션이 없습니다. 반복 일정을 추가하고 자동 생성하세요.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
