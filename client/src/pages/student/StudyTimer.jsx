import { useState, useEffect, useRef, useCallback } from 'react';
import { api, apiPost, apiPut, apiDelete, getUser } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';
import AvatarSVG from '../../components/AvatarSVG';
import { ErrorState } from '../../components/StudentStates';

const PRESETS = [
  { label: '5분', seconds: 300, emoji: '⚡' },
  { label: '10분', seconds: 600, emoji: '📝' },
  { label: '15분', seconds: 900, emoji: '✍️' },
  { label: '25분', seconds: 1500, emoji: '🍅' },
  { label: '30분', seconds: 1800, emoji: '📖' },
  { label: '50분', seconds: 3000, emoji: '📚' },
  { label: '60분', seconds: 3600, emoji: '🎯' },
  { label: '80분', seconds: 4800, emoji: '🔥' },
];

const DEFAULT_SUBJECTS = ['국어', '영어', '수학', '과학', '사회'];
const SUBJECT_COLORS = ['var(--info)', 'oklch(55% 0.20 290)', 'var(--destructive)', 'var(--success)', 'var(--warning)', 'oklch(60% 0.20 350)', 'oklch(60% 0.14 175)', 'oklch(65% 0.18 50)', 'oklch(50% 0.20 280)', 'oklch(70% 0.16 130)'];
const SUBJECT_EMOJIS = { '국어': '📖', '영어': '🔤', '수학': '🔢', '과학': '🔬', '사회': '🌍' };

function getStoredSubjects() {
  try {
    const stored = localStorage.getItem('study_subjects');
    if (stored) return JSON.parse(stored);
  } catch {}
  return [...DEFAULT_SUBJECTS];
}
function saveSubjects(subjects) {
  localStorage.setItem('study_subjects', JSON.stringify(subjects));
}
function getSubjectColor(name, subjects) {
  const idx = subjects.indexOf(name);
  return SUBJECT_COLORS[idx % SUBJECT_COLORS.length] || 'var(--muted-foreground)';
}
function getSubjectEmoji(name) {
  return SUBJECT_EMOJIS[name] || '📚';
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatHM(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

function formatTimeShort(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0m';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.2);
      osc.stop(ctx.currentTime + i * 0.2 + 0.4);
    });
    setTimeout(() => {
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.4);
      });
    }, 1200);
  } catch (e) { console.error('Audio error:', e); }
}

// 마일스톤 축하 메시지
const MILESTONE_MESSAGES = [
  { hours: 2, emoji: '📗', msg: '2시간 달성! 좋은 시작이에요!' },
  { hours: 4, emoji: '⭐', msg: '4시간 달성! 집중력 굿!' },
  { hours: 6, emoji: '🔥', msg: '6시간 달성! 불타오르고 있어요!' },
  { hours: 8, emoji: '🔥', msg: '8시간 달성! 열정 폭발!' },
  { hours: 10, emoji: '🔥🔥', msg: '10시간 달성! 초집중 모드!' },
  { hours: 12, emoji: '👑', msg: '12시간 달성! 전설이 되었어요!' },
];

export default function StudyTimer() {
  const user = getUser();
  // 모드: 'stopwatch' | 'countdown'
  const [timerMode, setTimerMode] = useState('stopwatch');
  // 탭: 'timer' | 'stats'
  const [tab, setTab] = useState('timer');

  // === 공통 상태 ===
  const [subjects, setSubjects] = useState(getStoredSubjects);
  const [selectedSubject, setSelectedSubject] = useState(() => getStoredSubjects()[0] || '국어');
  const [showSubjectEdit, setShowSubjectEdit] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

  // === 세션 상태 (서버 연동) ===
  const [session, setSession] = useState(null); // 서버 세션 객체
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState(''); // 'tab' | 'manual' | ''
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [todayTotalSeconds, setTodayTotalSeconds] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [finalDuration, setFinalDuration] = useState(0);
  const [milestoneToast, setMilestoneToast] = useState(null);

  // === 카운트다운 전용 ===
  const [countdownTotal, setCountdownTotal] = useState(1500);
  const [countdownRemaining, setCountdownRemaining] = useState(1500);
  const [inputHours, setInputHours] = useState(0);
  const [inputMinutes, setInputMinutes] = useState(25);
  const [inputSeconds, setInputSeconds] = useState(0);
  const countdownStartRef = useRef(null);
  const countdownRemainingAtStartRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // === 실시간 공부 중 ===
  const [activeStudents, setActiveStudents] = useState([]);

  // === 통계 ===
  const [statsPeriod, setStatsPeriod] = useState('daily');
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [statsDate, setStatsDate] = useState(new Date().toISOString().slice(0, 10));
  const [logList, setLogList] = useState([]);
  const [editingLog, setEditingLog] = useState(null);
  const [editLogMin, setEditLogMin] = useState(0);

  // refs
  const heartbeatRef = useRef(null);
  const elapsedRef = useRef(null);
  const sessionStartTimeRef = useRef(null);
  const totalPausedMsRef = useRef(0);
  const pauseStartTimeRef = useRef(null);
  const lastMilestoneRef = useRef(0);
  const activePollingRef = useRef(null);
  const visibilityPauseRef = useRef(false); // 탭 전환으로 인한 일시정지 여부

  // === 페이지 로드 시 기존 세션 복원 ===
  useEffect(() => {
    api('/study-timer/sessions/my').then(data => {
      if (data.session) {
        const s = data.session;
        setSession(s);
        setSelectedSubject(s.subject);
        setTimerMode(s.timer_type === 'countdown' ? 'countdown' : 'stopwatch');
        setIsRunning(!s.is_paused);
        setIsPaused(s.is_paused);
        sessionStartTimeRef.current = new Date(s.started_at).getTime();
        totalPausedMsRef.current = s.total_paused_ms || 0;
        if (s.is_paused && s.pause_started_at) {
          pauseStartTimeRef.current = new Date(s.pause_started_at).getTime();
        }
        if (s.timer_type === 'countdown' && s.preset_seconds > 0) {
          setCountdownTotal(s.preset_seconds);
        }
        setTodayTotalSeconds(data.today_total_seconds || 0);
      }
    }).catch(() => {});
  }, []);

  // === 경과 시간 계산 (1초 인터벌) ===
  useEffect(() => {
    if (!session || isPaused) {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      return;
    }
    const calcElapsed = () => {
      const now = Date.now();
      const startedAt = sessionStartTimeRef.current;
      const pausedMs = totalPausedMsRef.current;
      const elapsed = Math.max(0, Math.floor((now - startedAt - pausedMs) / 1000));
      setElapsedSeconds(elapsed);

      // 카운트다운 모드: 시간 다 됐는지 확인
      if (timerMode === 'countdown' && countdownTotal > 0) {
        const remaining = Math.max(0, countdownTotal - elapsed);
        setCountdownRemaining(remaining);
        if (remaining <= 0) {
          handleEndSession();
          playAlarm();
          if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
        }
      }

      // 마일스톤 체크
      const totalHours = (todayTotalSeconds + elapsed) / 3600;
      for (const m of MILESTONE_MESSAGES) {
        if (totalHours >= m.hours && lastMilestoneRef.current < m.hours) {
          lastMilestoneRef.current = m.hours;
          setMilestoneToast(m);
          setTimeout(() => setMilestoneToast(null), 4000);
        }
      }
    };
    calcElapsed();
    elapsedRef.current = setInterval(calcElapsed, 1000);
    return () => clearInterval(elapsedRef.current);
  }, [session, isPaused, timerMode, countdownTotal, todayTotalSeconds]);

  // === 하트비트 (15초) ===
  useEffect(() => {
    if (!session) return;
    const sendHeartbeat = () => {
      apiPost('/study-timer/sessions/heartbeat', { sessionId: session.id }).catch(() => {});
    };
    heartbeatRef.current = setInterval(sendHeartbeat, 15000);
    return () => clearInterval(heartbeatRef.current);
  }, [session]);

  // === Page Visibility API ===
  useEffect(() => {
    const handleVisibility = () => {
      if (!session) return;
      if (document.hidden) {
        if (!isPaused) {
          visibilityPauseRef.current = true;
          handlePauseSession('tab');
        }
      } else {
        if (isPaused && visibilityPauseRef.current) {
          visibilityPauseRef.current = false;
          handleResumeSession();
        }
      }
    };
    const handleBlur = () => {
      if (!session || isPaused) return;
      visibilityPauseRef.current = true;
      handlePauseSession('tab');
    };
    const handleFocus = () => {
      if (!session || !isPaused || !visibilityPauseRef.current) return;
      visibilityPauseRef.current = false;
      handleResumeSession();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [session, isPaused]);

  // === 활성 학생 폴링 (20초) ===
  useEffect(() => {
    const fetchActive = () => {
      api('/study-timer/sessions/active').then(d => setActiveStudents(d.sessions || [])).catch(() => {});
    };
    fetchActive();
    activePollingRef.current = setInterval(fetchActive, 20000);
    return () => clearInterval(activePollingRef.current);
  }, []);

  // === 세션 시작 ===
  const handleStartSession = async () => {
    try {
      const presetSec = timerMode === 'countdown'
        ? (inputHours * 3600 + inputMinutes * 60 + inputSeconds)
        : 0;

      if (timerMode === 'countdown' && presetSec <= 0) return;

      const res = await apiPost('/study-timer/sessions/start', {
        subject: selectedSubject,
        timerType: timerMode,
        presetSeconds: presetSec,
      });
      setSession(res.session);
      sessionStartTimeRef.current = new Date(res.session.started_at).getTime();
      totalPausedMsRef.current = 0;
      pauseStartTimeRef.current = null;
      setIsRunning(true);
      setIsPaused(false);
      setSessionEnded(false);
      setFinalDuration(0);
      setElapsedSeconds(0);
      lastMilestoneRef.current = Math.floor(todayTotalSeconds / 3600);
      visibilityPauseRef.current = false;

      if (timerMode === 'countdown') {
        setCountdownTotal(presetSec);
        setCountdownRemaining(presetSec);
      }
    } catch (e) {
      console.error('세션 시작 실패:', e);
    }
  };

  // === 일시정지 ===
  const handlePauseSession = async (reason = 'manual') => {
    if (!session) return;
    try {
      await apiPost('/study-timer/sessions/pause', { sessionId: session.id });
      const now = Date.now();
      pauseStartTimeRef.current = now;
      setIsPaused(true);
      setIsRunning(false);
      setPauseReason(reason);
    } catch (e) {
      console.error('일시정지 실패:', e);
    }
  };

  // === 재개 ===
  const handleResumeSession = async () => {
    if (!session) return;
    try {
      const res = await apiPost('/study-timer/sessions/resume', { sessionId: session.id });
      if (pauseStartTimeRef.current) {
        totalPausedMsRef.current = res.total_paused_ms || totalPausedMsRef.current;
      }
      pauseStartTimeRef.current = null;
      setIsPaused(false);
      setIsRunning(true);
      setPauseReason('');
    } catch (e) {
      console.error('재개 실패:', e);
    }
  };

  // === 세션 종료 ===
  const handleEndSession = async () => {
    if (!session) return;
    try {
      const res = await apiPost('/study-timer/sessions/end', { sessionId: session.id });
      setFinalDuration(res.finalDuration || 0);
      setSessionEnded(true);
      setSession(null);
      setIsRunning(false);
      setIsPaused(false);
      setPauseReason('');
      sessionStartTimeRef.current = null;
      totalPausedMsRef.current = 0;
      pauseStartTimeRef.current = null;
      clearInterval(heartbeatRef.current);
      clearInterval(elapsedRef.current);

      // 오늘 총 시간 갱신
      api('/study-timer/logs/daily').then(d => setTodayTotalSeconds(d.total_seconds || 0)).catch(() => {});
    } catch (e) {
      console.error('세션 종료 실패:', e);
    }
  };

  // === 통계 로드 ===
  const loadStats = useCallback(async () => {
    setLoadError('');
    setStatsLoading(true);
    try {
      let start, end;
      if (statsPeriod === 'daily') {
        const data = await api(`/study-timer/logs/daily?date=${statsDate}`);
        setStatsData(data);
        start = end = statsDate;
      } else if (statsPeriod === 'weekly') {
        const data = await api(`/study-timer/logs/weekly?date=${statsDate}`);
        setStatsData(data);
        start = data.start; end = data.end;
      } else {
        const d = new Date(statsDate + 'T00:00:00');
        const data = await api(`/study-timer/logs/monthly?year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
        setStatsData(data);
        const y = d.getFullYear(), m = d.getMonth() + 1;
        start = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }
      if (start && end) {
        const list = await api(`/study-timer/logs/list?start=${start}&end=${end}`);
        setLogList(list);
      }
    } catch (e) {
      setStatsData(null);
      setLogList([]);
      setLoadError(e.message || '데이터를 불러올 수 없습니다.');
    }
    setStatsLoading(false);
  }, [statsPeriod, statsDate]);

  const handleDeleteLog = async (id) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/study-timer/logs/${id}`);
      loadStats();
    } catch (e) { console.error(e); }
  };

  const handleEditLog = async (id) => {
    if (editLogMin <= 0) return;
    try {
      await apiPut(`/study-timer/logs/${id}`, { duration: editLogMin * 60 });
      setEditingLog(null);
      loadStats();
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (tab === 'stats') loadStats();
  }, [tab, loadStats]);

  // === 과목 관리 ===
  const handleAddSubject = () => {
    const name = newSubjectName.trim();
    if (!name || subjects.includes(name)) return;
    const updated = [...subjects, name];
    setSubjects(updated);
    saveSubjects(updated);
    setNewSubjectName('');
  };
  const handleRemoveSubject = (name) => {
    if (subjects.length <= 1) return;
    const updated = subjects.filter(s => s !== name);
    setSubjects(updated);
    saveSubjects(updated);
    if (selectedSubject === name) setSelectedSubject(updated[0]);
  };
  const handlePreset = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    setInputHours(h);
    setInputMinutes(m);
    setInputSeconds(s);
  };
  const moveDate = (dir) => {
    const d = new Date(statsDate + 'T00:00:00');
    if (statsPeriod === 'daily') d.setDate(d.getDate() + dir);
    else if (statsPeriod === 'weekly') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setStatsDate(d.toISOString().slice(0, 10));
  };
  const getDateLabel = () => {
    const d = new Date(statsDate + 'T00:00:00');
    if (statsPeriod === 'daily') return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_NAMES[d.getDay()]})`;
    if (statsPeriod === 'weekly') return statsData ? `${statsData.start} ~ ${statsData.end}` : '';
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  };

  const isActive = session && !isPaused;
  const subjectColor = getSubjectColor(selectedSubject, subjects);
  const totalHoursToday = (todayTotalSeconds + (isActive ? elapsedSeconds : 0)) / 3600;
  const maxSubjectSec = statsData?.by_subject?.length > 0
    ? Math.max(...statsData.by_subject.map(s => s.total_seconds)) : 0;

  // 원형 타이머 계산
  const circumference = 2 * Math.PI * 120;
  let progress = 0;
  let timerColor = subjectColor;
  let displayTime = '00:00:00';
  let statusText = '시간을 설정하세요';

  if (session) {
    if (timerMode === 'countdown' && countdownTotal > 0) {
      progress = ((countdownTotal - countdownRemaining) / countdownTotal) * 100;
      displayTime = formatTime(countdownRemaining);
      const ratio = countdownRemaining / countdownTotal;
      timerColor = ratio > 0.5 ? 'var(--success)' : ratio > 0.2 ? 'var(--warning)' : 'var(--destructive)';
    } else {
      // 스톱워치: 10시간 기준 진행률
      progress = Math.min(100, (elapsedSeconds / 36000) * 100);
      displayTime = formatTime(elapsedSeconds);
      // 시간에 따라 색상 변화
      if (elapsedSeconds < 7200) timerColor = 'var(--success)';
      else if (elapsedSeconds < 14400) timerColor = 'var(--warning)';
      else if (elapsedSeconds < 28800) timerColor = 'oklch(65% 0.18 50)';
      else timerColor = 'var(--destructive)';
    }
    statusText = isPaused ? (pauseReason === 'tab' ? '다른 탭 전환으로 일시정지' : '일시정지') :
                 '집중하세요! 💪';
  } else if (sessionEnded) {
    statusText = '공부 완료! 🎉';
  }

  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="content s-page">
      {/* 마일스톤 축하 토스트 */}
      {milestoneToast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          padding: '12px 24px', borderRadius: 16,
          background: 'linear-gradient(135deg, oklch(80% 0.14 85), oklch(65% 0.18 50))',
          color: 'white', fontSize: 15, fontWeight: 800, zIndex: 1000,
          boxShadow: '0 4px 20px oklch(65% 0.18 50 / 0.4)',
          animation: 'milestoneSlide 0.3s ease-out',
          whiteSpace: 'nowrap',
        }}>
          {milestoneToast.emoji} {milestoneToast.msg}
        </div>
      )}

      {/* 일시정지 배너 (탭 전환) */}
      {isPaused && pauseReason === 'tab' && (
        <div style={{
          padding: '10px 16px', borderRadius: 12, marginBottom: 12,
          background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)' }}>일시정지됨</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>다른 탭으로 전환하여 타이머가 일시정지되었습니다</div>
          </div>
        </div>
      )}

      {/* 메인 탭: 타이머 / 통계 */}
      <div className="s-tab-segment" style={{ marginBottom: 16 }}>
        <button className={`s-tab-seg-item${tab === 'timer' ? ' active' : ''}`} onClick={() => setTab('timer')}>⏱️ 타이머</button>
        <button className={`s-tab-seg-item${tab === 'stats' ? ' active' : ''}`} onClick={() => setTab('stats')}>📊 기록</button>
      </div>

      {tab === 'timer' && (
        <>
          {/* 타이머 모드 전환 (세션 중이 아닐 때만) */}
          {!session && !sessionEnded && (
            <div style={{
              display: 'flex', gap: 8, marginBottom: 16,
              background: 'var(--neutral-50)', borderRadius: 12, padding: 4,
            }}>
              <button onClick={() => setTimerMode('stopwatch')} style={{
                flex: 1, padding: '10px 8px', borderRadius: 10,
                background: timerMode === 'stopwatch' ? 'var(--card)' : 'transparent',
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                color: timerMode === 'stopwatch' ? 'var(--accent)' : 'var(--muted-foreground)',
                boxShadow: timerMode === 'stopwatch' ? 'var(--shadow-warm-xs)' : 'none',
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}>⏱️ 스톱워치</button>
              <button onClick={() => setTimerMode('countdown')} style={{
                flex: 1, padding: '10px 8px', borderRadius: 10,
                background: timerMode === 'countdown' ? 'var(--card)' : 'transparent',
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                color: timerMode === 'countdown' ? 'var(--accent)' : 'var(--muted-foreground)',
                boxShadow: timerMode === 'countdown' ? 'var(--shadow-warm-xs)' : 'none',
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}>⏰ 카운트다운</button>
            </div>
          )}

          {/* 과목 선택 (세션 시작 전만) */}
          {!session && !sessionEnded && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted-foreground)' }}>과목 선택</label>
                <button onClick={() => setShowSubjectEdit(!showSubjectEdit)} style={{
                  fontSize: 11, color: 'var(--muted-foreground)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit',
                }}>{showSubjectEdit ? '완료' : '편집'}</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {subjects.map(name => {
                  const color = getSubjectColor(name, subjects);
                  return (
                    <button key={name} onClick={() => !showSubjectEdit && setSelectedSubject(name)} style={{
                      padding: '8px 14px', borderRadius: 10,
                      border: selectedSubject === name && !showSubjectEdit ? `2px solid ${color}` : '1px solid var(--border)',
                      background: selectedSubject === name && !showSubjectEdit ? `${color}15` : 'var(--card)',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                      color: selectedSubject === name && !showSubjectEdit ? color : 'var(--foreground)',
                      transition: 'all 0.15s', position: 'relative',
                    }}>
                      {getSubjectEmoji(name)} {name}
                      {showSubjectEdit && subjects.length > 1 && (
                        <span onClick={(e) => { e.stopPropagation(); handleRemoveSubject(name); }} style={{
                          position: 'absolute', top: -6, right: -6, width: 18, height: 18,
                          borderRadius: 'var(--radius-full)', background: 'var(--destructive)', color: 'white',
                          fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', lineHeight: 1,
                        }}>×</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {showSubjectEdit && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)}
                    placeholder="새 과목 이름" maxLength={10}
                    onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
                  <button onClick={handleAddSubject} style={{
                    padding: '8px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  }}>추가</button>
                </div>
              )}
            </div>
          )}

          {/* 현재 과목 표시 (세션 중) */}
          {(session || sessionEnded) && (
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span style={{
                display: 'inline-block', padding: '4px 14px', borderRadius: 20,
                background: `${subjectColor}15`, color: subjectColor, fontSize: 13, fontWeight: 700,
                border: `1px solid ${subjectColor}40`,
              }}>
                {getSubjectEmoji(selectedSubject)} {selectedSubject}
              </span>
            </div>
          )}

          {/* 오늘 총 공부시간 */}
          {session && (
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                오늘 총 {formatHM(todayTotalSeconds + elapsedSeconds)}
              </span>
            </div>
          )}

          {/* 원형 타이머 */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, position: 'relative' }}>
            <svg width="280" height="280" viewBox="0 0 280 280">
              <circle cx="140" cy="140" r="120" fill="none" stroke="var(--border)" strokeWidth="8" opacity="0.3" />
              <circle cx="140" cy="140" r="120" fill="none"
                stroke={session ? timerColor : subjectColor}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={session ? strokeDashoffset : circumference}
                transform="rotate(-90 140 140)"
                style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.5s ease' }}
              />
              <text x="140" y="125" textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: 44, fontWeight: 900, fill: isPaused ? 'var(--muted-foreground)' : 'var(--foreground)', fontFamily: 'monospace', opacity: isPaused ? 0.6 : 1 }}>
                {session ? displayTime : (timerMode === 'countdown' ? formatTime(inputHours * 3600 + inputMinutes * 60 + inputSeconds) : '00:00:00')}
              </text>
              <text x="140" y="165" textAnchor="middle" style={{ fontSize: 13, fill: isPaused ? 'var(--warning)' : 'var(--muted-foreground)' }}>
                {statusText}
              </text>
              {timerMode === 'stopwatch' && !session && !sessionEnded && (
                <text x="140" y="185" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--muted-foreground)' }}>
                  스톱워치 모드
                </text>
              )}
            </svg>
            {isPaused && session && (
              <div style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: 280, height: 280, borderRadius: '50%',
                border: '2px dashed var(--warning)',
                opacity: 0.5,
              }} />
            )}
          </div>

          {/* 세션 시작 전: 설정 */}
          {!session && !sessionEnded && (
            <>
              {/* 카운트다운 프리셋 */}
              {timerMode === 'countdown' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <label style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>시간</label>
                      <input type="number" min="0" max="23" value={inputHours}
                        onChange={e => setInputHours(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                        style={{ width: 60, textAlign: 'center', fontSize: 20, fontWeight: 700, padding: '8px 4px', borderRadius: 12 }} />
                    </div>
                    <span style={{ fontSize: 24, fontWeight: 700, marginTop: 16 }}>:</span>
                    <div style={{ textAlign: 'center' }}>
                      <label style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>분</label>
                      <input type="number" min="0" max="59" value={inputMinutes}
                        onChange={e => setInputMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                        style={{ width: 60, textAlign: 'center', fontSize: 20, fontWeight: 700, padding: '8px 4px', borderRadius: 12 }} />
                    </div>
                    <span style={{ fontSize: 24, fontWeight: 700, marginTop: 16 }}>:</span>
                    <div style={{ textAlign: 'center' }}>
                      <label style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>초</label>
                      <input type="number" min="0" max="59" value={inputSeconds}
                        onChange={e => setInputSeconds(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                        style={{ width: 60, textAlign: 'center', fontSize: 20, fontWeight: 700, padding: '8px 4px', borderRadius: 12 }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                    {PRESETS.map(p => {
                      const selected = (inputHours * 3600 + inputMinutes * 60 + inputSeconds) === p.seconds;
                      return (
                        <button key={p.seconds} onClick={() => handlePreset(p.seconds)} style={{
                          padding: '10px 4px', borderRadius: 12,
                          border: '1px solid var(--border)',
                          background: selected ? 'var(--accent)' : 'var(--card)',
                          color: selected ? '#fff' : 'var(--foreground)',
                          cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s', fontFamily: 'inherit',
                        }}>
                          <div style={{ fontSize: 18 }}>{p.emoji}</div>
                          <div>{p.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <button onClick={handleStartSession}
                disabled={timerMode === 'countdown' && (inputHours === 0 && inputMinutes === 0 && inputSeconds === 0)}
                style={{
                  width: '100%', padding: '16px', borderRadius: 16,
                  background: subjectColor, color: '#fff',
                  fontSize: 18, fontWeight: 800, border: 'none', cursor: 'pointer',
                  opacity: (timerMode === 'countdown' && (inputHours === 0 && inputMinutes === 0 && inputSeconds === 0)) ? 0.5 : 1,
                  transition: 'opacity 0.2s', fontFamily: 'inherit',
                }}>
                ▶ {selectedSubject} 공부 시작
              </button>

              {/* 스톱워치 팁 */}
              {timerMode === 'stopwatch' && (
                <div style={{
                  marginTop: 16, padding: 16, borderRadius: 12,
                  background: 'var(--card)', border: '1px solid var(--border)',
                }}>
                  <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--accent)' }}>💡 열품타 모드</p>
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
                    ⏱️ 시작 버튼을 누르면 시간이 올라갑니다<br/>
                    📱 다른 탭이나 앱으로 전환하면 자동 일시정지!<br/>
                    👥 아래에서 지금 공부 중인 친구를 확인하세요
                  </p>
                </div>
              )}
              {timerMode === 'countdown' && (
                <div style={{
                  marginTop: 16, padding: 16, borderRadius: 12,
                  background: 'var(--card)', border: '1px solid var(--border)',
                }}>
                  <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--accent)' }}>💡 카운트다운 모드</p>
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
                    🍅 <b>포모도로 기법</b>: 25분 집중 → 5분 휴식 반복<br/>
                    🔥 <b>80분 집중</b>: 수능 국어 시간과 동일하게 훈련!<br/>
                    ⏰ 완료되면 공부 시간이 자동 기록됩니다
                  </p>
                </div>
              )}
            </>
          )}

          {/* 세션 진행 중: 제어 버튼 */}
          {session && (
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 16 }}>
              {!isPaused ? (
                <button onClick={() => handlePauseSession('manual')} style={{
                  flex: 1, padding: 'var(--space-4)', borderRadius: 16,
                  background: 'var(--warning)', color: '#fff',
                  fontSize: 18, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                }}>⏸ 일시정지</button>
              ) : (
                <button onClick={handleResumeSession} style={{
                  flex: 1, padding: 'var(--space-4)', borderRadius: 16,
                  background: 'var(--success)', color: '#fff',
                  fontSize: 18, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                }}>▶ 계속</button>
              )}
              <button onClick={handleEndSession} style={{
                flex: 1, padding: '16px', borderRadius: 16,
                background: 'var(--destructive)', color: '#fff',
                fontSize: 18, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>⏹ 종료</button>
            </div>
          )}

          {/* 세션 완료 */}
          {sessionEnded && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{
                padding: 'var(--space-5)', borderRadius: 16,
                background: 'linear-gradient(135deg, var(--accent-lighter), var(--accent-light))',
                marginBottom: 'var(--space-4)', border: '1px solid var(--accent)',
              }}>
                <div style={{ fontSize: 40, marginBottom: 'var(--space-2)' }}>🎉</div>
                <p style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>공부 완료!</p>
                <p style={{ fontSize: 16, fontWeight: 700 }}>
                  {selectedSubject} · {formatHM(finalDuration)}
                </p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--success)', marginTop: 6 }}>✅ 기록이 저장되었습니다</p>
              </div>
              <button onClick={() => { setSessionEnded(false); setFinalDuration(0); setElapsedSeconds(0); }} style={{
                width: '100%', padding: 'var(--space-4)', borderRadius: 16,
                background: subjectColor, color: '#fff',
                fontSize: 'var(--text-base)', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>🔄 새로 시작</button>
            </div>
          )}

          {/* === 현재 공부 중인 학생들 === */}
          <div style={{
            marginTop: 16, padding: 16, borderRadius: 14,
            background: 'var(--card)', border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
                👥 현재 공부 중 <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 800 }}>{activeStudents.length}명</span>
              </div>
            </div>

            {activeStudents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted-foreground)', fontSize: 13 }}>
                지금 공부하는 친구가 없어요.<br/>
                첫 번째로 시작해볼까요? 🚀
              </div>
            ) : (
              <div style={{
                display: 'flex', gap: 12, overflowX: 'auto',
                paddingBottom: 8, WebkitOverflowScrolling: 'touch',
              }}>
                {activeStudents.map(s => {
                  const isMe = s.user_id === user?.id;
                  const studyHours = (s.today_total_seconds || 0) / 3600;
                  return (
                    <div key={s.id} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      minWidth: 80, maxWidth: 90,
                      padding: '10px 8px', borderRadius: 12,
                      background: isMe ? 'var(--accent-lighter)' : 'var(--neutral-50)',
                      border: isMe ? '2px solid var(--accent)' : '1px solid var(--border)',
                      flexShrink: 0,
                    }}>
                      <AvatarSVG
                        config={s.avatar_config || {}}
                        size={44}
                        studyStatus={s.is_paused ? 'paused' : 'active'}
                        studyHours={studyHours}
                      />
                      <div style={{
                        fontSize: 11, fontWeight: 700, marginTop: 6,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        maxWidth: '100%', textAlign: 'center',
                        color: 'var(--warm-800)',
                      }}>
                        {s.nickname || s.name}
                      </div>
                      <div style={{
                        fontSize: 10, color: subjectColor,
                        background: `${getSubjectColor(s.subject, subjects)}15`,
                        padding: '1px 6px', borderRadius: 4, marginTop: 2,
                        fontWeight: 600,
                      }}>
                        {s.subject}
                      </div>
                      <div style={{
                        fontSize: 12, fontWeight: 800, marginTop: 4,
                        color: s.is_paused ? 'var(--muted-foreground)' : 'var(--accent)',
                        fontFamily: 'monospace',
                      }}>
                        {formatTimeShort(s.today_total_seconds)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* === 통계 탭 === */}
      {tab === 'stats' && loadError && <ErrorState message={loadError} onRetry={loadStats} />}
      {tab === 'stats' && !loadError && (
        <div>
          <div className="s-tab-segment" style={{ marginBottom: 'var(--space-4)' }}>
            {[
              { key: 'daily', label: '일별' },
              { key: 'weekly', label: '주별' },
              { key: 'monthly', label: '월별' },
            ].map(p => (
              <button key={p.key} className={`s-tab-seg-item${statsPeriod === p.key ? ' active' : ''}`} onClick={() => setStatsPeriod(p.key)}>{p.label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <button onClick={() => moveDate(-1)} style={{
              padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
              background: 'var(--card)', cursor: 'pointer', fontSize: 'var(--text-base)', fontFamily: 'inherit',
            }}>←</button>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{getDateLabel()}</span>
            <button onClick={() => moveDate(1)} style={{
              padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
              background: 'var(--card)', cursor: 'pointer', fontSize: 'var(--text-base)', fontFamily: 'inherit',
            }}>→</button>
          </div>

          {statsData && (
            <>
              <div style={{
                textAlign: 'center', padding: 'var(--space-5)', borderRadius: 14,
                background: 'linear-gradient(135deg, var(--accent-lighter), var(--accent-light))',
                marginBottom: 'var(--space-4)',
              }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', marginBottom: 4 }}>총 공부 시간</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent)' }}>
                  {formatHM(statsData.total_seconds || 0)}
                </div>
              </div>

              {statsData.by_subject && statsData.by_subject.length > 0 ? (
                <div className="s-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--foreground)' }}>과목별 공부 시간</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {statsData.by_subject.map(s => {
                      const pct = maxSubjectSec > 0 ? (s.total_seconds / maxSubjectSec) * 100 : 0;
                      const color = getSubjectColor(s.subject, subjects);
                      return (
                        <div key={s.subject}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{getSubjectEmoji(s.subject)} {s.subject}</span>
                            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{formatHM(s.total_seconds)} ({s.sessions}회)</span>
                          </div>
                          <div style={{ height: 8, background: 'var(--neutral-50)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 4, background: color,
                              width: `${pct}%`, transition: 'width 0.5s ease',
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="s-card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>이 기간의 공부 기록이 없습니다</p>
                </div>
              )}

              {(statsPeriod === 'weekly' || statsPeriod === 'monthly') && statsData.by_day && statsData.by_day.length > 0 && (
                <div className="s-card" style={{ padding: 'var(--space-4)' }}>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--foreground)' }}>일별 추이</h3>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
                    {statsData.by_day.map(d => {
                      const maxDay = Math.max(...statsData.by_day.map(x => x.total_seconds));
                      const h = maxDay > 0 ? (d.total_seconds / maxDay) * 100 : 0;
                      const dt = new Date(d.study_date + 'T00:00:00');
                      return (
                        <div key={d.study_date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ fontSize: 9, color: 'var(--muted-foreground)', marginBottom: 2 }}>
                            {formatHM(d.total_seconds)}
                          </div>
                          <div style={{
                            width: '100%', maxWidth: 28, borderRadius: '4px 4px 0 0',
                            background: 'var(--accent)', height: `${Math.max(h, 4)}%`,
                            transition: 'height 0.5s ease', minHeight: 4,
                          }} />
                          <div style={{ fontSize: 9, color: 'var(--muted-foreground)', marginTop: 2 }}>
                            {dt.getDate()}{statsPeriod === 'weekly' ? `(${DAY_NAMES[dt.getDay()]})` : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {logList.length > 0 && (
            <div className="s-card" style={{ padding: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--foreground)' }}>기록 목록</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {logList.map(log => {
                  const color = getSubjectColor(log.subject, subjects);
                  const isEditing = editingLog === log.id;
                  return (
                    <div key={log.id} style={{
                      padding: '8px 10px', borderRadius: 'var(--radius)',
                      background: 'var(--neutral-50)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                        background: `${color}15`, color,
                      }}>{log.subject}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{log.study_date}</span>
                      {isEditing ? (
                        <>
                          <input type="number" value={editLogMin} onChange={e => setEditLogMin(parseInt(e.target.value) || 0)}
                            style={{ width: 50, fontSize: 12, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border)', textAlign: 'center' }} />
                          <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>분</span>
                          <button onClick={() => handleEditLog(log.id)} style={{
                            fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--success)', color: '#fff', border: 'none', cursor: 'pointer',
                          }}>저장</button>
                          <button onClick={() => setEditingLog(null)} style={{
                            fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--muted-foreground)', color: '#fff', border: 'none', cursor: 'pointer',
                          }}>취소</button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 'auto' }}>
                            {formatHM(log.duration)}
                          </span>
                          <button onClick={() => { setEditingLog(log.id); setEditLogMin(Math.round(log.duration / 60)); }} style={{
                            fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--border)', color: 'var(--neutral-600)', border: 'none', cursor: 'pointer',
                          }}>수정</button>
                          <button onClick={() => handleDeleteLog(log.id)} style={{
                            fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--destructive-light)', color: 'var(--destructive)', border: 'none', cursor: 'pointer',
                          }}>삭제</button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes timerPulse {
          0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
          50% { opacity: 0.3; transform: translateX(-50%) scale(1.05); }
        }
        @keyframes milestoneSlide {
          from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>

      <BottomTabBar />
    </div>
  );
}
