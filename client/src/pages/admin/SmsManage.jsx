import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { useTenantConfig, getAllGrades } from '../../contexts/TenantContext';

const LazySmsCredits = lazy(() => import('./SmsCredits'));

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

const MSG_TYPES = [
  { id: 'operational', label: '운영', icon: '📋', desc: '수업 안내, 출결, 성적 등' },
  { id: 'marketing', label: '마케팅', icon: '📢', desc: '홍보, 이벤트, 할인 등' },
  { id: 'relationship', label: '관계', icon: '💝', desc: '감사, 축하, 격려 등' },
];

const TAB_LIST = [
  { id: 'send', label: '발송', icon: '📱' },
  { id: 'templates', label: '템플릿', icon: '📝' },
  { id: 'history', label: '이력', icon: '📋' },
  { id: 'schedule', label: '예약', icon: '⏰' },
  { id: 'consent', label: '수신동의', icon: '✅' },
  { id: 'stats', label: '통계', icon: '📊' },
];

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
  const [messageCategory, setMessageCategory] = useState('operational');
  const [templates, setTemplates] = useState([]);
  const [editTmpl, setEditTmpl] = useState(null);

  // 시험 성적
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [examStats, setExamStats] = useState(null);
  const [examStudentIds, setExamStudentIds] = useState(null);

  // 예약 발송
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);

  // 발송 전 확인 모달
  const [confirmModal, setConfirmModal] = useState(null);
  // 검증 결과
  const [validationResult, setValidationResult] = useState(null);

  // 크레딧
  const [creditInfo, setCreditInfo] = useState(null);
  const [pricing, setPricing] = useState({ SMS: 13, LMS: 29, MMS: 60, ALIMTALK: 8 });
  const [chargeModal, setChargeModal] = useState(false);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDesc, setChargeDesc] = useState('');
  const [activeTab, setActiveTab] = useState('send');
  const [smsTab, setSmsTab] = useState('send'); // 'send' | 'credits'

  // 이력 탭
  const [sendLogs, setSendLogs] = useState([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);

  // 예약 탭
  const [schedules, setSchedules] = useState([]);

  // 수신동의 탭
  const [consents, setConsents] = useState([]);
  const [consentSearch, setConsentSearch] = useState('');

  // 통계 탭
  const [stats, setStats] = useState(null);

  const fetchCredits = () => api('/sms/credits').then(setCreditInfo).catch(console.error);

  useEffect(() => {
    api('/sms/status').then(d => { setConfigured(d.configured); setLoading(false); }).catch(() => setLoading(false));
    api('/sms/templates').then(setTemplates).catch(console.error);
    api('/scores/exams').then(setExams).catch(console.error);
    fetchCredits();
    api('/sms/pricing').then(d => setPricing(d || { SMS: 13, LMS: 29, MMS: 60, ALIMTALK: 8 })).catch(console.error);
  }, []);

  // 탭별 데이터 로드
  useEffect(() => {
    if (activeTab === 'history') {
      api(`/sms/send-logs?page=${logPage}&limit=20`).then(d => {
        setSendLogs(d.logs); setLogTotal(d.total);
      }).catch(console.error);
    } else if (activeTab === 'schedule') {
      api('/sms/schedule').then(setSchedules).catch(console.error);
    } else if (activeTab === 'consent') {
      api('/sms/consent').then(setConsents).catch(console.error);
    } else if (activeTab === 'stats') {
      api('/sms/stats').then(setStats).catch(console.error);
      api(`/sms/credits/transactions?page=${txPage}&limit=20`).then(d => {
        setTransactions(d.transactions); setTxTotal(d.total);
      }).catch(console.error);
    }
  }, [activeTab, logPage, txPage]);

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
        setExamStudentIds(new Set()); setSelected(new Set()); setSelectAll(false);
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

  const selectTemplate = (tmpl) => {
    setMessage(tmpl.content);
    if (tmpl.message_type) setMessageCategory(tmpl.message_type);
  };

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

  // 마케팅 메시지 자동 처리
  const processMarketingMessage = (msg) => {
    let processed = msg;
    if (messageCategory === 'marketing') {
      if (!processed.startsWith('(광고)')) {
        processed = '(광고) ' + processed;
      }
      if (!processed.includes('수신거부')) {
        processed += '\n\n무료수신거부 080-XXX-XXXX';
      }
    }
    return processed;
  };

  const preparePreview = async () => {
    if (!message.trim()) { setMsg('메시지를 입력해주세요.'); return; }

    // 발송 전 검증
    const recipientIds = targetType === 'custom' ? [] : validRecipients.map(r => r.id);
    try {
      const validation = await apiPost('/sms/validate', {
        message: processMarketingMessage(message),
        message_type: messageCategory,
        recipient_ids: recipientIds,
        target_type: targetType,
      });
      setValidationResult(validation);
      if (!validation.valid) {
        setMsg(validation.errors.join(' / '));
        return;
      }
    } catch (e) { /* continue */ }

    if (targetType === 'custom') {
      if (!customPhone.trim()) { setMsg('전화번호를 입력해주세요.'); return; }
      const processedMsg = processMarketingMessage(message);
      const msgs = [{ phone: customPhone.replace(/[^0-9]/g, ''), message: processedMsg, name: '직접입력' }];
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
      let personalMsg = applyTemplate(message, r, examData, clinicInfo);
      personalMsg = processMarketingMessage(personalMsg);
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

  const handleSend = async () => {
    if (!confirmModal) return;
    setSending(true);
    setMsg('');
    try {
      if (isScheduled && scheduleDate && scheduleTime) {
        // 예약 발송
        const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
        const result = await apiPost('/sms/schedule', {
          message: confirmModal.messages[0].message,
          message_type: messageCategory,
          recipients: { phones: confirmModal.messages.map(m => m.phone) },
          scheduled_at: scheduledAt,
        });
        setMsg(`${result.message} (${new Date(scheduledAt).toLocaleString('ko-KR')})`);
      } else {
        // 즉시 발송
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
      }
      fetchCredits();
    } catch (e) {
      if (e.message.includes('크레딧')) setMsg('크레딧이 부족합니다. 충전 후 다시 시도해주세요.');
      else setMsg('발송 실패: ' + e.message);
    }
    setSending(false);
    setConfirmModal(null);
    setValidationResult(null);
  };

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
      if (editTmpl.id === 'new') {
        await apiPost('/sms/templates', { name: editTmpl.name, content: editTmpl.content, message_type: editTmpl.message_type || 'operational' });
      } else {
        await apiPut(`/sms/templates/${editTmpl.id}`, { name: editTmpl.name, content: editTmpl.content, message_type: editTmpl.message_type || 'operational' });
      }
      setTemplates(await api('/sms/templates'));
      setEditTmpl(null);
    } catch (e) { alert(e.message); }
  };

  const deleteTmpl = async (id) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;
    await apiDelete(`/sms/templates/${id}`);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  // 수신동의 토글
  const toggleConsent = async (parentId, currentConsent) => {
    try {
      await apiPut(`/sms/consent/${parentId}`, {
        marketing_consent: !currentConsent,
        consent_method: 'online',
      });
      setConsents(await api('/sms/consent'));
    } catch (e) { alert(e.message); }
  };

  // 일괄 동의
  const bulkConsent = async (consent) => {
    const filtered = filteredConsents.map(c => c.parent_id);
    if (filtered.length === 0) return;
    if (!confirm(`${filtered.length}명을 ${consent ? '동의' : '철회'} 처리하시겠습니까?`)) return;
    try {
      await apiPost('/sms/consent/bulk', { parent_ids: filtered, marketing_consent: consent, consent_method: 'online' });
      setConsents(await api('/sms/consent'));
    } catch (e) { alert(e.message); }
  };

  // 예약 취소
  const cancelSchedule = async (id) => {
    if (!confirm('이 예약을 취소하시겠습니까?')) return;
    try {
      await apiDelete(`/sms/schedule/${id}`);
      setSchedules(await api('/sms/schedule'));
    } catch (e) { alert(e.message); }
  };

  const grades = school ? getAllGrades(school) : [];
  const balance = creditInfo?.balance || 0;
  const isLowBalance = balance < 1000;
  const filteredConsents = consents.filter(c =>
    !consentSearch || (c.name && c.name.includes(consentSearch)) || (c.phone && c.phone.includes(consentSearch))
  );

  // 발송 탭에서 사용할 필터된 템플릿
  const filteredTemplates = templates.filter(t => !t.message_type || t.message_type === messageCategory);

  if (loading) return <div className="content"><div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>로딩 중...</div></div>;

  // 공통 스타일
  const S = {
    badge: (bg, color) => ({ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: bg, color, display: 'inline-block' }),
    th: { padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap' },
    td: { padding: '8px 10px' },
    input: { width: '100%', padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, boxSizing: 'border-box' },
    sectionTitle: { fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)', margin: 0 },
  };

  return (
    <div className="content max-w-7xl mx-auto w-full">
      <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>📱 메시지 정책 관리</h2>
      </div>

      {/* 상단 탭: 문자 발송 | SMS 충전 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-2)' }}>
        <button onClick={() => setSmsTab('send')} style={{
          padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700,
          background: smsTab === 'send' ? '#102044' : '#fff',
          color: smsTab === 'send' ? '#fff' : '#64748b',
          border: '1px solid #e2e8f0', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>문자 발송</button>
        <button onClick={() => setSmsTab('credits')} style={{
          padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700,
          background: smsTab === 'credits' ? '#102044' : '#fff',
          color: smsTab === 'credits' ? '#fff' : '#64748b',
          border: '1px solid #e2e8f0', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>SMS 충전</button>
      </div>

      {smsTab === 'credits' ? (
        <Suspense fallback={<div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>로딩 중...</div>}>
          <LazySmsCredits />
        </Suspense>
      ) : (
      <>

      {!configured && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--warning-light)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-2)', border: '1px solid var(--warning)', fontSize: 13, color: 'oklch(35% 0.12 75)' }}>
          SMS 설정이 필요합니다. 서버 .env에 SOLAPI 키를 설정해주세요.
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
          <span style={{ fontSize: 13, fontWeight: 600, color: isLowBalance ? 'oklch(48% 0.20 25)' : 'oklch(52% 0.14 160)' }}>잔액</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: isLowBalance ? 'oklch(48% 0.20 25)' : 'oklch(52% 0.14 160)' }}>{balance.toLocaleString()}원</span>
          {isLowBalance && <span style={{ fontSize: 11, color: 'oklch(48% 0.20 25)' }}>잔액 부족</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>SMS {pricing.SMS}원 / LMS {pricing.LMS}원</span>
          <button onClick={() => setChargeModal(true)} style={{
            padding: '6px 14px', borderRadius: 'var(--radius)', border: 'none',
            background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>충전</button>
        </div>
      </div>

      {/* 6탭 네비게이션 */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 'var(--space-2)', overflowX: 'auto' }}>
        {TAB_LIST.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', minWidth: 60,
            fontWeight: 600, fontSize: 12, borderRadius: 'var(--radius) var(--radius) 0 0',
            background: activeTab === tab.id ? 'var(--card)' : 'var(--muted)',
            color: activeTab === tab.id ? 'var(--primary)' : 'var(--muted-foreground)',
            borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
          }}>{tab.icon} {tab.label}</button>
        ))}
      </div>

      {/* ========================================== */}
      {/* 1. 발송 탭 */}
      {/* ========================================== */}
      {activeTab === 'send' && (
        <>
          {/* 메시지 유형 선택 */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            {MSG_TYPES.map(t => (
              <button key={t.id} onClick={() => setMessageCategory(t.id)} style={{
                flex: 1, padding: '10px 8px', borderRadius: 'var(--radius)',
                border: messageCategory === t.id ? '2px solid var(--primary)' : '2px solid var(--border)',
                background: messageCategory === t.id ? 'var(--info-light)' : 'var(--card)',
                cursor: 'pointer', textAlign: 'center',
              }}>
                <div style={{ fontSize: 18 }}>{t.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{t.label}</div>
                <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>{t.desc}</div>
              </button>
            ))}
          </div>

          {/* 마케팅 경고 */}
          {messageCategory === 'marketing' && (
            <div style={{ padding: 'var(--space-3)', background: 'oklch(95% 0.03 60)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-2)', border: '1px solid oklch(85% 0.08 60)', fontSize: 12 }}>
              <strong>광고성 메시지 안내:</strong> 수신 동의한 보호자만 발송됩니다. "(광고)" 표시와 수신거부 안내가 자동 삽입됩니다.
            </div>
          )}

          {/* 메인 3열 레이아웃 */}
          <div className="sms-main-row" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>

            {/* 1. 발송 대상 */}
            <div className="card" style={{ padding: 14, flex: '0 0 28%', minWidth: 0 }}>
              <h3 style={S.sectionTitle}>발송 대상</h3>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {[
                  { id: 'parent', label: '학부모' },
                  { id: 'student', label: '학생' },
                  { id: 'both', label: '동시' },
                  { id: 'custom', label: '직접' },
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
                      평균: {examStats.avg}점 / 최고점: {examStats.max}점 / 응시: {selected.size}명
                    </div>
                  )}

                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', maxHeight: 350, overflowY: 'auto' }}>
                    <div onClick={toggleSelectAll} style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)',
                      background: 'var(--neutral-50)', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600, position: 'sticky', top: 0, zIndex: 1,
                    }}>
                      <input type="checkbox" checked={selectAll} readOnly style={{ accentColor: 'var(--primary)' }} />
                      <span>전체 ({selected.size}/{filteredRecipients.length})</span>
                    </div>
                    {filteredRecipients.map(r => {
                      const phone = getPhone(r);
                      return (
                        <div key={r.id} onClick={() => toggleOne(r.id)} style={{
                          display: 'flex', alignItems: 'center', padding: '6px var(--space-3)',
                          borderBottom: '1px solid var(--neutral-50)', cursor: 'pointer', fontSize: 12,
                          background: selected.has(r.id) ? 'var(--info-light)' : 'var(--card)', gap: 'var(--space-2)',
                        }}>
                          <input type="checkbox" checked={selected.has(r.id)} readOnly style={{ accentColor: 'var(--primary)' }} />
                          <span style={{ fontWeight: 600, minWidth: 40 }}>{r.name}</span>
                          <span style={{ color: 'var(--muted-foreground)', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.school} {r.grade}</span>
                          <span style={{ color: phone ? 'var(--success)' : 'var(--destructive)', fontSize: 11, flexShrink: 0 }}>
                            {phone || '번호없음'}
                          </span>
                        </div>
                      );
                    })}
                    {filteredRecipients.length === 0 && (
                      <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>학생이 없습니다.</div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 'var(--space-1)' }}>
                    선택: {selected.size}명 / 유효: {validRecipients.length}명
                  </div>
                </>
              )}

              {targetType === 'custom' && (
                <input placeholder="전화번호 (010-1234-5678)" value={customPhone}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    let f = raw;
                    if (raw.length <= 3) f = raw;
                    else if (raw.length <= 7) f = raw.slice(0,3)+'-'+raw.slice(3);
                    else f = raw.slice(0,3)+'-'+raw.slice(3,7)+'-'+raw.slice(7,11);
                    setCustomPhone(f);
                  }}
                  maxLength={13} style={S.input} />
              )}
            </div>

            {/* 2. 메시지 */}
            <div className="card" style={{ padding: 14, flex: '1 1 50%', minWidth: 0 }}>
              <h3 style={S.sectionTitle}>메시지</h3>
              {/* 템플릿 퀵 선택 */}
              {filteredTemplates.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {filteredTemplates.slice(0, 5).map(t => (
                    <button key={t.id} onClick={() => selectTemplate(t)} style={{
                      padding: '4px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                      background: 'var(--muted)', fontSize: 11, cursor: 'pointer', fontWeight: 500,
                    }}>{t.name}</button>
                  ))}
                </div>
              )}
              <textarea
                placeholder="문자 내용을 입력하세요..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={14}
                style={{ resize: 'vertical', width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {getMessageType(message) === 'LMS' ? `LMS (장문) ${pricing.LMS}원/건` : `SMS (단문) ${pricing.SMS}원/건`}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{message.length}/2000자</span>
              </div>
              {/* 변수 안내 */}
              <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 'var(--space-1)', lineHeight: 1.8 }}>
                {'{{학생이름}} {{학교}} {{학년}} {{시험명}} {{점수}} {{만점}} {{등수}} {{총인원}} {{시험평균}} {{최고점}} {{클리닉내용}} {{날짜}}'}
              </div>

              {/* 예약 발송 옵션 */}
              <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--neutral-50)', borderRadius: 'var(--radius)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={isScheduled} onChange={e => setIsScheduled(e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }} />
                  <span style={{ fontWeight: 600 }}>예약 발송</span>
                </label>
                {isScheduled && (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                      style={{ ...S.input, flex: 1 }} />
                    <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                      style={{ ...S.input, flex: 1 }} />
                  </div>
                )}
              </div>
            </div>

            {/* 3. 비용 미리보기 */}
            <div className="card" style={{ padding: 14, flex: '0 0 20%', minWidth: 120 }}>
              <h3 style={S.sectionTitle}>비용 미리보기</h3>
              {(() => {
                const count = targetType === 'custom'
                  ? (customPhone ? 1 : 0)
                  : targetType === 'both'
                    ? validRecipients.reduce((n, r) => n + (r.parent_phone ? 1 : 0) + (r.phone ? 1 : 0), 0)
                    : validRecipients.length;
                const unitCost = pricing[getMessageType(message)] || 13;
                const total = count * unitCost;
                return (
                  <div style={{ fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>수신자</span><span style={{ fontWeight: 700 }}>{count}명</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>단가</span><span>{unitCost}원 ({getMessageType(message)})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border)', fontWeight: 700 }}>
                      <span>예상 비용</span><span style={{ color: 'var(--primary)' }}>{total.toLocaleString()}원</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: total > balance ? 'oklch(48% 0.20 25)' : 'var(--muted-foreground)' }}>
                      <span>잔액</span><span>{balance.toLocaleString()}원</span>
                    </div>
                    {total > balance && (
                      <div style={{ marginTop: 6, color: 'oklch(48% 0.20 25)', fontWeight: 600, fontSize: 11 }}>잔액 부족</div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 검증 경고 */}
          {validationResult && validationResult.warnings && validationResult.warnings.length > 0 && (
            <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'oklch(95% 0.03 60)', borderRadius: 'var(--radius)', border: '1px solid oklch(85% 0.08 60)', fontSize: 12, marginTop: 'var(--space-2)' }}>
              {validationResult.warnings.map((w, i) => <div key={i} style={{ marginBottom: 2 }}>- {w}</div>)}
            </div>
          )}

          {msg && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, marginTop: 'var(--space-2)',
              background: msg.includes('완료') || msg.includes('성공') || msg.includes('등록') ? 'var(--success-light)' : 'var(--destructive-light)',
              color: msg.includes('완료') || msg.includes('성공') || msg.includes('등록') ? 'var(--success)' : 'var(--destructive)',
              border: `1px solid ${msg.includes('완료') || msg.includes('성공') || msg.includes('등록') ? 'var(--success)' : 'var(--destructive)'}`
            }}>{msg}</div>
          )}

          <button className="btn btn-primary" onClick={preparePreview}
            disabled={sending || !configured}
            style={{ width: '100%', padding: 14, fontSize: 15, marginTop: 'var(--space-2)' }}>
            {isScheduled ? '예약 발송 미리보기' : '발송 미리보기'} ({targetType === 'custom' ? (customPhone ? 1 : 0) : validRecipients.length}건)
          </button>

          {/* 시험 선택 카드 */}
          {/\{\{(시험명|점수|만점|등수|총인원)\}\}/.test(message) && (() => {
            const filteredExams = exams.filter(e => {
              if (school && e.school && e.school !== school) return false;
              return true;
            });
            return (
              <div className="card" style={{ padding: 14, marginTop: 'var(--space-2)' }}>
                <h3 style={S.sectionTitle}>시험 선택 (성적 자동 입력)</h3>
                <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
                  style={{ ...S.input, marginTop: 'var(--space-1)' }}>
                  <option value="">시험을 선택하세요</option>
                  {filteredExams.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.exam_date || '날짜 미정'}){e.school ? ` [${e.school}]` : ''}</option>
                  ))}
                </select>
              </div>
            );
          })()}
        </>
      )}

      {/* ========================================== */}
      {/* 2. 템플릿 탭 */}
      {/* ========================================== */}
      {activeTab === 'templates' && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 style={S.sectionTitle}>메시지 템플릿</h3>
            <button onClick={() => setEditTmpl({ id: 'new', name: '', content: '', message_type: 'operational' })}
              className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>+ 새 템플릿</button>
          </div>

          {/* 유형별 필터 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-3)' }}>
            <button onClick={() => {}} style={{ padding: '4px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--card)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>전체 ({templates.length})</button>
            {MSG_TYPES.map(t => {
              const count = templates.filter(tmpl => tmpl.message_type === t.id).length;
              return (
                <button key={t.id} style={{ padding: '4px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--muted)', fontSize: 11, cursor: 'pointer' }}>
                  {t.icon} {t.label} ({count})
                </button>
              );
            })}
          </div>

          {templates.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
              등록된 템플릿이 없습니다. 새 템플릿을 추가해보세요.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-2)' }}>
              {templates.map(t => {
                const typeInfo = MSG_TYPES.find(m => m.id === t.message_type) || MSG_TYPES[0];
                return (
                  <div key={t.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--space-3)', background: 'var(--card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</span>
                      <span style={S.badge('var(--info-light)', 'var(--primary)')}>{typeInfo.icon} {typeInfo.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 'var(--space-2)', maxHeight: 60, overflow: 'hidden', lineHeight: 1.5 }}>
                      {t.content.substring(0, 100)}{t.content.length > 100 ? '...' : ''}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>사용 {t.usage_count || 0}회</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => { setMessage(t.content); setMessageCategory(t.message_type || 'operational'); setActiveTab('send'); }}
                          style={{ padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--success-light)', fontSize: 10, cursor: 'pointer' }}>사용</button>
                        <button onClick={() => setEditTmpl({ ...t })}
                          style={{ padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--info-light)', fontSize: 10, cursor: 'pointer' }}>수정</button>
                        <button onClick={() => deleteTmpl(t.id)}
                          style={{ padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--destructive-light)', fontSize: 10, cursor: 'pointer', color: 'var(--destructive)' }}>삭제</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 3. 이력 탭 */}
      {/* ========================================== */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: 14 }}>
          <h3 style={{ ...S.sectionTitle, marginBottom: 'var(--space-3)' }}>발송 이력</h3>
          {sendLogs.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>발송 이력이 없습니다.</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)' }}>
                      <th style={S.th}>시간</th>
                      <th style={S.th}>수신자</th>
                      <th style={{ ...S.th, textAlign: 'center' }}>유형</th>
                      <th style={{ ...S.th, textAlign: 'center' }}>분류</th>
                      <th style={{ ...S.th, textAlign: 'center' }}>비용</th>
                      <th style={{ ...S.th, textAlign: 'center' }}>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sendLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--neutral-50)' }}>
                        <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('ko-KR')}</td>
                        <td style={S.td}>
                          <span style={{ fontWeight: 600 }}>{log.recipient_name || '-'}</span>
                          <span style={{ color: 'var(--muted-foreground)', marginLeft: 6 }}>{log.recipient_phone}</span>
                        </td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <span style={S.badge(
                            log.message_type === 'LMS' ? 'var(--info-light)' : 'var(--success-light)',
                            log.message_type === 'LMS' ? 'oklch(48% 0.18 260)' : 'oklch(52% 0.14 160)'
                          )}>{log.message_type}</span>
                        </td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          {log.message_category && log.message_category !== 'operational' && (
                            <span style={S.badge('var(--muted)', 'var(--foreground)')}>
                              {MSG_TYPES.find(m => m.id === log.message_category)?.label || log.message_category}
                            </span>
                          )}
                        </td>
                        <td style={{ ...S.td, textAlign: 'center', fontWeight: 600 }}>{log.cost}원</td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <span style={S.badge(
                            log.status === 'sent' ? 'var(--success-light)' : 'var(--destructive-light)',
                            log.status === 'sent' ? 'oklch(52% 0.14 160)' : 'oklch(48% 0.20 25)'
                          )}>{log.status === 'sent' ? '성공' : '실패'}</span>
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

      {/* ========================================== */}
      {/* 4. 예약 탭 */}
      {/* ========================================== */}
      {activeTab === 'schedule' && (
        <div className="card" style={{ padding: 14 }}>
          <h3 style={{ ...S.sectionTitle, marginBottom: 'var(--space-3)' }}>예약 발송 목록</h3>
          {schedules.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
              예약된 발송이 없습니다. 발송 탭에서 예약 발송을 등록하세요.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {schedules.map(s => {
                const statusLabel = { pending: '대기', sent: '발송완료', cancelled: '취소됨', failed: '실패' }[s.status] || s.status;
                const statusColor = { pending: 'oklch(48% 0.18 260)', sent: 'oklch(52% 0.14 160)', cancelled: 'var(--muted-foreground)', failed: 'oklch(48% 0.20 25)' }[s.status];
                const statusBg = { pending: 'var(--info-light)', sent: 'var(--success-light)', cancelled: 'var(--muted)', failed: 'var(--destructive-light)' }[s.status];
                const recipients = typeof s.recipients === 'string' ? JSON.parse(s.recipients) : s.recipients;
                const phoneCount = recipients?.phones?.length || 0;
                return (
                  <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={S.badge(statusBg, statusColor)}>{statusLabel}</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                          {new Date(s.scheduled_at).toLocaleString('ko-KR')}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{phoneCount}명</span>
                      </div>
                      {s.status === 'pending' && (
                        <button onClick={() => cancelSchedule(s.id)}
                          style={{ padding: '3px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--destructive)', background: 'var(--destructive-light)', color: 'var(--destructive)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          취소
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--foreground)', lineHeight: 1.5, maxHeight: 40, overflow: 'hidden' }}>
                      {s.message.substring(0, 120)}{s.message.length > 120 ? '...' : ''}
                    </div>
                    {s.error_message && (
                      <div style={{ fontSize: 11, color: 'oklch(48% 0.20 25)', marginTop: 4 }}>{s.error_message}</div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 4 }}>
                      등록: {s.created_by_name || '-'} / {new Date(s.created_at).toLocaleString('ko-KR')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 5. 수신동의 탭 */}
      {/* ========================================== */}
      {activeTab === 'consent' && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 style={S.sectionTitle}>보호자 수신 동의 현황</h3>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={() => bulkConsent(true)} className="btn btn-outline" style={{ fontSize: 11, padding: '4px 10px' }}>
                일괄 동의
              </button>
              <button onClick={() => bulkConsent(false)} className="btn btn-outline" style={{ fontSize: 11, padding: '4px 10px' }}>
                일괄 철회
              </button>
            </div>
          </div>

          <input placeholder="이름 또는 전화번호 검색..." value={consentSearch} onChange={e => setConsentSearch(e.target.value)}
            style={{ ...S.input, marginBottom: 'var(--space-2)' }} />

          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 'var(--space-2)' }}>
            동의: {consents.filter(c => c.marketing_consent).length}명 / 전체: {consents.length}명
          </div>

          {filteredConsents.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>보호자 데이터가 없습니다.</div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', maxHeight: 500, overflowY: 'auto' }}>
              {filteredConsents.map(c => (
                <div key={c.parent_id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px var(--space-3)', borderBottom: '1px solid var(--neutral-50)', fontSize: 12,
                }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span style={{ color: 'var(--muted-foreground)', marginLeft: 8 }}>{c.phone}</span>
                    {c.children_names && (
                      <span style={{ color: 'var(--primary)', marginLeft: 8, fontSize: 11 }}>({c.children_names})</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {c.consented_at && (
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                        {new Date(c.consented_at).toLocaleDateString('ko-KR')}
                      </span>
                    )}
                    {c.consent_method && (
                      <span style={S.badge('var(--muted)', 'var(--foreground)')}>
                        {{ online: '온라인', written: '서면', verbal: '구두' }[c.consent_method] || c.consent_method}
                      </span>
                    )}
                    <button onClick={() => toggleConsent(c.parent_id, c.marketing_consent)} style={{
                      padding: '4px 12px', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer',
                      fontWeight: 600, fontSize: 11,
                      background: c.marketing_consent ? 'var(--success-light)' : 'var(--muted)',
                      color: c.marketing_consent ? 'oklch(52% 0.14 160)' : 'var(--muted-foreground)',
                    }}>
                      {c.marketing_consent ? '동의' : '미동의'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 6. 통계 탭 */}
      {/* ========================================== */}
      {activeTab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {/* 요약 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
            <div className="card" style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>오늘 발송</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{stats?.today?.count || 0}건</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{(stats?.today?.cost || 0).toLocaleString()}원</div>
            </div>
            <div className="card" style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>이번 달</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{stats?.this_month?.count || 0}건</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{(stats?.this_month?.cost || 0).toLocaleString()}원</div>
            </div>
            <div className="card" style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>잔액</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: isLowBalance ? 'oklch(48% 0.20 25)' : 'oklch(52% 0.14 160)' }}>
                {balance.toLocaleString()}원
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>SMS {Math.floor(balance / pricing.SMS)}건</div>
            </div>
          </div>

          {/* 월별 통계 테이블 */}
          <div className="card" style={{ padding: 14 }}>
            <h3 style={{ ...S.sectionTitle, marginBottom: 'var(--space-3)' }}>월별 발송 통계</h3>
            {!stats?.monthly || stats.monthly.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>통계 데이터가 없습니다.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)' }}>
                      <th style={S.th}>월</th>
                      <th style={{ ...S.th, textAlign: 'center' }}>분류</th>
                      <th style={{ ...S.th, textAlign: 'center' }}>채널</th>
                      <th style={{ ...S.th, textAlign: 'center' }}>전체</th>
                      <th style={{ ...S.th, textAlign: 'center' }}>성공</th>
                      <th style={{ ...S.th, textAlign: 'center' }}>실패</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>비용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.monthly.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--neutral-50)' }}>
                        <td style={S.td}>{row.month}</td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <span style={S.badge('var(--muted)', 'var(--foreground)')}>
                            {MSG_TYPES.find(m => m.id === row.message_category)?.label || row.message_category || '운영'}
                          </span>
                        </td>
                        <td style={{ ...S.td, textAlign: 'center' }}>{row.channel || 'sms'}</td>
                        <td style={{ ...S.td, textAlign: 'center', fontWeight: 600 }}>{row.total_count}</td>
                        <td style={{ ...S.td, textAlign: 'center', color: 'oklch(52% 0.14 160)' }}>{row.success_count}</td>
                        <td style={{ ...S.td, textAlign: 'center', color: row.fail_count > 0 ? 'oklch(48% 0.20 25)' : 'var(--muted-foreground)' }}>{row.fail_count}</td>
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{(row.total_cost || 0).toLocaleString()}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 충전/차감 이력 */}
          <div className="card" style={{ padding: 14 }}>
            <h3 style={{ ...S.sectionTitle, marginBottom: 'var(--space-3)' }}>충전/차감 이력</h3>
            {transactions.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>거래 내역이 없습니다.</div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)' }}>
                        <th style={S.th}>시간</th>
                        <th style={{ ...S.th, textAlign: 'center' }}>유형</th>
                        <th style={{ ...S.th, textAlign: 'right' }}>금액</th>
                        <th style={{ ...S.th, textAlign: 'right' }}>잔액</th>
                        <th style={S.th}>설명</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(tx => {
                        const typeLabel = { charge: '충전', deduct: '차감', refund: '환불' }[tx.type] || tx.type;
                        const typeColor = { charge: 'oklch(52% 0.14 160)', deduct: 'oklch(48% 0.20 25)', refund: 'oklch(48% 0.18 260)' }[tx.type];
                        const typeBg = { charge: 'var(--success-light)', deduct: 'var(--destructive-light)', refund: 'var(--info-light)' }[tx.type];
                        return (
                          <tr key={tx.id} style={{ borderBottom: '1px solid var(--neutral-50)' }}>
                            <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{new Date(tx.created_at).toLocaleString('ko-KR')}</td>
                            <td style={{ ...S.td, textAlign: 'center' }}><span style={S.badge(typeBg, typeColor)}>{typeLabel}</span></td>
                            <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: tx.amount > 0 ? 'oklch(52% 0.14 160)' : 'oklch(48% 0.20 25)' }}>
                              {tx.amount > 0 ? '+' : ''}{(tx.amount || 0).toLocaleString()}원
                            </td>
                            <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{(tx.balance_after || 0).toLocaleString()}원</td>
                            <td style={{ ...S.td, color: 'var(--muted-foreground)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || '-'}</td>
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
        </div>
      )}

      {/* ========================================== */}
      {/* 모달: 템플릿 편집 */}
      {/* ========================================== */}
      {editTmpl && (
        <>
          <div onClick={() => setEditTmpl(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 10000 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', width: 380, zIndex: 10001, boxShadow: 'var(--shadow-md)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>{editTmpl.id === 'new' ? '새 템플릿' : '템플릿 수정'}</h3>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>이름</label>
            <input value={editTmpl.name} onChange={e => setEditTmpl({ ...editTmpl, name: e.target.value })}
              placeholder="예: 클리닉 결과 안내" style={{ ...S.input, marginBottom: 'var(--space-2)' }} />
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>유형</label>
            <select value={editTmpl.message_type || 'operational'} onChange={e => setEditTmpl({ ...editTmpl, message_type: e.target.value })}
              style={{ ...S.input, marginBottom: 'var(--space-2)' }}>
              {MSG_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label} — {t.desc}</option>)}
            </select>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>내용</label>
            <textarea value={editTmpl.content} onChange={e => setEditTmpl({ ...editTmpl, content: e.target.value })}
              rows={6} placeholder={`[${config.academyName || '나만의 조교'}] {{학생이름}} 학생 안내\n\n내용...\n\n감사합니다.`}
              style={{ ...S.input, resize: 'vertical', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-2)' }} />
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 10, background: 'var(--neutral-50)', padding: 6, borderRadius: 'var(--space-1)' }}>
              {'{{학생이름}} {{학교}} {{학년}} {{날짜}} {{시험명}} {{점수}} {{만점}} {{등수}} {{총인원}} {{클리닉내용}}'}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-outline" onClick={() => setEditTmpl(null)} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={saveTmpl} style={{ flex: 1 }}>저장</button>
            </div>
          </div>
        </>
      )}

      {/* 모달: 충전 */}
      {chargeModal && (
        <>
          <div onClick={() => setChargeModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 10000 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', width: 360, zIndex: 10001, boxShadow: 'var(--shadow-md)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>크레딧 충전</h3>
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 4 }}>충전 금액 (원)</label>
              <input type="number" value={chargeAmount} onChange={e => setChargeAmount(e.target.value)}
                placeholder="금액 입력"
                style={{ ...S.input, fontSize: 15, fontWeight: 700 }} />
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
                placeholder="예: 4월분 충전" style={S.input} />
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
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-outline" onClick={() => { setChargeModal(false); setChargeAmount(''); setChargeDesc(''); }} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={handleCharge} style={{ flex: 1 }} disabled={!chargeAmount || parseInt(chargeAmount) <= 0}>충전하기</button>
            </div>
          </div>
        </>
      )}

      {/* 모달: 발송 확인 */}
      {confirmModal && (
        <>
          <div onClick={() => setConfirmModal(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(0% 0 0 / 0.5)', zIndex: 10000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', width: '90%', maxWidth: 500, maxHeight: '85vh',
            zIndex: 10001, boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column',
          }}>
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-1)', flexShrink: 0 }}>
              {isScheduled ? '예약 발송 확인' : '발송 확인'}
            </h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 'var(--space-2)', flexShrink: 0 }}>
              <span style={S.badge('var(--info-light)', 'var(--primary)')}>
                {MSG_TYPES.find(m => m.id === messageCategory)?.label || '운영'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{confirmModal.messages.length}건</span>
              {isScheduled && scheduleDate && scheduleTime && (
                <span style={S.badge('oklch(95% 0.03 60)', 'oklch(40% 0.12 60)')}>
                  예약: {scheduleDate} {scheduleTime}
                </span>
              )}
            </div>

            {/* 검증 경고 표시 */}
            {validationResult?.warnings?.length > 0 && (
              <div style={{ padding: 'var(--space-2)', background: 'oklch(95% 0.03 60)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-2)', fontSize: 11, flexShrink: 0 }}>
                {validationResult.warnings.map((w, i) => <div key={i}>- {w}</div>)}
              </div>
            )}

            {/* 비용 요약 */}
            {confirmModal.costPreview && !isScheduled && (
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
                    <span>잔액 부족</span>
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
                    {m.message.length}자 / {getMessageType(m.message)} / {pricing[getMessageType(m.message)]}원
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexShrink: 0 }}>
              <button className="btn btn-outline" onClick={() => setConfirmModal(null)} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={handleSend}
                disabled={sending || (!isScheduled && confirmModal.costPreview && confirmModal.costPreview.total > balance)}
                style={{ flex: 1 }}>
                {sending ? '처리 중...' : isScheduled
                  ? `예약 등록 (${confirmModal.messages.length}건)`
                  : `${confirmModal.messages.length}건 발송 (${confirmModal.costPreview?.total?.toLocaleString() || 0}원)`}
              </button>
            </div>
          </div>
        </>
      )}

      </>
      )}

      <button className="btn btn-outline" onClick={() => navigate('/admin')}
        style={{ width: '100%', marginTop: 'var(--space-2)' }}>대시보드로</button>
    </div>
  );
}
