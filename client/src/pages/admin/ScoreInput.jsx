import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { SCHOOLS, getAllGrades, EXAM_TYPES } from '../../config';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

export default function ScoreInput() {
  const schools = SCHOOLS;
  const examTypes = EXAM_TYPES;
  const [searchParams] = useSearchParams();
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [scoreInputs, setScoreInputs] = useState({});
  const [newExam, setNewExam] = useState({ examType: '학력평가 모의고사', name: '', examDate: '', school: '', grade: '', maxScore: 100 });
  const [editExamId, setEditExamId] = useState(null);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('exams');
  const [filterType, setFilterType] = useState('');

  const loadExams = () => api('/scores/exams').then(setExams).catch(console.error);
  const loadStudents = () => api('/admin/students').then(setStudents).catch(console.error);

  useEffect(() => {
    loadExams();
    loadStudents();
  }, []);

  // URL에서 exam 파라미터로 바로 성적 입력 탭 열기
  useEffect(() => {
    const examParam = searchParams.get('exam');
    if (examParam && exams.length > 0) {
      const examId = parseInt(examParam);
      if (exams.find(e => e.id === examId)) {
        selectExam(examId);
      }
    }
  }, [exams, searchParams]);

  const createExam = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        examType: newExam.examType,
        name: newExam.name,
        examDate: newExam.examDate || null,
        school: newExam.school || null,
        grade: newExam.grade || null,
        maxScore: parseFloat(newExam.maxScore) || 100
      };
      if (editExamId) {
        await apiPut(`/scores/exams/${editExamId}`, payload);
        setMsg('시험이 수정되었습니다.');
        setEditExamId(null);
      } else {
        await apiPost('/scores/exams', payload);
        setMsg('시험이 등록되었습니다.');
      }
      setNewExam({ examType: '학력평가 모의고사', name: '', examDate: '', school: '', grade: '', maxScore: 100 });
      loadExams();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const startEditExam = (exam) => {
    setNewExam({
      examType: exam.exam_type, name: exam.name,
      examDate: exam.exam_date || '', school: exam.school || '',
      grade: exam.grade || '', maxScore: exam.max_score || 100
    });
    setEditExamId(exam.id);
    setTab('new');
  };

  const deleteExam = async (examId) => {
    if (!confirm('이 시험과 관련 성적을 모두 삭제하시겠습니까?')) return;
    await apiDelete(`/scores/exams/${examId}`);
    loadExams();
    if (selectedExam === examId) setSelectedExam(null);
  };

  const selectExam = async (examId) => {
    setSelectedExam(examId);
    setTab('input');
    try {
      const scores = await api(`/scores/exams/${examId}/scores`);
      const inputs = {};
      scores.forEach((s) => {
        inputs[s.student_id] = { score: s.score, note: s.note || '', rankNum: s.rank_num };
      });
      setScoreInputs(inputs);
    } catch (e) {
      console.error(e);
    }
  };

  const updateScoreInput = (studentId, field, value) => {
    setScoreInputs((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || { score: '', note: '' }), [field]: value }
    }));
  };

  const saveScores = async () => {
    const scores = Object.entries(scoreInputs)
      .filter(([_, v]) => v.score !== '' && v.score !== undefined)
      .map(([studentId, v]) => ({
        studentId: parseInt(studentId),
        score: parseFloat(v.score),
        note: v.note || ''
      }));

    if (scores.length === 0) {
      setMsg('입력된 성적이 없습니다.');
      return;
    }

    try {
      await apiPost('/scores/batch', { examId: selectedExam, scores });
      setMsg(`${scores.length}명의 성적이 저장되었습니다. (등수 자동 계산 완료)`);
      // 저장 후 성적 다시 로드해서 등수 표시
      const updatedScores = await api(`/scores/exams/${selectedExam}/scores`);
      const inputs = {};
      updatedScores.forEach((s) => {
        inputs[s.student_id] = { score: s.score, note: s.note || '', rankNum: s.rank_num };
      });
      setScoreInputs(inputs);
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(err.message);
    }
  };

  // 분포도
  // === 정답키 설정 탭 state ===
  const [akExamId, setAkExamId] = useState('');
  const [akNumQuestions, setAkNumQuestions] = useState(20);
  const [akNumChoices, setAkNumChoices] = useState(5);
  const [akScoringType, setAkScoringType] = useState('equal'); // equal | individual
  const [akMaxScore, setAkMaxScore] = useState(100);
  const [akDefaultPoints, setAkDefaultPoints] = useState(5);
  const [akAnswers, setAkAnswers] = useState({}); // { 1: 3, 2: 1, ... }
  const [akPoints, setAkPoints] = useState({}); // { 1: 5, 2: 5, ... } for individual
  const [akLoading, setAkLoading] = useState(false);
  const [akExistingKey, setAkExistingKey] = useState(false);

  // === OMR 답안 입력 탭 state ===
  const [omrExams, setOmrExams] = useState([]);
  const [omrExamId, setOmrExamId] = useState('');
  const [omrAnswerKey, setOmrAnswerKey] = useState(null);
  const [omrFilterSchool, setOmrFilterSchool] = useState('');
  const [omrFilterGrade, setOmrFilterGrade] = useState('');
  const [omrExpandedStudent, setOmrExpandedStudent] = useState(null);
  const [omrStudentAnswers, setOmrStudentAnswers] = useState({}); // { studentId: { 1: 3, 2: 1, ... } }
  const [omrSubmissions, setOmrSubmissions] = useState({}); // existing submissions
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
        const ans = {};
        const pts = {};
        (key.questions || []).forEach(q => {
          ans[q.num] = q.answer;
          if (q.points !== undefined) pts[q.num] = q.points;
        });
        setAkAnswers(ans);
        setAkPoints(pts);
        setAkExistingKey(true);
      } else {
        resetAnswerKeyForm();
        setAkExistingKey(false);
      }
    } catch {
      resetAnswerKeyForm();
      setAkExistingKey(false);
    }
    setAkLoading(false);
  };

  const resetAnswerKeyForm = () => {
    setAkAnswers({});
    setAkPoints({});
    setAkNumQuestions(20);
    setAkNumChoices(5);
    setAkScoringType('equal');
    setAkMaxScore(100);
    setAkDefaultPoints(5);
  };

  const saveAnswerKey = async () => {
    if (!akExamId) { setMsg('시험을 선택하세요.'); return; }
    const questions = [];
    for (let i = 1; i <= akNumQuestions; i++) {
      if (!akAnswers[i]) { setMsg(`${i}번 문항의 정답을 선택하세요.`); return; }
      const q = { num: i, answer: akAnswers[i] };
      if (akScoringType === 'individual') {
        q.points = akPoints[i] !== undefined ? parseFloat(akPoints[i]) : akDefaultPoints;
      }
      questions.push(q);
    }
    const payload = {
      numQuestions: akNumQuestions,
      numChoices: akNumChoices,
      scoringType: akScoringType,
      maxScore: akMaxScore,
      defaultPoints: akDefaultPoints,
      questions
    };
    try {
      await apiPost(`/scores/exams/${akExamId}/answer-key`, payload);
      setMsg('정답키가 저장되었습니다.');
      setAkExistingKey(true);
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  const deleteAnswerKey = async () => {
    if (!akExamId) return;
    if (!confirm('정답키를 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/scores/exams/${akExamId}/answer-key`);
      resetAnswerKeyForm();
      setAkExistingKey(false);
      setMsg('정답키가 삭제되었습니다.');
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  // === OMR 함수 ===
  const loadOmrExams = async () => {
    try {
      const data = await api('/scores/exams-with-keys');
      setOmrExams(data);
    } catch { setOmrExams([]); }
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
      // submissions를 studentId별로 정리
      const subs = {};
      const studentAnswerMap = {};
      (subsData || []).forEach(sub => {
        subs[sub.student_id] = sub;
        if (sub.answers) {
          const ans = typeof sub.answers === 'string' ? JSON.parse(sub.answers) : sub.answers;
          const mapped = {};
          (ans || []).forEach(a => { mapped[a.num] = a.answer; });
          studentAnswerMap[sub.student_id] = mapped;
        }
      });
      setOmrSubmissions(subs);
      setOmrStudentAnswers(studentAnswerMap);
      setOmrQuestionStats(statsData || []);
    } catch (err) { console.error(err); }
    setOmrLoading(false);
  };

  const setOmrAnswer = (studentId, qNum, answer) => {
    setOmrStudentAnswers(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [qNum]: answer }
    }));
  };

  const calculateOmrScore = (studentId) => {
    if (!omrAnswerKey || !omrStudentAnswers[studentId]) return { correct: 0, total: 0, score: 0 };
    const key = omrAnswerKey;
    const answers = omrStudentAnswers[studentId];
    let correct = 0;
    let totalScore = 0;
    const numQ = key.numQuestions || 0;
    const equalPoints = numQ > 0 ? (key.maxScore || 100) / numQ : 0;

    for (let i = 1; i <= numQ; i++) {
      const keyQ = (key.questions || []).find(q => q.num === i);
      if (keyQ && answers[i] === keyQ.answer) {
        correct++;
        if (key.scoringType === 'individual') {
          totalScore += keyQ.points !== undefined ? keyQ.points : (key.defaultPoints || 0);
        } else {
          totalScore += equalPoints;
        }
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
        submissions.push({
          studentId: parseInt(studentId),
          answers: answerList,
          score: result.score
        });
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

  const [showDist, setShowDist] = useState(false);
  const [distribution, setDistribution] = useState(null);

  const loadDistribution = async (examId) => {
    if (showDist && distribution) { setShowDist(false); return; }
    try {
      const data = await api(`/scores/exams/${examId}/distribution`);
      setDistribution(data);
      setShowDist(true);
    } catch (e) { console.error(e); }
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

  const exam = exams.find((e) => e.id === selectedExam);
  const filteredStudents = exam
    ? students.filter((s) => {
        if (exam.school && s.school !== exam.school) return false;
        if (exam.grade && s.grade !== exam.grade) return false;
        return true;
      })
    : students;

  const gradeOptions = newExam.school ? getAllGrades(newExam.school) : [];
  const [filterSchool, setFilterSchool] = useState('');
  const filteredExams = exams.filter(e => {
    if (filterType && e.exam_type !== filterType) return false;
    if (filterSchool && e.school && e.school !== filterSchool) return false;
    return true;
  });

  const getExamBadgeClass = (type) => {
    if (type === '학력평가 모의고사') return 'badge badge-info';
    if (type === '서강인T 자체 모의고사') return 'badge badge-purple';
    if (type === '내신 파이널') return 'badge badge-danger';
    return 'badge badge-warning';
  };

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>성적 관리</span>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'exams' ? 'active' : ''}`} onClick={() => setTab('exams')}>시험 목록</button>
        <button className={`tab ${tab === 'new' ? 'active' : ''}`} onClick={() => { setTab('new'); if (!editExamId) { setNewExam({ examType: '학력평가 모의고사', name: '', examDate: '', school: '', grade: '', maxScore: 100 }); } }}>
          {editExamId ? '시험 수정' : '시험 등록'}
        </button>
        {selectedExam && (
          <button className={`tab ${tab === 'input' ? 'active' : ''}`} onClick={() => setTab('input')}>
            성적 입력
          </button>
        )}
        <button className={`tab ${tab === 'answerKey' ? 'active' : ''}`} onClick={() => { setTab('answerKey'); }}>
          📝 정답키 설정
        </button>
        <button className={`tab ${tab === 'omr' ? 'active' : ''}`} onClick={() => { setTab('omr'); loadOmrExams(); }}>
          📋 OMR 답안 입력
        </button>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      {tab === 'exams' && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>시험 목록</h2>
            <span style={{ fontSize: 13, color: '#64748b' }}>{filteredExams.length}개</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
              <option value="">전체 분류</option>
              {examTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
              <option value="">전체 학교</option>
              {schools.filter(s => s.name !== '조교' && s.name !== '선생님').map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>

          {filteredExams.length === 0 ? (
            <p style={{ color: '#999', textAlign: 'center', padding: 30 }}>등록된 시험이 없습니다.</p>
          ) : (
            <div>
              {/* 유형별로 그룹핑 */}
              {(() => {
                const groups = {};
                filteredExams.forEach(e => {
                  const key = e.exam_type || '기타';
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(e);
                });
                return Object.entries(groups).map(([type, items]) => (
                  <div key={type} style={{ marginBottom: 16 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: '#1e3a5f', padding: '6px 12px',
                      background: '#f1f5f9', borderRadius: 6, marginBottom: 6,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span>{type}</span>
                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{items.length}개</span>
                    </div>
                    {items.map(e => (
                      <div key={e.id} style={{
                        display: 'flex', alignItems: 'center', padding: '10px 12px',
                        borderBottom: '1px solid #f1f5f9', gap: 8, fontSize: 13,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {e.exam_date || '날짜 미정'} · {e.max_score}점 만점
                            {e.school ? ` · ${e.school}` : ''}
                            {e.grade ? ` ${e.grade}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => selectExam(e.id)}
                            style={{ fontSize: 11, padding: '4px 10px' }}>성적입력</button>
                          <button className="btn btn-outline btn-sm" onClick={() => startEditExam(e)}
                            style={{ fontSize: 11, padding: '4px 8px' }}>수정</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteExam(e.id)}
                            style={{ fontSize: 11, padding: '4px 8px' }}>삭제</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {tab === 'new' && (
        <div className="card">
          <h2>시험 등록</h2>
          <form onSubmit={createExam}>
            <div className="form-row">
              <div className="form-group">
                <label>시험 분류 *</label>
                <select value={newExam.examType} onChange={(e) => setNewExam({ ...newExam, examType: e.target.value })}>
                  {examTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>시험명 *</label>
                <input value={newExam.name} onChange={(e) => setNewExam({ ...newExam, name: e.target.value })} placeholder="예: 3월 모의고사" required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>시험 날짜</label>
                <input type="date" value={newExam.examDate} onChange={(e) => setNewExam({ ...newExam, examDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>만점</label>
                <input type="number" value={newExam.maxScore} onChange={(e) => setNewExam({ ...newExam, maxScore: e.target.value })} min="1" placeholder="100" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>학교 (비우면 전체)</label>
                <select value={newExam.school} onChange={(e) => setNewExam({ ...newExam, school: e.target.value, grade: '' })}>
                  <option value="">전체</option>
                  {schools.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>학년 (비우면 전체)</label>
                <select value={newExam.grade} onChange={(e) => setNewExam({ ...newExam, grade: e.target.value })} disabled={!newExam.school}>
                  <option value="">전체</option>
                  {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary">{editExamId ? '시험 수정' : '시험 등록'}</button>
              {editExamId && (
                <button type="button" className="btn btn-outline" onClick={() => {
                  setEditExamId(null);
                  setNewExam({ examType: '학력평가 모의고사', name: '', examDate: '', school: '', grade: '', maxScore: 100 });
                  setTab('exams');
                }}>취소</button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* === 정답키 설정 탭 === */}
      {tab === 'answerKey' && (
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>📝 정답키 설정</h2>

          {/* 시험 선택 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>시험 선택</label>
            <select
              value={akExamId}
              onChange={e => { const id = e.target.value; setAkExamId(id); if (id) { const ex = exams.find(x => x.id === parseInt(id)); if (ex) setAkMaxScore(ex.max_score || 100); loadAnswerKey(id); } else { resetAnswerKeyForm(); setAkExistingKey(false); } }}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
            >
              <option value="">시험을 선택하세요</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name} ({e.exam_type})</option>)}
            </select>
          </div>

          {akExamId && !akLoading && (
            <>
              {/* 설정 행 */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: '1 1 120px' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>문제 수</label>
                  <input type="number" min="1" max="100" value={akNumQuestions}
                    onChange={e => setAkNumQuestions(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }} />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>선택지 수</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="radio" name="akChoices" checked={akNumChoices === 4} onChange={() => setAkNumChoices(4)} /> 4지선다
                    </label>
                    <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="radio" name="akChoices" checked={akNumChoices === 5} onChange={() => setAkNumChoices(5)} /> 5지선다
                    </label>
                  </div>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>배점 방식</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="radio" name="akScoring" checked={akScoringType === 'equal'} onChange={() => setAkScoringType('equal')} /> 균등배점
                    </label>
                    <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="radio" name="akScoring" checked={akScoringType === 'individual'} onChange={() => setAkScoringType('individual')} /> 개별배점
                    </label>
                  </div>
                </div>
              </div>

              {/* 배점 정보 */}
              <div style={{ marginBottom: 16, padding: 10, background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                {akScoringType === 'equal' ? (
                  <span>균등배점: 만점 {akMaxScore}점 / {akNumQuestions}문항 = <strong>{Math.round((akMaxScore / akNumQuestions) * 100) / 100}점</strong></span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>기본 배점:</span>
                    <input type="number" min="0" step="0.5" value={akDefaultPoints}
                      onChange={e => setAkDefaultPoints(parseFloat(e.target.value) || 0)}
                      style={{ width: 60, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13 }} />
                    <span>점 (문항별 수정 가능)</span>
                  </div>
                )}
              </div>

              {/* 정답 입력 영역 */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>정답 입력</label>
                {(() => {
                  const rows = [];
                  for (let row = 0; row < Math.ceil(akNumQuestions / 5); row++) {
                    const items = [];
                    for (let col = 0; col < 5; col++) {
                      const qNum = row * 5 + col + 1;
                      if (qNum > akNumQuestions) break;
                      items.push(
                        <div key={qNum} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, width: 28, textAlign: 'right', flexShrink: 0 }}>{qNum}.</span>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {Array.from({ length: akNumChoices }, (_, i) => i + 1).map(n => {
                              const symbols = ['', '\u2460', '\u2461', '\u2462', '\u2463', '\u2464'];
                              return (
                                <button key={n} onClick={() => setAkAnswers(prev => ({ ...prev, [qNum]: n }))}
                                  style={{
                                    width: 28, height: 28, borderRadius: '50%', border: '1.5px solid',
                                    borderColor: akAnswers[qNum] === n ? '#3b82f6' : '#d1d5db',
                                    background: akAnswers[qNum] === n ? '#3b82f6' : 'white',
                                    color: akAnswers[qNum] === n ? 'white' : '#374151',
                                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                                  }}>
                                  {symbols[n]}
                                </button>
                              );
                            })}
                          </div>
                          {akScoringType === 'individual' && (
                            <input type="number" min="0" step="0.5"
                              value={akPoints[qNum] !== undefined ? akPoints[qNum] : akDefaultPoints}
                              onChange={e => setAkPoints(prev => ({ ...prev, [qNum]: parseFloat(e.target.value) || 0 }))}
                              style={{ width: 42, padding: '2px 4px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11, textAlign: 'center' }}
                            />
                          )}
                        </div>
                      );
                    }
                    rows.push(
                      <div key={row} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 6 }}>
                        {items}
                      </div>
                    );
                  }
                  return rows;
                })()}
              </div>

              {/* 저장/삭제 */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={saveAnswerKey}>정답키 저장</button>
                {akExistingKey && (
                  <button className="btn btn-danger" onClick={deleteAnswerKey}>정답키 삭제</button>
                )}
              </div>
            </>
          )}
          {akLoading && <p style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>로딩 중...</p>}
        </div>
      )}

      {/* === OMR 답안 입력 탭 === */}
      {tab === 'omr' && (
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>📋 OMR 답안 입력</h2>

          {/* 시험 선택 (정답키 있는 것만) */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>시험 선택 (정답키 설정된 시험만)</label>
            <select
              value={omrExamId}
              onChange={e => { const id = e.target.value; setOmrExamId(id); setOmrExpandedStudent(null); setOmrStudentAnswers({}); setOmrAnswerKey(null); setOmrSubmissions({}); setOmrQuestionStats([]); if (id) loadOmrData(id); }}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
            >
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
                {/* 필터 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <select value={omrFilterSchool} onChange={e => { setOmrFilterSchool(e.target.value); setOmrFilterGrade(''); }}
                    style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                    <option value="">전체 학교</option>
                    {schools.filter(s => s.name !== '조교' && s.name !== '선생님').map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                  <select value={omrFilterGrade} onChange={e => setOmrFilterGrade(e.target.value)}
                    disabled={!omrFilterSchool}
                    style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                    <option value="">전체 학년</option>
                    {omrGradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                {/* 문항별 정답률 그래프 */}
                {omrQuestionStats.length > 0 && (
                  <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#374151' }}>문항별 정답률</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={omrQuestionStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="questionNum" fontSize={10} stroke="var(--muted-foreground)" label={{ value: '문항', position: 'insideBottom', offset: -2, fontSize: 10 }} />
                        <YAxis domain={[0, 100]} fontSize={10} stroke="var(--muted-foreground)" tickFormatter={v => `${v}%`} />
                        <Tooltip formatter={v => [`${v}%`, '정답률']} labelFormatter={v => `${v}번`}
                          contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="correctRate" radius={[3, 3, 0, 0]}>
                          {omrQuestionStats.map((entry, idx) => (
                            <Cell key={idx} fill={entry.correctRate >= 70 ? '#22c55e' : entry.correctRate >= 40 ? '#f59e0b' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 학생 목록 */}
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>학생 {omrStudentList.length}명</div>
                {omrStudentList.map(s => {
                  const isExpanded = omrExpandedStudent === s.id;
                  const hasSubmission = !!omrSubmissions[s.id];
                  const hasAnswers = omrStudentAnswers[s.id] && Object.keys(omrStudentAnswers[s.id]).length > 0;
                  const result = hasAnswers ? calculateOmrScore(s.id) : null;

                  return (
                    <div key={s.id} style={{ marginBottom: 4, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      {/* 학생 행 */}
                      <div
                        onClick={() => setOmrExpandedStudent(isExpanded ? null : s.id)}
                        style={{
                          display: 'flex', alignItems: 'center', padding: '10px 12px', gap: 8,
                          cursor: 'pointer', background: isExpanded ? '#eff6ff' : 'white',
                          fontSize: 13, transition: 'background 0.15s'
                        }}
                      >
                        <span style={{ fontWeight: 600, minWidth: 60 }}>{s.name}</span>
                        <span style={{ color: '#64748b', fontSize: 12 }}>{s.school} {s.grade}</span>
                        <div style={{ flex: 1 }} />
                        {hasSubmission && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>제출완료</span>}
                        {hasAnswers && result && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6' }}>
                            {result.correct}/{result.total} ({result.score}점)
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>

                      {/* 답안 입력 패널 */}
                      {isExpanded && (
                        <div style={{ padding: 12, background: '#f8fafc', borderTop: '1px solid var(--border)' }}>
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
                                  <div key={qNum} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                                    <span style={{
                                      fontSize: 12, fontWeight: 600, width: 28, textAlign: 'right', flexShrink: 0,
                                      color: isCorrect ? '#3b82f6' : isWrong ? '#ef4444' : '#374151'
                                    }}>{qNum}.</span>
                                    <div style={{ display: 'flex', gap: 2 }}>
                                      {Array.from({ length: numC }, (_, i) => i + 1).map(n => {
                                        const symbols = ['', '\u2460', '\u2461', '\u2462', '\u2463', '\u2464'];
                                        const isSelected = selectedAns === n;
                                        let bg = 'white';
                                        let borderC = '#d1d5db';
                                        let textC = '#374151';
                                        if (isSelected && isCorrect) { bg = '#3b82f6'; borderC = '#3b82f6'; textC = 'white'; }
                                        else if (isSelected && isWrong) { bg = '#ef4444'; borderC = '#ef4444'; textC = 'white'; }
                                        return (
                                          <button key={n} onClick={() => setOmrAnswer(s.id, qNum, n)}
                                            style={{
                                              width: 28, height: 28, borderRadius: '50%', border: `1.5px solid ${borderC}`,
                                              background: bg, color: textC, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                                            }}>
                                            {symbols[n]}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }
                              rows.push(
                                <div key={row} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 6 }}>
                                  {items}
                                </div>
                              );
                            }
                            return rows;
                          })()}
                          {/* 실시간 점수 */}
                          {result && (
                            <div style={{
                              marginTop: 10, padding: '8px 12px', background: 'white', borderRadius: 8,
                              border: '1px solid var(--border)', fontSize: 13, fontWeight: 600,
                              display: 'flex', gap: 16
                            }}>
                              <span>정답: <span style={{ color: '#3b82f6' }}>{result.correct}/{result.total}</span></span>
                              <span>점수: <span style={{ color: '#22c55e' }}>{result.score}점</span></span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 저장 버튼 */}
                <div style={{ marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={saveOmrAnswers}>답안 일괄 저장</button>
                </div>
              </>
            );
          })()}
          {omrLoading && <p style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>로딩 중...</p>}
        </div>
      )}

      {tab === 'input' && selectedExam && (
        <div className="card">
          <h2>{exam?.name} - 성적 입력 (만점: {exam?.max_score}점)</h2>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
            성적 저장 시 등수가 자동으로 계산됩니다. 총 대상 학생: {filteredStudents.length}명
          </p>
          {filteredStudents.length === 0 ? (
            <p style={{ color: '#999' }}>해당하는 학생이 없습니다.</p>
          ) : (
            <>
              {/* 분포도 차트 */}
              {showDist && distribution && (() => {
                const distData = Object.entries(distribution.distribution).map(([range, count]) => ({
                  range, 학생수: count,
                }));
                const normalData = generateNormalDist(distribution);
                return (
                  <div style={{ marginBottom: 16, padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginBottom: 16 }}>
                      <div style={{ textAlign: 'center', padding: 10, background: 'white', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>평균</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>{distribution.average}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: 10, background: 'white', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>최고</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>{distribution.highest}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: 10, background: 'white', borderRadius: 8, border: '1px solid #fecaca' }}>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>최저</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>{distribution.lowest}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: 10, background: 'white', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>표준편차</div>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>{distribution.stdDev}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: 10, background: 'white', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>응시</div>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>{distribution.totalStudents}명</div>
                      </div>
                    </div>

                    {normalData.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#374151' }}>📈 표준분포 곡선</div>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={normalData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="score" fontSize={10} stroke="var(--muted-foreground)" />
                            <YAxis hide />
                            <Tooltip formatter={(v) => [v, '밀도']} labelFormatter={(v) => `${v}점`}
                              contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                            <Area type="monotone" dataKey="density" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
                            <ReferenceLine x={distribution.average} stroke="#6b7280" strokeWidth={1.5} strokeDasharray="3 3"
                              label={{ value: `평균 ${distribution.average}`, fill: '#6b7280', fontSize: 10, position: 'insideTopRight' }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#374151' }}>📊 구간별 인원</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={distData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="range" fontSize={10} stroke="var(--muted-foreground)" />
                          <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={10} />
                          <Tooltip contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                          <Bar dataKey="학생수" radius={[4, 4, 0, 0]} fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}

              <table>
                <thead>
                  <tr><th>이름</th><th>학교</th><th>학년</th><th>점수 (/{exam?.max_score})</th><th>등수</th><th>비고</th></tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>{s.school}</td>
                      <td>{s.grade}</td>
                      <td>
                        <input
                          type="number"
                          className="score-input"
                          value={scoreInputs[s.id]?.score ?? ''}
                          onChange={(e) => updateScoreInput(s.id, 'score', e.target.value)}
                          min="0" max={exam?.max_score || 100} step="0.1"
                        />
                      </td>
                      <td style={{ fontWeight: 600, color: '#3498db' }}>
                        {scoreInputs[s.id]?.rankNum ? `${scoreInputs[s.id].rankNum}등` : '-'}
                      </td>
                      <td>
                        <input
                          value={scoreInputs[s.id]?.note ?? ''}
                          onChange={(e) => updateScoreInput(s.id, 'note', e.target.value)}
                          placeholder="비고"
                          style={{ width: 150 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="btn-group">
                <button className="btn btn-success" onClick={saveScores}>성적 저장 (등수 자동 계산)</button>
                <button className="btn btn-outline" onClick={() => loadDistribution(selectedExam)}
                  style={{ background: showDist ? '#3b82f6' : undefined, color: showDist ? 'white' : undefined }}>
                  📊 {showDist ? '분포 닫기' : '성적 분포 보기'}
                </button>
                <button className="btn btn-outline" onClick={async () => {
                  try {
                    await apiPost(`/scores/exams/${selectedExam}/recalculate-ranks`, {});
                    const updatedScores = await api(`/scores/exams/${selectedExam}/scores`);
                    const inputs = {};
                    updatedScores.forEach((s) => {
                      inputs[s.student_id] = { score: s.score, note: s.note || '', rankNum: s.rank_num };
                    });
                    setScoreInputs(inputs);
                    setMsg('등수가 재계산되었습니다.');
                    setTimeout(() => setMsg(''), 2000);
                  } catch (err) { setMsg(err.message); }
                }}>등수 재계산</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
