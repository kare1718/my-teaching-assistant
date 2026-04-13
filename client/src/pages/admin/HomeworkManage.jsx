import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';
import useMediaQuery from '../../hooks/useMediaQuery';

function getSmsDefaultTemplate(academyName) {
  return `[${academyName || '나만의 조교'}] {name} 학생 과제 현황
제출: {submit}
평가: {eval}
{memo_line}
감사합니다.`;
}

const MEMO_PLACEHOLDERS = [
  '예) 문법 파트 이해도 부족, 조사 활용 연습 필요',
  '예) 독해 속도 향상됨, 요약 정리가 깔끔해짐',
  '예) 어휘력 우수하나 서술형 답안 작성 연습 필요',
  '예) 지난주 대비 과제 완성도 크게 향상',
  '예) 수업 집중도 좋음, 질문도 적극적',
  '예) 비문학 독해 연습 추가 필요',
  '예) 고전시가 해석 능력 우수',
  '예) 필기 정리 습관 개선 필요',
  '예) 과제 성실도 높음, 꾸준한 성장세',
  '예) 문학 감상문 표현력이 좋아짐',
  '예) 맞춤법 오류 반복, 집중 교정 필요',
  '예) 논술형 답안 구조가 개선됨',
  '예) 수행평가 대비 추가 연습 권장',
];

export default function HomeworkManage() {
  const { config } = useTenantConfig();
  const isLg = useMediaQuery('(min-width: 1600px)');
  const SMS_DEFAULT_TEMPLATE = getSmsDefaultTemplate(config.academyName);
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [filterSchool, setFilterSchool] = useState('');
  const [filterGrade, setFilterGrade] = useState('');

  // 포인트 모달
  const [bonusModal, setBonusModal] = useState(null);
  const [bonusAmount, setBonusAmount] = useState('50');
  const [bonusReason, setBonusReason] = useState('');

  // 일괄 선택 & 포인트
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [bulkBonusModal, setBulkBonusModal] = useState(false);
  const [bulkAmount, setBulkAmount] = useState('50');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkSending, setBulkSending] = useState(false);

  // 누적 기록 모달
  const [historyTarget, setHistoryTarget] = useState(null);
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  // SMS
  const [smsOverlay, setSmsOverlay] = useState(false);
  const [smsRecipients, setSmsRecipients] = useState([]);
  const [smsTemplate, setSmsTemplate] = useState(SMS_DEFAULT_TEMPLATE);
  const [smsTarget, setSmsTarget] = useState('parent');
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState(null);

  // 가이드 배너
  const [showGuide, setShowGuide] = useState(() => {
    try { return localStorage.getItem('hw_guide_dismissed') !== 'true'; } catch { return true; }
  });

  useEffect(() => {
    api('/homework/classes').then(data => {
      setClasses(data);
      if (data.length > 0) setSelectedClass(data[0].name);
    }).catch(console.error);
  }, []);

  const autoFilterFromClass = (className, studentList) => {
    if (!className || studentList.length === 0) return;
    const schools = [...new Set(studentList.map(s => s.school))].sort();
    const matchedSchool = schools.find(s => className.includes(s));
    if (matchedSchool) {
      setFilterSchool(matchedSchool);
      const matchedGrade = studentList
        .filter(s => s.school === matchedSchool)
        .map(s => s.grade)
        .find(g => g && className.includes(g));
      setFilterGrade(matchedGrade || '');
    } else {
      setFilterSchool(schools[0] || '');
      setFilterGrade('');
    }
  };

  useEffect(() => {
    if (!selectedClass || !date) return;
    setLoading(true);
    api(`/homework/class/${encodeURIComponent(selectedClass)}/date/${date}`)
      .then(data => {
        const mapped = data.map(s => ({
          ...s,
          submissionStatus: s.record?.submission_status || '',
          homeworkStatus: s.record?.homework_status || '',
          memo: s.record?.memo || '',
          changed: false,
        }));
        setAllStudents(mapped);
        autoFilterFromClass(selectedClass, mapped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedClass, date]);

  useEffect(() => {
    if (smsOverlay && smsRecipients.length === 0) {
      api('/sms/recipients').then(setSmsRecipients).catch(console.error);
    }
  }, [smsOverlay]);

  const students = useMemo(() => {
    let filtered = allStudents;
    if (filterSchool) filtered = filtered.filter(s => s.school === filterSchool);
    if (filterGrade) filtered = filtered.filter(s => s.grade === filterGrade);
    return filtered;
  }, [allStudents, filterSchool, filterGrade]);

  const schoolList = [...new Set(allStudents.map(s => s.school))].sort();
  const gradeList = [...new Set(
    allStudents.filter(s => !filterSchool || s.school === filterSchool).map(s => s.grade)
  )].sort();

  // 요약 통계
  const stats = useMemo(() => {
    const s = { total: students.length, submitted: 0, notSubmitted: 0, noInput: 0, best: 0, good: 0, resubmit: 0 };
    students.forEach(st => {
      if (st.submissionStatus === '제출') s.submitted++;
      else if (st.submissionStatus === '미제출') s.notSubmitted++;
      else s.noInput++;
      if (st.homeworkStatus === '최우수') s.best++;
      else if (st.homeworkStatus === '우수') s.good++;
      else if (st.homeworkStatus === '재제출') s.resubmit++;
    });
    return s;
  }, [students]);

  const update = (studentId, field, value) => {
    setAllStudents(prev => prev.map(s =>
      s.studentId === studentId ? { ...s, [field]: value, changed: true } : s
    ));
  };

  const handleSaveSingle = async (student) => {
    if (!student.changed) return;
    setSaving(true);
    try {
      await apiPost('/homework/bulk-save', {
        className: selectedClass, date,
        records: [{
          studentId: student.studentId,
          homeworkStatus: student.homeworkStatus || '',
          wordTest: '', retest: '',
          submissionStatus: student.submissionStatus || '',
          memo: student.memo || '',
        }],
      });
      setAllStudents(prev => prev.map(s => s.studentId === student.studentId ? { ...s, changed: false } : s));
      setMsg(`${student.name} 저장 완료!`);
      setTimeout(() => setMsg(''), 2000);
    } catch (e) { setMsg('실패: ' + e.message); }
    setSaving(false);
  };

  const handleSave = async () => {
    const changed = allStudents.filter(s => s.changed);
    if (changed.length === 0) { setMsg('변경 없음'); setTimeout(() => setMsg(''), 2000); return; }
    setSaving(true);
    try {
      await apiPost('/homework/bulk-save', {
        className: selectedClass, date,
        records: changed.map(s => ({
          studentId: s.studentId,
          homeworkStatus: s.homeworkStatus || '',
          wordTest: '',
          retest: '',
          submissionStatus: s.submissionStatus || '',
          memo: s.memo || '',
        })),
      });
      setMsg(`${changed.length}건 저장 완료!`);
      setAllStudents(prev => prev.map(s => ({ ...s, changed: false })));
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg('실패: ' + e.message); }
    setSaving(false);
  };

  const handleBonus = async () => {
    if (!bonusModal || !bonusAmount || parseInt(bonusAmount) <= 0) {
      setMsg('1 이상의 포인트를 입력하세요.'); setTimeout(() => setMsg(''), 2000); return;
    }
    try {
      await apiPost('/homework/bonus', {
        studentId: bonusModal.studentId,
        amount: parseInt(bonusAmount),
        reason: bonusReason || '과제 우수',
      });
      setMsg(`${bonusModal.name}에게 ${bonusAmount}pt 지급!`);
      setBonusModal(null); setBonusAmount('50'); setBonusReason('');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg('실패: ' + e.message); }
  };

  const handleDeleteRecord = async (studentId) => {
    const student = allStudents.find(s => s.studentId === studentId);
    if (!student?.record?.id) { setMsg('저장된 기록이 없습니다.'); setTimeout(() => setMsg(''), 2000); return; }
    if (!confirm(`${student.name}의 과제 기록을 삭제하시겠습니까?`)) return;
    try {
      await apiDelete(`/homework/${student.record.id}`);
      setMsg('기록 삭제 완료');
      setAllStudents(prev => prev.map(s =>
        s.studentId === studentId
          ? { ...s, record: null, submissionStatus: '', homeworkStatus: '', memo: '', changed: false }
          : s
      ));
      setTimeout(() => setMsg(''), 2000);
    } catch (e) { setMsg('삭제 실패: ' + e.message); }
  };

  const toggleCheck = (studentId) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const toggleAllChecks = () => {
    if (checkedIds.size === students.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(students.map(s => s.studentId)));
    }
  };

  const handleBulkBonus = async () => {
    if (checkedIds.size === 0 || !bulkAmount || parseInt(bulkAmount) <= 0) {
      setMsg('1 이상의 포인트를 입력하세요.'); setTimeout(() => setMsg(''), 2000); return;
    }
    setBulkSending(true);
    try {
      const result = await apiPost('/homework/bonus/bulk', {
        studentIds: [...checkedIds],
        amount: parseInt(bulkAmount),
        reason: bulkReason || '일괄 포인트 지급',
      });
      setMsg(`${result.success}명에게 ${bulkAmount}pt 지급 완료!`);
      setBulkBonusModal(false);
      setBulkAmount('50');
      setBulkReason('');
      setCheckedIds(new Set());
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg('실패: ' + e.message); }
    setBulkSending(false);
  };

  // 누적 기록 로드
  useEffect(() => {
    if (!historyTarget || !selectedClass) return;
    setHistLoading(true);
    api(`/homework/history/${encodeURIComponent(selectedClass)}?studentId=${historyTarget.studentId}&limit=30`)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setHistLoading(false));
  }, [historyTarget, selectedClass]);

  // 일괄 상태 변경
  const bulkUpdateField = (field, value) => {
    setAllStudents(prev => prev.map(s =>
      checkedIds.has(s.studentId) ? { ...s, [field]: value, changed: true } : s
    ));
  };

  // 뱃지 헬퍼
  const getSubmitBadge = (val) => {
    if (val === '제출') return { text: '제출', bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)' };
    if (val === '미제출') return { text: '미제출', bg: 'var(--destructive-light)', color: 'oklch(35% 0.15 25)' };
    return null;
  };
  const getGradeBadge = (val) => {
    if (val === '최우수') return { text: '최우수', bg: 'var(--warning-light)', color: 'oklch(35% 0.12 75)' };
    if (val === '우수') return { text: '우수', bg: 'var(--info-light)', color: 'var(--primary)' };
    if (val === '재제출') return { text: '재제출', bg: 'oklch(94% 0.04 350)', color: 'oklch(35% 0.15 350)' };
    return null;
  };

  // SMS 관련
  const buildSmsMessage = (student) => {
    return smsTemplate
      .replace(/\{name\}/g, student.name)
      .replace(/\{school\}/g, student.school)
      .replace(/\{grade\}/g, student.grade)
      .replace(/\{submit\}/g, student.submissionStatus || '미입력')
      .replace(/\{eval\}/g, student.homeworkStatus || '미입력')
      .replace(/\{memo\}/g, student.memo || '')
      .replace(/\{memo_line\}/g, student.memo ? `특이사항: ${student.memo}` : '')
      .replace(/\{date\}/g, date);
  };

  const getSmsTargets = () => {
    const withRecords = students.filter(s => s.submissionStatus || s.homeworkStatus);
    if (smsTarget === 'both') {
      const results = [];
      withRecords.forEach(s => {
        const recipient = smsRecipients.find(r => r.id === s.studentId);
        const msg = buildSmsMessage(s);
        if (recipient?.parent_phone) results.push({ ...s, phone: recipient.parent_phone, message: msg, tag: '학부모' });
        if (recipient?.phone) results.push({ ...s, phone: recipient.phone, message: msg, tag: '학생' });
      });
      return results;
    }
    return withRecords.map(s => {
      const recipient = smsRecipients.find(r => r.id === s.studentId);
      const phone = smsTarget === 'parent' ? recipient?.parent_phone : recipient?.phone;
      return { ...s, phone: phone || '', message: buildSmsMessage(s) };
    }).filter(t => t.phone);
  };

  const handleSendSms = async () => {
    const targets = getSmsTargets();
    if (targets.length === 0) { setMsg('발송 대상이 없습니다.'); setTimeout(() => setMsg(''), 3000); return; }
    if (!confirm(`${targets.length}건 과제 현황 문자를 발송하시겠습니까?`)) return;
    setSmsSending(true);
    try {
      const result = await apiPost('/sms/send-individual', {
        messages: targets.map(t => ({ phone: t.phone, message: t.message, name: t.name }))
      });
      setSmsResult(result);
      setMsg(`문자 발송 완료: 성공 ${result.success}건, 실패 ${result.fail}건`);
      setTimeout(() => setMsg(''), 5000);
    } catch (e) { setMsg('발송 실패: ' + e.message); }
    setSmsSending(false);
  };

  const changedCount = allStudents.filter(s => s.changed).length;

  // Ctrl+S 저장 단축키
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [allStudents]);

  // 셀렉트 배경색
  const getSelectStyle = (field, value) => {
    const base = {
      padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)',
      fontSize: 13, fontWeight: 600, cursor: 'pointer', minWidth: 90,
    };
    if (field === 'submissionStatus') {
      if (value === '제출') return { ...base, background: 'var(--success-light)', color: 'oklch(30% 0.12 145)', borderColor: 'oklch(80% 0.14 150)' };
      if (value === '미제출') return { ...base, background: 'var(--destructive-light)', color: 'oklch(35% 0.15 25)', borderColor: 'oklch(75% 0.10 25)' };
    }
    if (field === 'homeworkStatus') {
      if (value === '최우수') return { ...base, background: 'var(--warning-light)', color: 'oklch(35% 0.12 75)', borderColor: 'oklch(85% 0.10 85)' };
      if (value === '우수') return { ...base, background: 'var(--info-light)', color: 'var(--primary)', borderColor: 'oklch(72% 0.10 260)' };
      if (value === '재제출') return { ...base, background: 'oklch(94% 0.04 350)', color: 'oklch(35% 0.15 350)', borderColor: 'oklch(78% 0.10 350)' };
    }
    return { ...base, background: 'var(--neutral-50)', color: 'var(--muted-foreground)' };
  };

  const dismissGuide = () => {
    setShowGuide(false);
    try { localStorage.setItem('hw_guide_dismissed', 'true'); } catch {}
  };

  return (
    <div className="content">
      {/* === 가로 배치: 좌측 필터 + 우측 테이블 === */}
      <div className="hw-layout" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* 좌측 필터 사이드바 */}
        <div className="hw-sidebar" style={{
          width: isLg ? 260 : 220, minWidth: isLg ? 260 : 220, flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: isLg ? 10 : 8,
        }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin')} style={{ width: '100%' }}>← 대시보드</button>

          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
            style={{ padding: isLg ? '10px 12px' : '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: isLg ? 15 : 13, fontWeight: 600, width: '100%' }}>
            {classes.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <select value={filterSchool} onChange={e => { setFilterSchool(e.target.value); setFilterGrade(''); }}
            style={{ padding: isLg ? '10px 12px' : '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: isLg ? 15 : 13, width: '100%' }}>
            <option value="">학교 전체</option>
            {schoolList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
            style={{ padding: isLg ? '10px 12px' : '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: isLg ? 15 : 13, width: '100%' }}>
            <option value="">학년 전체</option>
            {gradeList.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: isLg ? '10px 12px' : '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: isLg ? 15 : 13, width: '100%', boxSizing: 'border-box' }} />

          {/* 요약 칩 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            {[
              { label: `전체 ${stats.total}`, bg: 'var(--neutral-50)', color: 'var(--foreground)' },
              { label: `제출 ${stats.submitted}`, bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)' },
              { label: `미제출 ${stats.notSubmitted}`, bg: stats.notSubmitted > 0 ? 'var(--destructive-light)' : 'var(--neutral-50)', color: stats.notSubmitted > 0 ? 'oklch(35% 0.15 25)' : 'var(--muted-foreground)' },
              { label: `최우수 ${stats.best}`, bg: stats.best > 0 ? 'var(--warning-light)' : 'var(--neutral-50)', color: stats.best > 0 ? 'oklch(35% 0.12 75)' : 'var(--muted-foreground)' },
              { label: `우수 ${stats.good}`, bg: stats.good > 0 ? 'var(--info-light)' : 'var(--neutral-50)', color: stats.good > 0 ? 'var(--primary)' : 'var(--muted-foreground)' },
              { label: `재제출 ${stats.resubmit}`, bg: stats.resubmit > 0 ? 'oklch(94% 0.04 350)' : 'var(--neutral-50)', color: stats.resubmit > 0 ? 'oklch(35% 0.15 350)' : 'var(--muted-foreground)' },
            ].map(chip => (
              <span key={chip.label} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                background: chip.bg, color: chip.color, textAlign: 'center',
              }}>{chip.label}</span>
            ))}
          </div>

          {/* 문자 발송 */}
          <button className="btn btn-outline btn-sm" onClick={() => setSmsOverlay(true)} style={{ width: '100%', marginTop: 8 }}>문자 발송</button>

          {/* 전체 저장 버튼 */}
          <button className="btn btn-primary btn-sm" onClick={handleSave}
            disabled={saving || changedCount === 0}
            style={{ fontWeight: 700, width: '100%', marginTop: 4 }}>
            {saving ? '저장중...' : `전체 저장${changedCount > 0 ? ` (${changedCount}건)` : ''}`}
          </button>
          {msg && (
            <span style={{
              padding: '4px 12px', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, textAlign: 'center',
              background: msg.includes('실패') ? 'var(--destructive-light)' : 'var(--success-light)',
              color: msg.includes('실패') ? 'oklch(35% 0.15 25)' : 'oklch(30% 0.12 145)',
            }}>{msg}</span>
          )}
        </div>

        {/* 우측 테이블 영역 */}
        <div style={{ flex: 1, minWidth: 0 }}>

      {/* 특이사항 작성 가이드 */}
      {showGuide && (
        <div style={{
          padding: '14px 18px', marginBottom: 12, borderRadius: 'var(--radius)',
          background: 'var(--info-light)', border: '1px solid oklch(82% 0.06 260)', position: 'relative',
        }}>
          <button onClick={dismissGuide}
            style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--muted-foreground)' }}>✕</button>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(30% 0.08 230)', marginBottom: 10 }}>
            특이사항 작성 가이드 — 구체적으로 적어주실수록 학생에게 큰 도움이 됩니다!
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'oklch(30% 0.12 145)', marginBottom: 6 }}>좋은 예시</div>
              {[
                '문법 파트 중 조사 활용에서 반복적 오류 발생, 조사 구분 연습 프린트 추가 배부 예정',
                '독해 속도가 지난주 대비 향상됨, 특히 요약 정리가 깔끔해짐. 비문학 지문 연습 추천',
                '어휘력은 상위권이나 서술형 답안에서 근거 제시가 약함. 논증 구조 연습 필요',
                '고전시가 해석 능력 우수, 현대시와 비교 감상 활동 시 적극적으로 참여',
                '지난주 미제출이었으나 이번 주 과제 완성도 크게 향상. 꾸준히 격려 필요',
              ].map(ex => (
                <div key={ex} style={{ padding: '4px 8px', marginBottom: 4, borderRadius: 4, fontSize: 11, background: 'var(--success-light)', color: 'oklch(30% 0.12 145)', border: '1px solid oklch(90% 0.06 145)' }}>{ex}</div>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'oklch(35% 0.15 25)', marginBottom: 6 }}>나쁜 예시 (너무 짧거나 모호함)</div>
              {[
                '좋음',
                '노력 필요',
                '보통',
                '잘함',
                '미흡',
              ].map(ex => (
                <div key={ex} style={{ padding: '4px 8px', marginBottom: 4, borderRadius: 4, fontSize: 11, background: 'var(--destructive-light)', color: 'oklch(35% 0.15 25)', border: '1px solid oklch(88% 0.06 25)', textDecoration: 'line-through' }}>{ex}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>로딩중...</div>
        ) : students.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
            {allStudents.length > 0 ? '조건에 맞는 학생이 없습니다.' : '학생 데이터 없음'}
          </div>
        ) : (
          <>
            {/* 데스크톱 테이블 */}
            <div className="hw-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '10px 8px', width: 36, textAlign: 'center' }}>
                      <input type="checkbox" checked={students.length > 0 && checkedIds.size === students.length}
                        onChange={toggleAllChecks} style={{ cursor: 'pointer' }} />
                    </th>
                    <th style={{ padding: '10px 8px', fontSize: 12, fontWeight: 700, textAlign: 'left', color: 'var(--muted-foreground)' }}>이름</th>
                    {!filterGrade && <th style={{ padding: '10px 8px', fontSize: 12, fontWeight: 700, textAlign: 'left', color: 'var(--muted-foreground)' }}>학년</th>}
                    <th style={{ padding: '10px 8px', fontSize: 12, fontWeight: 700, textAlign: 'center', color: 'var(--muted-foreground)', width: 90 }}>제출</th>
                    <th style={{ padding: '10px 8px', fontSize: 12, fontWeight: 700, textAlign: 'center', color: 'var(--muted-foreground)', width: 90 }}>평가</th>
                    <th style={{ padding: '10px 8px', fontSize: 12, fontWeight: 700, textAlign: 'left', color: 'var(--muted-foreground)', minWidth: 280 }}>특이사항</th>
                    <th style={{ padding: '10px 8px', fontSize: 12, fontWeight: 700, textAlign: 'center', color: 'var(--muted-foreground)', width: 200 }}>액션</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, idx) => (
                    <tr key={s.studentId} style={{
                      borderBottom: '1px solid var(--neutral-100)',
                      background: s.changed ? 'var(--warning-light)' : idx % 2 === 0 ? 'var(--card)' : 'var(--neutral-50)',
                      transition: 'background 0.15s',
                    }}>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <input type="checkbox" checked={checkedIds.has(s.studentId)}
                          onChange={() => toggleCheck(s.studentId)} style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '8px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {s.changed && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', flexShrink: 0 }} />}
                          {s.name}
                        </div>
                      </td>
                      {!filterGrade && (
                        <td style={{ padding: '8px', fontSize: 12, color: 'var(--muted-foreground)' }}>{s.grade}</td>
                      )}
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <select value={s.submissionStatus}
                          onChange={e => update(s.studentId, 'submissionStatus', e.target.value)}
                          style={getSelectStyle('submissionStatus', s.submissionStatus)}>
                          <option value="">-</option>
                          <option value="제출">제출</option>
                          <option value="미제출">미제출</option>
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <select value={s.homeworkStatus}
                          onChange={e => update(s.studentId, 'homeworkStatus', e.target.value)}
                          style={getSelectStyle('homeworkStatus', s.homeworkStatus)}>
                          <option value="">-</option>
                          <option value="최우수">최우수</option>
                          <option value="우수">우수</option>
                          <option value="재제출">재제출</option>
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <textarea value={s.memo}
                          onChange={e => update(s.studentId, 'memo', e.target.value)}
                          placeholder={MEMO_PLACEHOLDERS[idx % MEMO_PLACEHOLDERS.length]}
                          rows={2}
                          style={{
                            width: '100%', padding: '5px 8px', borderRadius: 6,
                            border: '1px solid var(--border)', fontSize: 12,
                            fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical',
                            background: s.memo ? 'var(--warning-light)' : 'transparent',
                          }} />
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button onClick={() => handleSaveSingle(s)}
                            disabled={!s.changed}
                            style={{
                              padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: s.changed ? 'pointer' : 'default',
                              border: s.changed ? '1px solid var(--primary)' : '1px solid var(--border)',
                              background: s.changed ? 'var(--primary)' : 'var(--neutral-50)',
                              color: s.changed ? 'white' : 'var(--muted-foreground)',
                            }}>
                            저장
                          </button>
                          <button onClick={() => { setBonusModal({ studentId: s.studentId, name: s.name }); setBonusAmount('50'); setBonusReason(''); }}
                            style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid oklch(80% 0.14 85)', background: 'var(--warning-light)', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'oklch(35% 0.12 75)' }}>
                            포인트
                          </button>
                          <button onClick={() => setHistoryTarget({ studentId: s.studentId, name: s.name })}
                            style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>
                            기록
                          </button>
                          {s.record?.id && (
                            <button onClick={() => handleDeleteRecord(s.studentId)}
                              style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--destructive)', background: 'var(--destructive-light)', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'oklch(35% 0.15 25)' }}>
                              삭제
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 모바일 카드 리스트 */}
            <div className="hw-card-list">
              {students.map((s, idx) => (
                <div key={s.studentId} style={{
                  padding: '12px', borderBottom: '1px solid var(--border)',
                  background: s.changed ? 'var(--warning-light)' : 'var(--card)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={checkedIds.has(s.studentId)}
                        onChange={() => toggleCheck(s.studentId)} style={{ cursor: 'pointer' }} />
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</span>
                      {s.changed && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)' }} />}
                      {!filterGrade && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{s.grade}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button onClick={() => handleSaveSingle(s)} disabled={!s.changed}
                        style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: s.changed ? 'pointer' : 'default',
                          border: s.changed ? '1px solid var(--primary)' : '1px solid var(--border)',
                          background: s.changed ? 'var(--primary)' : 'var(--neutral-50)', color: s.changed ? 'white' : 'var(--muted-foreground)' }}>저장</button>
                      <button onClick={() => { setBonusModal({ studentId: s.studentId, name: s.name }); setBonusAmount('50'); setBonusReason(''); }}
                        style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid oklch(80% 0.14 85)', background: 'var(--warning-light)', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'oklch(35% 0.12 75)' }}>포인트</button>
                      <button onClick={() => setHistoryTarget({ studentId: s.studentId, name: s.name })}
                        style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>기록</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <select value={s.submissionStatus}
                      onChange={e => update(s.studentId, 'submissionStatus', e.target.value)}
                      style={{ ...getSelectStyle('submissionStatus', s.submissionStatus), flex: 1 }}>
                      <option value="">제출 -</option>
                      <option value="제출">제출</option>
                      <option value="미제출">미제출</option>
                    </select>
                    <select value={s.homeworkStatus}
                      onChange={e => update(s.studentId, 'homeworkStatus', e.target.value)}
                      style={{ ...getSelectStyle('homeworkStatus', s.homeworkStatus), flex: 1 }}>
                      <option value="">평가 -</option>
                      <option value="최우수">최우수</option>
                      <option value="우수">우수</option>
                      <option value="재제출">재제출</option>
                    </select>
                  </div>
                  <input type="text" value={s.memo}
                    onChange={e => update(s.studentId, 'memo', e.target.value)}
                    placeholder={MEMO_PLACEHOLDERS[idx % MEMO_PLACEHOLDERS.length]}
                    style={{
                      width: '100%', padding: '6px 8px', borderRadius: 6,
                      border: '1px solid var(--border)', fontSize: 12,
                      fontFamily: 'inherit', boxSizing: 'border-box',
                      background: s.memo ? 'var(--warning-light)' : 'transparent',
                    }} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
        </div>{/* /우측 테이블 영역 */}
      </div>{/* /hw-layout 가로 배치 */}

      {/* === 하단 일괄 액션 바 === */}
      {checkedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: 'var(--card)', borderTop: '2px solid var(--primary)',
          padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8,
          justifyContent: 'center', flexWrap: 'wrap',
          boxShadow: '0 -4px 20px oklch(0% 0 0 / 0.1)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{checkedIds.size}명 선택</span>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          {[
            { label: '제출', field: 'submissionStatus', val: '제출', bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)' },
            { label: '미제출', field: 'submissionStatus', val: '미제출', bg: 'var(--destructive-light)', color: 'oklch(35% 0.15 25)' },
            { label: '최우수', field: 'homeworkStatus', val: '최우수', bg: 'var(--warning-light)', color: 'oklch(35% 0.12 75)' },
            { label: '우수', field: 'homeworkStatus', val: '우수', bg: 'var(--info-light)', color: 'var(--primary)' },
            { label: '재제출', field: 'homeworkStatus', val: '재제출', bg: 'oklch(94% 0.04 350)', color: 'oklch(35% 0.15 350)' },
          ].map(b => (
            <button key={b.label} onClick={() => bulkUpdateField(b.field, b.val)}
              style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: b.bg, color: b.color }}>
              {b.label}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <button onClick={() => { setBulkBonusModal(true); setBulkAmount('50'); setBulkReason(''); }}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid oklch(80% 0.14 85)', background: 'var(--warning-light)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'oklch(35% 0.12 75)' }}>
            ⭐ 포인트
          </button>
          <button onClick={() => setCheckedIds(new Set())}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: 12, color: 'var(--muted-foreground)' }}>
            선택 해제
          </button>
        </div>
      )}

      {/* === 누적 기록 모달 === */}
      {historyTarget && (
        <>
          <div onClick={() => setHistoryTarget(null)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 10000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', width: 480, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto',
            zIndex: 10001, boxShadow: '0 20px 60px oklch(0% 0 0 / 0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📊 {historyTarget.name} 과제 기록</h3>
              <button onClick={() => setHistoryTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--muted-foreground)' }}>✕</button>
            </div>
            {histLoading ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted-foreground)', fontSize: 12 }}>로딩중...</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted-foreground)', fontSize: 12 }}>기록이 없습니다.</div>
            ) : (
              <div>
                {history.map(r => {
                  const sBadge = getSubmitBadge(r.submission_status);
                  const gBadge = getGradeBadge(r.homework_status);
                  return (
                    <div key={r.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--neutral-50)', fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12, minWidth: 80 }}>{r.date}</span>
                        {sBadge && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: sBadge.bg, color: sBadge.color }}>{sBadge.text}</span>}
                        {gBadge && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: gBadge.bg, color: gBadge.color }}>{gBadge.text}</span>}
                      </div>
                      {r.memo && <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4, whiteSpace: 'pre-wrap', paddingLeft: 86 }}>{r.memo}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* === SMS 오버레이 === */}
      {smsOverlay && (
        <>
          <div onClick={() => setSmsOverlay(false)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 10000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', width: 400, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto',
            zIndex: 10001, boxShadow: '0 20px 60px oklch(0% 0 0 / 0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>과제 현황 문자 발송</h3>
              <button onClick={() => setSmsOverlay(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--muted-foreground)' }}>✕</button>
            </div>

            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>발송 대상</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {[
                  { val: 'parent', label: '학부모' },
                  { val: 'student', label: '학생' },
                  { val: 'both', label: '동시' },
                ].map(t => (
                  <button key={t.val} onClick={() => setSmsTarget(t.val)}
                    className={`btn btn-sm ${smsTarget === t.val ? 'btn-primary' : 'btn-outline'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: '6px 10px', background: 'var(--info-light)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-3)', fontSize: 12, color: 'oklch(38% 0.10 230)' }}>
              과제 현황 입력된 학생 ({students.filter(s => s.submissionStatus || s.homeworkStatus).length}명)에게 발송
            </div>

            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>메시지 템플릿</label>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
                변수: {'{name}'} {'{school}'} {'{grade}'} {'{submit}'} {'{eval}'} {'{memo}'} {'{memo_line}'} {'{date}'}
              </div>
              <textarea value={smsTemplate} onChange={e => setSmsTemplate(e.target.value)} rows={5}
                style={{ width: '100%', padding: isLg ? '10px 12px' : '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: isLg ? 15 : 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
            </div>

            <button className="btn btn-primary" onClick={handleSendSms} disabled={smsSending} style={{ width: '100%', fontWeight: 700 }}>
              {smsSending ? '발송 중...' : `${getSmsTargets().length}건 발송`}
            </button>

            {smsResult && (
              <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: 12,
                background: smsResult.fail > 0 ? 'var(--warning-light)' : 'var(--success-light)',
                color: smsResult.fail > 0 ? 'oklch(35% 0.12 75)' : 'oklch(30% 0.12 145)' }}>
                성공 {smsResult.success}건 / 실패 {smsResult.fail}건
                {smsResult.errors?.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 11, color: 'oklch(35% 0.15 25)' }}>
                    {smsResult.errors.map((e, i) => <div key={i}>{e.name}: {e.error}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* === 포인트 모달 === */}
      {bonusModal && (
        <>
          <div onClick={() => setBonusModal(null)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 10000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: 320, zIndex: 10001,
            boxShadow: '0 20px 60px oklch(0% 0 0 / 0.3)',
          }}>
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>⭐ 특별 포인트 지급</h3>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 'var(--space-3)' }}><strong>{bonusModal.name}</strong></p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 10 }}>
              {[
                { label: '최우수', amount: 100, reason: '최우수 과제', bg: 'oklch(85% 0.10 85)', color: 'oklch(35% 0.12 75)' },
                { label: '우수', amount: 50, reason: '우수 과제', bg: 'var(--info-light)', color: 'var(--primary)' },
              ].map(p => (
                <button key={p.label} onClick={() => { setBonusAmount(String(p.amount)); setBonusReason(p.reason); }}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: 'var(--text-sm)', background: p.bg, color: p.color, textAlign: 'center',
                  }}>
                  <div>{p.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2 }}>{p.amount}P</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 10 }}>
              {[30, 50, 100, 200].map(v => (
                <button key={v} onClick={() => setBonusAmount(String(v))}
                  style={{
                    flex: 1, padding: 'var(--space-2) 0', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: 'var(--text-xs)',
                    background: bonusAmount === String(v) ? 'var(--primary)' : 'var(--neutral-50)',
                    color: bonusAmount === String(v) ? 'white' : 'var(--foreground)',
                  }}>{v}P</button>
              ))}
            </div>
            <input type="number" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)}
              min="1" placeholder="직접 입력"
              style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 10, fontSize: 'var(--text-sm)', boxSizing: 'border-box' }} />
            <input value={bonusReason} onChange={e => setBonusReason(e.target.value)}
              placeholder="사유 (예: 최우수 과제)"
              style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-3)', fontSize: 13, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-outline" onClick={() => setBonusModal(null)} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={handleBonus} style={{ flex: 1 }}>지급</button>
            </div>
          </div>
        </>
      )}

      {/* === 일괄 포인트 모달 === */}
      {bulkBonusModal && (
        <>
          <div onClick={() => setBulkBonusModal(false)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 10000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: 340, zIndex: 10001,
            boxShadow: '0 20px 60px oklch(0% 0 0 / 0.3)',
          }}>
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>⭐ 일괄 포인트 지급</h3>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 'var(--space-3)' }}>
              <strong>{checkedIds.size}명</strong> 선택됨
            </p>
            <div style={{ maxHeight: 100, overflowY: 'auto', marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--neutral-50)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--muted-foreground)' }}>
              {students.filter(s => checkedIds.has(s.studentId)).map(s => s.name).join(', ')}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 10 }}>
              {[30, 50, 100, 200].map(v => (
                <button key={v} onClick={() => setBulkAmount(String(v))}
                  style={{
                    flex: 1, padding: 'var(--space-2) 0', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: 'var(--text-xs)',
                    background: bulkAmount === String(v) ? 'var(--primary)' : 'var(--neutral-50)',
                    color: bulkAmount === String(v) ? 'white' : 'var(--foreground)',
                  }}>{v}P</button>
              ))}
            </div>
            <input type="number" value={bulkAmount} onChange={e => setBulkAmount(e.target.value)}
              min="1" placeholder="포인트 직접 입력"
              style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 10, fontSize: 'var(--text-sm)', boxSizing: 'border-box' }} />
            <input value={bulkReason} onChange={e => setBulkReason(e.target.value)}
              placeholder="사유 (예: 과제 우수)"
              style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-3)', fontSize: 13, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-outline" onClick={() => setBulkBonusModal(false)} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={handleBulkBonus} disabled={bulkSending} style={{ flex: 1 }}>
                {bulkSending ? '지급 중...' : `${checkedIds.size}명 지급`}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        .hw-table-wrap { display: block; }
        .hw-card-list { display: none; }
        .hw-layout { display: flex; }
        .hw-sidebar { display: flex; }
        @media (max-width: 900px) {
          .hw-layout { flex-direction: column !important; }
          .hw-sidebar { width: 100% !important; min-width: 0 !important; flex-direction: row !important; flex-wrap: wrap !important; align-items: center !important; }
          .hw-sidebar select, .hw-sidebar input[type="date"] { flex: 1; min-width: 120px; }
        }
        @media (max-width: 768px) {
          .hw-table-wrap { display: none !important; }
          .hw-card-list { display: block !important; }
        }
      `}</style>
    </div>
  );
}
