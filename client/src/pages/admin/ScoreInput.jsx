import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete, apiUpload, getUser } from '../../api';
import { useTenantConfig, getAllGrades } from '../../contexts/TenantContext';
import { BarChart, Bar, AreaChart, Area, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, ZAxis } from 'recharts';
import { askConfirm } from '../../lib/feedback';
import { parseExplanationFileUrl } from '../../lib/explanationFile';
import AdminOmrStatsPanel from '../../components/AdminOmrStatsPanel';

const FONT_D = "var(--font-display, 'Paperlogy', 'KoPub Dotum', sans-serif)";

// === 시험 유형 에디터 (인라인 컴포넌트) ===
function ExamTypeEditor() {
  const { config, setConfig } = useTenantConfig();
  const [examTypes, setExamTypes] = useState((config?.examTypes || []).map(c => ({ ...c })));
  const [saving, setSaving] = useState(false);
  const [etMsg, setEtMsg] = useState('');

  useEffect(() => {
    if (config?.examTypes) setExamTypes(config.examTypes.map(c => ({ ...c, types: [...(c.types || [])] })));
  }, [config?.examTypes]);

  const addCategory = () => setExamTypes([...examTypes, { key: '', label: '', types: [] }]);
  const removeCategory = (idx) => setExamTypes(examTypes.filter((_, i) => i !== idx));
  const updateCategory = (idx, field, val) => {
    const next = [...examTypes];
    next[idx] = { ...next[idx], [field]: val };
    if (field === 'label' && !next[idx].key) next[idx].key = val.replace(/\s+/g, '_').toLowerCase();
    setExamTypes(next);
  };
  const addSubType = (catIdx) => {
    const next = [...examTypes];
    next[catIdx] = { ...next[catIdx], types: [...(next[catIdx].types || []), ''] };
    setExamTypes(next);
  };
  const removeSubType = (catIdx, typeIdx) => {
    const next = [...examTypes];
    next[catIdx] = { ...next[catIdx], types: next[catIdx].types.filter((_, i) => i !== typeIdx) };
    setExamTypes(next);
  };
  const updateSubType = (catIdx, typeIdx, val) => {
    const next = [...examTypes];
    const types = [...next[catIdx].types];
    types[typeIdx] = val;
    next[catIdx] = { ...next[catIdx], types };
    setExamTypes(next);
  };

  const saveExamTypes = async () => {
    setSaving(true);
    try {
      await apiPut('/academies/settings', { examTypes });
      setConfig(prev => ({ ...prev, examTypes }));
      setEtMsg('시험 유형이 저장되었습니다.');
      setTimeout(() => setEtMsg(''), 2500);
    } catch (err) { setEtMsg('저장 실패: ' + err.message); }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 800 }}>
      {etMsg && <div className="alert alert-success" style={{ marginBottom: 12 }}>{etMsg}</div>}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>시험 유형 관리</h3>
          <button onClick={addCategory}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#004bf0', border: '1px solid rgba(0,75,240,0.2)', background: 'transparent', cursor: 'pointer' }}>
            + 카테고리 추가
          </button>
        </div>

        {examTypes.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: 20, fontSize: 13 }}>등록된 시험 유형이 없습니다. 카테고리를 추가하세요.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {examTypes.map((cat, i) => (
            <div key={i} style={{ background: '#f3f4f5', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <input value={cat.label || ''} onChange={e => updateCategory(i, 'label', e.target.value)}
                  placeholder="카테고리명 (예: 모의고사)"
                  style={{ flex: 1, padding: '8px 12px', background: 'white', borderRadius: 8, border: '1px solid transparent', fontSize: 13, fontWeight: 600, outline: 'none' }} />
                <input value={cat.key || ''} onChange={e => updateCategory(i, 'key', e.target.value)}
                  placeholder="key"
                  style={{ width: 90, padding: '8px 10px', background: 'white', borderRadius: 8, border: '1px solid transparent', fontSize: 11, fontFamily: 'monospace', outline: 'none' }} />
                <button onClick={() => removeCategory(i)}
                  style={{ padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--neutral-400)', cursor: 'pointer', fontSize: 14 }}
                  title="카테고리 삭제">✕</button>
              </div>
              <div style={{ paddingLeft: 14, borderLeft: '2px solid var(--border)', marginLeft: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>하위 시험 유형</div>
                {(cat.types || []).map((t, j) => (
                  <div key={j} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <input value={t} onChange={e => updateSubType(i, j, e.target.value)}
                      placeholder="시험 유형명"
                      style={{ flex: 1, padding: '7px 12px', background: 'white', borderRadius: 8, border: '1px solid transparent', fontSize: 13, outline: 'none' }} />
                    <button onClick={() => removeSubType(i, j)}
                      style={{ background: 'none', border: 'none', color: 'var(--neutral-400)', cursor: 'pointer', fontSize: 12, padding: 4 }}>✕</button>
                  </div>
                ))}
                <button onClick={() => addSubType(i)}
                  style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--neutral-400)', border: '1px dashed var(--border)', background: 'transparent', cursor: 'pointer' }}>
                  + 하위 유형 추가
                </button>
              </div>
            </div>
          ))}
        </div>

        <button onClick={saveExamTypes} disabled={saving}
          style={{ marginTop: 16, width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', background: '#102044', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? '저장 중...' : '시험 유형 저장'}
        </button>
      </div>
    </div>
  );
}

export default function ScoreInput() {
  const { config } = useTenantConfig();
  const currentUser = getUser();
  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role);
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
  const [pageTab, setPageTab] = useState('scores'); // 'scores' | 'exam-types'
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
  const loadStudents = () => api('/scores/students-list').then(setStudents).catch(console.error);

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
    if (!await askConfirm('이 시험과 관련 성적을 모두 삭제하시겠습니까?')) return;
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

  // === 정답키 & 학생 OMR 설정 state ===
  const [akExamId, setAkExamId] = useState('');
  const [akNumQuestions, setAkNumQuestions] = useState(20);
  const [akNumChoices, setAkNumChoices] = useState(5);
  const [akScoringType, setAkScoringType] = useState('equal');
  const [akMaxScore, setAkMaxScore] = useState(100);
  const [akDefaultPoints, setAkDefaultPoints] = useState(5);
  const [akAnswers, setAkAnswers] = useState({});
  const [akPoints, setAkPoints] = useState({});
  const [akExpFileUrl, setAkExpFileUrl] = useState('');
  const [akExpFileTitle, setAkExpFileTitle] = useState('');
  const [akExpPages, setAkExpPages] = useState({});
  const [akExpUrls, setAkExpUrls] = useState({});
  const [akCategories, setAkCategories] = useState({});
  const [akPageRangeStr, setAkPageRangeStr] = useState('');
  const [akCategoryRangeStr, setAkCategoryRangeStr] = useState('');
  const [akExplanations, setAkExplanations] = useState({});
  const [akShowExplanations, setAkShowExplanations] = useState(false);
  const [akShowBulkExplanation, setAkShowBulkExplanation] = useState(false);
  const [akBulkExplanationText, setAkBulkExplanationText] = useState('');
  const [akQuickString, setAkQuickString] = useState('');
  const [akStudentOmrEnabled, setAkStudentOmrEnabled] = useState(false);
  const [akTimeLimitMinutes, setAkTimeLimitMinutes] = useState('');
  const [akAllowResubmit, setAkAllowResubmit] = useState(true);
  const [akResubmitCooldownMinutes, setAkResubmitCooldownMinutes] = useState(30);
  const [akMaxAttempts, setAkMaxAttempts] = useState(2);
  const [akResubmitMode, setAkResubmitMode] = useState('wrong_only');
  const [akRevealAnswersPolicy, setAkRevealAnswersPolicy] = useState('after_final');
  const [akStatsRevealPolicy, setAkStatsRevealPolicy] = useState('after_final');
  const [akStatsBasis, setAkStatsBasis] = useState('first');
  const [akMinStatsSample, setAkMinStatsSample] = useState(5);
  const [akLoading, setAkLoading] = useState(false);
  const [akExistingKey, setAkExistingKey] = useState(false);
  const [akPdfParsing, setAkPdfParsing] = useState(false);
  const [akPdfResult, setAkPdfResult] = useState(null);
  const [akPdfError, setAkPdfError] = useState('');
  const [akPdfDragging, setAkPdfDragging] = useState(false);
  const akPdfInputRef = useRef(null);
  const akExplanationRefs = useRef({});

  // === OMR state ===
  const [omrExams, setOmrExams] = useState([]);
  const [omrExamId, setOmrExamId] = useState('');
  const [omrAnswerKey, setOmrAnswerKey] = useState(null);
  const [omrFilterSchool, setOmrFilterSchool] = useState('');
  const [omrFilterGrade, setOmrFilterGrade] = useState('');
  const [omrExpandedStudent, setOmrExpandedStudent] = useState(null);
  const [omrStudentAnswers, setOmrStudentAnswers] = useState({});
  const [omrQuickInputByStudent, setOmrQuickInputByStudent] = useState({});
  const [omrSubmissions, setOmrSubmissions] = useState({});
  const [omrQuestionStats, setOmrQuestionStats] = useState([]);
  const [omrStatsData, setOmrStatsData] = useState(null);
  const [omrLoading, setOmrLoading] = useState(false);

  // === 정답키 함수 ===
  const loadAnswerKey = async (examId) => {
    if (!examId) return;
    setAkLoading(true);
    try {
      const data = await api(`/scores/exams/${examId}/answer-key`);
      if (data && data.answer_key) {
        const key = typeof data.answer_key === 'string' ? JSON.parse(data.answer_key) : data.answer_key;
        setAkNumQuestions(data.question_count || key.numQuestions || 20);
        setAkNumChoices(data.choice_count || key.numChoices || 5);
        setAkScoringType(key.scoringType || 'equal');
        setAkMaxScore(key.maxScore || 100);
        setAkDefaultPoints(key.defaultPoints || 5);
        setAkStudentOmrEnabled(Boolean(data.student_omr_enabled ?? key.studentOmrEnabled));
        setAkTimeLimitMinutes(data.time_limit_minutes ?? key.timeLimitMinutes ?? '');
        setAkAllowResubmit(data.allow_resubmit !== undefined ? Boolean(data.allow_resubmit) : (key.allowResubmit ?? true));
        setAkResubmitCooldownMinutes(data.resubmit_cooldown_minutes ?? key.resubmitCooldownMinutes ?? 30);
        setAkMaxAttempts(data.max_attempts ?? key.maxAttempts ?? 2);
        setAkResubmitMode(data.resubmit_mode || key.resubmitMode || 'wrong_only');
        setAkRevealAnswersPolicy(data.reveal_answers_policy || key.revealAnswersPolicy || 'after_final');
        setAkStatsRevealPolicy(data.stats_reveal_policy || key.statsRevealPolicy || 'after_final');
        setAkStatsBasis(data.stats_basis || key.statsBasis || 'first');
        setAkMinStatsSample(data.min_stats_sample !== undefined && data.min_stats_sample !== null ? Number(data.min_stats_sample) : (key.minStatsSample ?? 5));
        setAkExpFileUrl(key.explanationFile?.url || '');
        setAkExpFileTitle(key.explanationFile?.title || '');
        const ans = {}, pts = {}, exps = {}, pages = {}, urls = {}, cats = {};
        (key.questions || []).forEach(q => {
          ans[q.num] = q.answer;
          if (q.points !== undefined) pts[q.num] = q.points;
          if (typeof q.explanation === 'string' && q.explanation.trim()) exps[q.num] = q.explanation;
          if (q.explanationPage) pages[q.num] = q.explanationPage;
          if (typeof q.explanationUrl === 'string' && q.explanationUrl.trim()) urls[q.num] = q.explanationUrl;
          if (typeof q.category === 'string' && q.category.trim()) cats[q.num] = q.category.trim();
        });
        setAkAnswers(ans);
        setAkPoints(pts);
        setAkExplanations(exps);
        setAkExpPages(pages);
        setAkExpUrls(urls);
        setAkCategories(cats);
        setAkShowExplanations(Object.keys(exps).length > 0 || Object.keys(pages).length > 0 || Object.keys(urls).length > 0 || Object.keys(cats).length > 0);
        setAkQuickString((key.questions || []).map(q => q.answer).join(''));
        setAkExistingKey(true);
      } else { resetAnswerKeyForm(); setAkExistingKey(false); }
    } catch (e) { resetAnswerKeyForm(); setAkExistingKey(false); }
    setAkLoading(false);
  };

  const resetAnswerKeyForm = () => {
    setAkAnswers({}); setAkPoints({}); setAkExplanations({});
    setAkExpFileUrl(''); setAkExpFileTitle(''); setAkExpPages({}); setAkExpUrls({}); setAkCategories({});
    setAkPageRangeStr(''); setAkCategoryRangeStr('');
    setAkShowExplanations(false); setAkShowBulkExplanation(false); setAkBulkExplanationText('');
    setAkQuickString('');
    setAkPdfResult(null); setAkPdfError('');
    setAkNumQuestions(20); setAkNumChoices(5);
    setAkScoringType('equal'); setAkMaxScore(100); setAkDefaultPoints(5);
    setAkStudentOmrEnabled(false); setAkTimeLimitMinutes('');
    setAkAllowResubmit(true); setAkResubmitCooldownMinutes(30);
    setAkMaxAttempts(2); setAkResubmitMode('wrong_only'); setAkRevealAnswersPolicy('after_final');
    setAkStatsRevealPolicy('after_final'); setAkStatsBasis('first'); setAkMinStatsSample(5);
  };

  const applyParsedPdfAnswerKey = (parsed) => {
    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) return;
    const nextNumQ = parsed.numQuestions || parsed.questions.length;
    const nextNumC = parsed.numChoices || 5;
    const nextAns = {};
    const nextPts = {};
    const nextPages = { ...akExpPages };
    const nextCats = { ...akCategories };
    const nextExps = { ...akExplanations };

    parsed.questions.forEach(q => {
      nextAns[q.num] = q.answer;
      if (q.points !== undefined && q.points !== null) nextPts[q.num] = q.points;
      if (q.page) nextPages[q.num] = q.page;
      if (q.category) nextCats[q.num] = q.category;
      if (q.explanation) nextExps[q.num] = q.explanation;
    });

    setAkNumQuestions(nextNumQ);
    setAkNumChoices(nextNumC);
    if (parsed.maxScore) setAkMaxScore(parsed.maxScore);
    setAkScoringType(parsed.scoringType === 'individual' ? 'individual' : 'equal');
    if (parsed.scoringType === 'individual') {
      const firstPt = parsed.questions.find(q => q.points !== undefined)?.points;
      if (firstPt !== undefined) setAkDefaultPoints(firstPt);
      setAkPoints(nextPts);
    } else {
      setAkPoints({});
    }
    setAkAnswers(nextAns);
    setAkQuickString(Array.from({ length: nextNumQ }, (_, i) => nextAns[i + 1] || '').join(''));
    setAkExpPages(nextPages);
    setAkCategories(nextCats);
    setAkExplanations(nextExps);
    if (parsed.pagesDetectedCount > 0 || parsed.categoriesDetectedCount > 0) {
      setAkShowExplanations(true);
    }
    setAkPdfResult(parsed);
    setAkPdfError('');
    setMsg(`PDF에서 ${parsed.recognizedCount}문항의 정답을 자동 인식했습니다. 확인 후 아래 저장 버튼을 눌러주세요.`);
    setTimeout(() => setMsg(''), 4000);
  };

  const handleParseAnswerKeyPdfFile = async (file) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setAkPdfError('파일 크기는 최대 15MB까지 업로드할 수 있습니다.');
      return;
    }
    setAkPdfParsing(true);
    setAkPdfError('');
    setAkPdfResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (akNumChoices) formData.append('expectedNumChoices', String(akNumChoices));
      const data = await apiUpload('/scores/answer-key/parse-pdf', formData);
      applyParsedPdfAnswerKey(data);
    } catch (err) {
      setAkPdfError(err.message || 'PDF 정답표 자동 인식에 실패했습니다.');
    } finally {
      setAkPdfParsing(false);
      if (akPdfInputRef.current) akPdfInputRef.current.value = '';
    }
  };

  const handleParseAnswerKeyFromDrive = async () => {
    if (!akExpFileUrl.trim()) {
      setAkPdfError('먼저 아래 해설 파일 공유 링크 칸에 Google Drive 링크를 입력해 주세요.');
      return;
    }
    setAkPdfParsing(true);
    setAkPdfError('');
    setAkPdfResult(null);
    try {
      const data = await apiPost('/scores/answer-key/parse-pdf', {
        url: akExpFileUrl.trim(),
        expectedNumChoices: akNumChoices,
      });
      applyParsedPdfAnswerKey(data);
    } catch (err) {
      setAkPdfError(err.message || 'Google Drive PDF 자동 인식에 실패했습니다.');
    } finally {
      setAkPdfParsing(false);
    }
  };

  const applyCategoryRangeMap = () => {
    if (!akCategoryRangeStr.trim()) return;
    const tokens = akCategoryRangeStr.split(/[,/\n]+/).map(t => t.trim()).filter(Boolean);
    const next = { ...akCategories };
    let updated = 0;
    for (const token of tokens) {
      const m = token.match(/^(\d+)(?:\s*[-~]\s*(\d+))?\s*[:=]\s*(.+)$/);
      if (!m) continue;
      const startQ = Math.max(1, parseInt(m[1], 10));
      const endQ = Math.min(akNumQuestions, m[2] ? parseInt(m[2], 10) : startQ);
      const label = m[3].trim();
      if (!label) continue;
      for (let q = startQ; q <= endQ; q++) {
        next[q] = label;
        updated++;
      }
    }
    if (updated === 0) {
      setMsg('형식을 확인해 주세요. 예: 1-10:독서, 11-20:문학');
      return;
    }
    setAkCategories(next);
    setAkShowExplanations(true);
    setMsg(`${updated}개 문항에 영역 태그가 배정되었습니다.`);
    setTimeout(() => setMsg(''), 2500);
  };

  const applyQuickAnswerString = (rawStr) => {
    setAkQuickString(rawStr);
    const digits = (rawStr.match(/\d/g) || []).map(Number).filter(n => n >= 1 && n <= akNumChoices);
    if (digits.length === 0) return;
    const next = { ...akAnswers };
    digits.slice(0, akNumQuestions).forEach((ans, idx) => {
      next[idx + 1] = ans;
    });
    setAkAnswers(next);
  };

  // 문항 범위별 해설지 쪽수 일괄 배정 (예: "1-5:1, 6-10:2, 11:3")
  const applyPageRangeMap = () => {
    if (!akPageRangeStr.trim()) return;
    const tokens = akPageRangeStr.split(/[,/\n]+/).map(t => t.trim()).filter(Boolean);
    const next = { ...akExpPages };
    let updated = 0;
    for (const token of tokens) {
      const m = token.match(/^(\d+)(?:\s*[-~]\s*(\d+))?\s*[:=]\s*(\d+)\s*p?$/i);
      if (!m) continue;
      const startQ = Math.max(1, parseInt(m[1], 10));
      const endQ = Math.min(akNumQuestions, m[2] ? parseInt(m[2], 10) : startQ);
      const pageNum = Math.max(1, parseInt(m[3], 10));
      for (let q = startQ; q <= endQ; q++) {
        next[q] = pageNum;
        updated++;
      }
    }
    if (updated === 0) {
      setMsg('형식을 확인해 주세요. 예: 1-5:1, 6-10:2');
      return;
    }
    setAkExpPages(next);
    setAkShowExplanations(true);
    setMsg(`${updated}개 문항에 해설지 쪽수가 배정되었습니다.`);
    setTimeout(() => setMsg(''), 2500);
  };

  // 해설 일괄 붙여넣기 자동 분리 (예: "1. 해설...", "[2번] 해설...", "3) 해설...")
  const applyBulkExplanations = () => {
    if (!akBulkExplanationText.trim()) return;
    const lines = akBulkExplanationText.replace(/\r\n/g, '\n').split('\n');
    const parsed = {};
    let currentQ = null;
    const headerRe = /^\s*\[?(\d{1,3})\s*(?:번|[.)\]:])\s*(.*)$/;

    for (const line of lines) {
      const m = line.match(headerRe);
      if (m) {
        const qNum = parseInt(m[1], 10);
        if (qNum >= 1 && qNum <= akNumQuestions) {
          currentQ = qNum;
          parsed[currentQ] = m[2] ? [m[2]] : [];
          continue;
        }
      }
      if (currentQ !== null) {
        parsed[currentQ].push(line);
      }
    }

    const entries = Object.entries(parsed);
    if (entries.length === 0) {
      setMsg('문항 번호(예: 1. 해설 내용 / 2번 해설 내용)를 인식하지 못했습니다.');
      return;
    }

    setAkExplanations(prev => {
      const next = { ...prev };
      entries.forEach(([qNum, contentLines]) => {
        next[Number(qNum)] = contentLines.join('\n').trim();
      });
      return next;
    });
    setAkShowExplanations(true);
    setAkShowBulkExplanation(false);
    setAkBulkExplanationText('');
    setMsg(`${entries.length}개 문항의 해설이 자동 분리되어 입력되었습니다.`);
    setTimeout(() => setMsg(''), 2500);
  };

  const jumpToAdminExplanation = (qNum) => {
    setAkShowExplanations(true);
    setTimeout(() => {
      const el = akExplanationRefs.current[qNum];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }, 40);
  };

  const saveAnswerKey = async () => {
    if (!akExamId) { setMsg('시험을 선택하세요.'); return; }
    const trimmedFileUrl = akExpFileUrl.trim();
    let explanationFile = null;
    if (trimmedFileUrl) {
      const parsedFile = parseExplanationFileUrl(trimmedFileUrl);
      if (!parsedFile) {
        setMsg('해설 파일 링크 형식이 올바르지 않습니다. https:// 로 시작하는 공유 링크를 입력해 주세요.');
        return;
      }
      explanationFile = {
        url: parsedFile.openUrl,
        title: akExpFileTitle.trim(),
        provider: parsedFile.provider,
      };
    }

    const questions = [];
    for (let i = 1; i <= akNumQuestions; i++) {
      if (!akAnswers[i]) { setMsg(`${i}번 문항의 정답을 선택하세요.`); return; }
      const q = { num: i, answer: akAnswers[i] };
      if (akScoringType === 'individual') q.points = akPoints[i] !== undefined ? parseFloat(akPoints[i]) : akDefaultPoints;
      if (typeof akExplanations[i] === 'string' && akExplanations[i].trim()) {
        q.explanation = akExplanations[i].trim();
      }
      if (akExpPages[i] && Number(akExpPages[i]) > 0) {
        q.explanationPage = parseInt(akExpPages[i], 10);
      }
      if (typeof akExpUrls[i] === 'string' && akExpUrls[i].trim()) {
        const parsedQFile = parseExplanationFileUrl(akExpUrls[i].trim());
        if (!parsedQFile) {
          setMsg(`${i}번 문항의 개별 해설 링크 형식이 올바르지 않습니다.`);
          return;
        }
        q.explanationUrl = parsedQFile.openUrl;
      }
      if (typeof akCategories[i] === 'string' && akCategories[i].trim()) {
        q.category = akCategories[i].trim();
      }
      questions.push(q);
    }
    try {
      await apiPost(`/scores/exams/${akExamId}/answer-key`, {
        numQuestions: akNumQuestions,
        numChoices: akNumChoices,
        scoringType: akScoringType,
        maxScore: akMaxScore,
        defaultPoints: akDefaultPoints,
        explanationFile,
        questions,
        studentOmrEnabled: akStudentOmrEnabled,
        timeLimitMinutes: akTimeLimitMinutes === '' || Number(akTimeLimitMinutes) <= 0 ? null : parseInt(akTimeLimitMinutes),
        allowResubmit: akAllowResubmit,
        resubmitCooldownMinutes: parseInt(akResubmitCooldownMinutes) || 0,
        maxAttempts: akAllowResubmit ? (parseInt(akMaxAttempts) ?? 2) : 1,
        resubmitMode: akResubmitMode,
        revealAnswersPolicy: akRevealAnswersPolicy,
        statsRevealPolicy: akStatsRevealPolicy,
        statsBasis: akStatsBasis,
        minStatsSample: parseInt(akMinStatsSample) || 0,
      });
      setMsg('정답키·해설 파일 연동 및 OMR 설정이 저장되었습니다.'); setAkExistingKey(true);
      loadExams();
      setTimeout(() => setMsg(''), 2500);
    } catch (err) { setMsg(err.message); }
  };

  const regradeAllSubmissions = async (targetExamId) => {
    const id = targetExamId || akExamId || omrExamId;
    if (!id) return;
    try {
      const res = await apiPost(`/scores/exams/${id}/regrade-all`, {});
      setMsg(res.message || '재채점이 완료되었습니다.');
      if (omrExamId && String(omrExamId) === String(id)) loadOmrData(id, omrFilterSchool, omrFilterGrade);
      setTimeout(() => setMsg(''), 2500);
    } catch (err) { setMsg('재채점 실패: ' + err.message); }
  };

  const resetStudentCooldown = async (studentId, action = 'clear_cooldown') => {
    if (!omrExamId) return;
    try {
      const res = await apiPost(`/scores/exams/${omrExamId}/reset-cooldown`, { studentId, action });
      setMsg(res.message || '처리되었습니다.');
      loadOmrData(omrExamId, omrFilterSchool, omrFilterGrade);
      setTimeout(() => setMsg(''), 2500);
    } catch (err) { setMsg(err.message); }
  };

  const deleteAnswerKey = async () => {
    if (!akExamId || !await askConfirm('정답키를 삭제하시겠습니까?')) return;
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

  const reloadOmrQuestionStats = async (examId, school = '', grade = '') => {
    if (!examId) return;
    try {
      const qs = new URLSearchParams();
      if (school) qs.set('school', school);
      if (grade) qs.set('grade', grade);
      const query = qs.toString() ? `?${qs.toString()}` : '';
      const statsData = await api(`/scores/exams/${examId}/question-stats${query}`);
      setOmrStatsData(statsData || null);
      setOmrQuestionStats(Array.isArray(statsData) ? statsData : (statsData?.stats || []));
    } catch (err) {
      setOmrStatsData(null);
      setOmrQuestionStats([]);
    }
  };

  const loadOmrData = async (examId, school = omrFilterSchool, grade = omrFilterGrade) => {
    if (!examId) return;
    setOmrLoading(true);
    try {
      const qs = new URLSearchParams();
      if (school) qs.set('school', school);
      if (grade) qs.set('grade', grade);
      const query = qs.toString() ? `?${qs.toString()}` : '';

      const [keyData, subsData, statsData] = await Promise.all([
        api(`/scores/exams/${examId}/answer-key`),
        api(`/scores/exams/${examId}/submissions`),
        api(`/scores/exams/${examId}/question-stats${query}`)
      ]);
      if (keyData && keyData.answer_key) {
        const key = typeof keyData.answer_key === 'string' ? JSON.parse(keyData.answer_key) : keyData.answer_key;
        setOmrAnswerKey({
          ...key,
          studentOmrEnabled: Boolean(keyData.student_omr_enabled ?? key.studentOmrEnabled),
          timeLimitMinutes: keyData.time_limit_minutes ?? key.timeLimitMinutes ?? null,
          allowResubmit: keyData.allow_resubmit !== undefined ? Boolean(keyData.allow_resubmit) : true,
          resubmitCooldownMinutes: keyData.resubmit_cooldown_minutes ?? 30,
          maxAttempts: keyData.max_attempts ?? 2,
          resubmitMode: keyData.resubmit_mode || 'wrong_only',
          revealAnswersPolicy: keyData.reveal_answers_policy || 'after_final',
          statsRevealPolicy: keyData.stats_reveal_policy || 'after_final',
          statsBasis: keyData.stats_basis || 'first',
          minStatsSample: keyData.min_stats_sample ?? 5,
        });
      }
      const subs = {}, studentAnswerMap = {};
      (subsData || []).forEach(sub => {
        subs[sub.student_id] = sub;
        if (sub.answers) {
          const ans = typeof sub.answers === 'string' ? JSON.parse(sub.answers) : sub.answers;
          const mapped = {};
          if (Array.isArray(ans)) {
            ans.forEach((a, idx) => {
              if (a && typeof a === 'object' && a.num !== undefined) mapped[a.num] = a.answer;
              else mapped[idx + 1] = a;
            });
          } else if (ans && typeof ans === 'object') {
            Object.entries(ans).forEach(([k, v]) => { mapped[Number(k)] = v; });
          }
          studentAnswerMap[sub.student_id] = mapped;
        }
      });
      setOmrSubmissions(subs);
      setOmrStudentAnswers(studentAnswerMap);
      setOmrStatsData(statsData || null);
      setOmrQuestionStats(Array.isArray(statsData) ? statsData : (statsData?.stats || []));
    } catch (err) { setMsg('OMR 데이터 로드 실패: ' + err.message); }
    setOmrLoading(false);
  };

  const setOmrAnswer = (studentId, qNum, answer) => {
    setOmrStudentAnswers(prev => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [qNum]: answer } }));
  };

  // 조교·관리자용 개별 학생 빠른 답안 문자열 입력 (예: "31425...")
  const applyQuickStudentOmrString = (studentId, rawStr) => {
    setOmrQuickInputByStudent(prev => ({ ...prev, [studentId]: rawStr }));
    const numQ = omrAnswerKey?.numQuestions || 0;
    const numC = omrAnswerKey?.numChoices || 5;
    const digits = (rawStr.match(/\d/g) || []).map(Number).filter(n => n >= 1 && n <= numC);
    if (digits.length === 0 || numQ === 0) return;
    setOmrStudentAnswers(prev => {
      const next = { ...(prev[studentId] || {}) };
      digits.slice(0, numQ).forEach((ans, idx) => {
        next[idx + 1] = ans;
      });
      return { ...prev, [studentId]: next };
    });
  };

  // 조교·관리자용 개별 학생 OMR 저장/수정 (PUT /submissions/:studentId)
  const saveSingleStudentOmr = async (studentId, studentName, updateMode = 'latest') => {
    if (!omrExamId) return;
    const ansMap = omrStudentAnswers[studentId];
    if (!ansMap || Object.keys(ansMap).length === 0) {
      setMsg('입력된 답안이 없습니다.');
      return;
    }
    const existingSub = omrSubmissions[studentId];
    if (existingSub?.myStatus === 'in_progress') {
      const proceed = await askConfirm(`${studentName} 학생이 현재 OMR을 응시 중입니다.\n강제로 답안을 저장해 덮어쓰시겠습니까?`);
      if (!proceed) return;
    }
    try {
      const res = await apiPut(`/scores/exams/${omrExamId}/submissions/${studentId}`, {
        answers: ansMap,
        updateMode,
      });
      setMsg(`${studentName} 학생 OMR이 저장되었습니다. (${res.score}점)`);
      loadOmrData(omrExamId, omrFilterSchool, omrFilterGrade);
      setTimeout(() => setMsg(''), 2500);
    } catch (err) {
      setMsg('저장 실패: ' + err.message);
    }
  };

  // 조교·관리자용 개별 학생 OMR 제출 기록 삭제 (DELETE /submissions/:studentId)
  const deleteSingleStudentOmr = async (studentId, studentName) => {
    if (!omrExamId) return;
    const ok = await askConfirm(`${studentName} 학생의 OMR 제출 기록과 자동 반영된 성적을 삭제하시겠습니까?\n(삭제 후 학생이 처음부터 다시 응시하거나 조교가 재입력할 수 있습니다.)`);
    if (!ok) return;
    try {
      await apiDelete(`/scores/exams/${omrExamId}/submissions/${studentId}`);
      setOmrStudentAnswers(prev => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      setOmrQuickInputByStudent(prev => ({ ...prev, [studentId]: '' }));
      setMsg(`${studentName} 학생의 OMR 제출 기록이 삭제되었습니다.`);
      loadOmrData(omrExamId, omrFilterSchool, omrFilterGrade);
      setTimeout(() => setMsg(''), 2500);
    } catch (err) {
      setMsg('삭제 실패: ' + err.message);
    }
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
      if (keyQ && Number(answers[i]) === Number(keyQ.answer)) {
        correct++;
        totalScore += key.scoringType === 'individual' ? (keyQ.points !== undefined ? Number(keyQ.points) : (Number(key.defaultPoints) || 0)) : equalPoints;
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
    <div className="content max-w-7xl mx-auto">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>시험/성적</span>
      </div>

      {/* 상위 탭: 시험/성적 관리 | 시험 유형 설정 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setPageTab('scores')}
          style={{ fontFamily: FONT_D, padding: '9px 20px', borderRadius: 10, border: pageTab === 'scores' ? 'none' : '1px solid #e2e8f0', fontSize: 14, fontWeight: 700, cursor: 'pointer', background: pageTab === 'scores' ? '#102044' : 'white', color: pageTab === 'scores' ? 'white' : '#334155', transition: 'all .15s' }}>
          시험/성적 관리
        </button>
        <button onClick={() => setPageTab('exam-types')}
          style={{ fontFamily: FONT_D, padding: '9px 20px', borderRadius: 10, border: pageTab === 'exam-types' ? 'none' : '1px solid #e2e8f0', fontSize: 14, fontWeight: 700, cursor: 'pointer', background: pageTab === 'exam-types' ? '#102044' : 'white', color: pageTab === 'exam-types' ? 'white' : '#334155', transition: 'all .15s' }}>
          시험 유형 설정
        </button>
      </div>

      {pageTab === 'exam-types' && <ExamTypeEditor />}

      {pageTab === 'scores' && <>
      {/* 하위 탭: 3개 */}
      <div className="tabs" style={{ marginBottom: 12, fontFamily: FONT_D }}>
        <button className={`tab ${mainTab === 'examScore' ? 'active' : ''}`}
          style={{ fontFamily: FONT_D }}
          onClick={() => {
            setMainTab('examScore');
            loadExams();
            if (selectedExam) selectExam(selectedExam);
          }}>
          시험 & 성적
        </button>
        <button className={`tab ${mainTab === 'answerKey' ? 'active' : ''}`}
          style={{ fontFamily: FONT_D }}
          onClick={() => {
            setMainTab('answerKey');
            if (!akExamId && selectedExam) {
              const id = String(selectedExam);
              setAkExamId(id);
              const ex = exams.find(x => x.id === selectedExam);
              if (ex) setAkMaxScore(ex.max_score || 100);
              loadAnswerKey(id);
            }
          }}>
          정답키 설정
        </button>
        <button className={`tab ${mainTab === 'omrInput' ? 'active' : ''}`}
          style={{ fontFamily: FONT_D }}
          onClick={() => { setMainTab('omrInput'); loadOmrExams(); }}>
          OMR 입력
        </button>
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: 12, fontFamily: FONT_D, fontWeight: 600 }}>{msg}</div>}

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
                              {isAdmin && (
                                <button className="btn btn-danger btn-sm" onClick={(ev) => { ev.stopPropagation(); deleteExam(e.id); }}
                                  style={{ fontSize: 10, padding: '3px 6px' }}>삭제</button>
                              )}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ fontFamily: FONT_D, margin: 0, fontSize: 16, fontWeight: 700, color: '#102044' }}>{exam?.name} - 성적 입력</h3>
                      <span style={{ fontFamily: FONT_D, fontSize: 12, color: '#64748B' }}>만점: {exam?.max_score}점 · 대상: {filteredStudents.length}명</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const id = String(selectedExam);
                          setMainTab('answerKey');
                          setAkExamId(id);
                          if (exam) setAkMaxScore(exam.max_score || 100);
                          loadAnswerKey(id);
                        }}
                        style={{
                          fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 6,
                          border: '1px solid #102044', background: '#102044', color: '#FFFFFF', cursor: 'pointer',
                        }}
                      >
                        정답키 · PDF 자동인식 &rarr;
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const id = String(selectedExam);
                          setMainTab('omrInput');
                          loadOmrExams();
                          setOmrExamId(id);
                          loadOmrData(id, omrFilterSchool, omrFilterGrade);
                        }}
                        style={{
                          fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 6,
                          border: '1px solid #DCE2EC', background: '#F8F9FB', color: '#102044', cursor: 'pointer',
                        }}
                      >
                        OMR 입력 · 정답률 &rarr;
                      </button>
                    </div>
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
                                              if (!await askConfirm(`${s.name}의 성적을 삭제하시겠습니까?`)) return;
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
      {/* 탭 2: 정답키 & 학생 OMR 세부 설정 */}
      {/* ═══════════════════════════════════════════════ */}
      {mainTab === 'answerKey' && (
        <div style={{ maxWidth: 940 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ fontFamily: FONT_D, fontSize: 16, fontWeight: 700, color: '#102044', margin: 0 }}>📝 정답키 & 학생 OMR 설정</h3>
              {akExamId && akExistingKey && (
                <span style={{
                  fontFamily: FONT_D, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                  background: akStudentOmrEnabled ? '#F1F6F3' : '#F4F6FA',
                  color: akStudentOmrEnabled ? '#335B48' : '#64748B',
                  border: `1px solid ${akStudentOmrEnabled ? '#CADAD1' : '#DCE2EC'}`,
                }}>
                  {akStudentOmrEnabled ? '학생 앱 OMR 오픈 중' : '학생 앱 OMR 비공개'}
                </span>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: FONT_D, fontSize: 12, fontWeight: 700, color: '#102044', marginBottom: 4, display: 'block' }}>시험 선택</label>
              <select value={akExamId}
                onChange={e => {
                  const id = e.target.value; setAkExamId(id);
                  if (id) { const ex = exams.find(x => x.id === parseInt(id)); if (ex) setAkMaxScore(ex.max_score || 100); loadAnswerKey(id); }
                  else { resetAnswerKeyForm(); setAkExistingKey(false); }
                }}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                <option value="">시험을 선택하세요</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.name} ({e.exam_type}) {e.school ? `- ${e.school}` : ''} {e.grade || ''}</option>)}
              </select>
            </div>

            {akExamId && !akLoading && (
              <>
                {/* 1. 학생 직접 OMR & 타이머·재제출 세팅 패널 */}
                <div style={{
                  marginBottom: 16, padding: 14, borderRadius: 10,
                  background: '#F8F9FB', border: '1px solid #DCE2EC'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontFamily: FONT_D, fontSize: 14, fontWeight: 700, color: '#102044' }}>⚙️ 학생 앱 직접 OMR 입력 & 시간/재제출 세팅</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        문항 수, 응시 제한 시간(분), 1회 제출 후 재제출 대기 시간(쿨타임)을 시험별로 자유롭게 설정합니다.
                      </div>
                    </div>
                    <label style={{
                      fontFamily: FONT_D,
                      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                      padding: '6px 12px', borderRadius: 8,
                      background: akStudentOmrEnabled ? '#102044' : '#FFFFFF',
                      color: akStudentOmrEnabled ? 'white' : '#1E293B',
                      border: `1px solid ${akStudentOmrEnabled ? '#102044' : '#DCE2EC'}`, fontWeight: 700, fontSize: 12,
                    }}>
                      <input type="checkbox" checked={akStudentOmrEnabled}
                        onChange={e => setAkStudentOmrEnabled(e.target.checked)} />
                      학생 앱에서 직접 OMR 입력 허용
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                    {/* 시험 응시 제한 시간 */}
                    <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1px solid #DCE2EC' }}>
                      <label style={{ fontFamily: FONT_D, fontSize: 12, fontWeight: 700, color: '#102044', display: 'block', marginBottom: 6 }}>
                        ⏱ 시험 응시 제한 시간 (타이머)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <input type="number" min="0" max="300" placeholder="제한 없음"
                          value={akTimeLimitMinutes}
                          onChange={e => setAkTimeLimitMinutes(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                          style={{ fontFamily: FONT_D, width: 90, padding: '5px 8px', border: '1px solid #DCE2EC', borderRadius: 6, fontSize: 13 }} />
                        <span style={{ fontSize: 12 }}>분 (비워두거나 0이면 무제한)</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {[
                          { label: '무제한', val: '' },
                          { label: '15분', val: 15 },
                          { label: '20분', val: 20 },
                          { label: '30분', val: 30 },
                          { label: '45분', val: 45 },
                          { label: '50분', val: 50 },
                          { label: '80분', val: 80 },
                        ].map(p => (
                          <button key={p.label} type="button"
                            onClick={() => setAkTimeLimitMinutes(p.val)}
                            style={{
                              fontFamily: FONT_D, fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                              border: String(akTimeLimitMinutes) === String(p.val) ? '1px solid #102044' : '1px solid #DCE2EC',
                              background: String(akTimeLimitMinutes) === String(p.val) ? '#102044' : '#F8F9FB',
                              color: String(akTimeLimitMinutes) === String(p.val) ? '#FFFFFF' : '#1E293B',
                              fontWeight: 600,
                            }}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 재제출 대기 시간 (쿨타임) */}
                    <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1px solid #DCE2EC' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontFamily: FONT_D, fontSize: 12, fontWeight: 700, color: '#102044' }}>
                          ⏳ 1회 제출 후 재제출 시간 제한 (쿨타임)
                        </label>
                        <label style={{ fontFamily: FONT_D, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontWeight: 600 }}>
                          <input type="checkbox" checked={akAllowResubmit} onChange={e => setAkAllowResubmit(e.target.checked)} />
                          재제출 허용
                        </label>
                      </div>
                      {akAllowResubmit ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <input type="number" min="0" max="1440"
                              value={akResubmitCooldownMinutes}
                              onChange={e => setAkResubmitCooldownMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                              style={{ fontFamily: FONT_D, width: 80, padding: '5px 8px', border: '1px solid #DCE2EC', borderRadius: 6, fontSize: 13 }} />
                            <span style={{ fontSize: 12 }}>분 대기 후 재제출 가능</span>
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {[
                              { label: '즉시(0분)', val: 0 },
                              { label: '5분', val: 5 },
                              { label: '10분', val: 10 },
                              { label: '20분', val: 20 },
                              { label: '30분', val: 30 },
                              { label: '60분', val: 60 },
                            ].map(p => (
                              <button key={p.label} type="button"
                                onClick={() => setAkResubmitCooldownMinutes(p.val)}
                                style={{
                                  fontFamily: FONT_D, fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                                  border: Number(akResubmitCooldownMinutes) === p.val ? '1px solid #102044' : '1px solid #DCE2EC',
                                  background: Number(akResubmitCooldownMinutes) === p.val ? '#102044' : '#F8F9FB',
                                  color: Number(akResubmitCooldownMinutes) === p.val ? '#FFFFFF' : '#1E293B',
                                  fontWeight: 600,
                                }}>
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: '#64748B', padding: '8px 0' }}>
                          재제출 비활성화됨 — 학생은 1회만 최종 제출할 수 있습니다.
                        </div>
                      )}
                    </div>

                    {/* 재제출 횟수·방식 & 정답 공개 정책 */}
                    <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 8, border: '1px solid #DCE2EC', gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {akAllowResubmit && (
                          <>
                            <div style={{ flex: '1 1 160px' }}>
                              <label style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', display: 'block', marginBottom: 4 }}>총 제출 가능 횟수</label>
                              <select value={akMaxAttempts} onChange={e => setAkMaxAttempts(parseInt(e.target.value))}
                                style={{ width: '100%', padding: '6px 8px', border: '1px solid #DCE2EC', borderRadius: 6, fontSize: 12 }}>
                                <option value={2}>총 2회 (1차 제출 + 재제출 1회)</option>
                                <option value={3}>총 3회 (1차 제출 + 재제출 2회)</option>
                                <option value={4}>총 4회 (1차 제출 + 재제출 3회)</option>
                                <option value={0}>횟수 제한 없음 (쿨타임마다 재도전)</option>
                              </select>
                            </div>
                            <div style={{ flex: '1 1 220px' }}>
                              <label style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', display: 'block', marginBottom: 4 }}>재제출 시 마킹 방식</label>
                              <select value={akResubmitMode} onChange={e => setAkResubmitMode(e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', border: '1px solid #DCE2EC', borderRadius: 6, fontSize: 12 }}>
                                <option value="wrong_only">틀린 문항만 다시 마킹 (맞힌 문항은 잠금 유지)</option>
                                <option value="all">전체 문항 다시 마킹 허용</option>
                              </select>
                            </div>
                          </>
                        )}
                        <div style={{ flex: '1 1 240px' }}>
                          <label style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', display: 'block', marginBottom: 4 }}>정답 번호 공개 시점 (베끼기 방지)</label>
                          <select value={akRevealAnswersPolicy} onChange={e => setAkRevealAnswersPolicy(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #DCE2EC', borderRadius: 6, fontSize: 12 }}>
                            <option value="after_final">재제출 모두 완료 후 공개 (1차 후에는 점수·O/X만 표시)</option>
                            <option value="immediate">1차 제출 즉시 정답 번호까지 공개</option>
                            <option value="never">학생에게 정답 번호 비공개 (점수·O/X만 표시)</option>
                          </select>
                        </div>
                      </div>

                      {/* 문항별 정답률 · 선지 분포 공개 설정 */}
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, paddingTop: 10, borderTop: '1px solid #EAEFF5' }}>
                        <div style={{ flex: '1 1 220px' }}>
                          <label style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', display: 'block', marginBottom: 4 }}>학생 정답률 · 선지 분포 공개</label>
                          <select value={akStatsRevealPolicy} onChange={e => setAkStatsRevealPolicy(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #DCE2EC', borderRadius: 6, fontSize: 12 }}>
                            <option value="after_final">최종 완료 후 정답률 + 선지 분포 공개 (추천)</option>
                            <option value="rate_only_first">1차 직후부터 정답률(%)만 공개 (선지 분포는 최종 후)</option>
                            <option value="off">학생에게 정답률 비공개 (관리자·조교만 열람)</option>
                          </select>
                        </div>
                        <div style={{ flex: '1 1 180px' }}>
                          <label style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', display: 'block', marginBottom: 4 }}>학생 표시 정답률 기준</label>
                          <select value={akStatsBasis} onChange={e => setAkStatsBasis(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #DCE2EC', borderRadius: 6, fontSize: 12 }}>
                            <option value="first">1차 제출 기준 (실제 난이도 · 추천)</option>
                            <option value="latest">최종 제출 기준 (재제출 반영)</option>
                          </select>
                        </div>
                        <div style={{ flex: '0 1 170px' }}>
                          <label style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', display: 'block', marginBottom: 4 }}>정답률 최소 공개 인원</label>
                          <select value={akMinStatsSample} onChange={e => setAkMinStatsSample(parseInt(e.target.value))}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #DCE2EC', borderRadius: 6, fontSize: 12 }}>
                            <option value={5}>5명 이상 응시 시 공개 (기본)</option>
                            <option value={3}>3명 이상 응시 시 공개</option>
                            <option value={10}>10명 이상 응시 시 공개</option>
                            <option value={0}>제한 없음 (1명부터 바로 공개)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1.5 PDF · 이미지 정답표 AI 자동 인식 패널 */}
                <div
                  onDragOver={e => { e.preventDefault(); setAkPdfDragging(true); }}
                  onDragLeave={() => setAkPdfDragging(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setAkPdfDragging(false);
                    const file = e.dataTransfer?.files?.[0];
                    if (file) handleParseAnswerKeyPdfFile(file);
                  }}
                  style={{
                    marginBottom: 16, padding: 14, borderRadius: 10,
                    background: akPdfDragging ? '#F4F6FA' : '#FFFFFF',
                    border: akPdfDragging ? '1.5px dashed #102044' : '1px solid #DCE2EC',
                    transition: 'background 0.15s ease, border-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: FONT_D, fontSize: 13.5, fontWeight: 700, color: '#102044' }}>
                          PDF · 이미지 정답표 자동 인식
                        </span>
                        <span style={{
                          fontFamily: FONT_D, fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                          background: '#F4F6FA', color: '#102044', border: '1px solid #DCE2EC',
                        }}>
                          AI 자동 입력
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 3, lineHeight: 1.5 }}>
                        정답표·해설지 PDF 또는 캡처 사진을 올리면 문항 수, 객관식 정답(①~⑤), 배점, 영역, 해설 쪽수를 자동으로 인식해 아래에 채워줍니다. (드래그앤드롭 가능 · 최대 15MB)
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <input
                        ref={akPdfInputRef}
                        type="file"
                        accept="application/pdf,.pdf,image/png,image/jpeg,image/webp"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleParseAnswerKeyPdfFile(file);
                        }}
                      />
                      <button
                        type="button"
                        disabled={akPdfParsing}
                        onClick={() => akPdfInputRef.current?.click()}
                        style={{
                          fontFamily: FONT_D, fontSize: 12, fontWeight: 700,
                          padding: '7px 14px', borderRadius: 7, cursor: akPdfParsing ? 'wait' : 'pointer',
                          border: '1px solid #102044', background: '#102044', color: '#FFFFFF',
                          opacity: akPdfParsing ? 0.65 : 1,
                        }}
                      >
                        {akPdfParsing ? 'PDF 분석 중...' : 'PDF / 사진 올리기'}
                      </button>

                      {akExpFileUrl.trim() && /drive\.google\.com|docs\.google\.com/i.test(akExpFileUrl) && (
                        <button
                          type="button"
                          disabled={akPdfParsing}
                          onClick={handleParseAnswerKeyFromDrive}
                          style={{
                            fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700,
                            padding: '7px 11px', borderRadius: 7, cursor: akPdfParsing ? 'wait' : 'pointer',
                            border: '1px solid #DCE2EC', background: '#F8F9FB', color: '#102044',
                            opacity: akPdfParsing ? 0.65 : 1,
                          }}
                        >
                          연동된 Drive PDF에서 자동 인식
                        </button>
                      )}
                    </div>
                  </div>

                  {akPdfParsing && (
                    <div style={{
                      marginTop: 10, padding: '9px 11px', borderRadius: 7,
                      background: '#F4F6FA', border: '1px solid #DCE2EC',
                      fontFamily: FONT_D, fontSize: 12, fontWeight: 600, color: '#102044',
                    }}>
                      PDF에서 문항 번호 · 정답(①~⑤) · 배점 · 영역을 읽고 있습니다... (문서 크기에 따라 5~20초 소요)
                    </div>
                  )}

                  {akPdfError && (
                    <div style={{
                      marginTop: 10, padding: '9px 11px', borderRadius: 7,
                      background: '#FAF3F3', border: '1px solid #E0C8CA',
                      fontFamily: FONT_D, fontSize: 12, fontWeight: 600, color: '#913E43',
                    }}>
                      {akPdfError}
                    </div>
                  )}

                  {akPdfResult && (
                    <div style={{
                      marginTop: 10, padding: '10px 12px', borderRadius: 7,
                      background: '#F1F6F3', border: '1px solid #CADAD1',
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontFamily: FONT_D, fontSize: 12.5, fontWeight: 700, color: '#335B48' }}>
                          자동 인식 완료: {akPdfResult.recognizedCount}문항 입력됨
                          {akPdfResult.scoringType === 'individual' ? ' · 문항별 배점 반영' : ''}
                          {akPdfResult.categoriesDetectedCount > 0 ? ` · 영역 ${akPdfResult.categoriesDetectedCount}문항` : ''}
                          {akPdfResult.pagesDetectedCount > 0 ? ` · 해설 쪽수 ${akPdfResult.pagesDetectedCount}문항` : ''}
                        </span>
                        <span style={{ fontFamily: FONT_D, fontSize: 11, color: '#64748B' }}>
                          {akPdfResult.source}
                        </span>
                      </div>
                      {akPdfResult.summaryNote && (
                        <div style={{ fontSize: 11.5, color: '#1E293B' }}>{akPdfResult.summaryNote}</div>
                      )}
                      {Array.isArray(akPdfResult.warnings) && akPdfResult.warnings.length > 0 && (
                        <div style={{
                          padding: '7px 10px', borderRadius: 6,
                          background: '#FAF6EE', border: '1px solid #E3D5BA',
                          fontSize: 11.5, color: '#7F5C24', fontWeight: 600,
                          display: 'flex', flexDirection: 'column', gap: 2,
                        }}>
                          {akPdfResult.warnings.map((w, idx) => (
                            <div key={idx}>· {w}</div>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#335B48' }}>
                        아래 <strong>빠른 정답 마킹</strong>에서 오인식된 번호가 없는지 확인한 뒤 맨 아래 <strong>저장</strong> 버튼을 눌러주세요.
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. 문항 수 · 선택지 · 만점 · 배점 방식 */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                  <div style={{ flex: '1 1 130px' }}>
                    <label style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', display: 'block', marginBottom: 4 }}>문제 수 (1~100)</label>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input type="number" min="1" max="100" value={akNumQuestions}
                        onChange={e => setAkNumQuestions(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                        style={{ fontFamily: FONT_D, width: 70, padding: '5px 8px', border: '1px solid #DCE2EC', borderRadius: 6, fontSize: 13 }} />
                      {[10, 20, 25, 30, 45].map(n => (
                        <button key={n} type="button" onClick={() => setAkNumQuestions(n)}
                          style={{
                            fontFamily: FONT_D, fontSize: 11, padding: '4px 7px', borderRadius: 5, cursor: 'pointer',
                            border: akNumQuestions === n ? '1px solid #102044' : '1px solid #DCE2EC',
                            background: akNumQuestions === n ? '#102044' : '#FFFFFF',
                            color: akNumQuestions === n ? '#FFFFFF' : '#1E293B', fontWeight: 600,
                          }}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', display: 'block', marginBottom: 4 }}>선택지 수</label>
                    <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                      {[3, 4, 5].map(c => (
                        <label key={c} style={{ fontFamily: FONT_D, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                          <input type="radio" name="akChoices" checked={akNumChoices === c} onChange={() => setAkNumChoices(c)} /> {c}지선다
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: '0 1 90px' }}>
                    <label style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', display: 'block', marginBottom: 4 }}>만점</label>
                    <input type="number" min="1" max="1000" value={akMaxScore}
                      onChange={e => setAkMaxScore(Math.max(1, parseInt(e.target.value) || 100))}
                      style={{ fontFamily: FONT_D, width: '100%', padding: '5px 8px', border: '1px solid #DCE2EC', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '1 1 140px' }}>
                    <label style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', display: 'block', marginBottom: 4 }}>배점 방식</label>
                    <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                      <label style={{ fontFamily: FONT_D, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                        <input type="radio" name="akScoring" checked={akScoringType === 'equal'} onChange={() => setAkScoringType('equal')} /> 균등 배점
                      </label>
                      <label style={{ fontFamily: FONT_D, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                        <input type="radio" name="akScoring" checked={akScoringType === 'individual'} onChange={() => setAkScoringType('individual')} /> 문항별 배점
                      </label>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 14, padding: '8px 12px', background: '#F8F9FB', border: '1px solid #EAEFF5', borderRadius: 6, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  {akScoringType === 'equal' ? (
                    <span>균등배점: <strong style={{ fontFamily: FONT_D, color: '#102044' }}>{akMaxScore}점 / {akNumQuestions}문항 = 문항당 {Math.round((akMaxScore / akNumQuestions) * 100) / 100}점</strong></span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>기본 배점:</span>
                      <input type="number" min="0" step="0.5" value={akDefaultPoints}
                        onChange={e => setAkDefaultPoints(parseFloat(e.target.value) || 0)}
                        style={{ fontFamily: FONT_D, width: 55, padding: '3px 6px', border: '1px solid #DCE2EC', borderRadius: 4, fontSize: 12, textAlign: 'center' }} />
                      <span>점</span>
                      <span style={{ color: '#64748B' }}>
                        (현재 총합: <strong style={{ fontFamily: FONT_D, color: '#102044' }}>
                          {Array.from({ length: akNumQuestions }, (_, i) => akPoints[i + 1] !== undefined ? Number(akPoints[i + 1]) : Number(akDefaultPoints)).reduce((a, b) => a + b, 0)}점
                        </strong>)
                      </span>
                    </div>
                  )}

                  {/* 빠른 정답 문자열 일괄 입력 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044' }}>⚡ 빠른 정답 입력:</span>
                    <input
                      value={akQuickString}
                      onChange={e => applyQuickAnswerString(e.target.value)}
                      placeholder="예: 3142512345..."
                      style={{ width: 170, padding: '4px 8px', border: '1px solid #DCE2EC', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }}
                    />
                  </div>
                </div>

                {/* 정답 입력 영역 (빠른 정답) */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                    <label style={{ fontFamily: FONT_D, fontSize: 12.5, fontWeight: 700, color: '#102044' }}>
                      빠른 정답 마킹 ({Object.keys(akAnswers).filter(k => Number(k) <= akNumQuestions && akAnswers[k]).length}/{akNumQuestions}문항 입력됨)
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: '#64748B' }}>
                        문항 번호 클릭 시 아래 해설 입력란으로 이동
                      </span>
                    </label>
                    <button type="button" onClick={() => { setAkAnswers({}); setAkQuickString(''); }}
                      style={{ fontFamily: FONT_D, fontSize: 11, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      정답 초기화
                    </button>
                  </div>
                  {(() => {
                    const rows = [];
                    for (let row = 0; row < Math.ceil(akNumQuestions / 5); row++) {
                      const items = [];
                      for (let col = 0; col < 5; col++) {
                        const qNum = row * 5 + col + 1;
                        if (qNum > akNumQuestions) break;
                        const hasExp = Boolean(
                          (typeof akExplanations[qNum] === 'string' && akExplanations[qNum].trim()) ||
                          akExpPages[qNum] ||
                          (typeof akExpUrls[qNum] === 'string' && akExpUrls[qNum].trim())
                        );
                        items.push(
                          <div key={qNum} style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
                            <button
                              type="button"
                              onClick={() => jumpToAdminExplanation(qNum)}
                              title={`${qNum}번 해설 쪽수·링크 설정으로 이동`}
                              style={{
                                fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, width: 28, textAlign: 'right', flexShrink: 0,
                                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                color: hasExp ? '#335B48' : '#102044',
                                textDecoration: hasExp ? 'underline' : 'none',
                              }}
                            >
                              {qNum}.
                            </button>
                            <div style={{ display: 'flex', gap: 2 }}>
                              {Array.from({ length: akNumChoices }, (_, i) => i + 1).map(n => {
                                const symbols = ['', '\u2460', '\u2461', '\u2462', '\u2463', '\u2464'];
                                return (
                                  <button key={n} type="button" onClick={() => setAkAnswers(prev => ({ ...prev, [qNum]: n }))}
                                    style={{
                                      fontFamily: FONT_D,
                                      width: 26, height: 26, borderRadius: '50%', border: '1.5px solid',
                                      borderColor: akAnswers[qNum] === n ? '#102044' : '#CBD5E1',
                                      background: akAnswers[qNum] === n ? '#102044' : '#FFFFFF',
                                      color: akAnswers[qNum] === n ? '#FFFFFF' : '#1E293B',
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
                                style={{ fontFamily: FONT_D, width: 38, padding: '2px 4px', border: '1px solid #DCE2EC', borderRadius: 4, fontSize: 10, textAlign: 'center' }} />
                            )}
                          </div>
                        );
                      }
                      rows.push(
                        <div key={row} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: 6, marginBottom: 4 }}>
                          {items}
                        </div>
                      );
                    }
                    return rows;
                  })()}
                </div>

                {/* 정답과 해설 연동 영역 (Google Drive · 네이버 MYBOX / N드라이브) */}
                {(() => {
                  const parsedPreview = akExpFileUrl.trim() ? parseExplanationFileUrl(akExpFileUrl.trim()) : null;
                  const configuredCount = Array.from({ length: akNumQuestions }, (_, i) => i + 1).filter(qNum => (
                    akExpPages[qNum] ||
                    (akExpUrls[qNum] || '').trim() ||
                    (akExplanations[qNum] || '').trim()
                  )).length;

                  return (
                    <div style={{
                      marginBottom: 16, borderRadius: 10,
                      border: '1px solid #DCE2EC', background: '#F8F9FB', overflow: 'hidden',
                    }}>
                      {/* 헤더 */}
                      <div style={{
                        padding: '10px 14px', background: '#F4F6FA', borderBottom: '1px solid #DCE2EC',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                      }}>
                        <div>
                          <div style={{ fontFamily: FONT_D, fontSize: 13.5, fontWeight: 700, color: '#102044', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <span>정답과 해설 파일 연동 (Google Drive · 네이버 MYBOX / N드라이브)</span>
                            {parsedPreview && (
                              <span style={{
                                fontFamily: FONT_D, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                                background: '#F1F6F3', color: '#335B48', border: '1px solid #CADAD1',
                              }}>
                                {parsedPreview.providerLabel} 연결됨
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                            구글 드라이브나 네이버 MYBOX(N드라이브) 해설지 공유 링크를 넣으면 학생의 빠른 정답 아래에 바로 연동됩니다.
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => setAkShowExplanations(prev => !prev)}
                            style={{
                              fontFamily: FONT_D, fontSize: 11.5, fontWeight: 600, padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                              border: '1px solid #DCE2EC', background: akShowExplanations ? '#102044' : '#FFFFFF',
                              color: akShowExplanations ? '#FFFFFF' : '#1E293B',
                            }}
                          >
                            {akShowExplanations ? '문항별 연결 접기' : `문항별 쪽수·개별 링크 (${configuredCount}/${akNumQuestions})`}
                          </button>
                        </div>
                      </div>

                      {/* 1. 시험 전체 해설 파일 연동 입력 */}
                      <div style={{ padding: 13, background: '#FFFFFF', borderBottom: akShowExplanations || akShowBulkExplanation ? '1px solid #DCE2EC' : 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 8, marginBottom: 8 }}>
                          <div>
                            <label style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', display: 'block', marginBottom: 4 }}>
                              해설 파일 공유 링크 (Google Drive · 네이버 MYBOX / N드라이브 · PDF)
                            </label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input
                                type="url"
                                value={akExpFileUrl}
                                onChange={e => setAkExpFileUrl(e.target.value)}
                                placeholder="https://drive.google.com/file/d/... 또는 https://mybox.naver.com/..."
                                style={{
                                  flex: 1, padding: '7px 10px', border: '1px solid #DCE2EC', borderRadius: 6,
                                  fontSize: 12.5, boxSizing: 'border-box',
                                }}
                              />
                              {parsedPreview && (
                                <a
                                  href={parsedPreview.openUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontFamily: FONT_D, padding: '7px 10px', borderRadius: 6, border: '1px solid #DCE2EC',
                                    background: '#F8F9FB', color: '#102044', fontSize: 11.5, fontWeight: 600,
                                    textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center',
                                  }}
                                >
                                  열기 &#8599;
                                </a>
                              )}
                            </div>
                          </div>
                          <div>
                            <label style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', display: 'block', marginBottom: 4 }}>
                              파일 표시 제목 (선택)
                            </label>
                            <input
                              type="text"
                              value={akExpFileTitle}
                              onChange={e => setAkExpFileTitle(e.target.value)}
                              placeholder="예: 고1 주간 모의고사 3회 해설지.pdf"
                              style={{
                                width: '100%', padding: '7px 10px', border: '1px solid #DCE2EC', borderRadius: 6,
                                fontSize: 12.5, boxSizing: 'border-box',
                              }}
                            />
                          </div>
                        </div>

                        {akExpFileUrl.trim() && !parsedPreview ? (
                          <div style={{ fontFamily: FONT_D, fontSize: 11.5, color: '#913E43', fontWeight: 600 }}>
                            유효한 웹 링크(https://...)를 입력해 주세요.
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.55 }}>
                            {parsedPreview
                              ? parsedPreview.helperNote
                              : '구글 드라이브는 "링크가 있는 모든 사용자(뷰어)", 네이버 MYBOX(N드라이브)는 "공유 링크 생성(보기 허용)" 링크를 붙여넣어 주세요. 재제출 완료 전에는 학생에게 링크가 노출되지 않습니다.'}
                          </div>
                        )}
                      </div>

                      {/* 2. 문항별 해설지 쪽수 / 개별 파일 링크 / 짧은 메모 설정 (선택) */}
                      {akShowExplanations && (
                        <div style={{ padding: 12 }}>
                          {/* 빠른 쪽수·영역 일괄 배정 & 텍스트 일괄 붙여넣기 툴바 */}
                          <div style={{
                            padding: '9px 11px', background: '#FFFFFF', border: '1px solid #DCE2EC', borderRadius: 7,
                            marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                                <span style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', whiteSpace: 'nowrap' }}>
                                  해설지 쪽수:
                                </span>
                                <input
                                  type="text"
                                  value={akPageRangeStr}
                                  onChange={e => setAkPageRangeStr(e.target.value)}
                                  placeholder="예: 1-5:1, 6-10:2"
                                  style={{
                                    flex: '1 1 150px', maxWidth: 210, padding: '4px 8px',
                                    border: '1px solid #DCE2EC', borderRadius: 5, fontSize: 12,
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={applyPageRangeMap}
                                  style={{
                                    fontFamily: FONT_D, fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 5,
                                    border: 'none', background: '#102044', color: '#FFFFFF', cursor: 'pointer',
                                  }}
                                >
                                  쪽수 배정
                                </button>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                                <span style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', whiteSpace: 'nowrap' }}>
                                  영역 태그:
                                </span>
                                <input
                                  type="text"
                                  value={akCategoryRangeStr}
                                  onChange={e => setAkCategoryRangeStr(e.target.value)}
                                  placeholder="예: 1-10:독서, 11-20:문학"
                                  style={{
                                    flex: '1 1 160px', maxWidth: 220, padding: '4px 8px',
                                    border: '1px solid #DCE2EC', borderRadius: 5, fontSize: 12,
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={applyCategoryRangeMap}
                                  style={{
                                    fontFamily: FONT_D, fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 5,
                                    border: '1px solid #102044', background: '#FFFFFF', color: '#102044', cursor: 'pointer',
                                  }}
                                >
                                  영역 배정
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => setAkShowBulkExplanation(prev => !prev)}
                                style={{
                                  fontFamily: FONT_D, fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 5, cursor: 'pointer',
                                  border: '1px solid #DCE2EC', background: akShowBulkExplanation ? '#102044' : '#F8F9FB',
                                  color: akShowBulkExplanation ? '#FFFFFF' : '#475569',
                                }}
                              >
                                텍스트 일괄 붙여넣기
                              </button>
                            </div>
                          </div>

                          {/* 텍스트 해설 일괄 붙여넣기 (보조 옵션) */}
                          {akShowBulkExplanation && (
                            <div style={{ padding: 10, marginBottom: 10, background: '#FFFFFF', border: '1px solid #DCE2EC', borderRadius: 7 }}>
                              <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>
                                문항별 텍스트 메모를 한꺼번에 넣을 때 사용합니다. (<code style={{ background: '#F4F6FA', padding: '1px 4px', borderRadius: 3 }}>1. ...</code>, <code style={{ background: '#F4F6FA', padding: '1px 4px', borderRadius: 3 }}>2번 ...</code> 자동 인식)
                              </div>
                              <textarea
                                rows={4}
                                value={akBulkExplanationText}
                                onChange={e => setAkBulkExplanationText(e.target.value)}
                                placeholder={'1. 화자의 정서를 자연물에 빗대어 표현.\n2. ③번 선지는 인과 관계가 반대.'}
                                style={{
                                  width: '100%', padding: '7px 9px', border: '1px solid #DCE2EC', borderRadius: 6,
                                  fontSize: 12, lineHeight: 1.55, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical',
                                }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                                <button type="button" onClick={() => { setAkShowBulkExplanation(false); setAkBulkExplanationText(''); }}
                                  style={{ fontFamily: FONT_D, fontSize: 11, padding: '4px 9px', borderRadius: 5, border: '1px solid #DCE2EC', background: '#FFFFFF', color: '#64748B', cursor: 'pointer' }}>
                                  취소
                                </button>
                                <button type="button" onClick={applyBulkExplanations}
                                  style={{ fontFamily: FONT_D, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 5, border: 'none', background: '#102044', color: '#FFFFFF', cursor: 'pointer' }}>
                                  자동 분리 적용
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 문항별 쪽수 · 영역 · 개별 파일 링크 · 짧은 메모 리스트 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 400, overflowY: 'auto' }}>
                            {Array.from({ length: akNumQuestions }, (_, i) => i + 1).map(qNum => {
                              const symbols = ['', '\u2460', '\u2461', '\u2462', '\u2463', '\u2464'];
                              const ansVal = akAnswers[qNum];
                              return (
                                <div key={qNum} style={{
                                  background: '#FFFFFF', border: '1px solid #DCE2EC', borderRadius: 7, padding: '8px 10px',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                                    <span style={{ fontFamily: FONT_D, fontSize: 12, fontWeight: 700, color: '#102044', width: 32 }}>
                                      {String(qNum).padStart(2, '0')}번
                                    </span>
                                    <span style={{
                                      fontFamily: FONT_D, fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                                      background: ansVal ? '#F4F6FA' : '#FAF3F3',
                                      color: ansVal ? '#102044' : '#913E43',
                                    }}>
                                      {ansVal ? `정답 ${symbols[ansVal] || ansVal}` : '정답 미선택'}
                                    </span>
                                    <input
                                      type="text"
                                      value={akCategories[qNum] || ''}
                                      onChange={e => setAkCategories(prev => ({ ...prev, [qNum]: e.target.value }))}
                                      placeholder="영역 (예: 독서)"
                                      style={{
                                        width: 82, padding: '3px 6px', border: '1px solid #DCE2EC', borderRadius: 5,
                                        fontSize: 11.5,
                                      }}
                                    />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <span style={{ fontSize: 11, color: '#64748B' }}>해설지</span>
                                      <input
                                        ref={el => { akExplanationRefs.current[qNum] = el; }}
                                        type="number"
                                        min="1"
                                        max="500"
                                        value={akExpPages[qNum] || ''}
                                        onChange={e => setAkExpPages(prev => ({ ...prev, [qNum]: e.target.value ? parseInt(e.target.value, 10) : '' }))}
                                        placeholder="쪽"
                                        style={{
                                          fontFamily: FONT_D, width: 52, padding: '3px 6px', border: '1px solid #DCE2EC', borderRadius: 5,
                                          fontSize: 12, textAlign: 'center',
                                        }}
                                      />
                                      <span style={{ fontSize: 11, color: '#64748B' }}>쪽</span>
                                    </div>
                                    <input
                                      type="url"
                                      value={akExpUrls[qNum] || ''}
                                      onChange={e => setAkExpUrls(prev => ({ ...prev, [qNum]: e.target.value }))}
                                      placeholder="문항별 개별 구글/MYBOX 파일 링크 (선택)"
                                      style={{
                                        flex: '1 1 180px', padding: '4px 8px', border: '1px solid #DCE2EC', borderRadius: 5,
                                        fontSize: 11.5, boxSizing: 'border-box',
                                      }}
                                    />
                                  </div>
                                  <input
                                    type="text"
                                    value={akExplanations[qNum] || ''}
                                    onChange={e => setAkExplanations(prev => ({ ...prev, [qNum]: e.target.value }))}
                                    placeholder={`${qNum}번 짧은 핵심 해설 메모 (선택)`}
                                    style={{
                                      width: '100%', padding: '5px 8px', border: '1px solid #EAEFF5', borderRadius: 5,
                                      fontSize: 12, background: '#FAFBFD', boxSizing: 'border-box',
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" style={{ fontFamily: FONT_D }} onClick={saveAnswerKey}>정답키·해설 파일 연동 및 OMR 설정 저장</button>
                  {akExistingKey && (
                    <button className="btn btn-outline" style={{ fontFamily: FONT_D }} onClick={() => regradeAllSubmissions(akExamId)}>
                      🔄 기존 제출자 일괄 재채점
                    </button>
                  )}
                  {akExistingKey && <button className="btn btn-danger" style={{ fontFamily: FONT_D }} onClick={deleteAnswerKey}>삭제</button>}
                  {akExistingKey && (
                    <button className="btn btn-outline" onClick={() => { setMainTab('omrInput'); loadOmrExams(); setOmrExamId(akExamId); setTimeout(() => loadOmrData(akExamId), 300); }}
                      style={{ marginLeft: 'auto', fontFamily: FONT_D }}>
                      OMR 제출 현황 / 채점으로 이동 &rarr;
                    </button>
                  )}
                </div>
              </>
            )}
            {akLoading && <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: 20 }}>로딩 중...</p>}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* 탭 3: OMR 제출 현황 & 대리 입력 */}
      {/* ═══════════════════════════════════════════════ */}
      {mainTab === 'omrInput' && (
        <div style={{ maxWidth: 940 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ fontFamily: FONT_D, fontSize: 16, fontWeight: 700, color: '#102044', margin: 0 }}>📋 OMR 제출 현황 & 답안 관리</h3>
              {omrExamId && (
                <button className="btn btn-outline btn-sm" onClick={() => loadOmrData(omrExamId, omrFilterSchool, omrFilterGrade)} style={{ fontFamily: FONT_D, fontSize: 12 }}>
                  🔄 현황 새로고침
                </button>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontFamily: FONT_D, fontSize: 12, fontWeight: 700, color: '#102044', marginBottom: 4, display: 'block' }}>시험 선택 (정답키 설정된 시험)</label>
              <select value={omrExamId}
                onChange={e => {
                  const id = e.target.value; setOmrExamId(id);
                  setOmrExpandedStudent(null); setOmrStudentAnswers({}); setOmrAnswerKey(null);
                  setOmrSubmissions({}); setOmrQuestionStats([]); setOmrStatsData(null); setOmrQuickInputByStudent({});
                  if (id) loadOmrData(id, omrFilterSchool, omrFilterGrade);
                }}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #DCE2EC', borderRadius: 8, fontSize: 13 }}>
                <option value="">시험을 선택하세요</option>
                {omrExams.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.exam_type}) — {e.question_count}문항 {e.student_omr_enabled ? '· [학생OMR 오픈]' : '· [비공개]'}
                  </option>
                ))}
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
              const submittedCount = omrStudentList.filter(s => omrSubmissions[s.id]?.answers?.length > 0).length;
              return (
                <>
                  {/* 현재 시험의 OMR 세팅 요약 바 */}
                  <div style={{
                    marginBottom: 12, padding: '8px 12px', borderRadius: 8,
                    background: '#F8F9FB', border: '1px solid #DCE2EC',
                    display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', fontSize: 12
                  }}>
                    <span style={{ fontFamily: FONT_D, fontWeight: 700, color: omrAnswerKey.studentOmrEnabled ? '#335B48' : '#64748B' }}>
                      {omrAnswerKey.studentOmrEnabled ? '학생 앱 OMR 오픈' : '학생 앱 비공개'}
                    </span>
                    <span>문항: <strong style={{ fontFamily: FONT_D, color: '#102044' }}>{omrAnswerKey.numQuestions}문항</strong> ({omrAnswerKey.numChoices || 5}지선다)</span>
                    <span>제한시간: <strong style={{ fontFamily: FONT_D, color: '#102044' }}>{omrAnswerKey.timeLimitMinutes ? `${omrAnswerKey.timeLimitMinutes}분` : '무제한'}</strong></span>
                    <span>
                      재제출: <strong style={{ fontFamily: FONT_D, color: '#102044' }}>
                        {omrAnswerKey.allowResubmit
                          ? `쿨타임 ${omrAnswerKey.resubmitCooldownMinutes}분 · 최대 ${omrAnswerKey.maxAttempts === 0 ? '무제한' : `${omrAnswerKey.maxAttempts}회`} (${omrAnswerKey.resubmitMode === 'wrong_only' ? '오답만' : '전체'})`
                          : '불가(1회만)'}
                      </strong>
                    </span>
                    <button type="button"
                      onClick={() => { setMainTab('answerKey'); setAkExamId(omrExamId); loadAnswerKey(omrExamId); }}
                      style={{ fontFamily: FONT_D, marginLeft: 'auto', fontSize: 11.5, color: '#102044', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                      ⚙️ 설정 변경 &rarr;
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    <select value={omrFilterSchool} onChange={e => {
                      const nextSchool = e.target.value;
                      setOmrFilterSchool(nextSchool);
                      setOmrFilterGrade('');
                      reloadOmrQuestionStats(omrExamId, nextSchool, '');
                    }}
                      style={{ flex: 1, padding: '6px 8px', border: '1px solid #DCE2EC', borderRadius: 6, fontSize: 12 }}>
                      <option value="">전체 학교</option>
                      {schools.filter(s => s.name !== '조교' && s.name !== '선생님').map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                    <select value={omrFilterGrade} onChange={e => {
                      const nextGrade = e.target.value;
                      setOmrFilterGrade(nextGrade);
                      reloadOmrQuestionStats(omrExamId, omrFilterSchool, nextGrade);
                    }} disabled={!omrFilterSchool}
                      style={{ flex: 1, padding: '6px 8px', border: '1px solid #DCE2EC', borderRadius: 6, fontSize: 12 }}>
                      <option value="">전체 학년</option>
                      {omrGradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  {/* 문항별 정답률 · 선지 분포 · 킬러 문항 · 오답 학생 분석 패널 */}
                  <AdminOmrStatsPanel
                    statsData={omrStatsData}
                    examName={omrExam?.name || '시험'}
                    filterSchool={omrFilterSchool}
                    filterGrade={omrFilterGrade}
                  />

                  <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontFamily: FONT_D }}>대상 학생 <strong style={{ color: '#102044' }}>{omrStudentList.length}명</strong> (제출 완료: <strong style={{ color: '#335B48' }}>{submittedCount}명</strong>)</span>
                    <span>학생 이름을 클릭하면 조교·관리자 OMR 입력·수정·삭제 및 쿨타임 제어가 가능합니다.</span>
                  </div>
                  <div style={{ maxHeight: 620, overflowY: 'auto' }}>
                    {omrStudentList.map(s => {
                      const isExpanded = omrExpandedStudent === s.id;
                      const sub = omrSubmissions[s.id];
                      const hasSubmission = !!(sub && sub.answers && sub.answers.length > 0);
                      const hasAnswers = omrStudentAnswers[s.id] && Object.keys(omrStudentAnswers[s.id]).length > 0;
                      const result = hasAnswers ? calculateOmrScore(s.id) : null;
                      const firstScore = sub?.first_score ?? null;
                      const latestScore = sub?.score ?? null;
                      const attemptCount = sub?.attempt_count || (hasSubmission ? 1 : 0);
                      const hasRetest = attemptCount >= 2 && firstScore !== null && latestScore !== null;

                      const actorRole = sub?.last_updated_by_role || (hasSubmission ? 'student' : null);
                      const actorName = sub?.last_updated_by_name || '';
                      const actorBadge = actorRole === 'assistant'
                        ? { label: actorName ? `조교 입력(${actorName})` : '조교 입력', bg: '#F4F6FA', border: '#CBD5E1', color: '#102044' }
                        : actorRole === 'admin'
                          ? { label: actorName ? `관리자 입력(${actorName})` : '관리자 입력', bg: '#EEF2F8', border: '#C7D3E6', color: '#102044' }
                          : actorRole === 'student'
                            ? { label: '학생 직접', bg: '#F8F9FB', border: '#DCE2EC', color: '#475569' }
                            : null;

                      return (
                        <div key={s.id} style={{ marginBottom: 4, border: '1px solid #DCE2EC', borderRadius: 6, overflow: 'hidden' }}>
                          <div onClick={() => setOmrExpandedStudent(isExpanded ? null : s.id)}
                            style={{
                              display: 'flex', alignItems: 'center', padding: '8px 10px', gap: 6, flexWrap: 'wrap',
                              cursor: 'pointer', background: isExpanded ? '#F4F6FA' : '#FFFFFF', fontSize: 12,
                            }}>
                            <span style={{ fontFamily: FONT_D, fontWeight: 700, color: '#102044', minWidth: 55 }}>{s.name}</span>
                            <span style={{ color: '#64748B', fontSize: 11 }}>{s.school} {s.grade}</span>
                            {actorBadge && (
                              <span style={{
                                fontFamily: FONT_D, fontSize: 10.5, padding: '2px 7px', borderRadius: 999,
                                background: actorBadge.bg, border: `1px solid ${actorBadge.border}`,
                                color: actorBadge.color, fontWeight: 700,
                              }}>
                                {actorBadge.label}
                              </span>
                            )}
                            <div style={{ flex: 1 }} />

                            {/* 응시 상태 배지 */}
                            {sub?.myStatus === 'in_progress' && (
                              <span style={{ fontFamily: FONT_D, fontSize: 10.5, padding: '2px 7px', borderRadius: 999, background: '#F4F6FA', border: '1px solid #C7D3E6', color: '#102044', fontWeight: 700 }}>
                                응시중 {sub.timerRemainingSeconds != null ? `(${Math.ceil(sub.timerRemainingSeconds / 60)}분 남음)` : ''}
                              </span>
                            )}
                            {sub?.myStatus === 'cooldown' && (
                              <span style={{ fontFamily: FONT_D, fontSize: 10.5, padding: '2px 7px', borderRadius: 999, background: '#FAF6EE', border: '1px solid #E3D5BA', color: '#7F5C24', fontWeight: 700 }}>
                                재제출 대기 ({Math.ceil((sub.cooldownRemainingSeconds || 0) / 60)}분 남음)
                              </span>
                            )}
                            {sub?.myStatus === 'retry_available' && (
                              <span style={{ fontFamily: FONT_D, fontSize: 10.5, padding: '2px 7px', borderRadius: 999, background: '#F4F6FA', border: '1px solid #CBD5E1', color: '#1E3159', fontWeight: 700 }}>
                                오답 재도전 가능
                              </span>
                            )}
                            {hasSubmission && (
                              <span style={{ fontFamily: FONT_D, fontSize: 10.5, padding: '2px 7px', borderRadius: 999, background: '#F1F6F3', border: '1px solid #CADAD1', color: '#335B48', fontWeight: 700 }}>
                                {attemptCount}회 제출
                              </span>
                            )}

                            {/* 1차 vs 재제출 점수 표시 */}
                            {hasRetest ? (
                              <span style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', fontVariantNumeric: 'tabular-nums' }}>
                                1차 {firstScore}점 &rarr; 재제출 {latestScore}점
                                {latestScore - firstScore >= 0 && (
                                  <span style={{ color: '#335B48', marginLeft: 3 }}>(+{Math.round((latestScore - firstScore) * 10) / 10})</span>
                                )}
                              </span>
                            ) : (
                              hasAnswers && result && (
                                <span style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', fontVariantNumeric: 'tabular-nums' }}>
                                  {result.correct}/{result.total} ({result.score}점)
                                </span>
                              )
                            )}
                            <span style={{ fontSize: 10, color: '#94A3B8' }}>{isExpanded ? '▲' : '▼'}</span>
                          </div>
                          {isExpanded && (
                            <div style={{ padding: 12, background: '#F8F9FB', borderTop: '1px solid #DCE2EC' }}>
                              {/* 학생 응시 중 동시 편집 충돌 경고 */}
                              {sub?.myStatus === 'in_progress' && (
                                <div style={{
                                  fontFamily: FONT_D, marginBottom: 10, padding: '8px 10px', borderRadius: 6,
                                  background: '#FAF6EE', border: '1px solid #E3D5BA',
                                  fontSize: 11.5, color: '#7F5C24', fontWeight: 600,
                                }}>
                                  현재 학생이 OMR을 응시 중입니다. 답안을 저장하면 학생이 진행 중인 마킹을 덮어쓰고 즉시 채점됩니다.
                                </div>
                              )}

                              {/* 관리자·조교용 학생 타이머/쿨타임 제어 바 */}
                              {sub && (
                                <div style={{
                                  display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
                                  marginBottom: 10, padding: '6px 10px', background: '#FFFFFF', borderRadius: 6, border: '1px solid #DCE2EC', fontSize: 11
                                }}>
                                  <span style={{ fontFamily: FONT_D, fontWeight: 700, color: '#475569' }}>관리자·조교 제어:</span>
                                  {sub.myStatus === 'cooldown' && (
                                    <button type="button" className="btn btn-outline btn-sm"
                                      onClick={() => resetStudentCooldown(s.id, 'clear_cooldown')}
                                      style={{ fontFamily: FONT_D, fontSize: 11, padding: '2px 8px' }}>
                                      ⚡ 재제출 대기시간(쿨타임) 즉시 해제
                                    </button>
                                  )}
                                  {sub.isFinalized && (
                                    <button type="button" className="btn btn-outline btn-sm"
                                      onClick={() => resetStudentCooldown(s.id, 'grant_retry')}
                                      style={{ fontFamily: FONT_D, fontSize: 11, padding: '2px 8px' }}>
                                      🔄 추가 재제출 기회 1회 부여
                                    </button>
                                  )}
                                  {sub.myStatus === 'in_progress' && (
                                    <button type="button" className="btn btn-outline btn-sm"
                                      onClick={() => resetStudentCooldown(s.id, 'reset_timer')}
                                      style={{ fontFamily: FONT_D, fontSize: 11, padding: '2px 8px' }}>
                                      ⏱ 응시 타이머 초기화
                                    </button>
                                  )}
                                  {firstScore !== null && (
                                    <span style={{ fontFamily: FONT_D, marginLeft: 'auto', color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
                                      1차 원점수: <strong style={{ color: '#102044' }}>{firstScore}점</strong> ({sub.first_correct_count}/{omrAnswerKey.numQuestions})
                                      {hasRetest && <> · 최종 재제출: <strong style={{ color: '#102044' }}>{latestScore}점</strong> ({sub.correct_count}/{omrAnswerKey.numQuestions})</>}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* 조교·관리자 빠른 답안 문자열 입력 */}
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                                marginBottom: 10, padding: '7px 10px', background: '#FFFFFF',
                                border: '1px solid #DCE2EC', borderRadius: 6,
                              }}>
                                <span style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: '#102044', whiteSpace: 'nowrap' }}>
                                  빠른 답안 입력
                                </span>
                                <input
                                  type="text"
                                  value={omrQuickInputByStudent[s.id] || ''}
                                  onChange={e => applyQuickStudentOmrString(s.id, e.target.value)}
                                  placeholder={`예: 31425... (1~${omrAnswerKey.numChoices || 5} 숫자 ${omrAnswerKey.numQuestions || 0}개 연속 입력)`}
                                  style={{
                                    flex: 1, minWidth: 200, padding: '5px 8px', fontSize: 12,
                                    border: '1px solid #DCE2EC', borderRadius: 6, background: '#F8F9FB',
                                  }}
                                />
                                <span style={{ fontFamily: FONT_D, fontSize: 11, fontWeight: 600, color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
                                  {Object.keys(omrStudentAnswers[s.id] || {}).length}/{omrAnswerKey.numQuestions || 0}문항 입력됨
                                </span>
                              </div>

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
                                    const isCorrect = selectedAns && Number(selectedAns) === Number(correctAns);
                                    const isWrong = selectedAns && Number(selectedAns) !== Number(correctAns);
                                    items.push(
                                      <div key={qNum} style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
                                        <span style={{
                                          fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, width: 24, textAlign: 'right', flexShrink: 0,
                                          color: isCorrect ? '#335B48' : isWrong ? '#913E43' : '#1E293B'
                                        }}>{qNum}.</span>
                                        <div style={{ display: 'flex', gap: 2 }}>
                                          {Array.from({ length: numC }, (_, i) => i + 1).map(n => {
                                            const symbols = ['', '\u2460', '\u2461', '\u2462', '\u2463', '\u2464'];
                                            const isSelected = Number(selectedAns) === n;
                                            let bg = '#FFFFFF', borderC = '#CBD5E1', textC = '#1E293B';
                                            if (isSelected && isCorrect) { bg = '#102044'; borderC = '#102044'; textC = '#FFFFFF'; }
                                            else if (isSelected && isWrong) { bg = '#913E43'; borderC = '#913E43'; textC = '#FFFFFF'; }
                                            return (
                                              <button key={n} type="button" onClick={() => setOmrAnswer(s.id, qNum, n)}
                                                style={{
                                                  fontFamily: FONT_D,
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

                              {/* 개별 학생 점수 미리보기 + 조교·관리자 CRUD 액션 바 */}
                              <div style={{
                                marginTop: 10, padding: '8px 10px', background: '#FFFFFF', borderRadius: 6,
                                border: '1px solid #DCE2EC', fontSize: 12, display: 'flex',
                                alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                              }}>
                                <div style={{ fontFamily: FONT_D, display: 'flex', gap: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                  {result ? (
                                    <>
                                      <span>예상 정답: <span style={{ color: '#102044' }}>{result.correct}/{result.total}</span></span>
                                      <span>예상 점수: <span style={{ color: '#335B48' }}>{result.score}점</span></span>
                                    </>
                                  ) : (
                                    <span style={{ color: '#64748B', fontWeight: 500 }}>마킹 또는 빠른 답안 입력 후 저장하세요.</span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    onClick={() => saveSingleStudentOmr(s.id, s.name, 'latest')}
                                    disabled={!hasAnswers}
                                    style={{
                                      fontFamily: FONT_D, padding: '5px 11px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                                      border: '1px solid #102044', background: hasAnswers ? '#102044' : '#E2E8F0',
                                      color: hasAnswers ? '#FFFFFF' : '#94A3B8', cursor: hasAnswers ? 'pointer' : 'not-allowed',
                                    }}
                                  >
                                    {hasSubmission ? '답안 수정 저장' : '답안 저장'}
                                  </button>
                                  {hasRetest && (
                                    <button
                                      type="button"
                                      onClick={() => saveSingleStudentOmr(s.id, s.name, 'first')}
                                      disabled={!hasAnswers}
                                      style={{
                                        fontFamily: FONT_D, padding: '5px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                                        border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#102044',
                                        cursor: hasAnswers ? 'pointer' : 'not-allowed',
                                      }}
                                    >
                                      1차 원답안 정정
                                    </button>
                                  )}
                                  {sub && (
                                    <button
                                      type="button"
                                      onClick={() => deleteSingleStudentOmr(s.id, s.name)}
                                      style={{
                                        fontFamily: FONT_D, padding: '5px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                                        border: '1px solid #E0C8CA', background: '#FAF3F3', color: '#913E43',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      제출 기록 삭제
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" style={{ fontFamily: FONT_D }} onClick={saveOmrAnswers}>답안 일괄 저장</button>
                    <button className="btn btn-outline" style={{ fontFamily: FONT_D }} onClick={() => regradeAllSubmissions(omrExamId)}>🔄 전체 재채점</button>
                  </div>
                </>
              );
            })()}
            {omrLoading && <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: 20 }}>로딩 중...</p>}
          </div>
        </div>
      )}

      </>}

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
