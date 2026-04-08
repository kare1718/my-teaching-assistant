import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { useTenantConfig, getAllGrades } from '../../contexts/TenantContext';

// EUC-KR 바이트 수 계산 (서버와 동일 로직)
function getByteLength(text) {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 0x7F) bytes += 1;
    else bytes += 2;
  }
  return bytes;
}
function getMessageType(text) {
  return getByteLength(text) > 90 ? 'LMS' : 'SMS';
}

export default function SmsManage() {
  const { config } = useTenantConfig();
  const schools = config.schools || [];
  const studentSchools = (config.schools || []).filter(s => s.name !== '조교' && s.name !== '선생님');
  const navigate = useNavigate();
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  // 대상 선택
  const [targetType, setTargetType] = useState('parent');
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
  const [examStats, setExamStats] = useState(null);

  // 발송 전 확인 모달
  const [confirmModal, setConfirmModal] = useState(null);

  // === 크레딧 관련 상태 ===
  const [creditInfo, setCreditInfo] = useState(null); // { balance, total_charged, total_used }
  const [pricing, setPricing] = useState({ SMS: 13, LMS: 29, MMS: 60, ALIMTALK: 8 });
  const [chargeModal, setChargeModal] = useState(false);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDesc, setChargeDesc] = useState('');
  const [activeTab, setActiveTab] = useState('send'); // 'send' | 'history' | 'transactions'
  const [sendLogs, setSendLogs] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);

  const fetchCredits = () => api('/sms/credits').then(setCreditInfo).catch(console.error);

  useEffect(() => {
    api('/sms/status').then(d => { setConfigured(d.configured); setLoading(false); }).catch(() => setLoading(false));
    api('/sms/templates').then(setTemplates).catch(console.error);
    api('/scores/exams').then(setExams).catch(console.error);
    fetchCredits();
    api('/sms/pricing').then(setPricing).catch(console.error);
  }, []);

  // 이력 탭 로드
  useEffect(() => {
    if (activeTab === 'history') {
      api(`/sms/send-logs?page=${logPage}&limit=20`).then(d => {
        setSendLogs(d.logs); setLogTotal(d.total);
      }).catch(console.error);
    } else if (activeTab === 'transactions') {
      api(`/sms/credits/transactions?page=${txPage}&limit=20`).then(d => {
        setTransactions(d.transactions); setTxTotal(d.total);
      }).catch(console.error);
    }
  }, [activeTab, logPage, txPage]);

  // 시험에 성적이 있는 학생 ID 목록
  const [examStudentIds, setExamStudentIds] = useState(null);

  const handleExamSelect = async (examId) => {
    setSelectedExam(examId);
    if (!examId) { setExamStats(null); setExamStudentIds(null); return; }
    try {
      const scores = await api(`/scores/exams/${examId}/scores`);
      const exam = exams.find(e => e.id === parseInt(examId));
      if (scores.length > 0) {
        const scoreValues = scores.map(s => s.score).filter(s => s != null);
        const avg = scoreValues.length > 0 ? (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1) : '-';
        const max = scoreValues.length > 0 ? Math.max(...scoreValues) : '-';
        setExamStats({ avg, max, date: exam?.exam_date || '', name: exam?.name || '' });
        const studentIds = new Set(scores.map(s => s.student_id));
        setExamStudentIds(studentIds);
        setSelected(studentIds);
        setSelectAll(true);
      } else {
        setExamStudentIds(new Set());
        setSelected(new Set());
        setSelectAll(false);
      }
    } catch (e) { console.error(e); }
  };

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
    else setSelected(new Set(filteredRecipients.map(r => r.id)));
    setSelectAll(!selectAll);
  };

  const toggleOne = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
    setSelectAll(next.size === filteredRecipients.length);
  };

  const filteredRecipients = examStudentIds ? recipients.filter(r => examStudentIds.has(r.id)) : recipients;
  const selectedRecipients = filteredRecipients.filter(r => selected.has(r.id));
  const getPhone = (r) => targetType === 'parent' || targetType === 'both' ? r.parent_phone : r.phone;
  const validRecipients = targetType === 'both'
    ? selectedRecipients.filter(r => r.parent_phone || r.phone)
    : selectedRecipients.filter(r => getPhone(r));

  const formatClinicInfo = (clinics) => {
    if (!clinics || clinics.length === 0) return '(클리닉 기록 없음)';
    return clinics.map(c => {
      const parts = [];
      parts.push(`- ${c.appointment_date} ${c.time_slot} [${c.topic || '클리닉'}]`);
      if (c.detail) parts.push(`  상담 내용: ${c.detail}`);
      if (c.admin_note) parts.push(`  메모: ${c.admin_note}`);
      if (c.notes && c.notes.length > 0) {
        c.notes.forEach(n => { parts.push(`  ${n.author_name}: ${n.content}`); });
      }
      return parts.join('\n');
    }).join('\n');
  };

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
    if (examStats) {
      text = text.replace(/\{\{시험평균\}\}/g, examStats.avg || '');
      text = text.replace(/\{\{최고점\}\}/g, examStats.max || '');
      text = text.replace(/\{\{시험날짜\}\}/g, examStats.date || '');
    }
    if (clinicInfo) text = text.replace(/\{\{클리닉내용\}\}/g, clinicInfo);
    text = text.replace(/\{\{날짜\}\}/g, new Date().toLocaleDateString('ko-KR'));
    return text;
  };

  const selectTemplate = (tmpl) => setMessage(tmpl.content);

  // 비용 계산 헬퍼
  const calcCostPreview = (msgs) => {
    const breakdown = {};
    let total = 0;
    msgs.forEach(m => {
      const type = getMessageType(m.message);
      const cost = pricing[type] || 13;
      if (!breakdown[type]) breakdown[type] = { count: 0, unitCost: cost, subtotal: 0 };
      breakdown[type].count++;
      breakdown[type].subtotal += cost;
      total += cost;
    });
    return { total, breakdown };
  };

  // 발송 전 확인 - 메시지 미리보기
  const preparePreview = async () => {
    if (!message.trim()) { setMsg('메시지를 입력해주세요.'); return; }

    if (targetType === 'custom') {
      if (!customPhone.trim()) { setMsg('전화번호를 입력해주세요.'); return; }
      const msgs = [{ phone: customPhone.replace(/[^0-9]/g, ''), message, name: '직접입력' }];
      setConfirmModal({ messages: msgs, costPreview: calcCostPreview(msgs) });
      return;
    }

    if (validRecipients.length === 0) { setMsg('발송 대상이 없습니다.'); return; }

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

    const hasClinicVars = /\{\{클리닉내용\}\}/.test(message);
    let clinicMap = {};
    if (hasClinicVars) {
      try {
        const ids = validRecipients.map(r => r.id).join(',');
        const clinics = await api(`/sms/clinic-appointments?studentIds=${ids}`);
        clinics.forEach(c => {
          if (!clinicMap[c.student_id]) clinicMap[c.student_id] = [];
          clinicMap[c.student_id].push(c);
        });
        Object.keys(clinicMap).forEach(k => { clinicMap[k] = clinicMap[k].slice(0, 3); });
      } catch (e) { console.error(e); }
    }

    const preview = [];
    validRecipients.forEach(r => {
      const examData = examScoresMap[r.id] || null;
      const clinicInfo = hasClinicVars ? formatClinicInfo(clinicMap[r.id]) : null;
      const personalMsg = applyTemplate(message, r, examData, clinicInfo);
      if (targetType === 'both') {
        if (r.parent_phone) preview.push({ phone: r.parent_phone, message: personalMsg, name: r.name, school: r.school, grade: r.grade, tag: '학부모' });
        if (r.phone) preview.push({ phone: r.phone, message: personalMsg, name: r.name, school: r.school, grade: r.grade, tag: '학생' });
      } else {
        preview.push({ phone: getPhone(r), message: personalMsg, name: r.name, school: r.school, grade: r.grade });
      }
    });

    setConfirmModal({ messages: preview, costPreview: calcCostPreview(preview) });
  };

  const updateModalMessage = (index, newMsg) => {
    setConfirmModal(prev => {
      const msgs = [...prev.messages];
      msgs[index] = { ...msgs[index], message: newMsg };
      return { ...prev, messages: msgs, costPreview: calcCostPreview(msgs) };
    });
  };

  // 실제 발송
  const handleSend = async () => {
    if (!confirmModal) return;
    setSending(true);
    setMsg('');
    try {
      const allSame = confirmModal.messages.every(m => m.message === confirmModal.messages[0].message);
      let result;
      if (allSame && confirmModal.messages.length > 1) {
        result = await apiPost('/sms/send-bulk', {
          targetType: 'custom',
          recipients: confirmModal.messages.map(m => m.phone),
          message: confirmModal.messages[0].message,
        });
      } else {
        result = await apiPost('/sms/send-individual', { messages: confirmModal.messages });
      }
      setMsg(result.message + (result.cost ? ` (${result.cost.toLocaleString()}원 차감)` : ''));
      fetchCredits();
    } catch (e) {
      if (e.message.includes('크레딧')) {
        setMsg('크레딧이 부족합니다. 충전 후 다시 시도해주세요.');
      } else {
        setMsg('발송 실패: ' + e.message);
      }
    }
    setSending(false);
    setConfirmModal(null);
  };

  // 충전 처리
  const handleCharge = async () => {
    const amount = parseInt(chargeAmount);
    if (!amount || amount <= 0) { alert('유효한 금액을 입력해주세요.'); return; }
    try {
      const result = await apiPost('/sms/credits/charge', { amount, description: chargeDesc || '수동 충전' });
      setMsg(result.message);
      fetchCredits();
      setChargeModal(false);
      setChargeAmount('');
      setChargeDesc('');
    } catch (e) { alert(e.message); }
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
  const balance = creditInfo?.balance || 0;
  const isLowBalance = balance < 1000;

  if (loading) return <div className="content"><div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>로딩 중...</div></div>;

  return (
    <div className="content">
      <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>📱 문자 발송</h2>
      </div>

      {!configured && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--warning-light)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-2)', border: '1px solid var(--warning)', fontSize: 13, color: 'oklch(35% 0.12 75)' }}>
          ⚠️ SMS 설정이 필요합니다. 서버 .env에 SOLAPI 키를 설정해주세요.
        </div>
      )}

      {/* 크레딧 잔액 바 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderRadius: 'var(--radius)',
        background: isLowBalance ? 'var(--destructive-light)' : 'var(--success-light)',
        border: `1px solid ${isLowBalance ? 'oklch(75% 0.10 25)' : 'oklch(80% 0.14 150)'}`,
        marginBottom: 'var(--space-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: isLowBalance ? 'oklch(48% 0.20 25)' : 'oklch(52% 0.14 160)' }}>
            잔액
          </span>
          <span style={{ fontSize: 20, fontWeight: 800, color: isLowBalance ? 'oklch(48% 0.20 25)' : 'oklch(52% 0.14 160)' }}>
            {balance.toLocaleString()}원
          </span>
          {isLowBalance && <span style={{ fontSize: 11, color: 'oklch(48% 0.20 25)' }}>잔액 부족</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            SMS {pricing.SMS}원 · LMS {pricing.LMS}원
          </span>
          <button onClick={() => setChargeModal(true)} style={{
            padding: '6px 14px', borderRadius: 'var(--radius)', border: 'none',
            background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>충전</button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 'var(--space-2)' }}>
        {[
          { id: 'send', label: '문자 발송' },
          { id: 'history', label: '발송 이력' },
          { id: 'transactions', label: '충전/차감 이력' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 13, borderRadius: 'var(--radius) var(--radius) 0 0',
            background: activeTab === tab.id ? 'var(--card)' : 'var(--muted)',
            color: activeTab === tab.id ? 'var(--primary)' : 'var(--muted-foreground)',
            borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* === 발송 탭 === */}
      {activeTab === 'send' && (
        <>
          {/* 메인 3열 레이아웃 */}
          <div className="sms-main-row" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>

            {/* 1. 발송 대상 (30%) */}
            <div className="card" style={{ padding: 14, flex: '0 0 28%', minWidth: 0 }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 10 }}>📋 발송 대상</h3>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {[
                  { id: 'parent', label: '👨‍👩‍👧 학부모' },
                  { id: 'student', label: '👤 학생' },
                  { id: 'both', label: '👥 동시' },
                  { id: 'custom', label: '✏️ 직접' },
                ].map(t => (
                  <button key={t.id} onClick={() => { setTargetType(t.id); setSelected(new Set()); setSelectAll(false); }} style={{
                    flex: 1, padding: 'var(--space-2) 0', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: 12,
                    background: targetType === t.id ? 'var(--primary)' : 'var(--muted)',
                    color: targetType === t.id ? 'white' : 'var(--foreground)',
                  }}>{t.label}</button>
                ))}
              </div>

              {targetType !== 'custom' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 'var(--space-2)' }}>
                    <select value={school} onChange={e => { setSchool(e.target.value); setGrade(''); }}
                      style={{ padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                      <option value="">전체 학교</option>
                      {studentSchools.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                    <select value={grade} onChange={e => setGrade(e.target.value)}
                      style={{ padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                      <option value="">전체 학년</option>
                      {grades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <select value={selectedExam} onChange={e => handleExamSelect(e.target.value)}
                      style={{ padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                      <option value="">시험 선택</option>
                      {exams.filter(e => { if (school && e.school && e.school !== school) return false; return true; }).map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.exam_date || ''}){e.school ? ` [${e.school}]` : ''}</option>
                      ))}
                    </select>
                  </div>
                  {examStats && (
                    <div style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 6, padding: 'var(--space-1) var(--space-2)', background: 'var(--info-light)', borderRadius: 'var(--radius-sm)' }}>
                      📊 평균: {examStats.avg}점 · 최고점: {examStats.max}점 · 응시: {selected.size}명
                    </div>
                  )}

                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', maxHeight: 400, overflowY: 'auto', overflowX: 'hidden' }}>
                    <div onClick={toggleSelectAll} style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)',
                      background: 'var(--neutral-50)', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600, position: 'sticky', top: 0, zIndex: 1,
                    }}>
                      <input type="checkbox" checked={selectAll} readOnly style={{ accentColor: 'var(--primary)', flexShrink: 0, width: 'var(--space-4)', height: 'var(--space-4)' }} />
                      <span>전체 선택 ({selected.size}/{filteredRecipients.length})</span>
                    </div>
                    {filteredRecipients.map(r => {
                      const phone = getPhone(r);
                      return (
                        <div key={r.id} onClick={() => toggleOne(r.id)} style={{
                          display: 'flex', alignItems: 'center', padding: '7px var(--space-3)',
                          borderBottom: '1px solid var(--neutral-50)', cursor: 'pointer', fontSize: 13,
                          background: selected.has(r.id) ? 'var(--info-light)' : 'var(--card)', gap: 'var(--space-2)', minWidth: 0,
                        }}>
                          <input type="checkbox" checked={selected.has(r.id)} readOnly style={{ accentColor: 'var(--primary)', flexShrink: 0, width: 'var(--space-4)', height: 'var(--space-4)' }} />
                          <span style={{ fontWeight: 600, flexShrink: 0, minWidth: 40 }}>{r.name}</span>
                          <span style={{ color: 'var(--muted-foreground)', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.school} {r.grade}</span>
                          {targetType === 'both' ? (
                            <span style={{ fontSize: 10, flexShrink: 0, textAlign: 'right', lineHeight: 1.4 }}>
                              <span style={{ color: r.parent_phone ? 'var(--success)' : 'var(--destructive)' }}>부모 {r.parent_phone || '✕'}</span>
                              <br/>
                              <span style={{ color: r.phone ? 'var(--success)' : 'var(--destructive)' }}>학생 {r.phone || '✕'}</span>
                            </span>
                          ) : (
                            <span style={{ color: phone ? 'var(--success)' : 'var(--destructive)', fontSize: 11, flexShrink: 0 }}>
                              {phone || '번호없음'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {filteredRecipients.length === 0 && (
                      <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>학생이 없습니다.</div>
                    )}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', marginTop: 'var(--space-1)' }}>
                    선택: {selected.size}명 · 유효 번호: {validRecipients.length}명
                    {targetType === 'both' && ` · 예상 발송: ${validRecipients.reduce((n, r) => n + (r.parent_phone ? 1 : 0) + (r.phone ? 1 : 0), 0)}건`}
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
                  style={{ width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, boxSizing: 'border-box' }} />
              )}
            </div>

            {/* 2. 메시지 (50%) */}
            <div className="card" style={{ padding: 14, flex: '1 1 50%', minWidth: 0 }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>💬 메시지</h3>
              <textarea
                placeholder="문자 내용을 입력하세요... (템플릿을 선택하거나 직접 입력)"
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={16}
                style={{ resize: 'vertical', width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {getMessageType(message) === 'LMS' ? `LMS (장문) · ${pricing.LMS}원/건` : `SMS (단문) · ${pricing.SMS}원/건`}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{message.length}/2000자</span>
              </div>
            </div>

            {/* 3. 템플릿 (20%) */}
            <div className="card" style={{ padding: 14, flex: '0 0 20%', minWidth: 120 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>📝 템플릿</h3>
                <button onClick={() => setEditTmpl({ id: 'new', name: '', content: '' })}
                  style={{ fontSize: 10, padding: '3px var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--muted)', cursor: 'pointer' }}>+</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {templates.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button onClick={() => selectTemplate(t)} style={{
                      flex: 1, padding: '6px 8px', borderRadius: '6px 0 0 6px', border: '1px solid var(--border)',
                      background: 'var(--muted)', fontSize: 11, cursor: 'pointer', fontWeight: 500, textAlign: 'left',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{t.name}</button>
                    <button onClick={() => setEditTmpl({ ...t })} style={{
                      padding: '6px 4px', borderRadius: 0, border: '1px solid var(--border)', borderLeft: 'none',
                      background: 'var(--info-light)', fontSize: 10, cursor: 'pointer', color: 'var(--primary)',
                    }}>✏️</button>
                    <button onClick={() => deleteTmpl(t.id)} style={{
                      padding: '6px 4px', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', border: '1px solid var(--border)', borderLeft: 'none',
                      background: 'var(--destructive-light)', fontSize: 10, cursor: 'pointer', color: 'var(--destructive)',
                    }}>🗑</button>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 'var(--space-2)', lineHeight: 1.6 }}>
                {'{{학생이름}} {{학교}} {{학년}} {{시험명}} {{점수}} {{만점}} {{등수}} {{총인원}} {{시험평균}} {{최고점}} {{클리닉내용}}'}
              </div>
              {/\{\{클리닉내용\}\}/.test(message) && (
                <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--info-light)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', marginBottom: 2 }}>🏥 클리닉 자동 입력</div>
                  <div style={{ fontSize: 10, color: 'var(--primary)', lineHeight: 1.5 }}>
                    미리보기 시 각 학생의 클리닉 기록이 자동 입력됩니다.
                  </div>
                </div>
              )}
            </div>

          </div> {/* sms-main-row 닫기 */}

          {msg && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500,
              background: msg.includes('완료') || msg.includes('성공') ? 'var(--success-light)' : 'var(--destructive-light)',
              color: msg.includes('완료') || msg.includes('성공') ? 'var(--success)' : 'var(--destructive)',
              border: `1px solid ${msg.includes('완료') || msg.includes('성공') ? 'var(--success)' : 'var(--destructive)'}`
            }}>{msg}</div>
          )}

          <button className="btn btn-primary" onClick={preparePreview}
            disabled={sending || !configured}
            style={{ width: '100%', padding: 14, fontSize: 15, marginTop: 'var(--space-1)' }}>
            📱 발송 미리보기 ({targetType === 'custom' ? (customPhone ? 1 : 0) : validRecipients.length}건)
          </button>
        </>
      )}

      {/* === 발송 이력 탭 === */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: 14 }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>📋 발송 이력</h3>
          {sendLogs.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>발송 이력이 없습니다.</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>시간</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>수신자</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>유형</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>비용</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sendLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--neutral-50)' }}>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('ko-KR')}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ fontWeight: 600 }}>{log.recipient_name || '-'}</span>
                          <span style={{ color: 'var(--muted-foreground)', marginLeft: 6 }}>{log.recipient_phone}</span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                            background: log.message_type === 'LMS' ? 'var(--info-light)' : 'var(--success-light)',
                            color: log.message_type === 'LMS' ? 'oklch(48% 0.18 260)' : 'oklch(52% 0.14 160)',
                          }}>{log.message_type}</span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>{log.cost}원</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                            background: log.status === 'sent' ? 'var(--success-light)' : 'var(--destructive-light)',
                            color: log.status === 'sent' ? 'oklch(52% 0.14 160)' : 'oklch(48% 0.20 25)',
                          }}>{log.status === 'sent' ? '성공' : '실패'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-3)', fontSize: 12 }}>
                <span style={{ color: 'var(--muted-foreground)' }}>총 {logTotal}건</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button disabled={logPage <= 1} onClick={() => setLogPage(p => p - 1)}
                    style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: logPage <= 1 ? 'default' : 'pointer', background: 'var(--card)' }}>이전</button>
                  <span style={{ padding: '4px 10px', color: 'var(--muted-foreground)' }}>{logPage} / {Math.max(1, Math.ceil(logTotal / 20))}</span>
                  <button disabled={logPage >= Math.ceil(logTotal / 20)} onClick={() => setLogPage(p => p + 1)}
                    style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: logPage >= Math.ceil(logTotal / 20) ? 'default' : 'pointer', background: 'var(--card)' }}>다음</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* === 충전/차감 이력 탭 === */}
      {activeTab === 'transactions' && (
        <div className="card" style={{ padding: 14 }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>💰 충전/차감 이력</h3>
          {transactions.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>거래 내역이 없습니다.</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>시간</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>유형</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>금액</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>잔액</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>설명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => {
                      const typeLabel = { charge: '충전', deduct: '차감', refund: '환불' }[tx.type] || tx.type;
                      const typeColor = { charge: 'oklch(52% 0.14 160)', deduct: 'oklch(48% 0.20 25)', refund: 'oklch(48% 0.18 260)' }[tx.type] || 'var(--neutral-500)';
                      const typeBg = { charge: 'var(--success-light)', deduct: 'var(--destructive-light)', refund: 'var(--info-light)' }[tx.type] || 'var(--neutral-100)';
                      return (
                        <tr key={tx.id} style={{ borderBottom: '1px solid var(--neutral-50)' }}>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{new Date(tx.created_at).toLocaleString('ko-KR')}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: typeBg, color: typeColor }}>{typeLabel}</span>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: tx.amount > 0 ? 'oklch(52% 0.14 160)' : 'oklch(48% 0.20 25)' }}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}원
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{tx.balance_after.toLocaleString()}원</td>
                          <td style={{ padding: '8px 10px', color: 'var(--muted-foreground)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-3)', fontSize: 12 }}>
                <span style={{ color: 'var(--muted-foreground)' }}>총 {txTotal}건</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button disabled={txPage <= 1} onClick={() => setTxPage(p => p - 1)}
                    style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: txPage <= 1 ? 'default' : 'pointer', background: 'var(--card)' }}>이전</button>
                  <span style={{ padding: '4px 10px', color: 'var(--muted-foreground)' }}>{txPage} / {Math.max(1, Math.ceil(txTotal / 20))}</span>
                  <button disabled={txPage >= Math.ceil(txTotal / 20)} onClick={() => setTxPage(p => p + 1)}
                    style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: txPage >= Math.ceil(txTotal / 20) ? 'default' : 'pointer', background: 'var(--card)' }}>다음</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 템플릿 편집 모달 */}
      {editTmpl && (
        <>
          <div onClick={() => setEditTmpl(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 10000 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', width: 340, zIndex: 10001, boxShadow: 'var(--shadow-md)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>{editTmpl.id === 'new' ? '새 템플릿' : '템플릿 수정'}</h3>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>이름</label>
            <input value={editTmpl.name} onChange={e => setEditTmpl({ ...editTmpl, name: e.target.value })}
              placeholder="예: 클리닉 결과 안내"
              style={{ width: '100%', padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-2)', fontSize: 13, boxSizing: 'border-box' }} />
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>내용</label>
            <textarea value={editTmpl.content} onChange={e => setEditTmpl({ ...editTmpl, content: e.target.value })}
              rows={6} placeholder={`[${config.academyName || '나만의 조교'}] {{학생이름}} 학생 클리닉 안내\n\n{{클리닉내용}}\n\n감사합니다.`}
              style={{ width: '100%', padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-xs)', resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 10, background: 'var(--neutral-50)', padding: 6, borderRadius: 'var(--space-1)' }}>
              {'{{학생이름}} {{학교}} {{학년}} {{날짜}} {{시험명}} {{점수}} {{만점}} {{등수}} {{총인원}} {{내용}} {{클리닉내용}}'}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-outline" onClick={() => setEditTmpl(null)} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={saveTmpl} style={{ flex: 1 }}>저장</button>
            </div>
          </div>
        </>
      )}

      {/* 충전 모달 */}
      {chargeModal && (
        <>
          <div onClick={() => setChargeModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 10000 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', width: 360, zIndex: 10001, boxShadow: 'var(--shadow-md)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>💰 크레딧 충전</h3>
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 4 }}>충전 금액 (원)</label>
              <input type="number" value={chargeAmount} onChange={e => setChargeAmount(e.target.value)}
                placeholder="금액 입력"
                style={{ width: '100%', padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 15, fontWeight: 700, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {[5000, 10000, 30000, 50000].map(amt => (
                  <button key={amt} onClick={() => setChargeAmount(String(amt))} style={{
                    flex: 1, padding: '6px 0', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                    background: parseInt(chargeAmount) === amt ? 'var(--primary)' : 'var(--muted)',
                    color: parseInt(chargeAmount) === amt ? 'white' : 'var(--foreground)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>{(amt / 10000).toLocaleString()}만원</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 4 }}>메모 (선택)</label>
              <input value={chargeDesc} onChange={e => setChargeDesc(e.target.value)}
                placeholder="예: 4월분 충전"
                style={{ width: '100%', padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            {chargeAmount && parseInt(chargeAmount) > 0 && (
              <div style={{ padding: 'var(--space-2)', background: 'var(--neutral-50)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-3)', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>현재 잔액</span><span style={{ fontWeight: 600 }}>{balance.toLocaleString()}원</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--primary)' }}>
                  <span>충전 금액</span><span style={{ fontWeight: 600 }}>+{parseInt(chargeAmount).toLocaleString()}원</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 4, fontWeight: 700 }}>
                  <span>충전 후</span><span style={{ color: 'oklch(52% 0.14 160)' }}>{(balance + parseInt(chargeAmount)).toLocaleString()}원</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  SMS 약 {Math.floor((balance + parseInt(chargeAmount)) / pricing.SMS)}건 발송 가능
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-outline" onClick={() => { setChargeModal(false); setChargeAmount(''); setChargeDesc(''); }} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={handleCharge} style={{ flex: 1 }}
                disabled={!chargeAmount || parseInt(chargeAmount) <= 0}>충전하기</button>
            </div>
          </div>
        </>
      )}

      {/* 발송 확인 모달 (비용 표시 포함) */}
      {confirmModal && (
        <>
          <div onClick={() => setConfirmModal(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(0% 0 0 / 0.5)', zIndex: 10000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', width: '90%', maxWidth: 500, maxHeight: '85vh',
            zIndex: 10001, boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column',
          }}>
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-1)', flexShrink: 0 }}>📱 발송 확인</h3>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 'var(--space-2)', flexShrink: 0 }}>
              총 <strong>{confirmModal.messages.length}건</strong> · 각 메시지를 클릭하면 수정할 수 있습니다
            </p>

            {/* 비용 요약 */}
            {confirmModal.costPreview && (
              <div style={{
                padding: '10px 14px', borderRadius: 'var(--radius)',
                background: confirmModal.costPreview.total > balance ? 'var(--destructive-light)' : 'var(--success-light)',
                border: `1px solid ${confirmModal.costPreview.total > balance ? 'oklch(75% 0.10 25)' : 'oklch(80% 0.14 150)'}`,
                marginBottom: 'var(--space-2)', flexShrink: 0, fontSize: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>예상 비용</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{confirmModal.costPreview.total.toLocaleString()}원</span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
                  {Object.entries(confirmModal.costPreview.breakdown).map(([type, info]) => (
                    <span key={type} style={{ color: 'var(--muted-foreground)' }}>
                      {type} {info.count}건 x {info.unitCost}원 = {info.subtotal.toLocaleString()}원
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>잔액: {balance.toLocaleString()}원</span>
                  <span style={{ fontWeight: 600, color: confirmModal.costPreview.total > balance ? 'oklch(48% 0.20 25)' : 'oklch(52% 0.14 160)' }}>
                    발송 후: {(balance - confirmModal.costPreview.total).toLocaleString()}원
                  </span>
                </div>
                {confirmModal.costPreview.total > balance && (
                  <div style={{ marginTop: 6, color: 'oklch(48% 0.20 25)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>잔액이 부족합니다</span>
                    <button onClick={() => { setConfirmModal(null); setChargeModal(true); }} style={{
                      padding: '3px 10px', border: 'none', borderRadius: 'var(--radius)', background: 'oklch(48% 0.20 25)', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}>충전하기</button>
                  </div>
                )}
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              {confirmModal.messages.map((m, i) => (
                <div key={i} style={{ padding: '10px var(--space-3)', borderBottom: '1px solid var(--neutral-50)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)', fontSize: 'var(--text-xs)' }}>
                    <span style={{ fontWeight: 700 }}>{m.name}{m.tag ? ` [${m.tag}]` : ''} {m.school ? `(${m.school} ${m.grade})` : ''}</span>
                    <span style={{ color: 'var(--muted-foreground)' }}>{m.phone}</span>
                  </div>
                  <textarea
                    value={m.message}
                    onChange={e => updateModalMessage(i, e.target.value)}
                    rows={Math.max(3, m.message.split('\n').length + 1)}
                    style={{
                      width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      fontSize: 'var(--text-xs)', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box',
                      background: 'var(--neutral-50)',
                    }}
                  />
                  <div style={{ fontSize: 10, color: 'var(--muted-foreground)', textAlign: 'right', marginTop: 2 }}>
                    {m.message.length}자 · {getMessageType(m.message)} · {pricing[getMessageType(m.message)]}원
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexShrink: 0 }}>
              <button className="btn btn-outline" onClick={() => setConfirmModal(null)} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={handleSend}
                disabled={sending || (confirmModal.costPreview && confirmModal.costPreview.total > balance)}
                style={{ flex: 1 }}>
                {sending ? '전송 중...' : `📱 ${confirmModal.messages.length}건 발송 (${confirmModal.costPreview?.total?.toLocaleString() || 0}원)`}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 시험 선택 카드 */}
      {activeTab === 'send' && /\{\{(시험명|점수|만점|등수|총인원)\}\}/.test(message) && (() => {
        const filteredExams = exams.filter(e => {
          if (school && e.school && e.school !== school) return false;
          if (grade && e.grade && e.grade !== grade) return false;
          return true;
        });
        return (
          <div className="card" style={{ padding: 14 }}>
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>📊 시험 선택 (성적 자동 입력)</h3>
            {school && <div style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 6 }}>📌 {school} {grade || '전체 학년'} 관련 시험만 표시</div>}
            <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
              style={{ width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
              <option value="">시험을 선택하세요</option>
              {filteredExams.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.exam_date || '날짜 미정'}){e.school ? ` [${e.school}]` : ''}</option>
              ))}
            </select>
            {filteredExams.length === 0 && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--destructive)', marginTop: 'var(--space-1)' }}>해당 조건에 맞는 시험이 없습니다.</div>
            )}
          </div>
        );
      })()}

      <button className="btn btn-outline" onClick={() => navigate('/admin')}
        style={{ width: '100%', marginTop: 'var(--space-2)' }}>← 대시보드</button>
    </div>
  );
}
