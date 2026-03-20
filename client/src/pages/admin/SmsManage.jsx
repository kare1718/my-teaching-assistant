import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { SCHOOLS, getAllGrades } from '../../config';

export default function SmsManage() {
  const schools = SCHOOLS;
  const studentSchools = SCHOOLS.filter(s => s.name !== '조교' && s.name !== '선생님');
  const navigate = useNavigate();
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  // 대상 선택
  const [targetType, setTargetType] = useState('student');
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [selectAll, setSelectAll] = useState(true);
  const [customPhone, setCustomPhone] = useState('');

  // 메시지
  const [message, setMessage] = useState('');
  const [templates, setTemplates] = useState([]);
  const [editTmpl, setEditTmpl] = useState(null);

  // 시험 성적 (템플릿 변수용)
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');

  // 발송 전 확인 모달 (메시지 수정 가능)
  const [confirmModal, setConfirmModal] = useState(null); // {messages: [{phone, message, name, ...}]}

  useEffect(() => {
    api('/sms/status').then(d => { setConfigured(d.configured); setLoading(false); }).catch(() => setLoading(false));
    api('/sms/templates').then(setTemplates).catch(console.error);
    api('/scores/exams').then(setExams).catch(console.error);
  }, []);

  useEffect(() => {
    if (targetType === 'custom') return;
    const params = new URLSearchParams();
    if (school) params.set('school', school);
    if (grade) params.set('grade', grade);
    api(`/sms/recipients?${params}`).then(data => {
      setRecipients(data);
      if (selectAll) setSelected(new Set(data.map(r => r.id)));
    }).catch(console.error);
  }, [targetType, school, grade]);

  const toggleSelectAll = () => {
    if (selectAll) setSelected(new Set());
    else setSelected(new Set(recipients.map(r => r.id)));
    setSelectAll(!selectAll);
  };

  const toggleOne = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
    setSelectAll(next.size === recipients.length);
  };

  const selectedRecipients = recipients.filter(r => selected.has(r.id));
  const getPhone = (r) => targetType === 'parent' ? r.parent_phone : r.phone;
  const validRecipients = selectedRecipients.filter(r => getPhone(r));

  // 클리닉 내용 포매팅
  const formatClinicInfo = (clinics) => {
    if (!clinics || clinics.length === 0) return '(클리닉 기록 없음)';
    return clinics.map(c => {
      const parts = [];
      parts.push(`- ${c.appointment_date} ${c.time_slot}`);
      if (c.topic) parts[0] += ` [${c.topic}]`;
      if (c.admin_note) parts.push(`  결과: ${c.admin_note}`);
      if (c.detail) parts.push(`  내용: ${c.detail}`);
      return parts.join('\n');
    }).join('\n');
  };

  // 템플릿 변수 치환
  const applyTemplate = (tmplContent, student, examData, clinicInfo) => {
    let text = tmplContent;
    if (student) {
      text = text.replace(/\{\{학생이름\}\}/g, student.name || '');
      text = text.replace(/\{\{학교\}\}/g, student.school || '');
      text = text.replace(/\{\{학년\}\}/g, student.grade || '');
    }
    if (examData) {
      text = text.replace(/\{\{시험명\}\}/g, examData.exam_name || '');
      text = text.replace(/\{\{점수\}\}/g, examData.score != null ? String(examData.score) : '');
      text = text.replace(/\{\{만점\}\}/g, examData.max_score != null ? String(examData.max_score) : '');
      text = text.replace(/\{\{등수\}\}/g, examData.rank_num != null ? String(examData.rank_num) : '');
      text = text.replace(/\{\{총인원\}\}/g, examData.total_students != null ? String(examData.total_students) : '');
    }
    if (clinicInfo) {
      text = text.replace(/\{\{클리닉내용\}\}/g, clinicInfo);
    }
    text = text.replace(/\{\{날짜\}\}/g, new Date().toLocaleDateString('ko-KR'));
    return text;
  };

  const selectTemplate = (tmpl) => setMessage(tmpl.content);

  // 발송 전 확인 - 메시지 미리보기
  const preparePreview = async () => {
    if (!message.trim()) { setMsg('메시지를 입력해주세요.'); return; }

    if (targetType === 'custom') {
      if (!customPhone.trim()) { setMsg('전화번호를 입력해주세요.'); return; }
      setConfirmModal({
        messages: [{ phone: customPhone.replace(/[^0-9]/g, ''), message, name: '직접입력' }],
      });
      return;
    }

    if (validRecipients.length === 0) { setMsg('발송 대상이 없습니다.'); return; }

    // 시험 성적 변수
    const hasExamVars = /\{\{(시험명|점수|만점|등수|총인원)\}\}/.test(message);
    let examScoresMap = {};
    if (hasExamVars && selectedExam) {
      try {
        const scores = await api(`/scores/exams/${selectedExam}/scores`);
        scores.forEach(s => { examScoresMap[s.student_id] = s; });
        const exam = exams.find(e => e.id === parseInt(selectedExam));
        if (exam) Object.values(examScoresMap).forEach(s => { s.exam_name = exam.name; s.max_score = exam.max_score; });
      } catch (e) { console.error(e); }
    }

    // 클리닉 변수
    const hasClinicVars = /\{\{클리닉내용\}\}/.test(message);
    let clinicMap = {}; // studentId -> [appointments]
    if (hasClinicVars) {
      try {
        const ids = validRecipients.map(r => r.id).join(',');
        const clinics = await api(`/sms/clinic-appointments?studentIds=${ids}`);
        clinics.forEach(c => {
          if (!clinicMap[c.student_id]) clinicMap[c.student_id] = [];
          clinicMap[c.student_id].push(c);
        });
        // 학생별 최근 3건만
        Object.keys(clinicMap).forEach(k => { clinicMap[k] = clinicMap[k].slice(0, 3); });
      } catch (e) { console.error(e); }
    }

    const preview = validRecipients.map(r => {
      const examData = examScoresMap[r.id] || null;
      const clinicInfo = hasClinicVars ? formatClinicInfo(clinicMap[r.id]) : null;
      const personalMsg = applyTemplate(message, r, examData, clinicInfo);
      return { phone: getPhone(r), message: personalMsg, name: r.name, school: r.school, grade: r.grade };
    });

    setConfirmModal({ messages: preview });
  };

  // 확인 모달에서 개별 메시지 수정
  const updateModalMessage = (index, newMsg) => {
    setConfirmModal(prev => {
      const msgs = [...prev.messages];
      msgs[index] = { ...msgs[index], message: newMsg };
      return { messages: msgs };
    });
  };

  // 실제 발송
  const handleSend = async () => {
    if (!confirmModal) return;
    setSending(true);
    setMsg('');
    try {
      const allSame = confirmModal.messages.every(m => m.message === confirmModal.messages[0].message);
      if (allSame && confirmModal.messages.length > 1) {
        const result = await apiPost('/sms/send-bulk', {
          targetType: 'custom',
          recipients: confirmModal.messages.map(m => m.phone),
          message: confirmModal.messages[0].message,
        });
        setMsg(result.message);
      } else {
        const result = await apiPost('/sms/send-individual', { messages: confirmModal.messages });
        setMsg(result.message);
      }
    } catch (e) {
      setMsg('발송 실패: ' + e.message);
    }
    setSending(false);
    setConfirmModal(null);
  };

  // 템플릿 CRUD
  const saveTmpl = async () => {
    if (!editTmpl || !editTmpl.name || !editTmpl.content) return;
    try {
      if (editTmpl.id === 'new') await apiPost('/sms/templates', { name: editTmpl.name, content: editTmpl.content });
      else await apiPut(`/sms/templates/${editTmpl.id}`, { name: editTmpl.name, content: editTmpl.content });
      setTemplates(await api('/sms/templates'));
      setEditTmpl(null);
    } catch (e) { alert(e.message); }
  };

  const deleteTmpl = async (id) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;
    await apiDelete(`/sms/templates/${id}`);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const grades = school ? getAllGrades(school) : [];

  if (loading) return <div className="content"><div className="card" style={{ padding: 24, textAlign: 'center' }}>로딩 중...</div></div>;

  return (
    <div className="content">
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, margin: 0 }}>📱 문자 발송</h2>
      </div>

      {!configured && (
        <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8, marginBottom: 8, border: '1px solid #fbbf24', fontSize: 13, color: '#92400e' }}>
          ⚠️ SMS 설정이 필요합니다. 서버 .env에 SOLAPI 키를 설정해주세요.
        </div>
      )}

      {/* 1. 발송 대상 */}
      <div className="card" style={{ padding: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📋 발송 대상</h3>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[
            { id: 'student', label: '👤 학생' },
            { id: 'parent', label: '👨‍👩‍👧 학부모' },
            { id: 'custom', label: '✏️ 직접입력' },
          ].map(t => (
            <button key={t.id} onClick={() => { setTargetType(t.id); setSelected(new Set()); setSelectAll(false); }} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13,
              background: targetType === t.id ? 'var(--primary)' : 'var(--muted)',
              color: targetType === t.id ? 'white' : 'var(--foreground)',
            }}>{t.label}</button>
          ))}
        </div>

        {targetType !== 'custom' && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <select value={school} onChange={e => { setSchool(e.target.value); setGrade(''); }}
                style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                <option value="">전체 학교</option>
                {studentSchools.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
              <select value={grade} onChange={e => setGrade(e.target.value)}
                style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                <option value="">전체 학년</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 250, overflowY: 'auto', overflowX: 'hidden' }}>
              <div onClick={toggleSelectAll} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                background: '#f8fafc', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, position: 'sticky', top: 0, zIndex: 1,
              }}>
                <input type="checkbox" checked={selectAll} readOnly style={{ accentColor: 'var(--primary)', flexShrink: 0, width: 16, height: 16 }} />
                <span>전체 선택 ({selected.size}/{recipients.length})</span>
              </div>
              {recipients.map(r => {
                const phone = getPhone(r);
                return (
                  <div key={r.id} onClick={() => toggleOne(r.id)} style={{
                    display: 'flex', alignItems: 'center', padding: '7px 12px',
                    borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 13,
                    background: selected.has(r.id) ? '#eff6ff' : 'white', gap: 8, minWidth: 0,
                  }}>
                    <input type="checkbox" checked={selected.has(r.id)} readOnly style={{ accentColor: 'var(--primary)', flexShrink: 0, width: 16, height: 16 }} />
                    <span style={{ fontWeight: 600, flexShrink: 0, minWidth: 40 }}>{r.name}</span>
                    <span style={{ color: 'var(--muted-foreground)', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.school} {r.grade}</span>
                    <span style={{ color: phone ? '#166534' : '#dc2626', fontSize: 11, flexShrink: 0 }}>
                      {phone || '번호없음'}
                    </span>
                  </div>
                );
              })}
              {recipients.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>학생이 없습니다.</div>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>
              선택: {selected.size}명 · 유효 번호: {validRecipients.length}명
            </div>
          </>
        )}

        {targetType === 'custom' && (
          <input placeholder="전화번호 (예: 010-1234-5678)" value={customPhone}
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9]/g, '');
              let f = raw;
              if (raw.length <= 3) f = raw;
              else if (raw.length <= 7) f = raw.slice(0,3)+'-'+raw.slice(3);
              else f = raw.slice(0,3)+'-'+raw.slice(3,7)+'-'+raw.slice(7,11);
              setCustomPhone(f);
            }}
            maxLength={13}
            style={{ width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
        )}
      </div>

      {/* 2. 템플릿 */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>📝 템플릿</h3>
          <button onClick={() => setEditTmpl({ id: 'new', name: '', content: '' })}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--muted)', cursor: 'pointer' }}>
            + 새 템플릿
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {templates.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button onClick={() => selectTemplate(t)} style={{
                padding: '6px 12px', borderRadius: '6px 0 0 6px', border: '1px solid var(--border)',
                background: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontWeight: 500,
              }}>{t.name}</button>
              <button onClick={() => setEditTmpl({ ...t })} style={{
                padding: '6px 6px', borderRadius: 0, border: '1px solid var(--border)', borderLeft: 'none',
                background: '#eff6ff', fontSize: 11, cursor: 'pointer', color: '#2563eb',
              }}>✏️</button>
              <button onClick={() => deleteTmpl(t.id)} style={{
                padding: '6px 6px', borderRadius: '0 6px 6px 0', border: '1px solid var(--border)', borderLeft: 'none',
                background: '#fef2f2', fontSize: 11, cursor: 'pointer', color: '#dc2626',
              }}>🗑</button>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', background: '#f8fafc', padding: 8, borderRadius: 6, lineHeight: 1.8 }}>
          <strong>사용 가능한 변수:</strong><br/>
          기본: {'{{학생이름}}'} {'{{학교}}'} {'{{학년}}'} {'{{날짜}}'} {'{{내용}}'}<br/>
          시험: {'{{시험명}}'} {'{{점수}}'} {'{{만점}}'} {'{{등수}}'} {'{{총인원}}'}<br/>
          클리닉: {'{{클리닉내용}}'} <span style={{ color: '#2563eb' }}>← 학생별 클리닉 기록 자동 입력</span>
        </div>
      </div>

      {/* 템플릿 편집 모달 */}
      {editTmpl && (
        <>
          <div onClick={() => setEditTmpl(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', borderRadius: 16, padding: 20, width: 340, zIndex: 301, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>{editTmpl.id === 'new' ? '새 템플릿' : '템플릿 수정'}</h3>
            <label style={{ fontSize: 12, fontWeight: 600 }}>이름</label>
            <input value={editTmpl.name} onChange={e => setEditTmpl({ ...editTmpl, name: e.target.value })}
              placeholder="예: 클리닉 결과 안내"
              style={{ width: '100%', padding: 8, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, fontSize: 13, boxSizing: 'border-box' }} />
            <label style={{ fontSize: 12, fontWeight: 600 }}>내용</label>
            <textarea value={editTmpl.content} onChange={e => setEditTmpl({ ...editTmpl, content: e.target.value })}
              rows={6} placeholder={'[강인한 국어] {{학생이름}} 학생 클리닉 안내\n\n{{클리닉내용}}\n\n감사합니다.'}
              style={{ width: '100%', padding: 8, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 10, background: '#f8fafc', padding: 6, borderRadius: 4 }}>
              {'{{학생이름}} {{학교}} {{학년}} {{날짜}} {{시험명}} {{점수}} {{만점}} {{등수}} {{총인원}} {{내용}} {{클리닉내용}}'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setEditTmpl(null)} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={saveTmpl} style={{ flex: 1 }}>저장</button>
            </div>
          </div>
        </>
      )}

      {/* 3. 시험 선택 (성적 변수용) - 선택된 학교/학년에 맞는 시험만 표시 */}
      {/\{\{(시험명|점수|만점|등수|총인원)\}\}/.test(message) && (() => {
        const filteredExams = exams.filter(e => {
          if (school && e.school && e.school !== school) return false;
          if (grade && e.grade && e.grade !== grade) return false;
          return true;
        });
        return (
          <div className="card" style={{ padding: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📊 시험 선택 (성적 자동 입력)</h3>
            {school && <div style={{ fontSize: 11, color: '#2563eb', marginBottom: 6 }}>📌 {school} {grade || '전체 학년'} 관련 시험만 표시</div>}
            <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
              style={{ width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
              <option value="">시험을 선택하세요</option>
              {filteredExams.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.exam_date || '날짜 미정'}){e.school ? ` [${e.school}]` : ''}</option>
              ))}
            </select>
            {filteredExams.length === 0 && (
              <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>해당 조건에 맞는 시험이 없습니다.</div>
            )}
          </div>
        );
      })()}

      {/* 클리닉 변수 안내 */}
      {/\{\{클리닉내용\}\}/.test(message) && (
        <div className="card" style={{ padding: 14, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af', marginBottom: 4 }}>🏥 클리닉 내용 자동 입력 모드</div>
          <div style={{ fontSize: 12, color: '#1e3a5f', lineHeight: 1.6 }}>
            "발송 미리보기"를 누르면 각 학생의 최근 클리닉 기록(날짜, 시간, 주제, 관리자 메모)이 자동으로 입력됩니다.
            미리보기에서 메시지를 개별 수정할 수 있습니다.
          </div>
        </div>
      )}

      {/* 4. 메시지 입력 */}
      <div className="card" style={{ padding: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>💬 메시지</h3>
        <textarea
          placeholder="문자 내용을 입력하세요... (템플릿을 선택하거나 직접 입력)"
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={10}
          style={{ resize: 'vertical', width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            {message.length > 90 ? 'LMS (장문)' : 'SMS (단문)'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{message.length}/2000자</span>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: msg.includes('완료') || msg.includes('성공') ? '#f0fdf4' : '#fef2f2',
          color: msg.includes('완료') || msg.includes('성공') ? '#166534' : '#dc2626',
          border: `1px solid ${msg.includes('완료') || msg.includes('성공') ? '#bbf7d0' : '#fecaca'}`
        }}>{msg}</div>
      )}

      <button className="btn btn-primary" onClick={preparePreview}
        disabled={sending || !configured}
        style={{ width: '100%', padding: 14, fontSize: 15, marginTop: 4 }}>
        📱 발송 미리보기 ({targetType === 'custom' ? (customPhone ? 1 : 0) : validRecipients.length}건)
      </button>

      {/* 발송 확인 모달 (메시지 개별 수정 가능) */}
      {confirmModal && (
        <>
          <div onClick={() => setConfirmModal(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: 'white', borderRadius: 16, padding: 20, width: '90%', maxWidth: 500, maxHeight: '85vh',
            zIndex: 301, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column',
          }}>
            <h3 style={{ fontSize: 16, marginBottom: 4, flexShrink: 0 }}>📱 발송 확인</h3>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 8, flexShrink: 0 }}>
              총 <strong>{confirmModal.messages.length}건</strong> · 각 메시지를 클릭하면 수정할 수 있습니다
            </p>

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {confirmModal.messages.map((m, i) => (
                <div key={i} style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ fontWeight: 700 }}>{m.name} {m.school ? `(${m.school} ${m.grade})` : ''}</span>
                    <span style={{ color: 'var(--muted-foreground)' }}>{m.phone}</span>
                  </div>
                  <textarea
                    value={m.message}
                    onChange={e => updateModalMessage(i, e.target.value)}
                    rows={Math.max(3, m.message.split('\n').length + 1)}
                    style={{
                      width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0',
                      fontSize: 12, lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box',
                      background: '#f8fafc',
                    }}
                  />
                  <div style={{ fontSize: 10, color: 'var(--muted-foreground)', textAlign: 'right', marginTop: 2 }}>
                    {m.message.length}자 {m.message.length > 90 ? '(LMS)' : '(SMS)'}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexShrink: 0 }}>
              <button className="btn btn-outline" onClick={() => setConfirmModal(null)} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={handleSend} disabled={sending} style={{ flex: 1 }}>
                {sending ? '전송 중...' : `📱 ${confirmModal.messages.length}건 발송`}
              </button>
            </div>
          </div>
        </>
      )}

      <button className="btn btn-outline" onClick={() => navigate('/admin')}
        style={{ width: '100%', marginTop: 8 }}>← 대시보드</button>
    </div>
  );
}
