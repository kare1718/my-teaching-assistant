import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { useTenantConfig, getAllGrades } from '../../contexts/TenantContext';
import { toast, askConfirm } from '../../lib/feedback';
import { PageLoading } from '../../components/ui';

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
  const [tmplFilter, setTmplFilter] = useState('all');
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
    if (!amount || amount <= 0) { toast('유효한 금액을 입력해주세요.'); return; }
    try {
      const result = await apiPost('/sms/credits/charge', { amount, description: chargeDesc || '수동 충전' });
      setMsg(result.message);
      fetchCredits();
      setChargeModal(false);
      setChargeAmount('');
      setChargeDesc('');
    } catch (e) { toast.error(e.message); }
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
    } catch (e) { toast.error(e.message); }
  };

  const deleteTmpl = async (id) => {
    if (!await askConfirm('이 템플릿을 삭제하시겠습니까?')) return;
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
    } catch (e) { toast.error(e.message); }
  };

  // 일괄 동의
  const bulkConsent = async (consent) => {
    const filtered = filteredConsents.map(c => c.parent_id);
    if (filtered.length === 0) return;
    if (!await askConfirm(`${filtered.length}명을 ${consent ? '동의' : '철회'} 처리하시겠습니까?`)) return;
    try {
      await apiPost('/sms/consent/bulk', { parent_ids: filtered, marketing_consent: consent, consent_method: 'online' });
      setConsents(await api('/sms/consent'));
    } catch (e) { toast.error(e.message); }
  };

  // 예약 취소
  const cancelSchedule = async (id) => {
    if (!await askConfirm('이 예약을 취소하시겠습니까?')) return;
    try {
      await apiDelete(`/sms/schedule/${id}`);
      setSchedules(await api('/sms/schedule'));
    } catch (e) { toast.error(e.message); }
  };

  const grades = school ? getAllGrades(school) : [];
  const balance = creditInfo?.balance || 0;
  const isLowBalance = balance < 1000;
  const filteredConsents = consents.filter(c =>
    !consentSearch || (c.name && c.name.includes(consentSearch)) || (c.phone && c.phone.includes(consentSearch))
  );

  // 발송 탭에서 사용할 필터된 템플릿
  const filteredTemplates = templates.filter(t => !t.message_type || t.message_type === messageCategory);

  if (loading) return <PageLoading wrap="main-content" />;

  return (
    <div className="main-content max-w-7xl mx-auto w-full">
      <div className="mb-4">
        <h2 className="text-2xl font-extrabold text-[var(--primary)] tracking-tight">📱 메시지 정책 관리</h2>
      </div>

      {/* 상단 탭: 문자 발송 | SMS 충전 */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => setSmsTab('send')}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap border transition-colors font-display ${
            smsTab === 'send'
              ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
          }`}>문자 발송</button>
        <button onClick={() => setSmsTab('credits')}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap border transition-colors font-display ${
            smsTab === 'credits'
              ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
          }`}>SMS 충전</button>
      </div>

      {smsTab === 'credits' ? (
        <Suspense fallback={<div className="text-center py-10 text-slate-400">로딩 중...</div>}>
          <LazySmsCredits />
        </Suspense>
      ) : (
      <>

      {!configured && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-2 text-[13px] text-amber-700">
          SMS 설정이 필요합니다. 서버 .env에 SOLAPI 키를 설정해주세요.
        </div>
      )}

      {/* 크레딧 잔액 바 */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-xl border mb-2 ${
        isLowBalance ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
      }`}>
        <div className="flex items-center gap-3">
          <span className={`text-[13px] font-semibold ${isLowBalance ? 'text-[#ba1a1a]' : 'text-emerald-600'}`}>잔액</span>
          <span className={`font-display text-xl font-extrabold ${isLowBalance ? 'text-[#ba1a1a]' : 'text-emerald-600'}`}>{balance.toLocaleString()}원</span>
          {isLowBalance && <span className="text-[11px] text-[#ba1a1a]">잔액 부족</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">SMS {pricing.SMS}원 / LMS {pricing.LMS}원</span>
          <button onClick={() => setChargeModal(true)}
            className="bg-[var(--cta)] text-white px-3.5 py-1.5 rounded-lg text-[13px] font-bold hover:opacity-90 font-display">충전</button>
        </div>
      </div>

      {/* 6탭 네비게이션 */}
      <div className="flex gap-0.5 mb-2 overflow-x-auto">
        {TAB_LIST.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[60px] py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-[var(--primary)] border-[var(--primary)]'
                : 'bg-slate-100 text-slate-500 border-transparent hover:text-[var(--primary)]'
            }`}>{tab.icon} {tab.label}</button>
        ))}
      </div>

      {/* ========================================== */}
      {/* 1. 발송 탭 */}
      {/* ========================================== */}
      {activeTab === 'send' && (
        <>
          {/* 메시지 유형 선택 */}
          <div className="flex gap-2 mb-2">
            {MSG_TYPES.map(t => (
              <button key={t.id} onClick={() => setMessageCategory(t.id)}
                className={`flex-1 px-2 py-2.5 rounded-xl border-2 text-center transition-colors ${
                  messageCategory === t.id
                    ? 'border-[var(--primary)] bg-blue-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}>
                <div className="text-lg">{t.icon}</div>
                <div className="text-[13px] font-bold mt-0.5 text-[var(--primary)]">{t.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>

          {/* 마케팅 경고 */}
          {messageCategory === 'marketing' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-2 text-xs text-amber-700">
              <strong>광고성 메시지 안내:</strong> 수신 동의한 보호자만 발송됩니다. "(광고)" 표시와 수신거부 안내가 자동 삽입됩니다.
            </div>
          )}

          {/* 메인 3열 레이아웃 */}
          <div className="sms-main-row flex gap-3 items-start">

            {/* 1. 발송 대상 */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex-[0_0_28%] min-w-0">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">발송 대상</h3>
              <div className="flex gap-1.5 mb-2.5">
                {[
                  { id: 'parent', label: '학부모' },
                  { id: 'student', label: '학생' },
                  { id: 'both', label: '동시' },
                  { id: 'custom', label: '직접' },
                ].map(t => (
                  <button key={t.id} onClick={() => { setTargetType(t.id); setSelected(new Set()); setSelectAll(false); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      targetType === t.id
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>{t.label}</button>
                ))}
              </div>

              {targetType !== 'custom' && (
                <>
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    <select value={school} onChange={e => { setSchool(e.target.value); setGrade(''); }}
                      className="px-2 py-2 bg-white border border-slate-200 rounded-lg text-[13px] outline-none focus:border-[var(--cta)] min-w-0">
                      <option value="">전체 학교</option>
                      {studentSchools.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                    <select value={grade} onChange={e => setGrade(e.target.value)}
                      className="px-2 py-2 bg-white border border-slate-200 rounded-lg text-[13px] outline-none focus:border-[var(--cta)] min-w-0">
                      <option value="">전체 학년</option>
                      {grades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <select value={selectedExam} onChange={e => handleExamSelect(e.target.value)}
                      className="px-2 py-2 bg-white border border-slate-200 rounded-lg text-[13px] outline-none focus:border-[var(--cta)] min-w-0">
                      <option value="">시험 선택</option>
                      {exams.filter(e => { if (school && e.school && e.school !== school) return false; return true; }).map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.exam_date || ''}){e.school ? ` [${e.school}]` : ''}</option>
                      ))}
                    </select>
                  </div>
                  {examStats && (
                    <div className="text-[11px] text-[var(--primary)] mb-1.5 px-2 py-1 bg-blue-50 rounded-md">
                      평균: {examStats.avg}점 / 최고점: {examStats.max}점 / 응시: {selected.size}명
                    </div>
                  )}

                  <div className="border border-slate-200 rounded-lg max-h-[350px] overflow-y-auto">
                    <div onClick={toggleSelectAll}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 cursor-pointer text-[13px] font-semibold sticky top-0 z-[1]">
                      <input type="checkbox" checked={selectAll} readOnly className="accent-[var(--primary)]" />
                      <span>전체 ({selected.size}/{filteredRecipients.length})</span>
                    </div>
                    {filteredRecipients.map(r => {
                      const phone = getPhone(r);
                      return (
                        <div key={r.id} onClick={() => toggleOne(r.id)}
                          className={`flex items-center px-3 py-1.5 border-b border-slate-50 cursor-pointer text-xs gap-2 ${
                            selected.has(r.id) ? 'bg-blue-50' : 'bg-white'
                          }`}>
                          <input type="checkbox" checked={selected.has(r.id)} readOnly className="accent-[var(--primary)]" />
                          <span className="font-semibold min-w-[40px]">{r.name}</span>
                          <span className="text-slate-500 text-[11px] flex-1 truncate">{r.school} {r.grade}</span>
                          <span className={`text-[11px] shrink-0 ${phone ? 'text-emerald-600' : 'text-[#ba1a1a]'}`}>
                            {phone || '번호없음'}
                          </span>
                        </div>
                      );
                    })}
                    {filteredRecipients.length === 0 && (
                      <div className="p-4 text-center text-slate-400 text-[13px]">학생이 없습니다.</div>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
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
                  maxLength={13} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
              )}
            </div>

            {/* 2. 메시지 */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex-[1_1_50%] min-w-0">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">메시지</h3>
              {/* 템플릿 퀵 선택 */}
              {filteredTemplates.length > 0 && (
                <div className="flex gap-1 mb-2 flex-wrap">
                  {filteredTemplates.slice(0, 5).map(t => (
                    <button key={t.id} onClick={() => selectTemplate(t)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-600 hover:bg-slate-100">{t.name}</button>
                  ))}
                </div>
              )}
              <textarea
                placeholder="문자 내용을 입력하세요..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={14}
                className="resize-y w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] outline-none focus:border-[var(--cta)] box-border"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[11px] text-slate-500">
                  {getMessageType(message) === 'LMS' ? `LMS (장문) ${pricing.LMS}원/건` : `SMS (단문) ${pricing.SMS}원/건`}
                </span>
                <span className="text-[11px] text-slate-500">{message.length}/2000자</span>
              </div>
              {/* 변수 안내 */}
              <div className="text-[10px] text-slate-400 mt-1 leading-[1.8]">
                {'{{학생이름}} {{학교}} {{학년}} {{시험명}} {{점수}} {{만점}} {{등수}} {{총인원}} {{시험평균}} {{최고점}} {{클리닉내용}} {{날짜}}'}
              </div>

              {/* 예약 발송 옵션 */}
              <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                  <input type="checkbox" checked={isScheduled} onChange={e => setIsScheduled(e.target.checked)}
                    className="accent-[var(--primary)]" />
                  <span className="font-semibold">예약 발송</span>
                </label>
                {isScheduled && (
                  <div className="flex gap-2 mt-2">
                    <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] outline-none focus:border-[var(--cta)]" />
                    <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] outline-none focus:border-[var(--cta)]" />
                  </div>
                )}
              </div>
            </div>

            {/* 3. 비용 미리보기 */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex-[0_0_20%] min-w-[120px]">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">비용 미리보기</h3>
              {(() => {
                const count = targetType === 'custom'
                  ? (customPhone ? 1 : 0)
                  : targetType === 'both'
                    ? validRecipients.reduce((n, r) => n + (r.parent_phone ? 1 : 0) + (r.phone ? 1 : 0), 0)
                    : validRecipients.length;
                const unitCost = pricing[getMessageType(message)] || 13;
                const total = count * unitCost;
                return (
                  <div className="text-xs text-slate-600">
                    <div className="flex justify-between mb-1.5">
                      <span>수신자</span><span className="font-bold text-[var(--primary)]">{count}명</span>
                    </div>
                    <div className="flex justify-between mb-1.5">
                      <span>단가</span><span>{unitCost}원 ({getMessageType(message)})</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold">
                      <span>예상 비용</span><span className="font-display font-bold text-[var(--primary)]">{total.toLocaleString()}원</span>
                    </div>
                    <div className={`flex justify-between mt-1.5 text-[11px] ${total > balance ? 'text-[#ba1a1a]' : 'text-slate-400'}`}>
                      <span>잔액</span><span>{balance.toLocaleString()}원</span>
                    </div>
                    {total > balance && (
                      <div className="mt-1.5 text-[#ba1a1a] font-semibold text-[11px]">잔액 부족</div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 검증 경고 */}
          {validationResult && validationResult.warnings && validationResult.warnings.length > 0 && (
            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 mt-2">
              {validationResult.warnings.map((w, i) => <div key={i} className="mb-0.5">- {w}</div>)}
            </div>
          )}

          {msg && (
            <div className={`px-3.5 py-2.5 rounded-lg text-[13px] font-medium mt-2 border ${
              msg.includes('완료') || msg.includes('성공') || msg.includes('등록')
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-[#ba1a1a] border-red-200'
            }`}>{msg}</div>
          )}

          <button onClick={preparePreview}
            disabled={sending || !configured}
            className="w-full py-3.5 text-[15px] mt-2 bg-[var(--cta)] text-white rounded-lg font-bold hover:opacity-90 font-display disabled:opacity-50 disabled:cursor-not-allowed">
            {isScheduled ? '예약 발송 미리보기' : '발송 미리보기'} ({targetType === 'custom' ? (customPhone ? 1 : 0) : validRecipients.length}건)
          </button>

          {/* 시험 선택 카드 */}
          {/\{\{(시험명|점수|만점|등수|총인원)\}\}/.test(message) && (() => {
            const filteredExams = exams.filter(e => {
              if (school && e.school && e.school !== school) return false;
              return true;
            });
            return (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mt-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">시험 선택 (성적 자동 입력)</h3>
                <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)] mt-1">
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
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">메시지 템플릿</h3>
            <button onClick={() => setEditTmpl({ id: 'new', name: '', content: '', message_type: 'operational' })}
              className="bg-[var(--cta)] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 font-display">+ 새 템플릿</button>
          </div>

          {/* 유형별 필터 */}
          <div className="flex gap-1.5 mb-3">
            <button onClick={() => setTmplFilter('all')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                tmplFilter === 'all' ? 'border-[var(--primary)] bg-blue-50 text-[var(--primary)]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}>전체 ({templates.length})</button>
            {MSG_TYPES.map(t => {
              const count = templates.filter(tmpl => tmpl.message_type === t.id).length;
              const active = tmplFilter === t.id;
              return (
                <button key={t.id} onClick={() => setTmplFilter(active ? 'all' : t.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] border ${
                    active ? 'border-[var(--primary)] bg-blue-50 text-[var(--primary)] font-semibold' : 'border-slate-200 bg-slate-50 text-slate-600 font-normal hover:bg-slate-100'
                  }`}>
                  {t.icon} {t.label} ({count})
                </button>
              );
            })}
          </div>

          {(tmplFilter === 'all' ? templates : templates.filter(t => t.message_type === tmplFilter)).length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-[13px]">
              등록된 템플릿이 없습니다. 새 템플릿을 추가해보세요.
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2">
              {(tmplFilter === 'all' ? templates : templates.filter(t => t.message_type === tmplFilter)).map(t => {
                const typeInfo = MSG_TYPES.find(m => m.id === t.message_type) || MSG_TYPES[0];
                return (
                  <div key={t.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-[13px] text-[var(--primary)]">{t.name}</span>
                      <span className="rounded-full px-3 py-0.5 text-xs font-bold bg-blue-50 text-[var(--primary)] whitespace-nowrap">{typeInfo.icon} {typeInfo.label}</span>
                    </div>
                    <div className="text-xs text-slate-500 mb-2 max-h-[60px] overflow-hidden leading-normal">
                      {t.content.substring(0, 100)}{t.content.length > 100 ? '...' : ''}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400">사용 {t.usage_count || 0}회</span>
                      <div className="flex gap-1">
                        <button onClick={() => { setMessage(t.content); setMessageCategory(t.message_type || 'operational'); setActiveTab('send'); }}
                          className="px-2 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-semibold hover:bg-emerald-100">사용</button>
                        <button onClick={() => setEditTmpl({ ...t })}
                          className="px-2 py-0.5 rounded-md border border-slate-200 bg-blue-50 text-[var(--primary)] text-[10px] font-semibold hover:bg-blue-100">수정</button>
                        <button onClick={() => deleteTmpl(t.id)}
                          className="px-2 py-0.5 rounded-md border border-red-200 bg-red-50 text-[#ba1a1a] text-[10px] font-semibold hover:bg-red-100">삭제</button>
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
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">발송 이력</h3>
          {sendLogs.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-[13px]">발송 이력이 없습니다.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-slate-200">
                      <th className="px-2.5 py-2 text-left whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">시간</th>
                      <th className="px-2.5 py-2 text-left whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">수신자</th>
                      <th className="px-2.5 py-2 text-center whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">유형</th>
                      <th className="px-2.5 py-2 text-center whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">분류</th>
                      <th className="px-2.5 py-2 text-center whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">비용</th>
                      <th className="px-2.5 py-2 text-center whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sendLogs.map(log => (
                      <tr key={log.id} className="border-b border-slate-50">
                        <td className="px-2.5 py-2 whitespace-nowrap">{new Date(log.created_at).toLocaleString('ko-KR')}</td>
                        <td className="px-2.5 py-2">
                          <span className="font-semibold text-[var(--primary)]">{log.recipient_name || '-'}</span>
                          <span className="text-slate-400 ml-1.5">{log.recipient_phone}</span>
                        </td>
                        <td className="px-2.5 py-2 text-center">
                          <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                            log.message_type === 'LMS' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>{log.message_type}</span>
                        </td>
                        <td className="px-2.5 py-2 text-center">
                          {log.message_category && log.message_category !== 'operational' && (
                            <span className="rounded-full px-3 py-0.5 text-xs font-bold bg-slate-100 text-slate-600">
                              {MSG_TYPES.find(m => m.id === log.message_category)?.label || log.message_category}
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 text-center font-semibold">{log.cost}원</td>
                        <td className="px-2.5 py-2 text-center">
                          <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                            log.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>{log.status === 'sent' ? '성공' : '실패'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-3 text-xs">
                <span className="text-slate-400">총 {logTotal}건</span>
                <div className="flex gap-1">
                  <button disabled={logPage <= 1} onClick={() => setLogPage(p => p - 1)}
                    className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-default">이전</button>
                  <span className="px-2.5 py-1 text-slate-400">{logPage} / {Math.max(1, Math.ceil(logTotal / 20))}</span>
                  <button disabled={logPage >= Math.ceil(logTotal / 20)} onClick={() => setLogPage(p => p + 1)}
                    className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-default">다음</button>
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
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">예약 발송 목록</h3>
          {schedules.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-[13px]">
              예약된 발송이 없습니다. 발송 탭에서 예약 발송을 등록하세요.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {schedules.map(s => {
                const statusLabel = { pending: '대기', sent: '발송완료', cancelled: '취소됨', failed: '실패' }[s.status] || s.status;
                const statusColor = { pending: 'oklch(48% 0.18 260)', sent: 'oklch(52% 0.14 160)', cancelled: 'var(--muted-foreground)', failed: 'oklch(48% 0.20 25)' }[s.status];
                const statusBg = { pending: 'var(--info-light)', sent: 'var(--success-light)', cancelled: 'var(--muted)', failed: 'var(--destructive-light)' }[s.status];
                const recipients = typeof s.recipients === 'string' ? JSON.parse(s.recipients) : s.recipients;
                const phoneCount = recipients?.phones?.length || 0;
                return (
                  <div key={s.id} className="border border-slate-200 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full px-3 py-0.5 text-xs font-bold inline-block" style={{ background: statusBg, color: statusColor }}>{statusLabel}</span>
                        <span className="text-xs font-semibold text-[var(--primary)]">
                          {new Date(s.scheduled_at).toLocaleString('ko-KR')}
                        </span>
                        <span className="text-[11px] text-slate-400">{phoneCount}명</span>
                      </div>
                      {s.status === 'pending' && (
                        <button onClick={() => cancelSchedule(s.id)}
                          className="px-2.5 py-0.5 rounded-md border border-red-200 bg-red-50 text-[#ba1a1a] text-[11px] font-semibold hover:bg-red-100">
                          취소
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 leading-normal max-h-10 overflow-hidden">
                      {s.message.substring(0, 120)}{s.message.length > 120 ? '...' : ''}
                    </div>
                    {s.error_message && (
                      <div className="text-[11px] text-[#ba1a1a] mt-1">{s.error_message}</div>
                    )}
                    <div className="text-[10px] text-slate-400 mt-1">
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
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">보호자 수신 동의 현황</h3>
            <div className="flex gap-2">
              <button onClick={() => bulkConsent(true)}
                className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                일괄 동의
              </button>
              <button onClick={() => bulkConsent(false)}
                className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                일괄 철회
              </button>
            </div>
          </div>

          <input placeholder="이름 또는 전화번호 검색..." value={consentSearch} onChange={e => setConsentSearch(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)] mb-2" />

          <div className="text-xs text-slate-500 mb-2">
            동의: {consents.filter(c => c.marketing_consent).length}명 / 전체: {consents.length}명
          </div>

          {filteredConsents.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-[13px]">보호자 데이터가 없습니다.</div>
          ) : (
            <div className="border border-slate-200 rounded-lg max-h-[500px] overflow-y-auto">
              {filteredConsents.map(c => (
                <div key={c.parent_id} className="flex items-center justify-between px-3 py-2 border-b border-slate-50 text-xs">
                  <div className="flex-1">
                    <span className="font-semibold text-[var(--primary)]">{c.name}</span>
                    <span className="text-slate-400 ml-2">{c.phone}</span>
                    {c.children_names && (
                      <span className="text-[var(--primary)] ml-2 text-[11px]">({c.children_names})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.consented_at && (
                      <span className="text-[10px] text-slate-400">
                        {new Date(c.consented_at).toLocaleDateString('ko-KR')}
                      </span>
                    )}
                    {c.consent_method && (
                      <span className="rounded-full px-3 py-0.5 text-xs font-bold bg-slate-100 text-slate-600">
                        {{ online: '온라인', written: '서면', verbal: '구두' }[c.consent_method] || c.consent_method}
                      </span>
                    )}
                    <button onClick={() => toggleConsent(c.parent_id, c.marketing_consent)}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold ${
                        c.marketing_consent ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}>
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
        <div className="flex flex-col gap-2">
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
              <div className="text-[11px] text-slate-400">오늘 발송</div>
              <div className="font-display font-bold text-[22px] text-[var(--primary)]">{stats?.today?.count || 0}건</div>
              <div className="text-[11px] text-slate-400">{(stats?.today?.cost || 0).toLocaleString()}원</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
              <div className="text-[11px] text-slate-400">이번 달</div>
              <div className="font-display font-bold text-[22px] text-[var(--primary)]">{stats?.this_month?.count || 0}건</div>
              <div className="text-[11px] text-slate-400">{(stats?.this_month?.cost || 0).toLocaleString()}원</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
              <div className="text-[11px] text-slate-400">잔액</div>
              <div className={`font-display font-bold text-[22px] ${isLowBalance ? 'text-[#ba1a1a]' : 'text-emerald-600'}`}>
                {balance.toLocaleString()}원
              </div>
              <div className="text-[11px] text-slate-400">SMS {Math.floor(balance / pricing.SMS)}건</div>
            </div>
          </div>

          {/* 월별 통계 테이블 */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">월별 발송 통계</h3>
            {!stats?.monthly || stats.monthly.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-[13px]">통계 데이터가 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-slate-200">
                      <th className="px-2.5 py-2 text-left whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">월</th>
                      <th className="px-2.5 py-2 text-center whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">분류</th>
                      <th className="px-2.5 py-2 text-center whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">채널</th>
                      <th className="px-2.5 py-2 text-center whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">전체</th>
                      <th className="px-2.5 py-2 text-center whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">성공</th>
                      <th className="px-2.5 py-2 text-center whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">실패</th>
                      <th className="px-2.5 py-2 text-right whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">비용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.monthly.map((row, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="px-2.5 py-2">{row.month}</td>
                        <td className="px-2.5 py-2 text-center">
                          <span className="rounded-full px-3 py-0.5 text-xs font-bold bg-slate-100 text-slate-600">
                            {MSG_TYPES.find(m => m.id === row.message_category)?.label || row.message_category || '운영'}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 text-center">{row.channel || 'sms'}</td>
                        <td className="px-2.5 py-2 text-center font-semibold">{row.total_count}</td>
                        <td className="px-2.5 py-2 text-center text-emerald-600">{row.success_count}</td>
                        <td className={`px-2.5 py-2 text-center ${row.fail_count > 0 ? 'text-[#ba1a1a]' : 'text-slate-400'}`}>{row.fail_count}</td>
                        <td className="px-2.5 py-2 text-right font-semibold">{(row.total_cost || 0).toLocaleString()}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 충전/차감 이력 */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">충전/차감 이력</h3>
            {transactions.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-[13px]">거래 내역이 없습니다.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b-2 border-slate-200">
                        <th className="px-2.5 py-2 text-left whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">시간</th>
                        <th className="px-2.5 py-2 text-center whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">유형</th>
                        <th className="px-2.5 py-2 text-right whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">금액</th>
                        <th className="px-2.5 py-2 text-right whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">잔액</th>
                        <th className="px-2.5 py-2 text-left whitespace-nowrap text-xs font-bold text-slate-500 uppercase tracking-widest">설명</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(tx => {
                        const typeLabel = { charge: '충전', deduct: '차감', refund: '환불' }[tx.type] || tx.type;
                        const typeColor = { charge: 'oklch(52% 0.14 160)', deduct: 'oklch(48% 0.20 25)', refund: 'oklch(48% 0.18 260)' }[tx.type];
                        const typeBg = { charge: 'var(--success-light)', deduct: 'var(--destructive-light)', refund: 'var(--info-light)' }[tx.type];
                        return (
                          <tr key={tx.id} className="border-b border-slate-50">
                            <td className="px-2.5 py-2 whitespace-nowrap">{new Date(tx.created_at).toLocaleString('ko-KR')}</td>
                            <td className="px-2.5 py-2 text-center"><span className="rounded-full px-3 py-0.5 text-xs font-bold inline-block" style={{ background: typeBg, color: typeColor }}>{typeLabel}</span></td>
                            <td className={`px-2.5 py-2 text-right font-bold font-display ${tx.amount > 0 ? 'text-emerald-600' : 'text-[#ba1a1a]'}`}>
                              {tx.amount > 0 ? '+' : ''}{(tx.amount || 0).toLocaleString()}원
                            </td>
                            <td className="px-2.5 py-2 text-right font-semibold">{(tx.balance_after || 0).toLocaleString()}원</td>
                            <td className="px-2.5 py-2 text-slate-400 max-w-[200px] truncate">{tx.description || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center mt-3 text-xs">
                  <span className="text-slate-400">총 {txTotal}건</span>
                  <div className="flex gap-1">
                    <button disabled={txPage <= 1} onClick={() => setTxPage(p => p - 1)}
                      className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-default">이전</button>
                    <span className="px-2.5 py-1 text-slate-400">{txPage} / {Math.max(1, Math.ceil(txTotal / 20))}</span>
                    <button disabled={txPage >= Math.ceil(txTotal / 20)} onClick={() => setTxPage(p => p + 1)}
                      className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-default">다음</button>
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
          <div onClick={() => setEditTmpl(null)} className="fixed inset-0 bg-black/40 z-[10000]" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-5 w-[380px] z-[10001] shadow-lg">
            <h3 className="text-base font-bold text-[var(--primary)] mb-3">{editTmpl.id === 'new' ? '새 템플릿' : '템플릿 수정'}</h3>
            <label className="text-xs font-semibold text-slate-500">이름</label>
            <input value={editTmpl.name} onChange={e => setEditTmpl({ ...editTmpl, name: e.target.value })}
              placeholder="예: 클리닉 결과 안내"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)] mb-2" />
            <label className="text-xs font-semibold text-slate-500">유형</label>
            <select value={editTmpl.message_type || 'operational'} onChange={e => setEditTmpl({ ...editTmpl, message_type: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)] mb-2">
              {MSG_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label} — {t.desc}</option>)}
            </select>
            <label className="text-xs font-semibold text-slate-500">내용</label>
            <textarea value={editTmpl.content} onChange={e => setEditTmpl({ ...editTmpl, content: e.target.value })}
              rows={6} placeholder={`[${config.academyName || '나만의 조교'}] {{학생이름}} 학생 안내\n\n내용...\n\n감사합니다.`}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-[var(--cta)] resize-y mb-2" />
            <div className="text-[11px] text-slate-400 mb-2.5 bg-slate-50 p-1.5 rounded-md">
              {'{{학생이름}} {{학교}} {{학년}} {{날짜}} {{시험명}} {{점수}} {{만점}} {{등수}} {{총인원}} {{클리닉내용}}'}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditTmpl(null)}
                className="flex-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-bold">취소</button>
              <button onClick={saveTmpl}
                className="flex-1 bg-[var(--cta)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display">저장</button>
            </div>
          </div>
        </>
      )}

      {/* 모달: 충전 */}
      {chargeModal && (
        <>
          <div onClick={() => setChargeModal(false)} className="fixed inset-0 bg-black/40 z-[10000]" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-5 w-[360px] z-[10001] shadow-lg">
            <h3 className="text-base font-bold text-[var(--primary)] mb-3">크레딧 충전</h3>
            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-500 block mb-1">충전 금액 (원)</label>
              <input type="number" value={chargeAmount} onChange={e => setChargeAmount(e.target.value)}
                placeholder="금액 입력"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[15px] font-bold outline-none focus:border-[var(--cta)]" />
              <div className="flex gap-1.5 mt-2">
                {[5000, 10000, 30000, 50000].map(amt => (
                  <button key={amt} onClick={() => setChargeAmount(String(amt))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      parseInt(chargeAmount) === amt
                        ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}>{(amt / 10000).toLocaleString()}만원</button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-500 block mb-1">메모 (선택)</label>
              <input value={chargeDesc} onChange={e => setChargeDesc(e.target.value)}
                placeholder="예: 4월분 충전"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
            </div>
            {chargeAmount && parseInt(chargeAmount) > 0 && (
              <div className="p-2 bg-slate-50 rounded-lg mb-3 text-xs">
                <div className="flex justify-between mb-1">
                  <span>현재 잔액</span><span className="font-semibold">{balance.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between mb-1 text-[var(--primary)]">
                  <span>충전 금액</span><span className="font-semibold">+{parseInt(chargeAmount).toLocaleString()}원</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-bold">
                  <span>충전 후</span><span className="text-emerald-600">{(balance + parseInt(chargeAmount)).toLocaleString()}원</span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setChargeModal(false); setChargeAmount(''); setChargeDesc(''); }}
                className="flex-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-bold">취소</button>
              <button onClick={handleCharge} disabled={!chargeAmount || parseInt(chargeAmount) <= 0}
                className="flex-1 bg-[var(--cta)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display disabled:opacity-50 disabled:cursor-not-allowed">충전하기</button>
            </div>
          </div>
        </>
      )}

      {/* 모달: 발송 확인 */}
      {confirmModal && (
        <>
          <div onClick={() => setConfirmModal(null)} className="fixed inset-0 bg-black/50 z-[10000]" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-5 w-[90%] max-w-[500px] max-h-[85vh] z-[10001] shadow-lg flex flex-col">
            <h3 className="text-base font-bold text-[var(--primary)] mb-1 shrink-0">
              {isScheduled ? '예약 발송 확인' : '발송 확인'}
            </h3>
            <div className="flex gap-2 items-center mb-2 shrink-0">
              <span className="rounded-full px-3 py-0.5 text-xs font-bold bg-blue-50 text-[var(--primary)]">
                {MSG_TYPES.find(m => m.id === messageCategory)?.label || '운영'}
              </span>
              <span className="text-[13px] text-slate-500">{confirmModal.messages.length}건</span>
              {isScheduled && scheduleDate && scheduleTime && (
                <span className="rounded-full px-3 py-0.5 text-xs font-bold bg-amber-100 text-amber-700">
                  예약: {scheduleDate} {scheduleTime}
                </span>
              )}
            </div>

            {/* 검증 경고 표시 */}
            {validationResult?.warnings?.length > 0 && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg mb-2 text-[11px] text-amber-700 shrink-0">
                {validationResult.warnings.map((w, i) => <div key={i}>- {w}</div>)}
              </div>
            )}

            {/* 비용 요약 */}
            {confirmModal.costPreview && !isScheduled && (
              <div className={`px-3.5 py-2.5 rounded-lg border mb-2 shrink-0 text-xs ${
                confirmModal.costPreview.total > balance
                  ? 'bg-red-50 border-red-200'
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold">예상 비용</span>
                  <span className="font-display font-bold text-sm text-[var(--primary)]">{confirmModal.costPreview.total.toLocaleString()}원</span>
                </div>
                <div className="flex gap-3 flex-wrap mb-1">
                  {Object.entries(confirmModal.costPreview.breakdown).map(([type, info]) => (
                    <span key={type} className="text-slate-500">
                      {type} {info.count}건 x {info.unitCost}원 = {info.subtotal.toLocaleString()}원
                    </span>
                  ))}
                </div>
                <div className="flex justify-between">
                  <span>잔액: {balance.toLocaleString()}원</span>
                  <span className={`font-semibold ${confirmModal.costPreview.total > balance ? 'text-[#ba1a1a]' : 'text-emerald-600'}`}>
                    발송 후: {(balance - confirmModal.costPreview.total).toLocaleString()}원
                  </span>
                </div>
                {confirmModal.costPreview.total > balance && (
                  <div className="mt-1.5 text-[#ba1a1a] font-semibold flex justify-between items-center">
                    <span>잔액 부족</span>
                    <button onClick={() => { setConfirmModal(null); setChargeModal(true); }}
                      className="px-2.5 py-0.5 rounded-lg bg-[#ba1a1a] text-white text-[11px] font-semibold hover:opacity-90">충전하기</button>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg">
              {confirmModal.messages.map((m, i) => (
                <div key={i} className="px-3 py-2.5 border-b border-slate-50">
                  <div className="flex justify-between mb-1 text-xs">
                    <span className="font-bold text-[var(--primary)]">{m.name}{m.tag ? ` [${m.tag}]` : ''} {m.school ? `(${m.school} ${m.grade})` : ''}</span>
                    <span className="text-slate-400">{m.phone}</span>
                  </div>
                  <textarea
                    value={m.message}
                    onChange={e => updateModalMessage(i, e.target.value)}
                    rows={Math.max(3, m.message.split('\n').length + 1)}
                    className="w-full px-2 py-2 rounded-md border border-slate-200 text-xs leading-relaxed resize-y box-border bg-slate-50 outline-none focus:border-[var(--cta)]"
                  />
                  <div className="text-[10px] text-slate-400 text-right mt-0.5">
                    {m.message.length}자 / {getMessageType(m.message)} / {pricing[getMessageType(m.message)]}원
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-3 shrink-0">
              <button onClick={() => setConfirmModal(null)}
                className="flex-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-bold">취소</button>
              <button onClick={handleSend}
                disabled={sending || (!isScheduled && confirmModal.costPreview && confirmModal.costPreview.total > balance)}
                className="flex-1 bg-[var(--cta)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display disabled:opacity-50 disabled:cursor-not-allowed">
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

      <button onClick={() => navigate('/admin')}
        className="w-full mt-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-bold">대시보드로</button>
    </div>
  );
}
