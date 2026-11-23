import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getUser } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { SkeletonPage, ErrorState, EmptyState } from '../../components/StudentStates';
import BottomTabBar from '../../components/BottomTabBar';
import StudentOmrGuideModal from '../../components/StudentOmrGuideModal';
import StudentOmrSheet from '../../components/StudentOmrSheet';
import StudentOmrResult from '../../components/StudentOmrResult';
import { askConfirm } from '../../lib/feedback';
import {
  useMyScores,
  useStudentsList,
  useDistribution,
  useOmrSubmission,
  useStudentOmrExams,
  useStartOmr,
  useSaveOmrDraft,
  useSubmitOmrAnswers,
  useFinalizeOmrSubmission,
} from '../../hooks/queries/useScores';

const DEFAULT_CAT_COLORS = [
  'oklch(30% 0.08 260)', 'var(--warning)', 'oklch(55% 0.20 290)',
  'oklch(62% 0.16 200)', 'oklch(58% 0.14 160)', 'var(--destructive)',
  'oklch(50% 0.16 30)', 'oklch(45% 0.12 120)',
];

const DEFAULT_CAT_ICONS = ['📝', '📋', '🌸', '☀️', '🍂', '❄️', '📚', '✏️'];

function formatDurationMMSS(totalSeconds) {
  const sec = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ScoreView() {
  const { config } = useTenantConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState('all');
  const [showDist, setShowDist] = useState(null);
  const [expandedTrends, setExpandedTrends] = useState({});
  const [selectedOmrExamId, setSelectedOmrExamId] = useState(null);

  // ── 학생 직접 OMR 입력 state ──
  const [activeOmrExam, setActiveOmrExam] = useState(null); // 현재 마킹 화면이 열린 시험 객체
  const [markingAnswers, setMarkingAnswers] = useState({}); // { [qNum]: choiceNum }
  const [showWrongOnlyFilter, setShowWrongOnlyFilter] = useState(true);
  const [omrBannerMsg, setOmrBannerMsg] = useState('');
  const [omrErrorMsg, setOmrErrorMsg] = useState('');
  const [previewResultExamId, setPreviewResultExamId] = useState(null);
  const [lastSubmitResult, setLastSubmitResult] = useState(null);
  const [showOmrGuide, setShowOmrGuide] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const autoSubmittedRef = useRef({});
  const handledDeepLinkRef = useRef(false);

  const user = getUser();
  const isStaff = user?.role === 'admin' || user?.school === '조교' || user?.school === '선생님';
  const [selectedStudent, setSelectedStudent] = useState('');
  const [filterSchool, setFilterSchool] = useState('');

  const { data: scores = [], isLoading: loading, error: scoresError } = useMyScores(selectedStudent);
  const { data: studentsList = [] } = useStudentsList(isStaff);
  const { data: distribution = null } = useDistribution(showDist);
  const { data: omrData = null, isLoading: omrLoading } = useOmrSubmission(selectedOmrExamId, selectedStudent);
  const { data: omrExams = [], refetch: refetchOmrExams } = useStudentOmrExams(selectedStudent);

  const startOmrMutation = useStartOmr();
  const saveDraftMutation = useSaveOmrDraft();
  const submitOmrMutation = useSubmitOmrAnswers();
  const finalizeOmrMutation = useFinalizeOmrSubmission();

  // 홈 화면(MyPage) 등에서 ?omrExamId=123&start=1 또는 ?guide=1 로 넘어온 경우 자연스럽게 연결
  useEffect(() => {
    if (searchParams.get('guide') === '1') {
      setShowOmrGuide(true);
    }
    const targetOmrId = searchParams.get('omrExamId');
    const shouldStart = searchParams.get('start') === '1';
    if (!targetOmrId || handledDeepLinkRef.current || omrExams.length === 0) return;

    const targetExam = omrExams.find(e => String(e.examId) === String(targetOmrId));
    if (!targetExam) return;

    handledDeepLinkRef.current = true;
    if (shouldStart && ['not_started', 'in_progress', 'retry_available'].includes(targetExam.myStatus)) {
      handleOpenOmrMarking(targetExam);
    } else {
      setPreviewResultExamId(targetExam.examId);
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, omrExams]);

  // 1초 주기 타이머 틱 (응시 제한 시간 카운트다운 & 재제출 쿨타임 카운트다운 공통)
  useEffect(() => {
    const hasActiveTimerOrCooldown =
      Boolean(activeOmrExam?.expiresAt) ||
      omrExams.some(e => e.myStatus === 'in_progress' || e.myStatus === 'cooldown');
    if (!hasActiveTimerOrCooldown) return;

    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [activeOmrExam, omrExams]);

  // 현재 마킹 중인 시험의 남은 시간(초) 계산 및 제한 시간 만료 시 자동 제출
  const activeTimerRemainingSec = useMemo(() => {
    if (!activeOmrExam?.expiresAt) return null;
    const diff = Math.ceil((new Date(activeOmrExam.expiresAt).getTime() - nowTick) / 1000);
    return Math.max(0, diff);
  }, [activeOmrExam, nowTick]);

  useEffect(() => {
    if (!activeOmrExam || activeTimerRemainingSec === null) return;
    if (activeTimerRemainingSec <= 0 && !autoSubmittedRef.current[activeOmrExam.examId] && !submitOmrMutation.isPending) {
      autoSubmittedRef.current[activeOmrExam.examId] = true;
      handleAutoSubmitByTimer();
    }
  }, [activeTimerRemainingSec, activeOmrExam]);

  const handleOpenOmrMarking = async (examItem) => {
    setOmrErrorMsg('');
    setOmrBannerMsg('');
    try {
      const session = await startOmrMutation.mutateAsync(examItem.examId);
      const locked = session.lockedQuestions || examItem.lockedQuestions || {};
      const localKey = `omr_draft_${examItem.examId}_${session.attemptNum || 1}`;
      let savedLocal = {};
      try {
        const raw = localStorage.getItem(localKey);
        if (raw) savedLocal = JSON.parse(raw);
      } catch {}

      const merged = {
        ...(examItem.draftAnswers || {}),
        ...(session.draftAnswers || {}),
        ...savedLocal,
        ...locked, // 맞힌 문항(잠금)은 항상 기존 정답으로 고정
      };

      setMarkingAnswers(merged);
      setShowWrongOnlyFilter(Object.keys(locked).length > 0 && (session.resubmitMode || examItem.resubmitMode) === 'wrong_only');
      autoSubmittedRef.current[examItem.examId] = false;
      setActiveOmrExam({
        ...examItem,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        timeLimitMinutes: session.timeLimitMinutes ?? examItem.timeLimitMinutes,
        attemptNum: session.attemptNum || (examItem.attemptCount || 0) + 1,
        lockedQuestions: locked,
        previousWrongAnswers: session.previousWrongAnswers || examItem.previousWrongAnswers || {},
        resubmitMode: session.resubmitMode || examItem.resubmitMode || 'wrong_only',
      });
    } catch (err) {
      setOmrErrorMsg(err.message || 'OMR 시험을 시작할 수 없습니다.');
      refetchOmrExams();
    }
  };

  const handleSelectBubble = (qNum, choiceNum) => {
    if (!activeOmrExam) return;
    // wrong_only 재제출 시 이미 맞힌 문항은 잠금
    if (activeOmrExam.resubmitMode === 'wrong_only' && activeOmrExam.lockedQuestions?.[qNum] !== undefined) {
      return;
    }
    setMarkingAnswers(prev => {
      const next = { ...prev, [qNum]: choiceNum };
      const localKey = `omr_draft_${activeOmrExam.examId}_${activeOmrExam.attemptNum || 1}`;
      try { localStorage.setItem(localKey, JSON.stringify(next)); } catch {}
      saveDraftMutation.mutate({ examId: activeOmrExam.examId, answers: next });
      return next;
    });
  };

  const handleAutoSubmitByTimer = async () => {
    if (!activeOmrExam) return;
    try {
      const res = await submitOmrMutation.mutateAsync({
        examId: activeOmrExam.examId,
        answers: markingAnswers,
        autoSubmittedByTimer: true,
      });
      const localKey = `omr_draft_${activeOmrExam.examId}_${activeOmrExam.attemptNum || 1}`;
      try { localStorage.removeItem(localKey); } catch {}
      setLastSubmitResult({ examId: activeOmrExam.examId, examName: activeOmrExam.name, maxScore: activeOmrExam.maxScore, ...res });
      setPreviewResultExamId(activeOmrExam.examId);
      setActiveOmrExam(null);
      setOmrBannerMsg(`⏱ 제한 시간이 종료되어 현재까지 마킹한 답안으로 자동 제출되었습니다. (${res.score}점)`);
    } catch (err) {
      setOmrErrorMsg(err.message || '자동 제출 중 오류가 발생했습니다.');
    }
  };

  const handleSubmitOmr = async () => {
    if (!activeOmrExam) return;
    setOmrErrorMsg('');
    const numQ = activeOmrExam.questionCount || 20;
    const locked = activeOmrExam.lockedQuestions || {};
    const unmarked = [];
    for (let i = 1; i <= numQ; i++) {
      if (locked[i] === undefined && !markingAnswers[i]) {
        unmarked.push(i);
      }
    }

    if (unmarked.length > 0) {
      const previewNums = unmarked.slice(0, 8).join(', ') + (unmarked.length > 8 ? ` 외 ${unmarked.length - 8}개` : '');
      const ok = await askConfirm(`아직 마킹하지 않은 문항이 ${unmarked.length}개(${previewNums}번) 있습니다.\n이대로 제출하시겠습니까?`);
      if (!ok) return;
    } else {
      const ok = await askConfirm(`${activeOmrExam.name} (${activeOmrExam.attemptNum}차) OMR 답안을 제출하시겠습니까?`);
      if (!ok) return;
    }

    try {
      const res = await submitOmrMutation.mutateAsync({
        examId: activeOmrExam.examId,
        answers: markingAnswers,
        autoSubmittedByTimer: false,
      });
      const localKey = `omr_draft_${activeOmrExam.examId}_${activeOmrExam.attemptNum || 1}`;
      try { localStorage.removeItem(localKey); } catch {}
      setLastSubmitResult({ examId: activeOmrExam.examId, examName: activeOmrExam.name, maxScore: activeOmrExam.maxScore, ...res });
      setPreviewResultExamId(activeOmrExam.examId);
      setActiveOmrExam(null);
      setOmrBannerMsg(`${res.message} — ${res.score}점 (${res.correctCount}/${res.totalQuestions}문항 정답)`);
    } catch (err) {
      setOmrErrorMsg(err.message || '답안 제출에 실패했습니다.');
    }
  };

  const handleFinalizeEarly = async (examItem) => {
    const ok = await askConfirm('재제출 기회를 포기하고 현재 점수로 최종 확정하시겠습니까?\n(확정 후에는 정답 번호를 바로 볼 수 있지만, 다시 제출할 수 없습니다.)');
    if (!ok) return;
    try {
      await finalizeOmrMutation.mutateAsync(examItem.examId);
      setOmrBannerMsg('최종 제출로 확정되어 전체 정답 번호가 공개되었습니다.');
      setPreviewResultExamId(examItem.examId);
    } catch (err) {
      setOmrErrorMsg(err.message);
    }
  };

  const EXAM_CATEGORIES = useMemo(() => {
    const cats = (config.examTypes || []).map((c, i) => ({
      key: c.key || `cat_${i}`,
      label: c.label || c.key,
      types: c.types || [],
    }));
    return [{ key: 'all', label: '전체' }, ...cats];
  }, [config.examTypes]);

  const CAT_COLORS = useMemo(() => {
    const map = {};
    (config.examTypes || []).forEach((c, i) => {
      map[c.key || `cat_${i}`] = DEFAULT_CAT_COLORS[i % DEFAULT_CAT_COLORS.length];
    });
    return map;
  }, [config.examTypes]);

  const CAT_ICONS = useMemo(() => {
    const map = {};
    (config.examTypes || []).forEach((c, i) => {
      map[c.key || `cat_${i}`] = DEFAULT_CAT_ICONS[i % DEFAULT_CAT_ICONS.length];
    });
    return map;
  }, [config.examTypes]);

  const loadError = scoresError?.message || '';
  const staffSchools = [...new Set(studentsList.map(s => s.school))].sort();
  const filteredStudents = filterSchool
    ? studentsList.filter(s => s.school === filterSchool)
    : studentsList;

  const loadDistribution = (examId) => {
    setShowDist(prev => prev === examId ? null : examId);
  };

  const loadOmrData = (examId) => {
    setSelectedOmrExamId(prev => prev === examId ? null : examId);
  };

  // 카테고리별 성적 그룹
  const categories = EXAM_CATEGORIES.filter(c => c.key !== 'all');
  const getCatScores = (cat) => scores.filter(s => cat.types.includes(s.exam_type));

  // 전체 or 특정 카테고리
  const visibleCats = activeCategory === 'all'
    ? categories.filter(c => getCatScores(c).length > 0)
    : categories.filter(c => c.key === activeCategory && getCatScores(c).length > 0);

  // 전체 통계
  const totalExams = scores.length;
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((s, e) => s + (e.score / (e.max_score || 100)) * 100, 0) / scores.length)
    : 0;

  const generateNormalDistribution = (dist) => {
    if (!dist || dist.totalStudents < 2) return [];
    const { average, highest, lowest, allScores: rawScores, maxScore } = dist;
    const sc = rawScores || [];
    const mean = average;
    const variance = sc.length > 0 ? sc.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sc.length : Math.pow((highest - lowest) / 4, 2);
    const stdDev = Math.sqrt(variance) || 1;
    const points = [];
    const mn = Math.max(0, mean - 3.5 * stdDev);
    const mx = Math.min(maxScore, mean + 3.5 * stdDev);
    const step = (mx - mn) / 50;
    for (let x = mn; x <= mx; x += step) {
      const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
      points.push({ score: Math.round(x * 10) / 10, density: Math.round(y * 10000) / 10000 });
    }
    return points;
  };

  const renderTrendChart = (data, color) => {
    if (data.length < 2) return null;
    const trendData = data.map(s => ({ name: s.exam_name.length > 8 ? s.exam_name.slice(0, 8) + '…' : s.exam_name, 점수: s.score, fullName: s.exam_name }));
    const scoreValues = data.map(s => s.score);
    const minS = Math.min(...scoreValues), maxS = Math.max(...scoreValues);
    const range = maxS - minS;
    const padding = Math.max(range * 0.3, 5);
    const yMin = Math.max(0, Math.floor((minS - padding) / 5) * 5);
    const yMax = Math.min(Math.max(...data.map(s => s.max_score || 100)), Math.ceil((maxS + padding) / 5) * 5);

    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--warm-200)" />
          <XAxis dataKey="name" fontSize={11} stroke="var(--warm-500)" />
          <YAxis domain={[yMin, yMax]} stroke="var(--warm-500)" fontSize={11} />
          <Tooltip
            formatter={(v) => [`${v}점`, '점수']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--warm-200)', borderRadius: 'var(--radius)', fontSize: 'var(--text-sm)' }}
          />
          <Line type="monotone" dataKey="점수" stroke={color} strokeWidth={2.5} dot={{ r: 4, fill: color }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const distData = distribution?.distribution ? Object.entries(distribution.distribution).map(([range, count]) => ({
    range, 학생수: count,
    isMyRange: distribution.myScore !== null && parseInt(range.split('-')[0]) <= distribution.myScore && distribution.myScore <= parseInt(range.split('-')[1])
  })) : [];
  const normalData = distribution ? generateNormalDistribution(distribution) : [];

  if (loading) {
    return (
      <div className="content s-page">
        <SkeletonPage />
        <BottomTabBar />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="content s-page">
        <ErrorState message={loadError} onRetry={() => window.location.reload()} />
        <BottomTabBar />
      </div>
    );
  }

  return (
    <div className="content s-page">
      {/* 관리자/조교: 학생 선택 */}
      {isStaff && studentsList.length > 0 && (
        <div className="s-card" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filterSchool} onChange={e => { setFilterSchool(e.target.value); setSelectedStudent(''); }}
              style={{ padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--warm-200)', fontSize: 'var(--text-sm)' }}>
              <option value="">전체 학교</option>
              {staffSchools.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
              style={{ flex: 1, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--warm-200)', fontSize: 'var(--text-sm)' }}>
              <option value="">내 성적</option>
              {filteredStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.school} {s.grade})</option>
              ))}
            </select>
          </div>
          {selectedStudent && (
            <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--accent)', fontWeight: 600 }}>
              {filteredStudents.find(s => s.id === parseInt(selectedStudent))?.name || ''}의 성적을 조회 중
            </div>
          )}
        </div>
      )}

      {/* 알림 배너 */}
      {omrBannerMsg && (
        <div style={{
          marginBottom: 'var(--space-2)', padding: '10px 14px', borderRadius: 'var(--radius)',
          background: 'oklch(0.94 0.06 155)', border: '1px solid oklch(0.82 0.1 155)',
          color: 'oklch(0.32 0.12 155)', fontSize: 'var(--text-sm)', fontWeight: 700,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>✅ {omrBannerMsg}</span>
          <button onClick={() => setOmrBannerMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}
      {omrErrorMsg && (
        <div style={{
          marginBottom: 'var(--space-2)', padding: '10px 14px', borderRadius: 'var(--radius)',
          background: 'oklch(0.95 0.05 25)', border: '1px solid oklch(0.82 0.1 25)',
          color: 'oklch(0.4 0.16 25)', fontSize: 'var(--text-sm)', fontWeight: 700,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>⚠️ {omrErrorMsg}</span>
          <button onClick={() => setOmrErrorMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 1. 활성화된 OMR 마킹 시트 (실제 OMR 답안지 디자인 + 타이머·미니맵) */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeOmrExam && (
        <StudentOmrSheet
          exam={activeOmrExam}
          markingAnswers={markingAnswers}
          onSelectBubble={handleSelectBubble}
          onSubmit={handleSubmitOmr}
          onClose={() => setActiveOmrExam(null)}
          isSubmitting={submitOmrMutation.isPending}
          remainingSeconds={activeTimerRemainingSec}
          showWrongOnlyFilter={showWrongOnlyFilter}
          onToggleWrongOnlyFilter={setShowWrongOnlyFilter}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 2. 학생 직접 OMR 응시 가능 시험 카드 섹션 */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="s-card" style={{ padding: '16px 18px', marginBottom: 'var(--space-3)', fontFamily: "var(--font-body, 'KoPub Dotum', sans-serif)" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: omrExams.length > 0 ? 12 : 0, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "var(--font-display, 'Paperlogy', sans-serif)", fontSize: 15.5, fontWeight: 700, color: '#102044', letterSpacing: '-0.01em' }}>
              OMR 답안지 직접 입력
            </span>
            <span style={{
              fontFamily: "var(--font-display, 'Paperlogy', sans-serif)",
              fontSize: 11, padding: '2px 8px', borderRadius: 5,
              background: omrExams.length > 0 ? '#102044' : '#F1F5F9',
              color: omrExams.length > 0 ? '#FFFFFF' : '#475569', fontWeight: 600
            }}>
              {omrExams.length}건
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => setShowOmrGuide(true)}
              style={{
                fontFamily: "var(--font-display, 'Paperlogy', sans-serif)",
                fontSize: 11.5, padding: '4px 10px', borderRadius: 6,
                border: '1px solid #DCE2EC', background: '#F8F9FB',
                color: '#1E293B', fontWeight: 600, cursor: 'pointer'
              }}
            >
              사용법 안내
            </button>
            <button type="button" onClick={() => refetchOmrExams()}
              style={{ fontFamily: "var(--font-display, 'Paperlogy', sans-serif)", fontSize: 11.5, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' }}>
              새로고침
            </button>
          </div>
        </div>

        {omrExams.length === 0 && (
          <div style={{
            marginTop: 10, padding: '12px 14px', borderRadius: 8,
            background: '#F8F9FB', border: '1px dashed #DCE2EC',
            fontSize: 12.5, color: '#64748B', lineHeight: 1.5
          }}>
            현재 열려 있는 OMR 시험이 없습니다. 선생님이 시험 OMR 입력을 오픈하면 이곳에 자동으로 표시됩니다.
          </div>
        )}

        {omrExams.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {omrExams.map(exam => {
              const liveCooldownSec = exam.nextRetryAvailableAt
                ? Math.max(0, Math.ceil((new Date(exam.nextRetryAvailableAt).getTime() - nowTick) / 1000))
                : 0;
              const liveTimerSec = exam.expiresAt
                ? Math.max(0, Math.ceil((new Date(exam.expiresAt).getTime() - nowTick) / 1000))
                : null;

              const effectiveStatus =
                exam.myStatus === 'cooldown' && liveCooldownSec <= 0
                  ? 'retry_available'
                  : exam.myStatus;

              const wrongCount = exam.questionCount - (exam.latestCorrectCount || 0);
              const isShowingResult = previewResultExamId === exam.examId;
              const resultPayload = lastSubmitResult?.examId === exam.examId
                ? lastSubmitResult
                : exam.lastGradedResults
                  ? {
                      score: exam.latestScore,
                      firstScore: exam.firstScore,
                      correctCount: exam.latestCorrectCount,
                      questionCount: exam.questionCount,
                      attemptCount: exam.attemptCount,
                      canRevealAnswers: exam.canRevealAnswers,
                      explanationFile: exam.explanationFile || null,
                      hasExplanationFile: Boolean(exam.hasExplanationFile),
                      results: exam.lastGradedResults,
                    }
                  : null;

              return (
                <div key={exam.examId} style={{
                  padding: '13px 15px', borderRadius: 10,
                  background: '#FFFFFF', border: '1px solid #DCE2EC'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
                        <span style={{ fontFamily: "var(--font-display, 'Paperlogy', sans-serif)", fontWeight: 700, fontSize: 14.5, color: '#102044' }}>
                          {exam.name}
                        </span>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#F4F6FA', color: '#64748B', border: '1px solid #EAEFF5' }}>
                          {exam.examType}
                        </span>
                        {effectiveStatus === 'not_started' && (
                          <span style={{ fontFamily: "var(--font-display, 'Paperlogy', sans-serif)", fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#F1F6F3', color: '#335B48', border: '1px solid #CADAD1', fontWeight: 600 }}>
                            응시 가능
                          </span>
                        )}
                        {effectiveStatus === 'in_progress' && (
                          <span style={{ fontFamily: "var(--font-display, 'Paperlogy', sans-serif)", fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#F4F6FA', color: '#102044', border: '1px solid #CBD5E1', fontWeight: 600 }}>
                            응시 중 {liveTimerSec !== null ? `(${formatDurationMMSS(liveTimerSec)})` : ''}
                          </span>
                        )}
                        {effectiveStatus === 'cooldown' && (
                          <span style={{ fontFamily: "var(--font-display, 'Paperlogy', sans-serif)", fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#FAF6EE', color: '#7F5C24', border: '1px solid #E3D5BA', fontWeight: 600 }}>
                            재제출 대기 중
                          </span>
                        )}
                        {effectiveStatus === 'retry_available' && (
                          <span style={{ fontFamily: "var(--font-display, 'Paperlogy', sans-serif)", fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#F4F6FA', color: '#1E3159', border: '1px solid #BCC6D6', fontWeight: 600 }}>
                            오답 재도전 가능
                          </span>
                        )}
                        {effectiveStatus === 'completed' && (
                          <span style={{ fontFamily: "var(--font-display, 'Paperlogy', sans-serif)", fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#F1F5F9', color: '#475569', border: '1px solid #DCE2EC', fontWeight: 600 }}>
                            제출 완료
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 12, color: '#64748B', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        <span>{exam.questionCount}문항 ({exam.choiceCount}지선다)</span>
                        <span>· 제한시간 {exam.timeLimitMinutes ? `${exam.timeLimitMinutes}분` : '없음'}</span>
                        <span>
                          · 재제출 {exam.allowResubmit
                            ? `${exam.cooldownMinutes}분 대기 후 가능 (최대 ${exam.maxAttempts === 0 ? '무제한' : `${exam.maxAttempts}회`})`
                            : '1회만 제출'}
                        </span>
                      </div>

                      {/* 1차 점수 / 재제출 점수 표시 */}
                      {exam.attemptCount >= 1 && (
                        <div style={{ fontFamily: "var(--font-display, 'Paperlogy', sans-serif)", marginTop: 6, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {exam.attemptCount >= 2 && exam.firstScore !== null ? (
                            <>
                              <span style={{ color: '#64748B' }}>1차 {exam.firstScore}점 ({exam.firstCorrectCount}/{exam.questionCount})</span>
                              <span style={{ color: '#94A3B8' }}>&rarr;</span>
                              <span style={{ color: '#102044' }}>재제출 {exam.latestScore}점 ({exam.latestCorrectCount}/{exam.questionCount})</span>
                            </>
                          ) : (
                            <span style={{ color: '#102044' }}>
                              1차 {exam.latestScore}점 / {exam.maxScore}점 ({exam.latestCorrectCount}/{exam.questionCount} 정답 · 오답 {wrongCount}문항)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 상태별 액션 버튼 */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      {effectiveStatus === 'not_started' && !selectedStudent && (
                        <button type="button"
                          onClick={() => handleOpenOmrMarking(exam)}
                          style={{
                            fontFamily: "var(--font-display, 'Paperlogy', sans-serif)",
                            padding: '8px 16px', borderRadius: 8, border: 'none',
                            background: '#102044', color: '#FFFFFF', fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
                          }}>
                          OMR 시험 시작
                        </button>
                      )}

                      {effectiveStatus === 'in_progress' && !selectedStudent && (
                        <button type="button"
                          onClick={() => handleOpenOmrMarking(exam)}
                          style={{
                            fontFamily: "var(--font-display, 'Paperlogy', sans-serif)",
                            padding: '8px 16px', borderRadius: 8, border: 'none',
                            background: '#102044', color: '#FFFFFF', fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
                          }}>
                          이어서 마킹하기
                        </button>
                      )}

                      {effectiveStatus === 'cooldown' && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontFamily: "var(--font-display, 'Paperlogy', sans-serif)",
                            padding: '6px 12px', borderRadius: 7,
                            background: '#FAF6EE', border: '1px solid #E3D5BA',
                            color: '#7F5C24', fontSize: 12, fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums'
                          }}>
                            {formatDurationMMSS(liveCooldownSec)} 후 재제출 가능
                          </div>
                          {!selectedStudent && !exam.canRevealAnswers && (
                            <button type="button"
                              onClick={() => handleFinalizeEarly(exam)}
                              style={{
                                marginTop: 4, fontSize: 11, color: '#64748B',
                                background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline'
                              }}>
                              재제출 포기하고 정답 확인
                            </button>
                          )}
                        </div>
                      )}

                      {effectiveStatus === 'retry_available' && !selectedStudent && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button type="button"
                            onClick={() => handleOpenOmrMarking(exam)}
                            style={{
                              fontFamily: "var(--font-display, 'Paperlogy', sans-serif)",
                              padding: '8px 16px', borderRadius: 8, border: 'none',
                              background: '#102044', color: '#FFFFFF', fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
                            }}>
                            틀린 {wrongCount}문항 재도전
                          </button>
                          {!exam.canRevealAnswers && (
                            <button type="button"
                              onClick={() => handleFinalizeEarly(exam)}
                              style={{
                                fontSize: 11, color: '#64748B',
                                background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline'
                              }}>
                              최종 확정
                            </button>
                          )}
                        </div>
                      )}

                      {exam.attemptCount >= 1 && resultPayload && (
                        <button type="button"
                          onClick={() => setPreviewResultExamId(isShowingResult ? null : exam.examId)}
                          style={{
                            fontFamily: "var(--font-display, 'Paperlogy', sans-serif)",
                            padding: '5px 11px', borderRadius: 6, border: '1px solid #DCE2EC',
                            background: isShowingResult ? '#102044' : '#F8F9FB',
                            color: isShowingResult ? '#FFFFFF' : '#1E293B',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer'
                          }}>
                          {exam.canRevealAnswers ? '빠른 정답 · 해설 보기' : '1차 정오표(O/X) 보기'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 인라인 빠른 정답 & 정답과 해설 표시 */}
                  {isShowingResult && resultPayload && (
                    <StudentOmrResult data={resultPayload} maxScore={exam.maxScore} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 요약 카드 */}
      {scores.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <div style={{ flex: 1, background: 'linear-gradient(135deg, var(--accent), var(--accent-lighter))', borderRadius: 'var(--radius)', padding: 'var(--space-3) var(--space-4)', color: 'white' }}>
            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>총 시험 수</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>{totalExams}<span style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>회</span></div>
          </div>
          <div style={{ flex: 1, background: 'linear-gradient(135deg, var(--success), var(--success))', borderRadius: 'var(--radius)', padding: 'var(--space-3) var(--space-4)', color: 'white' }}>
            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>평균 환산 점수</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>{avgScore}<span style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>점</span></div>
          </div>
        </div>
      )}

      {/* 카테고리 탭 */}
      <div className="s-tab-pills" style={{ overflowX: 'auto' }}>
        {EXAM_CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setActiveCategory(c.key)}
            className={`s-tab-pill${activeCategory === c.key ? ' active' : ''}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* 카테고리별 성적 카드 */}
      {visibleCats.length === 0 && omrExams.length === 0 && (
        <EmptyState message="등록된 성적이 없습니다." />
      )}

      {visibleCats.map(cat => {
        const catScores = getCatScores(cat).sort((a, b) => (b.exam_date || '').localeCompare(a.exam_date || ''));
        const color = CAT_COLORS[cat.key] || 'var(--neutral-500)';
        const icon = CAT_ICONS[cat.key] || '📄';
        const hasTrend = catScores.length >= 2;

        return (
          <div key={cat.key} className="s-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
            {/* 카테고리 헤더 */}
            <div style={{
              padding: 'var(--space-3) var(--space-4)', background: `${color}10`,
              borderBottom: `2px solid ${color}30`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-lg)' }}>{icon}</span>
                <span className="s-section-title" style={{ color }}>{cat.label}</span>
                <span style={{
                  fontSize: 'var(--text-xs)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-sm)',
                  background: color, color: 'white', fontWeight: 600,
                }}>{catScores.length}건</span>
              </div>
              {hasTrend && (
                <button onClick={() => setExpandedTrends(p => ({ ...p, [cat.key]: !p[cat.key] }))}
                  style={{
                    fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${color}40`, background: expandedTrends[cat.key] ? color : 'transparent',
                    color: expandedTrends[cat.key] ? 'white' : color,
                    cursor: 'pointer', fontWeight: 600,
                  }}>
                  📈 추이 {expandedTrends[cat.key] ? '▲' : '▼'}
                </button>
              )}
            </div>

            {/* 추이 차트 */}
            {expandedTrends[cat.key] && hasTrend && (
              <div style={{ padding: 'var(--space-3) var(--space-2) var(--space-1)' }}>
                {renderTrendChart(getCatScores(cat).sort((a, b) => (a.exam_date || '').localeCompare(b.exam_date || '')), color)}
              </div>
            )}

            {/* 시험 목록 */}
            {catScores.map((s, i) => {
              const firstScoreVal = s.first_score ?? s.omr_first_score ?? null;
              const retestScoreVal = s.retest_score ?? ((s.omr_attempt_count || 0) >= 2 ? s.omr_latest_score : null);
              const hasDualScores = firstScoreVal !== null && retestScoreVal !== null;

              return (
                <div key={`${s.exam_id}-${i}`} style={{
                  padding: 'var(--space-2) var(--space-4)',
                  borderBottom: i < catScores.length - 1 ? '1px solid var(--warm-200)' : 'none',
                  background: showDist === s.exam_id ? 'var(--warm-50)' : 'var(--card)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 3 }}>{s.exam_name}</div>
                      <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--warm-500)', flexWrap: 'wrap' }}>
                        <span>📅 {s.exam_date || '-'}</span>
                        <span style={{ color: 'var(--warm-500)', fontSize: 'var(--text-xs)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>{s.exam_type}</span>
                        {hasDualScores && (
                          <span style={{
                            fontSize: 11, padding: '1px 7px', borderRadius: 8,
                            background: 'oklch(0.94 0.05 260)', color: 'var(--accent)', fontWeight: 700
                          }}>
                            1차 {firstScoreVal}점 &rarr; 재제출 {retestScoreVal}점
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 'var(--space-3)' }}>
                      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color }}>
                        {s.score}<span style={{ fontSize: 'var(--text-sm)', color: 'var(--warm-500)', fontWeight: 400 }}>/{s.max_score}</span>
                      </div>
                      {s.rank_num && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--warm-500)' }}>
                          {s.rank_num}등 / {s.total_students}명
                        </div>
                      )}
                      {s.rank_num && s.total_students && (() => {
                        const isNaesin = s.exam_name && (s.exam_name.includes('내신') || s.exam_name.includes('중간') || s.exam_name.includes('기말'));
                        const pctile = (s.rank_num / s.total_students) * 100;
                        if (isNaesin) {
                          const g = pctile <= 10 ? 1 : pctile <= 34 ? 2 : pctile <= 66 ? 3 : pctile <= 90 ? 4 : 5;
                          const gc = g === 1 ? 'var(--success)' : g === 2 ? 'var(--accent)' : g === 3 ? 'var(--warning)' : g === 4 ? 'var(--destructive)' : 'oklch(35% 0.15 25)';
                          return <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: gc }}>{g}등급</div>;
                        }
                        const g = pctile <= 4 ? 1 : pctile <= 11 ? 2 : pctile <= 23 ? 3 : pctile <= 40 ? 4 : pctile <= 60 ? 5 : pctile <= 77 ? 6 : pctile <= 89 ? 7 : pctile <= 96 ? 8 : 9;
                        const gc = g <= 2 ? 'var(--success)' : g <= 4 ? 'var(--accent)' : g <= 6 ? 'var(--warning)' : 'var(--destructive)';
                        return <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: gc }}>{g}등급</div>;
                      })()}
                    </div>
                  </div>
                  {s.note && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--warm-500)', marginTop: 'var(--space-1)', padding: 'var(--space-1) var(--space-2)', background: 'var(--warm-50)', borderRadius: 'var(--radius-sm)' }}>
                      💬 {s.note}
                    </div>
                  )}
                  <div style={{ marginTop: 'var(--space-1)', display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                    <button onClick={() => loadDistribution(s.exam_id)}
                      style={{
                        fontSize: 'var(--text-xs)', padding: '3px var(--space-2)', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--warm-200)', cursor: 'pointer',
                        background: showDist === s.exam_id ? 'var(--accent)' : 'var(--warm-100)',
                        color: showDist === s.exam_id ? 'white' : 'var(--warm-800)',
                      }}>
                      📊 분포 보기
                    </button>
                    {s.has_answer_key === 1 && s.has_submission === 1 && (
                      <button onClick={() => loadOmrData(s.exam_id)}
                        style={{
                          fontSize: 'var(--text-xs)', padding: '3px var(--space-2)', borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--warm-200)', cursor: 'pointer',
                          background: selectedOmrExamId === s.exam_id ? 'var(--accent)' : 'var(--warm-100)',
                          color: selectedOmrExamId === s.exam_id ? 'white' : 'var(--warm-800)',
                        }}>
                        {omrLoading && selectedOmrExamId === s.exam_id ? '...' : '📝 답안 확인'}
                      </button>
                    )}
                  </div>

                  {/* 분포 차트 - 인라인 */}
                  {showDist === s.exam_id && distribution && (
                    <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--warm-50)', borderRadius: 'var(--radius)', border: '1px solid var(--warm-200)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                        {distribution.myScore !== null && (
                          <div style={{ textAlign: 'center', padding: 'var(--space-2)', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--accent-lighter)' }}>
                            <div style={{ fontSize: 10, color: 'var(--warm-500)' }}>내 점수</div>
                            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--accent)' }}>{distribution.myScore}</div>
                          </div>
                        )}
                        <div style={{ textAlign: 'center', padding: 'var(--space-2)', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--warm-200)' }}>
                          <div style={{ fontSize: 10, color: 'var(--warm-500)' }}>평균</div>
                          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>{distribution.average}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: 'var(--space-2)', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--success-light)' }}>
                          <div style={{ fontSize: 10, color: 'var(--warm-500)' }}>최고</div>
                          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--success)' }}>{distribution.highest}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: 'var(--space-2)', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--destructive-light)' }}>
                          <div style={{ fontSize: 10, color: 'var(--warm-500)' }}>최저</div>
                          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--destructive)' }}>{distribution.lowest}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: 'var(--space-2)', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--warm-200)' }}>
                          <div style={{ fontSize: 10, color: 'var(--warm-500)' }}>응시</div>
                          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>{distribution.totalStudents}명</div>
                        </div>
                      </div>

                      {normalData.length > 0 && (
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                          <div className="s-section-title" style={{ marginBottom: 'var(--space-1)' }}>표준분포</div>
                          <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={normalData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--warm-200)" />
                              <XAxis dataKey="score" fontSize={10} stroke="var(--warm-500)" />
                              <YAxis hide />
                              <Tooltip formatter={(v, n) => n === 'density' ? [v, '밀도'] : [v, n]} labelFormatter={(v) => `${v}점`}
                                contentStyle={{ background: 'var(--card)', border: '1px solid var(--warm-200)', borderRadius: 'var(--radius)', fontSize: 'var(--text-xs)' }} />
                              <Area type="monotone" dataKey="density" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} />
                              {distribution.myScore !== null && (
                                <ReferenceLine x={distribution.myScore} stroke="var(--destructive)" strokeWidth={2} strokeDasharray="5 5"
                                  label={{ value: `나 ${distribution.myScore}`, fill: 'var(--destructive)', fontSize: 11, position: 'top' }} />
                              )}
                              <ReferenceLine x={distribution.average} stroke="var(--warm-500)" strokeWidth={1.5} strokeDasharray="3 3"
                                label={{ value: `평균 ${distribution.average}`, fill: 'var(--warm-500)', fontSize: 10, position: 'insideTopRight' }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      <div className="s-section-title" style={{ marginBottom: 'var(--space-1)' }}>구간별 인원</div>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={distData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--warm-200)" />
                          <XAxis dataKey="range" fontSize={10} stroke="var(--warm-500)" />
                          <YAxis allowDecimals={false} stroke="var(--warm-500)" fontSize={10} />
                          <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--warm-200)', borderRadius: 'var(--radius)', fontSize: 'var(--text-xs)' }} />
                          <Bar dataKey="학생수" radius={[4, 4, 0, 0]}>
                            {distData.map((entry, index) => (<Cell key={index} fill={entry.isMyRange ? 'var(--destructive)' : color} />))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>

                      {/* 동점자 표시 */}
                      {distribution.studentScores && (() => {
                        const byScore = {};
                        distribution.studentScores.forEach(st => {
                          if (!byScore[st.score]) byScore[st.score] = [];
                          byScore[st.score].push(st);
                        });
                        const ties = Object.entries(byScore).filter(([, arr]) => arr.length > 1).sort((a, b) => b[0] - a[0]);
                        if (ties.length === 0) return null;
                        return (
                          <div style={{ marginTop: 'var(--space-2)' }}>
                            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--warm-500)', marginBottom: 'var(--space-1)' }}>동점자 현황</div>
                            <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                              {ties.map(([score, arr]) => (
                                <span key={score} style={{
                                  fontSize: 'var(--text-xs)', padding: '3px var(--space-2)', borderRadius: 'var(--radius)',
                                  background: distribution.myScore === parseInt(score) ? 'var(--destructive-light)' : 'var(--warm-100)',
                                  border: distribution.myScore === parseInt(score) ? '1px solid var(--destructive-light)' : '1px solid var(--warm-200)',
                                }}>
                                  <strong>{score}점</strong> {arr.length}명
                                  {distribution.myScore === parseInt(score) && <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>(나)</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* OMR 답안 확인 (빠른 정답 + 정답과 해설 렌더링) */}
                  {selectedOmrExamId === s.exam_id && !omrLoading && omrData && Array.isArray(omrData.results) && (
                    <StudentOmrResult data={omrData} maxScore={s.max_score || 100} />
                  )}

                  {/* OMR 데이터 없음 */}
                  {selectedOmrExamId === s.exam_id && !omrLoading && (!omrData || !Array.isArray(omrData.results)) && (
                    <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--warm-50)', borderRadius: 'var(--radius)', fontSize: 'var(--text-xs)', color: 'var(--warm-500)' }}>
                      답안 데이터를 찾을 수 없습니다.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      <StudentOmrGuideModal forceOpen={showOmrGuide} onClose={() => setShowOmrGuide(false)} />
      <BottomTabBar />
    </div>
  );
}
