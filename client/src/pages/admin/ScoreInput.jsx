import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { useTenantConfig, getAllGrades } from '../../contexts/TenantContext';
import { BarChart, Bar, AreaChart, Area, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, ZAxis } from 'recharts';

export default function ScoreInput() {
  const { config } = useTenantConfig();
  const schools = config?.schools || [];
  const EXAM_MAJOR_CATEGORIES = (config?.examTypes || []).map(c => ({
    ...c,
    key: c?.key || c?.label || '',
    label: c?.label || '',
    types: Array.isArray(c?.types) ? c.types.filter(Boolean) : [],
  }));
  const EXAM_TYPES = EXAM_MAJOR_CATEGORIES.flatMap(c => c.types);
  const [searchParams] = useSearchParams();
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [scoreInputs, setScoreInputs] = useState({});
  const [newExam, setNewExam] = useState({ examType: '', name: '', examDate: '', school: '', grade: '', maxScore: 100 });
  const [customExamType, setCustomExamType] = useState(false);
  const [editExamId, setEditExamId] = useState(null);
  const [msg, setMsg] = useState('');
  const [mainTab, setMainTab] = useState('examScore'); // examScore | answerKey | omrInput
  const [filterType, setFilterType] = useState('');

  // === 평가 기준 (등급컷 + 통과 커트라인) ===
  const DEFAULT_GRADE_CUTS = [
    { label: '1등급', min: 90 }, { label: '2등급', min: 80 }, { label: '3등급', min: 70 },
    { label: '4등급', min: 60 }, { label: '5등급', min: 0 },
  ];
  const DEFAULT_PASS = { enabled: false, pass_score: 60, pass_label: '통과', fail_label: '재시험' };
  const [evalCriteria, setEvalCriteria] = useState({
    apply_grade_cuts: false,
    grade_cuts: DEFAULT_GRADE_CUTS,
    pass_criteria: DEFAULT_PASS,
  });
  const [showEvalCriteria, setShowEvalCriteria] = useState(false);
  const [examScoreCounts, setExamScoreCounts] = useState({});

  const loadExams = () => api('/scores/exams').then(data => {
    setExams(data);
    // Load score counts for each exam
    data.forEach(exam => {
      api(`/scores/exams/${exam.id}/scores`).then(scores => {
        setExamScoreCounts(prev => ({ ...prev, [exam.id]: scores.length }));
      }).catch(() => {});
    });
  }).catch(console.error);
  const loadStudents = () => api('/admin/students').then(setStudents).catch(console.error);

  useEffect(() => { loadExams(); loadStudents(); }, []);

  useEffect(() => {
    const examParam = searchParams.get('exam');
    if (examParam && exams.length > 0) {
      const examId = parseInt(examParam);
      if (exams.find(e => e.id === examId)) selectExam(examId);
    }
  }, [exams, searchParams]);

  // === 시험 등록/수정 ===
  const createExam = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        examType: newExam.examType, name: newExam.name,
        examDate: newExam.examDate || null, school: newExam.school || null,
        grade: newExam.grade || null, maxScore: parseFloat(newExam.maxScore) || 100
      };
      if (editExamId) {
        await apiPut(`/scores/exams/${editExamId}`, payload);
        setMsg('시험이 수정되었습니다.');
        setEditExamId(null);
      } else {
        await apiPost('/scores/exams', payload);
        setMsg('시험이 등록되었습니다.');
      }
      setNewExam({ examType: '', name: '', examDate: '', school: '', grade: '', maxScore: 100 });
      loadExams();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  const startEditExam = (exam) => {
    setNewExam({
      examType: exam.exam_type, name: exam.name,
      examDate: exam.exam_date || '', school: exam.school || '',
      grade: exam.grade || '', maxScore: exam.max_score || 100
    });
    setEditExamId(exam.id);
  };

  const deleteExam = async (examId) => {
    if (!confirm('이 시험과 관련 성적을 모두 삭제하시겠습니까?')) return;
    await apiDelete(`/scores/exams/${examId}`);
    loadExams();
    if (selectedExam === examId) setSelectedExam(null);
  };

  const selectExam = async (examId) => {
    setSelectedExam(examId);
    try {
      const scores = await api(`/scores/exams/${examId}/scores`);
      const inputs = {};
      scores.forEach(s => { inputs[s.student_id] = { score: s.score, note: s.note || '', rankNum: s.rank_num, scoreId: s.id, status: s.status || 'normal' }; });
      setScoreInputs(inputs);
    } catch (e) { setMsg('성적 데이터 로드 실패: ' + e.message); }
  };

  // 평가 기준 로드/저장
  const loadEvalCriteria = async (examId) => {
    try {
      const data = await api(`/scores/exams/${examId}/grade-cuts`);
      if (!data || !data.grade_cuts) {
        setEvalCriteria({ apply_grade_cuts: false, grade_cuts: DEFAULT_GRADE_CUTS, pass_criteria: DEFAULT_PASS });
        return;
      }
      if (Array.isArray(data.grade_cuts)) {
        setEvalCriteria({ apply_grade_cuts: true, grade_cuts: data.grade_cuts, pass_criteria: DEFAULT_PASS });
      } else if (data.grade_cuts.version === 2) {
        setEvalCriteria(data.grade_cuts);
      }
    } catch { setEvalCriteria({ apply_grade_cuts: false, grade_cuts: DEFAULT_GRADE_CUTS, pass_criteria: DEFAULT_PASS }); }
  };

  const saveEvalCriteria = async () => {
    if (!selectedExam) return;
    try {
      await apiPut(`/scores/exams/${selectedExam}/grade-cuts`, {
        grade_cuts: { version: 2, ...evalCriteria }
      });
      setMsg('평가 기준이 저장되었습니다.');
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  // 등급/통과 판정 헬퍼
  const getGrade = (score) => {
    if (!evalCriteria.apply_grade_cuts || score === '' || score === undefined) return '-';
    const sorted = [...evalCriteria.grade_cuts].sort((a, b) => b.min - a.min);
    for (const g of sorted) {
      if (parseFloat(score) >= g.min) return g.label;
    }
    return sorted[sorted.length - 1]?.label || '-';
  };

  const getPassStatus = (score) => {
    if (!evalCriteria.pass_criteria.enabled || score === '' || score === undefined) return null;
    return parseFloat(score) >= evalCriteria.pass_criteria.pass_score;
  };

  // Tab/Enter 키보드 네비게이션
  const handleScoreKeyDown = (e, studentIndex) => {
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      const nextInput = document.querySelector(`[data-score-idx="${studentIndex + 1}"]`);
      if (nextInput) nextInput.focus();
    }
  };

  const updateScoreInput = (studentId, field, value) => {
    setScoreInputs(prev => ({ ...prev, [studentId]: { ...(prev[studentId] || { score: '', note: '', status: 'normal' }), [field]: value } }));
  };

  const saveScores = async () => {
    const scores = Object.entries(scoreInputs)
      .filter(([_, v]) => v.score !== '' && v.score !== undefined || (v.status && v.status !== 'normal'))
      .map(([studentId, v]) => ({
        studentId: parseInt(studentId),
        score: v.status && v.status !== 'normal' ? 0 : parseFloat(v.score),
        note: v.note || '',
        status: v.status || 'normal',
      }));
    if (scores.length === 0) { setMsg('입력된 성적이 없습니다.'); return; }
    try {
      await apiPost('/scores/batch', { examId: selectedExam, scores });
      setMsg(`${scores.length}명의 성적이 저장되었습니다. (등수 자동 계산 완료)`);
      const updatedScores = await api(`/scores/exams/${selectedExam}/scores`);
      const inputs = {};
      updatedScores.forEach(s => { inputs[s.student_id] = { score: s.score, note: s.note || '', rankNum: s.rank_num, scoreId: s.id, status: s.status || 'normal' }; });
      setScoreInputs(inputs);
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message); }
  };

  const SCORE_STATUSES = [
    { value: 'normal', label: '응시', color: 'var(--foreground)' },
    { value: 'absent', label: '결석', color: 'var(--destructive)' },
    { value: 'not_taken', label: '미응시', color: 'var(--neutral-400)' },
    { value: 'retest', label: '재시험', color: 'var(--warning)' },
  ];

  // === 정답키 state ===
  const [akExamId, setAkExamId] = useState('');
  const [akNumQuestions, setAkNumQuestions] = useState(20);
  const [akNumChoices, setAkNumChoices] = useState(5);
  const [akScoringType, setAkScoringType] = useState('equal');
  const [akMaxScore, setAkMaxScore] = useState(100);
  const [akDefaultPoints, setAkDefaultPoints] = useState(5);
  const [akAnswers, setAkAnswers] = useState({});
  const [akPoints, setAkPoints] = useState({});
  const [akLoading, setAkLoading] = useState(false);
  const [akExistingKey, setAkExistingKey] = useState(false);

  // === OMR state ===
  const [omrExams, setOmrExams] = useState([]);
  const [omrExamId, setOmrExamId] = useState('');
  const [omrAnswerKey, setOmrAnswerKey] = useState(null);
  const [omrFilterSchool, setOmrFilterSchool] = useState('');
  const [omrFilterGrade, setOmrFilterGrade] = useState('');
  const [omrExpandedStudent, setOmrExpandedStudent] = useState(null);
  const [omrStudentAnswers, setOmrStudentAnswers] = useState({});
  const [omrSubmissions, setOmrSubmissions] = useState({});
  const [omrQuestionStats, setOmrQuestionStats] = useState([]);
  const [omrLoading, setOmrLoading] = useState(false);

  // === 정답키 함수 ===
  const loadAnswerKey = async (examId) => {
    if (!examId) return;
    setAkLoading(true);
    try {
      const data = await api(`/scores/exams/${examId}/answer-key`);
      if (data && data.answer_key) {
        const key = typeof data.answer_key === 'string' ? JSON.parse(data.answer_key) : data.answer_key;
        setAkNumQuestions(key.numQuestions || 20);
        setAkNumChoices(key.numChoices || 5);
        setAkScoringType(key.scoringType || 'equal');
        setAkMaxScore(key.maxScore || 100);
        setAkDefaultPoints(key.defaultPoints || 5);
        const ans = {}, pts = {};
        (key.questions || []).forEach(q => { ans[q.num] = q.answer; if (q.points !== undefined) pts[q.num] = q.points; });
        setAkAnswers(ans);
        setAkPoints(pts);
        setAkExistingKey(true);
      } else { resetAnswerKeyForm(); setAkExistingKey(false); }
    } catch (e) { resetAnswerKeyForm(); setAkExistingKey(false); }
    setAkLoading(false);
  };

  const resetAnswerKeyForm = () => {
    setAkAnswers({}); setAkPoints({});
    setAkNumQuestions(20); setAkNumChoices(5);
    setAkScoringType('equal'); setAkMaxScore(100); setAkDefaultPoints(5);
  };

  const saveAnswerKey = async () => {
    if (!akExamId) { setMsg('시험을 선택하세요.'); return; }
    const questions = [];
    for (let i = 1; i <= akNumQuestions; i++) {
      if (!akAnswers[i]) { setMsg(`${i}번 문항의 정답을 선택하세요.`); return; }
      const q = { num: i, answer: akAnswers[i] };
      if (akScoringType === 'individual') q.points = akPoints[i] !== undefined ? parseFloat(akPoints[i]) : akDefaultPoints;
      questions.push(q);
    }
    try {
      await apiPost(`/scores/exams/${akExamId}/answer-key`, {
        numQuestions: akNumQuestions, numChoices: akNumChoices, scoringType: akScoringType,
        maxScore: akMaxScore, defaultPoints: akDefaultPoints, questions
      });
      setMsg('정답키가 저장되었습니다.'); setAkExistingKey(true);
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  const deleteAnswerKey = async () => {
    if (!akExamId || !confirm('정답키를 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/scores/exams/${akExamId}/answer-key`);
      resetAnswerKeyForm(); setAkExistingKey(false);
      setMsg('정답키가 삭제되었습니다.');
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  // === OMR 함수 ===
  const loadOmrExams = async () => {
    try { const data = await api('/scores/exams-with-keys'); setOmrExams(data); }
    catch (e) { setOmrExams([]); }
  };

  const loadOmrData = async (examId) => {
    if (!examId) return;
    setOmrLoading(true);
    try {
      const [keyData, subsData, statsData] = await Promise.all([
        api(`/scores/exams/${examId}/answer-key`),
        api(`/scores/exams/${examId}/submissions`),
        api(`/scores/exams/${examId}/question-stats`)
      ]);
      if (keyData && keyData.answer_key) {
        const key = typeof keyData.answer_key === 'string' ? JSON.parse(keyData.answer_key) : keyData.answer_key;
        setOmrAnswerKey(key);
      }
      const subs = {}, studentAnswerMap = {};
      (subsData || []).forEach(sub => {
        subs[sub.student_id] = sub;
        if (sub.answers) {
          const ans = typeof sub.answers === 'string' ? JSON.parse(sub.answers) : sub.answers;
          const mapped = {};
          (ans || []).forEach(a => { mapped[a.num] = a.answer; });
          studentAnswerMap[sub.student_id] = mapped;
        }
      });
      setOmrSubmissions(subs); setOmrStudentAnswers(studentAnswerMap); setOmrQuestionStats(statsData || []);
    } catch (err) { setMsg('OMR 데이터 로드 실패: ' + err.message); }
    setOmrLoading(false);
  };

  const setOmrAnswer = (studentId, qNum, answer) => {
    setOmrStudentAnswers(prev => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [qNum]: answer } }));
  };

  const calculateOmrScore = (studentId) => {
    if (!omrAnswerKey || !omrStudentAnswers[studentId]) return { correct: 0, total: 0, score: 0 };
    const key = omrAnswerKey;
    const answers = omrStudentAnswers[studentId];
    let correct = 0, totalScore = 0;
    const numQ = key.numQuestions || 0;
    const equalPoints = numQ > 0 ? (key.maxScore || 100) / numQ : 0;
    for (let i = 1; i <= numQ; i++) {
      const keyQ = (key.questions || []).find(q => q.num === i);
      if (keyQ && answers[i] === keyQ.answer) {
        correct++;
        totalScore += key.scoringType === 'individual' ? (keyQ.points !== undefined ? keyQ.points : (key.defaultPoints || 0)) : equalPoints;
      }
    }
    return { correct, total: numQ, score: Math.round(totalScore * 100) / 100 };
  };

  const saveOmrAnswers = async () => {
    if (!omrExamId || !omrAnswerKey) return;
    const submissions = [];
    Object.entries(omrStudentAnswers).forEach(([studentId, answers]) => {
      const answerList = [];
      for (let i = 1; i <= omrAnswerKey.numQuestions; i++) {
        if (answers[i]) answerList.push({ num: i, answer: answers[i] });
      }
      if (answerList.length > 0) {
        const result = calculateOmrScore(parseInt(studentId));
        submissions.push({ studentId: parseInt(studentId), answers: answerList, score: result.score });
      }
    });
    if (submissions.length === 0) { setMsg('입력된 답안이 없습니다.'); return; }
    try {
      await apiPost(`/scores/exams/${omrExamId}/submit-answers-batch`, { submissions });
      setMsg(`${submissions.length}명의 답안이 저장되었습니다.`);
      loadOmrData(omrExamId);
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message); }
  };

  // 분포도
  const [showDist, setShowDist] = useState(false);
  const [distribution, setDistribution] = useState(null);

  const loadDistribution = async (examId) => {
    if (showDist && distribution) { setShowDist(false); return; }
    try { const data = await api(`/scores/exams/${examId}/distribution`); setDistribution(data); setShowDist(true); }
    catch (e) { setMsg('분포 데이터 로드 실패: ' + e.message); }
  };

  const generateNormalDist = (dist) => {
    if (!dist || !dist.average || !dist.stdDev || dist.stdDev === 0) return [];
    const { average, stdDev, max_score } = dist;
    const maxS = max_score || 100;
    const points = [];
    for (let x = 0; x <= maxS; x += Math.max(1, Math.round(maxS / 50))) {
      const z = (x - average) / stdDev;
      const density = Math.round((1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z) * 10000) / 100;
      points.push({ score: x, density });
    }
    return points;
  };

  const exam = exams.find(e => e.id === selectedExam);
  const filteredStudents = exam
    ? students.filter(s => {
        if (exam.school && s.school !== exam.school) return false;
        if (exam.grade && s.grade !== exam.grade) return false;
        return true;
      })
    : students;

  const studentsBySchool = {};
  filteredStudents.forEach(s => {
    const key = s.school || '기타';
    if (!studentsBySchool[key]) studentsBySchool[key] = [];
    studentsBySchool[key].push(s);
  });
  const schoolGroups = Object.entries(studentsBySchool).sort((a, b) => a[0].localeCompare(b[0]));
  const hasMultipleSchools = schoolGroups.length > 1;

  // 시험 선택 시 평가 기준 로드
  useEffect(() => {
    if (selectedExam) loadEvalCriteria(selectedExam);
  }, [selectedExam]);

  const gradeOptions = newExam.school ? getAllGrades(newExam.school) : ['1학년', '2학년', '3학년'];
  const [filterSchool, setFilterSchool] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const filteredExams = exams.filter(e => {
    if (filterType) {
      const cat = EXAM_MAJOR_CATEGORIES.find(c => c.key === filterType);
      if (cat && !cat.types.includes(e.exam_type)) return false;
      if (!cat && e.exam_type !== filterType) return false;
    }
    if (filterSchool && e.school && e.school !== filterSchool) return false;
    if (filterGrade && e.grade && e.grade !== filterGrade) return false;
    return true;
  });
  const examGrades = [...new Set(exams.filter(e => !filterSchool || e.school === filterSchool).map(e => e.grade).filter(Boolean))].sort();

  // 문자 발송
  const [smsMode, setSmsMode] = useState(false);
  const [smsTemplate, setSmsTemplate] = useState('');
  const [smsTargets, setSmsTargets] = useState([]);
  const [smsSending, setSmsSending] = useState(false);
  const [smsTargetType, setSmsTargetType] = useState('parent'); // 'parent' | 'student' | 'both'

  const prepareSms = () => {
    if (!exam || !selectedExam) return;
    const targets = [];
    filteredStudents.forEach(s => {
      const sc = scoreInputs[s.id];
      if (sc && sc.score !== '' && sc.score !== undefined) {
        const hasParentPhone = !!s.parent_phone;
        const hasStudentPhone = !!s.phone;
        if (hasParentPhone || hasStudentPhone) {
          targets.push({
            studentId: s.id, name: s.name, school: s.school, grade: s.grade,
            score: sc.score, rankNum: sc.rankNum,
            phone: s.phone, parentPhone: s.parent_phone,
            parentName: s.parent_name || ''
          });
        }
      }
    });
    setSmsTargets(targets);
    const defaultTmpl = `[${config?.academyName || '나만의 조교'}]\n${exam.name} 성적 안내\n\n{name} 학생: {score}점 / ${exam.max_score}점{rank}\n\n감사합니다.`;
    setSmsTemplate(defaultTmpl);
    setSmsMode(true);
  };

  const getSmsPhone = (t) => smsTargetType === 'parent' ? t.parentPhone : t.phone;
  const smsValidTargets = smsTargetType === 'both'
    ? smsTargets.filter(t => t.parentPhone || t.phone)
    : smsTargets.filter(t => getSmsPhone(t));
  const smsTotalMessages = smsTargetType === 'both'
    ? smsValidTargets.reduce((n, t) => n + (t.parentPhone ? 1 : 0) + (t.phone ? 1 : 0), 0)
    : smsValidTargets.length;

  const sendScoreSms = async () => {
    if (smsValidTargets.length === 0) { setMsg('발송 대상이 없습니다.'); return; }
    setSmsSending(true);
    try {
      const applyTmpl = (t) => smsTemplate
        .replace(/{name}/g, t.name)
        .replace(/{score}/g, String(t.score))
        .replace(/{rank}/g, t.rankNum ? ` (${t.rankNum}등)` : '')
        .replace(/{school}/g, t.school || '')
        .replace(/{grade}/g, t.grade || '')
        .replace(/{parent}/g, t.parentName || '학부모');

      const messages = [];
      smsValidTargets.forEach(t => {
        const content = applyTmpl(t);
        if (smsTargetType === 'both') {
          if (t.parentPhone) messages.push({ to: t.parentPhone, content });
          if (t.phone) messages.push({ to: t.phone, content });
        } else {
          const phone = getSmsPhone(t);
          if (phone) messages.push({ to: phone, content });
        }
      });

      await apiPost('/sms/send-individual', { messages });
      setMsg(`${messages.length}건 성적 문자 발송 완료!`);
      setSmsMode(false);
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(`문자 발송 실패: ${err.message}`); }
    setSmsSending(false);
  };

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>시험 성적</span>
      </div>

      {/* 메인 탭: 3개 */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab ${mainTab === 'examScore' ? 'active' : ''}`}
          onClick={() => setMainTab('examScore')}>
          📊 시험 & 성적
        </button>
        <button className={`tab ${mainTab === 'answerKey' ? 'active' : ''}`}
          onClick={() => setMainTab('answerKey')}>
          📝 정답키 설정
        </button>
        <button className={`tab ${mainTab === 'omrInput' ? 'active' : ''}`}
          onClick={() => { setMainTab('omrInput'); loadOmrExams(); }}>
          📋 OMR 입력
        </button>
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: 12 }}>{msg}</div>}

      {/* ═══════════════════════════════════════════════ */}
      {/* 탭 1: 시험 & 성적 — 가로 2열 */}
      {/* ═══════════════════════════════════════════════ */}
      {mainTab === 'examScore' && (
        <div className="score-3col" style={{ display: 'grid', gridTemplateColumns: '260px 280px 1fr', gap: 'var(--space-3, 12px)', alignItems: 'start' }}>

          {/* === Column 1: 시험 등록 === */}
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ fontSize: 16, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                ✏️ {editExamId ? '시험 수정' : '시험 등록'}
              </h3>
              <form onSubmit={createExam}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>시험 분류 *</label>
                  {customExamType ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={newExam.examType} onChange={e => setNewExam({ ...newExam, examType: e.target.value })}
                        placeholder="시험 분류를 직접 입력" style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} autoFocus />
                      <button type="button" onClick={() => { setCustomExamType(false); setNewExam({ ...newExam, examType: EXAM_TYPES[0] || '' }); }}
                        style={{ padding: '6px 10px', fontSize: 12, background: 'var(--border)', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>목록</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select value={newExam.examType} onChange={e => setNewExam({ ...newExam, examType: e.target.value })}
                        style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                        {EXAM_MAJOR_CATEGORIES.map(cat => (
                          <optgroup key={cat.key} label={cat.label}>
                            {cat.types.map(t => <option key={t} value={t}>{t}</option>)}
                          </optgroup>
                        ))}
                      </select>
                      <button type="button" onClick={() => { setCustomExamType(true); setNewExam({ ...newExam, examType: '' }); }}
                        style={{ padding: '6px 10px', fontSize: 12, background: 'var(--border)', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>✏️ 직접</button>
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>시험명 *</label>
                  <input value={newExam.name} onChange={e => setNewExam({ ...newExam, name: e.target.value })} placeholder="예: 3월 모의고사" required
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>시험 날짜</label>
                    <input type="date" value={newExam.examDate} onChange={e => setNewExam({ ...newExam, examDate: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>만점</label>
                    <input type="number" value={newExam.maxScore} onChange={e => setNewExam({ ...newExam, maxScore: e.target.value })} min="1" placeholder="100"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>학교</label>
                    <select value={newExam.school} onChange={e => setNewExam({ ...newExam, school: e.target.value, grade: '' })}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                      <option value="">전체</option>
                      {schools.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>학년</label>
                    <select value={newExam.grade} onChange={e => setNewExam({ ...newExam, grade: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                      <option value="">전체</option>
                      {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, fontSize: 13 }}>{editExamId ? '시험 수정' : '시험 등록'}</button>
                  {editExamId && (
                    <button type="button" className="btn btn-outline" style={{ fontSize: 13 }} onClick={() => {
                      setEditExamId(null);
                      setNewExam({ examType: '', name: '', examDate: '', school: '', grade: '', maxScore: 100 });
                    }}>취소</button>
                  )}
                </div>
              </form>
            </div>

          {/* === Column 2: 시험 목록 === */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>📋 시험 목록</h3>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{filteredExams.length}개</span>
              </div>
              {/* 필터 */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setFilterType('')}
                  className={`btn btn-sm ${!filterType ? 'btn-primary' : 'btn-outline'}`} style={{ fontSize: 11, padding: '3px 8px' }}>
                  전체
                </button>
                {EXAM_MAJOR_CATEGORIES.map(cat => {
                  const cnt = exams.filter(e => cat.types.includes(e.exam_type)).length;
                  if (cnt === 0) return null;
                  return (
                    <button key={cat.key} onClick={() => setFilterType(filterType === cat.key ? '' : cat.key)}
                      style={filterType === cat.key ? {} : { background: cat.bg, color: cat.color, borderColor: cat.color + '40' }}
                      className={`btn btn-sm ${filterType === cat.key ? 'btn-primary' : 'btn-outline'}`}>
                      {cat.emoji} ({cnt})
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <select value={filterSchool} onChange={e => { setFilterSchool(e.target.value); setFilterGrade(''); }}
                  style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
                  <option value="">전체 학교</option>
                  {schools.filter(s => s.name !== '조교' && s.name !== '선생님').map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
                <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
                  style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
                  <option value="">전체 학년</option>
                  {examGrades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              {filteredExams.length === 0 ? (
                <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 20, fontSize: 13 }}>등록된 시험이 없습니다.</p>
              ) : (
                <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                  {(() => {
                    const getMajorCategory = (examType) => {
                      const cat = EXAM_MAJOR_CATEGORIES.find(c => c.types.includes(examType));
                      return cat || { key: 'etc', label: '기타', emoji: '📋', color: 'var(--muted-foreground)', bg: 'var(--neutral-100)' };
                    };
                    const groups = {};
                    filteredExams.forEach(e => {
                      const cat = getMajorCategory(e.exam_type);
                      if (!groups[cat.key]) groups[cat.key] = { cat, items: [] };
                      groups[cat.key].items.push(e);
                    });
                    return Object.values(groups).map(({ cat, items }) => (
                      <div key={cat.key} style={{ marginBottom: 12 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 700, color: cat.color, padding: '5px 10px',
                          background: cat.bg, borderRadius: 6, marginBottom: 4,
                          borderLeft: `3px solid ${cat.color}`,
                        }}>
                          {cat.emoji} {cat.label.replace(/^. /, '')} ({items.length})
                        </div>
                        {items.map(e => (
                          <div key={e.id} style={{
                            display: 'flex', alignItems: 'center', padding: '8px 10px',
                            borderBottom: '1px solid var(--neutral-100)', gap: 6, fontSize: 12,
                            background: selectedExam === e.id ? 'var(--primary-lighter)' : 'transparent',
                            borderRadius: 4, cursor: 'pointer',
                          }} onClick={() => selectExam(e.id)}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                {e.exam_date || '날짜미정'} · {e.max_score}점{e.school ? ` · ${e.school}` : ''}{e.grade ? ` ${e.grade}` : ''}
                                {examScoreCounts[e.id] !== undefined && (
                                  <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: examScoreCounts[e.id] > 0 ? 'var(--success)' : 'var(--neutral-100)', color: examScoreCounts[e.id] > 0 ? 'white' : 'var(--muted-foreground)' }}>
                                    입력 {examScoreCounts[e.id]}명
                                  </span>
                                )}
                                {e.grade_cuts && <span style={{ fontSize: 10, color: 'var(--primary)' }} title="등급컷 설정됨">📐</span>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                              <button className="btn btn-outline btn-sm" onClick={(ev) => { ev.stopPropagation(); startEditExam(e); }}
                                style={{ fontSize: 10, padding: '3px 6px' }}>수정</button>
                              <button className="btn btn-danger btn-sm" onClick={(ev) => { ev.stopPropagation(); deleteExam(e.id); }}
                                style={{ fontSize: 10, padding: '3px 6px' }}>삭제</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

          {/* === Column 3: 성적 입력 + 문자 발송 === */}
          <div style={{ minWidth: 0 }}>
            {!selectedExam ? (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 6 }}>시험을 선택하세요</div>
                <div style={{ fontSize: 13, color: 'var(--neutral-400)' }}>왼쪽 시험 목록에서 시험을 클릭하면 성적 입력이 여기에 표시됩니다</div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 14, alignItems: 'start' }}>
                {/* 성적 입력 영역 */}
                <div className="card" style={{ padding: 16, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{exam?.name} - 성적 입력</h3>
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>만점: {exam?.max_score}점 · 대상: {filteredStudents.length}명</span>
                  </div>

                  {filteredStudents.length === 0 ? (
                    <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 20 }}>해당하는 학생이 없습니다.</p>
                  ) : (
                    <>
                      {/* 분포도 */}
                      {showDist && distribution && (() => {
                        const distData = Object.entries(distribution.distribution).map(([range, count]) => ({ range, 학생수: count }));
                        const normalData = generateNormalDist(distribution);
                        return (
                          <div style={{ marginBottom: 16, padding: 14, background: 'var(--neutral-50)', borderRadius: 12, border: '1px solid var(--border)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8, marginBottom: 14 }}>
                              {[
                                { label: '평균', value: distribution.average, color: 'var(--primary-light)', border: 'var(--border)' },
                                { label: '최고', value: distribution.highest, color: 'var(--success)', border: 'var(--border)' },
                                { label: '최저', value: distribution.lowest, color: 'var(--destructive)', border: 'var(--border)' },
                                { label: '표준편차', value: distribution.stdDev, color: 'var(--foreground)', border: 'var(--border)' },
                                { label: '응시', value: `${distribution.totalStudents}명`, color: 'var(--foreground)', border: 'var(--border)' },
                              ].map((item, i) => (
                                <div key={i} style={{ textAlign: 'center', padding: 8, background: 'var(--card)', borderRadius: 8, border: `1px solid ${item.border}` }}>
                                  <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{item.label}</div>
                                  <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</div>
                                </div>
                              ))}
                            </div>
                            {normalData.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>📈 표준분포 곡선</div>
                                <ResponsiveContainer width="100%" height={160}>
                                  <AreaChart data={normalData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="score" fontSize={10} stroke="var(--muted-foreground)" />
                                    <YAxis hide />
                                    <Tooltip formatter={v => [v, '밀도']} labelFormatter={v => `${v}점`}
                                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                                    <Area type="monotone" dataKey="density" stroke="var(--primary-light)" fill="var(--primary-light)" fillOpacity={0.1} strokeWidth={2} />
                                    <ReferenceLine x={distribution.average} stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="3 3" />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>📊 구간별 인원</div>
                              <ResponsiveContainer width="100%" height={140}>
                                <BarChart data={distData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                  <XAxis dataKey="range" fontSize={10} stroke="var(--muted-foreground)" />
                                  <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={10} />
                                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                                  <Bar dataKey="학생수" radius={[4, 4, 0, 0]} fill="var(--primary-light)" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            {/* 동점자 시각화 */}
                            {distribution.studentScores && distribution.studentScores.length > 0 && (() => {
                              const scoreGroups = {};
                              distribution.studentScores.forEach(s => {
                                if (!scoreGroups[s.score]) scoreGroups[s.score] = [];
                                scoreGroups[s.score].push(s);
                              });
                              const dots = [];
                              Object.entries(scoreGroups).forEach(([score, sts]) => {
                                sts.forEach((s, idx) => { dots.push({ score: Number(score), y: idx + 1, name: s.name, rank: s.rank, school: s.school, count: sts.length }); });
                              });
                              const maxY = Math.max(...dots.map(d => d.y), 1);
                              const hasTies = Object.values(scoreGroups).some(g => g.length > 1);
                              return (
                                <div style={{ marginTop: 14 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700 }}>🎯 개별 점수 분포</span>
                                    {hasTies && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: 'var(--warning-light)', color: 'var(--warning)', fontWeight: 600 }}>동점자</span>}
                                  </div>
                                  <ResponsiveContainer width="100%" height={Math.max(120, maxY * 25 + 50)}>
                                    <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                      <XAxis type="number" dataKey="score" domain={[0, distribution.maxScore]} fontSize={10} stroke="var(--muted-foreground)" />
                                      <YAxis type="number" dataKey="y" domain={[0, maxY + 1]} hide />
                                      <ZAxis range={[100, 100]} />
                                      <Tooltip content={({ active, payload }) => {
                                        if (!active || !payload?.[0]) return null;
                                        const d = payload[0].payload;
                                        return (
                                          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                                            <div style={{ fontWeight: 700 }}>{d.name} ({d.school})</div>
                                            <div>{d.score}점 — {d.rank}등</div>
                                            {d.count > 1 && <div style={{ color: 'var(--warning)', fontWeight: 600 }}>동점 {d.count}명</div>}
                                          </div>
                                        );
                                      }} />
                                      <ReferenceLine x={distribution.average} stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="3 3" />
                                      <Scatter data={dots} fill="var(--primary)">
                                        {dots.map((d, i) => <Cell key={i} fill={d.count > 1 ? 'var(--warning)' : 'var(--primary)'} stroke={d.count > 1 ? 'var(--warning)' : 'var(--primary)'} strokeWidth={1} />)}
                                      </Scatter>
                                    </ScatterChart>
                                  </ResponsiveContainer>
                                  {hasTies && (
                                    <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--warning-light)', borderRadius: 6, border: '1px solid var(--border)' }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', marginBottom: 2 }}>⚠️ 동점자</div>
                                      {Object.entries(scoreGroups).filter(([, g]) => g.length > 1).sort(([a], [b]) => Number(b) - Number(a)).map(([score, sts]) => (
                                        <div key={score} style={{ fontSize: 11, color: 'var(--warning)' }}>
                                          <b>{score}점 ({sts[0].rank}등)</b>: {sts.map(s => s.name).join(', ')}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}

                      {/* 성적 테이블 */}
                      <div style={{ overflowX: 'auto' }}>
                        {schoolGroups.map(([schoolName, schoolStudents]) => (
                          <div key={schoolName} style={{ marginBottom: hasMultipleSchools ? 14 : 0 }}>
                            {hasMultipleSchools && (
                              <div style={{ padding: '5px 10px', background: 'var(--primary-lighter)', fontWeight: 700, fontSize: 12, borderBottom: '1px solid var(--border)', color: 'var(--primary)', borderRadius: '6px 6px 0 0' }}>
                                {schoolName} ({schoolStudents.length}명)
                              </div>
                            )}
                            <table style={{ width: '100%', fontSize: 13 }}>
                              <thead>
                                <tr>
                                  <th>이름</th>
                                  {!hasMultipleSchools && <th>학교</th>}
                                  <th>학년</th>
                                  <th style={{ width: 60 }}>상태</th>
                                  <th>점수 (/{exam?.max_score})</th>
                                  <th>등수</th>
                                  {evalCriteria.apply_grade_cuts && <th>등급</th>}
                                  {evalCriteria.pass_criteria.enabled && <th>통과</th>}
                                  <th>비고</th>
                                  <th></th>
                                </tr>
                              </thead>
                              <tbody>
                                {schoolStudents.map((s, sIdx) => {
                                  const sc = scoreInputs[s.id];
                                  const status = sc?.status || 'normal';
                                  const isExcluded = status !== 'normal';
                                  const scoreVal = isExcluded ? '' : sc?.score;
                                  const grade = isExcluded ? '-' : getGrade(scoreVal);
                                  const gradeNum = parseInt(grade);
                                  const gradeColor = grade === '-' ? 'var(--neutral-400)' : gradeNum <= 2 ? 'var(--success)' : gradeNum <= 4 ? 'var(--primary-light)' : gradeNum <= 6 ? 'var(--warning)' : 'var(--destructive)';
                                  const passStatus = isExcluded ? null : getPassStatus(scoreVal);
                                  const isOverMax = scoreVal !== '' && scoreVal !== undefined && parseFloat(scoreVal) > (exam?.max_score || 100);
                                  const statusInfo = SCORE_STATUSES.find(st => st.value === status) || SCORE_STATUSES[0];
                                  return (
                                    <tr key={s.id} style={{ opacity: isExcluded ? 0.5 : 1 }}>
                                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                                      {!hasMultipleSchools && <td>{s.school}</td>}
                                      <td>{s.grade}</td>
                                      <td>
                                        <select value={status}
                                          onChange={e => updateScoreInput(s.id, 'status', e.target.value)}
                                          style={{ padding: '2px 4px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 4, color: statusInfo.color, fontWeight: 600, background: 'var(--card)', width: 60 }}>
                                          {SCORE_STATUSES.map(st => (
                                            <option key={st.value} value={st.value}>{st.label}</option>
                                          ))}
                                        </select>
                                      </td>
                                      <td style={{ position: 'relative' }}>
                                        {isExcluded ? (
                                          <span style={{ fontSize: 12, color: statusInfo.color, fontWeight: 600 }}>{statusInfo.label}</span>
                                        ) : (
                                          <input type="number" className="score-input"
                                            data-score-idx={sIdx}
                                            value={scoreVal ?? ''}
                                            onChange={e => updateScoreInput(s.id, 'score', e.target.value)}
                                            onKeyDown={e => handleScoreKeyDown(e, sIdx)}
                                            placeholder="미응시"
                                            min="0" max={exam?.max_score || 100} step="0.1"
                                            style={isOverMax ? { borderColor: 'var(--destructive)' } : undefined} />
                                        )}
                                      </td>
                                      <td style={{ fontWeight: 600, color: 'var(--primary-light)' }}>
                                        {isExcluded ? '-' : sc?.rankNum ? `${sc.rankNum}등` : '-'}
                                      </td>
                                      {evalCriteria.apply_grade_cuts && (
                                        <td style={{ fontWeight: 700, color: gradeColor, fontSize: 13 }}>{grade}</td>
                                      )}
                                      {evalCriteria.pass_criteria.enabled && (
                                        <td style={{ fontWeight: 600, fontSize: 12, color: passStatus === true ? 'var(--success)' : passStatus === false ? 'var(--destructive)' : 'var(--neutral-400)' }}>
                                          {passStatus === true ? evalCriteria.pass_criteria.pass_label : passStatus === false ? evalCriteria.pass_criteria.fail_label : '-'}
                                        </td>
                                      )}
                                      <td>
                                        <input value={sc?.note ?? ''}
                                          onChange={e => updateScoreInput(s.id, 'note', e.target.value)}
                                          placeholder="비고" style={{ width: 100 }} />
                                      </td>
                                      <td>
                                        {sc?.scoreId && (
                                          <button className="btn btn-sm btn-danger" style={{ fontSize: 10, padding: '2px 5px' }}
                                            onClick={async () => {
                                              if (!confirm(`${s.name}의 성적을 삭제하시겠습니까?`)) return;
                                              try {
                                                await apiDelete(`/scores/score/${scoreInputs[s.id].scoreId}`);
                                                setScoreInputs(prev => { const next = { ...prev }; delete next[s.id]; return next; });
                                                setMsg('성적 삭제 완료');
                                                setTimeout(() => setMsg(''), 2000);
                                              } catch (e) { setMsg(e.message); }
                                            }}>삭제</button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>

                      {/* 버튼 영역 */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                        <button className="btn btn-success" onClick={saveScores}>💾 성적 저장</button>
                        <button className="btn btn-outline" onClick={() => loadDistribution(selectedExam)}
                          style={{ background: showDist ? 'var(--primary-light)' : undefined, color: showDist ? 'var(--card)' : undefined }}>
                          📊 {showDist ? '분포 닫기' : '분포 보기'}
                        </button>
                        <button className="btn btn-outline" onClick={async () => {
                          try {
                            await apiPost(`/scores/exams/${selectedExam}/recalculate-ranks`, {});
                            const updatedScores = await api(`/scores/exams/${selectedExam}/scores`);
                            const inputs = {};
                            updatedScores.forEach(s => { inputs[s.student_id] = { score: s.score, note: s.note || '', rankNum: s.rank_num }; });
                            setScoreInputs(inputs);
                            setMsg('등수가 재계산되었습니다.');
                            setTimeout(() => setMsg(''), 2000);
                          } catch (err) { setMsg(err.message); }
                        }}>🔄 등수 재계산</button>
                        <button className="btn btn-primary" onClick={prepareSms}
                          style={{ background: 'var(--primary)' }}>
                          📱 성적 문자 발송
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* 평가 기준 (등급컷 + 통과 커트라인) */}
                {selectedExam && (
                  <div className="card" style={{ marginTop: 10 }}>
                    <div onClick={() => setShowEvalCriteria(!showEvalCriteria)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', padding: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>평가 기준</span>
                      <span>{showEvalCriteria ? '▲' : '▼'}</span>
                    </div>
                    {showEvalCriteria && (
                      <div style={{ padding: '0 10px 10px' }}>
                        {/* 등급컷 */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <input type="checkbox" checked={evalCriteria.apply_grade_cuts}
                            onChange={e => setEvalCriteria({...evalCriteria, apply_grade_cuts: e.target.checked})} />
                          <span style={{ fontWeight: 600, fontSize: 13 }}>등급컷 적용</span>
                        </label>
                        {evalCriteria.apply_grade_cuts && (
                          <div style={{ marginLeft: 20, marginBottom: 12 }}>
                            {evalCriteria.grade_cuts.map((g, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <input value={g.label} onChange={e => { const cuts = [...evalCriteria.grade_cuts]; cuts[i] = {...cuts[i], label: e.target.value}; setEvalCriteria({...evalCriteria, grade_cuts: cuts}); }}
                                  style={{ width: 60, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }} />
                                <input type="number" value={g.min} onChange={e => { const cuts = [...evalCriteria.grade_cuts]; cuts[i] = {...cuts[i], min: parseInt(e.target.value) || 0}; setEvalCriteria({...evalCriteria, grade_cuts: cuts}); }}
                                  style={{ width: 50, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }} />
                                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>점 이상</span>
                                <button onClick={() => { const cuts = evalCriteria.grade_cuts.filter((_, j) => j !== i); setEvalCriteria({...evalCriteria, grade_cuts: cuts}); }}
                                  style={{ fontSize: 10, color: 'var(--destructive)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                              </div>
                            ))}
                            <button onClick={() => setEvalCriteria({...evalCriteria, grade_cuts: [...evalCriteria.grade_cuts, { label: `${evalCriteria.grade_cuts.length + 1}등급`, min: 0 }]})}
                              style={{ fontSize: 11, color: 'var(--primary)', background: 'none', border: '1px dashed var(--border)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>+ 등급 추가</button>
                          </div>
                        )}

                        {/* 통과 커트라인 */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <input type="checkbox" checked={evalCriteria.pass_criteria.enabled}
                            onChange={e => setEvalCriteria({...evalCriteria, pass_criteria: {...evalCriteria.pass_criteria, enabled: e.target.checked}})} />
                          <span style={{ fontWeight: 600, fontSize: 13 }}>통과 커트라인</span>
                        </label>
                        {evalCriteria.pass_criteria.enabled && (
                          <div style={{ marginLeft: 20, marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 12 }}>통과 기준:</span>
                            <input type="number" value={evalCriteria.pass_criteria.pass_score}
                              onChange={e => setEvalCriteria({...evalCriteria, pass_criteria: {...evalCriteria.pass_criteria, pass_score: parseInt(e.target.value) || 0}})}
                              style={{ width: 50, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }} />
                            <span style={{ fontSize: 12 }}>점 이상</span>
                            <input value={evalCriteria.pass_criteria.pass_label} placeholder="통과"
                              onChange={e => setEvalCriteria({...evalCriteria, pass_criteria: {...evalCriteria.pass_criteria, pass_label: e.target.value}})}
                              style={{ width: 50, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }} />
                            <span style={{ fontSize: 11 }}>/</span>
                            <input value={evalCriteria.pass_criteria.fail_label} placeholder="미통과"
                              onChange={e => setEvalCriteria({...evalCriteria, pass_criteria: {...evalCriteria.pass_criteria, fail_label: e.target.value}})}
                              style={{ width: 50, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }} />
                          </div>
                        )}

                        <button className="btn btn-primary btn-sm" onClick={saveEvalCriteria} style={{ marginTop: 8, width: '100%' }}>
                          이 시험에 적용
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 문자 발송 패널 (성적 입력 오른쪽) */}
                {smsMode && selectedExam && (
                  <div className="card" style={{ padding: 16, width: 'min(320px, 30vw)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 style={{ margin: 0, fontSize: 15 }}>📱 문자 발송</h3>
                      <button onClick={() => setSmsMode(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--neutral-400)' }}>✕</button>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>발송 대상</label>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                        {[
                          { id: 'parent', label: '학부모' },
                          { id: 'student', label: '학생' },
                          { id: 'both', label: '동시발송' },
                        ].map(t => (
                          <button key={t.id} onClick={() => setSmsTargetType(t.id)} style={{
                            flex: 1, padding: '5px 0', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: 11,
                            background: smsTargetType === t.id ? 'var(--primary)' : 'var(--neutral-100)',
                            color: smsTargetType === t.id ? 'white' : 'var(--foreground)',
                          }}>{t.label}</button>
                        ))}
                      </div>
                      <div style={{ padding: '6px 10px', background: 'var(--neutral-50)', borderRadius: 6, fontSize: 12, color: 'var(--muted-foreground)' }}>
                        대상: <strong style={{ color: 'var(--foreground)' }}>{smsValidTargets.length}명</strong>
                        {smsTargetType === 'both' && <> · 발송: <strong style={{ color: 'var(--foreground)' }}>{smsTotalMessages}건</strong></>}
                      </div>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                        메시지 템플릿
                        <span style={{ fontWeight: 400, color: 'var(--neutral-400)', marginLeft: 4 }}>변수: {'{name}'} {'{score}'} {'{rank}'}</span>
                      </label>
                      <textarea value={smsTemplate} onChange={e => setSmsTemplate(e.target.value)}
                        rows={6} style={{
                          width: '100%', padding: '8px 10px', border: '1px solid var(--border)',
                          borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
                          boxSizing: 'border-box',
                        }} />
                    </div>

                    {/* 미리보기 */}
                    {smsTargets.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>미리보기 ({smsTargets[0].name})</label>
                        <div style={{
                          padding: '8px 10px', background: 'var(--neutral-50)', borderRadius: 6,
                          border: '1px solid var(--border)', fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--foreground)'
                        }}>
                          {smsTemplate
                            .replace(/{name}/g, smsTargets[0].name)
                            .replace(/{score}/g, String(smsTargets[0].score))
                            .replace(/{rank}/g, smsTargets[0].rankNum ? ` (${smsTargets[0].rankNum}등)` : '')
                            .replace(/{school}/g, smsTargets[0].school || '')
                            .replace(/{grade}/g, smsTargets[0].grade || '')
                            .replace(/{parent}/g, smsTargets[0].parentName || '학부모')
                          }
                        </div>
                      </div>
                    )}

                    <button className="btn btn-primary" onClick={sendScoreSms} disabled={smsSending || smsTotalMessages === 0}
                      style={{ width: '100%', background: 'var(--primary)', fontSize: 14 }}>
                      {smsSending ? '발송 중...' : `📱 ${smsTotalMessages}건 발송`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* 탭 2: 정답키 설정 */}
      {/* ═══════════════════════════════════════════════ */}
      {mainTab === 'answerKey' && (
        <div style={{ maxWidth: 900 }}>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 16, margin: '0 0 12px' }}>📝 정답키 설정</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>시험 선택</label>
              <select value={akExamId}
                onChange={e => {
                  const id = e.target.value; setAkExamId(id);
                  if (id) { const ex = exams.find(x => x.id === parseInt(id)); if (ex) setAkMaxScore(ex.max_score || 100); loadAnswerKey(id); }
                  else { resetAnswerKeyForm(); setAkExistingKey(false); }
                }}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                <option value="">시험을 선택하세요</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.name} ({e.exam_type})</option>)}
              </select>
            </div>

            {akExamId && !akLoading && (
              <>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                  <div style={{ flex: '1 1 100px' }}>
                    <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>문제 수</label>
                    <input type="number" min="1" max="100" value={akNumQuestions}
                      onChange={e => setAkNumQuestions(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                      style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '1 1 140px' }}>
                    <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>선택지</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <input type="radio" name="akChoices" checked={akNumChoices === 4} onChange={() => setAkNumChoices(4)} /> 4지선다
                      </label>
                      <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <input type="radio" name="akChoices" checked={akNumChoices === 5} onChange={() => setAkNumChoices(5)} /> 5지선다
                      </label>
                    </div>
                  </div>
                  <div style={{ flex: '1 1 140px' }}>
                    <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>배점</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <input type="radio" name="akScoring" checked={akScoringType === 'equal'} onChange={() => setAkScoringType('equal')} /> 균등
                      </label>
                      <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <input type="radio" name="akScoring" checked={akScoringType === 'individual'} onChange={() => setAkScoringType('individual')} /> 개별
                      </label>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 14, padding: 8, background: 'var(--neutral-50)', borderRadius: 6, fontSize: 12 }}>
                  {akScoringType === 'equal' ? (
                    <span>균등배점: {akMaxScore}점 / {akNumQuestions}문항 = <strong>{Math.round((akMaxScore / akNumQuestions) * 100) / 100}점</strong></span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>기본 배점:</span>
                      <input type="number" min="0" step="0.5" value={akDefaultPoints}
                        onChange={e => setAkDefaultPoints(parseFloat(e.target.value) || 0)}
                        style={{ width: 50, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, textAlign: 'center' }} />
                      <span>점</span>
                    </div>
                  )}
                </div>

                {/* 정답 입력 영역 */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' }}>정답 입력</label>
                  {(() => {
                    const rows = [];
                    for (let row = 0; row < Math.ceil(akNumQuestions / 5); row++) {
                      const items = [];
                      for (let col = 0; col < 5; col++) {
                        const qNum = row * 5 + col + 1;
                        if (qNum > akNumQuestions) break;
                        items.push(
                          <div key={qNum} style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, width: 24, textAlign: 'right', flexShrink: 0 }}>{qNum}.</span>
                            <div style={{ display: 'flex', gap: 2 }}>
                              {Array.from({ length: akNumChoices }, (_, i) => i + 1).map(n => {
                                const symbols = ['', '\u2460', '\u2461', '\u2462', '\u2463', '\u2464'];
                                return (
                                  <button key={n} onClick={() => setAkAnswers(prev => ({ ...prev, [qNum]: n }))}
                                    style={{
                                      width: 26, height: 26, borderRadius: '50%', border: '1.5px solid',
                                      borderColor: akAnswers[qNum] === n ? 'var(--primary-light)' : 'var(--border)',
                                      background: akAnswers[qNum] === n ? 'var(--primary-light)' : 'var(--card)',
                                      color: akAnswers[qNum] === n ? 'var(--card)' : 'var(--foreground)',
                                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                                    }}>{symbols[n]}</button>
                                );
                              })}
                            </div>
                            {akScoringType === 'individual' && (
                              <input type="number" min="0" step="0.5"
                                value={akPoints[qNum] !== undefined ? akPoints[qNum] : akDefaultPoints}
                                onChange={e => setAkPoints(prev => ({ ...prev, [qNum]: parseFloat(e.target.value) || 0 }))}
                                style={{ width: 38, padding: '2px 4px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 10, textAlign: 'center' }} />
                            )}
                          </div>
                        );
                      }
                      rows.push(
                        <div key={row} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6, marginBottom: 4 }}>
                          {items}
                        </div>
                      );
                    }
                    return rows;
                  })()}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={saveAnswerKey}>정답키 저장</button>
                  {akExistingKey && <button className="btn btn-danger" onClick={deleteAnswerKey}>삭제</button>}
                </div>
              </>
            )}
            {akLoading && <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: 20 }}>로딩 중...</p>}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* 탭 3: OMR 입력 */}
      {/* ═══════════════════════════════════════════════ */}
      {mainTab === 'omrInput' && (
        <div style={{ maxWidth: 900 }}>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 16, margin: '0 0 12px' }}>📋 OMR 답안 입력</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>시험 선택 (정답키 설정된 시험)</label>
              <select value={omrExamId}
                onChange={e => {
                  const id = e.target.value; setOmrExamId(id);
                  setOmrExpandedStudent(null); setOmrStudentAnswers({}); setOmrAnswerKey(null); setOmrSubmissions({}); setOmrQuestionStats([]);
                  if (id) loadOmrData(id);
                }}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                <option value="">시험을 선택하세요</option>
                {omrExams.map(e => <option key={e.id} value={e.id}>{e.name} ({e.exam_type})</option>)}
              </select>
            </div>

            {omrExamId && omrAnswerKey && !omrLoading && (() => {
              const omrExam = exams.find(e => e.id === parseInt(omrExamId));
              const omrGradeOptions = omrFilterSchool ? getAllGrades(omrFilterSchool) : [];
              const omrStudentList = students.filter(s => {
                if (omrExam?.school && s.school !== omrExam.school) return false;
                if (omrExam?.grade && s.grade !== omrExam.grade) return false;
                if (omrFilterSchool && s.school !== omrFilterSchool) return false;
                if (omrFilterGrade && s.grade !== omrFilterGrade) return false;
                return true;
              });
              return (
                <>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    <select value={omrFilterSchool} onChange={e => { setOmrFilterSchool(e.target.value); setOmrFilterGrade(''); }}
                      style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
                      <option value="">전체 학교</option>
                      {schools.filter(s => s.name !== '조교' && s.name !== '선생님').map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                    <select value={omrFilterGrade} onChange={e => setOmrFilterGrade(e.target.value)} disabled={!omrFilterSchool}
                      style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
                      <option value="">전체 학년</option>
                      {omrGradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  {/* 문항별 정답률 */}
                  {omrQuestionStats.length > 0 && (
                    <div style={{ marginBottom: 14, padding: 10, background: 'var(--neutral-50)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>문항별 정답률</div>
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={omrQuestionStats}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="questionNum" fontSize={10} stroke="var(--muted-foreground)" />
                          <YAxis domain={[0, 100]} fontSize={10} stroke="var(--muted-foreground)" tickFormatter={v => `${v}%`} />
                          <Tooltip formatter={v => [`${v}%`, '정답률']} labelFormatter={v => `${v}번`}
                            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                          <Bar dataKey="correctRate" radius={[3, 3, 0, 0]}>
                            {omrQuestionStats.map((entry, idx) => (
                              <Cell key={idx} fill={entry.correctRate >= 70 ? 'var(--success)' : entry.correctRate >= 40 ? 'var(--warning)' : 'var(--destructive)'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>학생 {omrStudentList.length}명</div>
                  <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                    {omrStudentList.map(s => {
                      const isExpanded = omrExpandedStudent === s.id;
                      const hasSubmission = !!omrSubmissions[s.id];
                      const hasAnswers = omrStudentAnswers[s.id] && Object.keys(omrStudentAnswers[s.id]).length > 0;
                      const result = hasAnswers ? calculateOmrScore(s.id) : null;
                      return (
                        <div key={s.id} style={{ marginBottom: 3, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                          <div onClick={() => setOmrExpandedStudent(isExpanded ? null : s.id)}
                            style={{
                              display: 'flex', alignItems: 'center', padding: '8px 10px', gap: 6,
                              cursor: 'pointer', background: isExpanded ? 'var(--primary-lighter)' : 'var(--card)', fontSize: 12,
                            }}>
                            <span style={{ fontWeight: 600, minWidth: 50 }}>{s.name}</span>
                            <span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>{s.school} {s.grade}</span>
                            <div style={{ flex: 1 }} />
                            {hasSubmission && <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 600 }}>제출</span>}
                            {hasAnswers && result && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary-light)' }}>{result.correct}/{result.total} ({result.score}점)</span>
                            )}
                            <span style={{ fontSize: 10, color: 'var(--neutral-400)' }}>{isExpanded ? '▲' : '▼'}</span>
                          </div>
                          {isExpanded && (
                            <div style={{ padding: 10, background: 'var(--neutral-50)', borderTop: '1px solid var(--border)' }}>
                              {(() => {
                                const numQ = omrAnswerKey.numQuestions || 0;
                                const numC = omrAnswerKey.numChoices || 5;
                                const keyQuestions = omrAnswerKey.questions || [];
                                const studentAns = omrStudentAnswers[s.id] || {};
                                const rows = [];
                                for (let row = 0; row < Math.ceil(numQ / 5); row++) {
                                  const items = [];
                                  for (let col = 0; col < 5; col++) {
                                    const qNum = row * 5 + col + 1;
                                    if (qNum > numQ) break;
                                    const correctAns = keyQuestions.find(q => q.num === qNum)?.answer;
                                    const selectedAns = studentAns[qNum];
                                    const isCorrect = selectedAns && selectedAns === correctAns;
                                    const isWrong = selectedAns && selectedAns !== correctAns;
                                    items.push(
                                      <div key={qNum} style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
                                        <span style={{
                                          fontSize: 11, fontWeight: 600, width: 24, textAlign: 'right', flexShrink: 0,
                                          color: isCorrect ? 'var(--primary-light)' : isWrong ? 'var(--destructive)' : 'var(--foreground)'
                                        }}>{qNum}.</span>
                                        <div style={{ display: 'flex', gap: 2 }}>
                                          {Array.from({ length: numC }, (_, i) => i + 1).map(n => {
                                            const symbols = ['', '\u2460', '\u2461', '\u2462', '\u2463', '\u2464'];
                                            const isSelected = selectedAns === n;
                                            let bg = 'var(--card)', borderC = 'var(--border)', textC = 'var(--foreground)';
                                            if (isSelected && isCorrect) { bg = 'var(--primary-light)'; borderC = 'var(--primary-light)'; textC = 'var(--card)'; }
                                            else if (isSelected && isWrong) { bg = 'var(--destructive)'; borderC = 'var(--destructive)'; textC = 'var(--card)'; }
                                            return (
                                              <button key={n} onClick={() => setOmrAnswer(s.id, qNum, n)}
                                                style={{
                                                  width: 26, height: 26, borderRadius: '50%', border: `1.5px solid ${borderC}`,
                                                  background: bg, color: textC, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                                                }}>{symbols[n]}</button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  }
                                  rows.push(
                                    <div key={row} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6, marginBottom: 4 }}>
                                      {items}
                                    </div>
                                  );
                                }
                                return rows;
                              })()}
                              {result && (
                                <div style={{
                                  marginTop: 8, padding: '6px 10px', background: 'var(--card)', borderRadius: 6,
                                  border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, display: 'flex', gap: 12
                                }}>
                                  <span>정답: <span style={{ color: 'var(--primary-light)' }}>{result.correct}/{result.total}</span></span>
                                  <span>점수: <span style={{ color: 'var(--success)' }}>{result.score}점</span></span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <button className="btn btn-primary" onClick={saveOmrAnswers}>답안 일괄 저장</button>
                  </div>
                </>
              );
            })()}
            {omrLoading && <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: 20 }}>로딩 중...</p>}
          </div>
        </div>
      )}

      {/* 반응형 CSS */}
      <style>{`
        @media (max-width: 1024px) {
          .score-3col { grid-template-columns: 280px 1fr !important; }
          .score-3col > :first-child { display: none; }
        }
        @media (max-width: 768px) {
          .score-3col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
