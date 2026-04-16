const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// 기본 과목 목록
const DEFAULT_SUBJECTS = ['국어', '영어', '수학', '사회', '과학', '기타'];

// KST 오늘 날짜
function getTodayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 세션 종료 공통 로직
async function endSessionAndSave(session) {
  const now = new Date();
  let pausedMs = session.total_paused_ms || 0;

  // 현재 일시정지 중이면 일시정지 시간 추가
  if (session.is_paused && session.pause_started_at) {
    pausedMs += now.getTime() - new Date(session.pause_started_at).getTime();
  }

  const totalMs = now.getTime() - new Date(session.started_at).getTime();
  let finalDuration = Math.max(0, Math.floor((totalMs - pausedMs) / 1000));

  // 12시간 상한
  finalDuration = Math.min(finalDuration, 43200);

  // study_logs에 저장 (10초 이상만)
  if (finalDuration >= 10) {
    const today = getTodayKST();
    await runInsert(
      'INSERT INTO study_logs (user_id, subject, duration, study_date, academy_id) VALUES (?, ?, ?, ?, ?)',
      [session.user_id, session.subject, finalDuration, today, session.academy_id]
    );
  }

  // 세션 종료 처리
  await runQuery(
    'UPDATE study_sessions SET is_active = false, ended_at = NOW(), final_duration = ?, is_paused = false, pause_started_at = NULL, total_paused_ms = ? WHERE id = ? AND academy_id = ?',
    [finalDuration, pausedMs, session.id, session.academy_id]
  );

  return finalDuration;
}

// ============================
// 기존 공부 기록 (study_logs) API
// ============================

// 공부 기록 저장
router.post('/logs', async (req, res) => {
  const { subject, duration, study_date } = req.body;
  if (!subject || !duration || duration <= 0) {
    return res.status(400).json({ error: '과목과 시간을 입력해주세요.' });
  }
  const date = study_date || getTodayKST();
  const id = await runInsert(
    'INSERT INTO study_logs (user_id, subject, duration, study_date, academy_id) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, subject.trim(), Math.round(duration), date, req.academyId]
  );
  res.json({ message: '공부 기록이 저장되었습니다.', id });
});

// 일별 기록 조회
router.get('/logs/daily', async (req, res) => {
  const { date } = req.query;
  const targetDate = date || getTodayKST();
  const logs = await getAll(
    `SELECT subject, SUM(duration) as total_seconds, COUNT(*) as sessions
     FROM study_logs WHERE user_id = ? AND study_date = ? AND academy_id = ?
     GROUP BY subject ORDER BY total_seconds DESC`,
    [req.user.id, targetDate, req.academyId]
  );
  const dayTotal = logs.reduce((sum, l) => sum + l.total_seconds, 0);
  res.json({ date: targetDate, logs, total_seconds: dayTotal });
});

// 주별 기록 조회
router.get('/logs/weekly', async (req, res) => {
  const { date } = req.query;
  const target = date ? new Date(date + 'T00:00:00') : new Date();
  const day = target.getDay();
  const monday = new Date(target);
  monday.setDate(target.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startStr = monday.toISOString().slice(0, 10);
  const endStr = sunday.toISOString().slice(0, 10);

  const bySubject = await getAll(
    `SELECT subject, SUM(duration) as total_seconds, COUNT(*) as sessions
     FROM study_logs WHERE user_id = ? AND study_date >= ? AND study_date <= ? AND academy_id = ?
     GROUP BY subject ORDER BY total_seconds DESC`,
    [req.user.id, startStr, endStr, req.academyId]
  );

  const byDay = await getAll(
    `SELECT study_date, SUM(duration) as total_seconds
     FROM study_logs WHERE user_id = ? AND study_date >= ? AND study_date <= ? AND academy_id = ?
     GROUP BY study_date ORDER BY study_date ASC`,
    [req.user.id, startStr, endStr, req.academyId]
  );

  const weekTotal = bySubject.reduce((sum, l) => sum + l.total_seconds, 0);
  res.json({ start: startStr, end: endStr, by_subject: bySubject, by_day: byDay, total_seconds: weekTotal });
});

// 월별 기록 조회
router.get('/logs/monthly', async (req, res) => {
  const { year, month } = req.query;
  const y = year || new Date().getFullYear();
  const m = month || (new Date().getMonth() + 1);
  const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
  const nextMonth = parseInt(m) + 1;
  const endStr = nextMonth > 12
    ? `${parseInt(y) + 1}-01-01`
    : `${y}-${String(nextMonth).padStart(2, '0')}-01`;

  const bySubject = await getAll(
    `SELECT subject, SUM(duration) as total_seconds, COUNT(*) as sessions
     FROM study_logs WHERE user_id = ? AND study_date >= ? AND study_date < ? AND academy_id = ?
     GROUP BY subject ORDER BY total_seconds DESC`,
    [req.user.id, startStr, endStr, req.academyId]
  );

  const byDay = await getAll(
    `SELECT study_date, SUM(duration) as total_seconds
     FROM study_logs WHERE user_id = ? AND study_date >= ? AND study_date < ? AND academy_id = ?
     GROUP BY study_date ORDER BY study_date ASC`,
    [req.user.id, startStr, endStr, req.academyId]
  );

  const monthTotal = bySubject.reduce((sum, l) => sum + l.total_seconds, 0);
  res.json({ year: y, month: m, by_subject: bySubject, by_day: byDay, total_seconds: monthTotal });
});

// 전체 누적 통계
router.get('/logs/total', async (req, res) => {
  const bySubject = await getAll(
    `SELECT subject, SUM(duration) as total_seconds, COUNT(*) as sessions
     FROM study_logs WHERE user_id = ? AND academy_id = ?
     GROUP BY subject ORDER BY total_seconds DESC`,
    [req.user.id, req.academyId]
  );
  const total = bySubject.reduce((sum, l) => sum + l.total_seconds, 0);
  res.json({ by_subject: bySubject, total_seconds: total });
});

// 개별 기록 목록 (날짜 범위)
router.get('/logs/list', async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.json([]);
  const logs = await getAll(
    `SELECT id, subject, duration, study_date, created_at
     FROM study_logs WHERE user_id = ? AND study_date >= ? AND study_date <= ? AND academy_id = ?
     ORDER BY study_date DESC, created_at DESC`,
    [req.user.id, start, end, req.academyId]
  );
  res.json(logs);
});

// 기록 수정
router.put('/logs/:id', async (req, res) => {
  const { subject, duration } = req.body;
  const log = await getOne('SELECT * FROM study_logs WHERE id = ? AND user_id = ? AND academy_id = ?', [req.params.id, req.user.id, req.academyId]);
  if (!log) return res.status(404).json({ error: '기록을 찾을 수 없습니다.' });
  await runQuery(
    'UPDATE study_logs SET subject = ?, duration = ? WHERE id = ? AND academy_id = ?',
    [subject || log.subject, duration || log.duration, req.params.id, req.academyId]
  );
  res.json({ message: '수정되었습니다.' });
});

// 기록 삭제
router.delete('/logs/:id', async (req, res) => {
  const log = await getOne('SELECT * FROM study_logs WHERE id = ? AND user_id = ? AND academy_id = ?', [req.params.id, req.user.id, req.academyId]);
  if (!log) return res.status(404).json({ error: '기록을 찾을 수 없습니다.' });
  await runQuery('DELETE FROM study_logs WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  res.json({ message: '삭제되었습니다.' });
});

// ============================
// 공부시간 랭킹
// ============================

router.get('/rankings', async (req, res) => {
  const { type = 'today' } = req.query;
  const today = getTodayKST();

  let dateCondition = '';
  let dateParams = [];

  if (type === 'today') {
    dateCondition = 'AND sl.study_date = ?';
    dateParams = [today];
  } else if (type === 'weekly') {
    const kst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    const d = new Date(kst);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const monday = d.toISOString().slice(0, 10);
    dateCondition = 'AND sl.study_date >= ?';
    dateParams = [monday];
  } else if (type === 'monthly') {
    const monthStart = today.slice(0, 7) + '-01';
    dateCondition = 'AND sl.study_date >= ?';
    dateParams = [monthStart];
  }

  const rows = await getAll(
    `SELECT sl.user_id, u.name, s.school, s.grade,
            sc.avatar_config, sc.nickname,
            SUM(sl.duration) as total_seconds, COUNT(*) as sessions
     FROM study_logs sl
     JOIN users u ON sl.user_id = u.id
     LEFT JOIN students s ON s.user_id = u.id AND s.academy_id = ?
     LEFT JOIN student_characters sc ON sc.student_id = s.id
     WHERE u.role = 'student'
       AND sl.academy_id = ?
       AND (s.school NOT IN ('조교','선생님') OR s.school IS NULL)
       ${dateCondition}
     GROUP BY sl.user_id
     ORDER BY total_seconds DESC
     LIMIT 50`,
    [req.academyId, req.academyId, ...dateParams]
  );

  const rankings = rows.map((r, i) => ({
    rank: i + 1,
    user_id: r.user_id,
    name: r.name,
    school: r.school,
    grade: r.grade,
    avatar_config: r.avatar_config ? JSON.parse(r.avatar_config) : null,
    nickname: r.nickname,
    total_seconds: r.total_seconds,
    sessions: r.sessions,
  }));

  let myRank = null;
  let myInfo = null;
  const myRow = rankings.find(r => r.user_id === req.user.id);
  if (myRow) {
    myRank = myRow.rank;
    myInfo = myRow;
  } else {
    const me = await getOne(
      `SELECT SUM(duration) as total_seconds, COUNT(*) as sessions
       FROM study_logs sl
       WHERE sl.user_id = ? AND sl.academy_id = ? ${dateCondition}`,
      [req.user.id, req.academyId, ...dateParams]
    );
    if (me && me.total_seconds > 0) {
      const ahead = await getOne(
        `SELECT COUNT(*) as cnt FROM (
          SELECT sl2.user_id
          FROM study_logs sl2
          JOIN users u2 ON sl2.user_id = u2.id
          LEFT JOIN students s2 ON s2.user_id = u2.id AND s2.academy_id = ?
          WHERE u2.role = 'student'
            AND sl2.academy_id = ?
            AND (s2.school NOT IN ('조교','선생님') OR s2.school IS NULL)
            ${dateCondition.replace(/sl\./g, 'sl2.')}
          GROUP BY sl2.user_id
          HAVING SUM(sl2.duration) > ?
        ) sub`,
        [req.academyId, req.academyId, ...dateParams, me.total_seconds]
      );
      myRank = (ahead ? ahead.cnt : 0) + 1;
      myInfo = { total_seconds: me.total_seconds, sessions: me.sessions };
    }
  }

  res.json({ rankings, myRank, myInfo, type });
});

// ============================
// 실시간 공부 세션 (열품타) API
// ============================

// 세션 시작
router.post('/sessions/start', async (req, res) => {
  try {
    const { subject = '기타', timerType = 'stopwatch', presetSeconds = 0 } = req.body;
    if (typeof subject !== 'string' || subject.trim().length === 0 || subject.trim().length > 20) {
      return res.status(400).json({ error: '과목명은 1-20자여야 합니다.' });
    }

    // 기존 활성 세션 종료
    const existing = await getOne(
      'SELECT * FROM study_sessions WHERE user_id = ? AND is_active = true AND academy_id = ?',
      [req.user.id, req.academyId]
    );
    if (existing) {
      await endSessionAndSave(existing);
    }

    // 새 세션 생성
    const id = await runInsert(
      'INSERT INTO study_sessions (user_id, subject, timer_type, preset_seconds, academy_id) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, subject.trim(), timerType === 'countdown' ? 'countdown' : 'stopwatch', Math.max(0, Math.round(presetSeconds)), req.academyId]
    );

    const session = await getOne('SELECT * FROM study_sessions WHERE id = ? AND academy_id = ?', [id, req.academyId]);
    res.json({ session });
  } catch (e) {
    console.error('세션 시작 오류:', e);
    res.status(500).json({ error: '세션 시작에 실패했습니다.' });
  }
});

// 하트비트
router.post('/sessions/heartbeat', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId가 필요합니다.' });

    const session = await getOne(
      'SELECT * FROM study_sessions WHERE id = ? AND user_id = ? AND is_active = true AND academy_id = ?',
      [sessionId, req.user.id, req.academyId]
    );
    if (!session) return res.status(404).json({ error: '활성 세션을 찾을 수 없습니다.' });

    const now = new Date();
    const lastHb = new Date(session.last_heartbeat_at);
    const gapMs = now.getTime() - lastHb.getTime();

    // 90초 이상 갭이면 갭 시간을 일시정지로 처리
    if (gapMs > 90000 && !session.is_paused) {
      const newPausedMs = (session.total_paused_ms || 0) + gapMs;
      await runQuery(
        'UPDATE study_sessions SET last_heartbeat_at = NOW(), total_paused_ms = ? WHERE id = ? AND academy_id = ?',
        [newPausedMs, sessionId, req.academyId]
      );
      return res.json({ status: 'gap_detected', pausedMs: newPausedMs });
    }

    await runQuery(
      'UPDATE study_sessions SET last_heartbeat_at = NOW() WHERE id = ? AND academy_id = ?',
      [sessionId, req.academyId]
    );
    res.json({ status: session.is_paused ? 'paused' : 'active' });
  } catch (e) {
    console.error('하트비트 오류:', e);
    res.status(500).json({ error: '하트비트 처리에 실패했습니다.' });
  }
});

// 일시정지
router.post('/sessions/pause', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId가 필요합니다.' });

    const session = await getOne(
      'SELECT * FROM study_sessions WHERE id = ? AND user_id = ? AND is_active = true AND academy_id = ?',
      [sessionId, req.user.id, req.academyId]
    );
    if (!session) return res.status(404).json({ error: '활성 세션을 찾을 수 없습니다.' });
    if (session.is_paused) return res.json({ message: '이미 일시정지 상태입니다.' });

    await runQuery(
      'UPDATE study_sessions SET is_paused = true, pause_started_at = NOW(), last_heartbeat_at = NOW() WHERE id = ? AND academy_id = ?',
      [sessionId, req.academyId]
    );
    res.json({ message: '일시정지되었습니다.' });
  } catch (e) {
    console.error('일시정지 오류:', e);
    res.status(500).json({ error: '일시정지에 실패했습니다.' });
  }
});

// 재개
router.post('/sessions/resume', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId가 필요합니다.' });

    const session = await getOne(
      'SELECT * FROM study_sessions WHERE id = ? AND user_id = ? AND is_active = true AND academy_id = ?',
      [sessionId, req.user.id, req.academyId]
    );
    if (!session) return res.status(404).json({ error: '활성 세션을 찾을 수 없습니다.' });
    if (!session.is_paused) return res.json({ message: '일시정지 상태가 아닙니다.' });

    // 일시정지 시간 계산
    let addedPauseMs = 0;
    if (session.pause_started_at) {
      addedPauseMs = Date.now() - new Date(session.pause_started_at).getTime();
    }
    const newPausedMs = (session.total_paused_ms || 0) + addedPauseMs;

    await runQuery(
      'UPDATE study_sessions SET is_paused = false, pause_started_at = NULL, total_paused_ms = ?, last_heartbeat_at = NOW() WHERE id = ? AND academy_id = ?',
      [newPausedMs, sessionId, req.academyId]
    );
    res.json({ message: '재개되었습니다.', total_paused_ms: newPausedMs });
  } catch (e) {
    console.error('재개 오류:', e);
    res.status(500).json({ error: '재개에 실패했습니다.' });
  }
});

// 세션 종료
router.post('/sessions/end', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId가 필요합니다.' });

    const session = await getOne(
      'SELECT * FROM study_sessions WHERE id = ? AND user_id = ? AND is_active = true AND academy_id = ?',
      [sessionId, req.user.id, req.academyId]
    );
    if (!session) return res.status(404).json({ error: '활성 세션을 찾을 수 없습니다.' });

    const finalDuration = await endSessionAndSave(session);
    res.json({ message: '세션이 종료되었습니다.', finalDuration });
  } catch (e) {
    console.error('세션 종료 오류:', e);
    res.status(500).json({ error: '세션 종료에 실패했습니다.' });
  }
});

// 현재 공부 중인 학생 목록
router.get('/sessions/active', async (req, res) => {
  try {
    const rows = await getAll(
      `SELECT ss.id, ss.user_id, ss.subject, ss.started_at, ss.is_paused,
              ss.total_paused_ms, ss.last_heartbeat_at, ss.timer_type, ss.pause_started_at,
              u.name, s.school, s.grade,
              sc.avatar_config, sc.nickname
       FROM study_sessions ss
       JOIN users u ON ss.user_id = u.id
       LEFT JOIN students s ON s.user_id = u.id AND s.academy_id = ?
       LEFT JOIN student_characters sc ON sc.student_id = s.id
       WHERE ss.is_active = true
         AND ss.academy_id = ?
         AND ss.last_heartbeat_at > NOW() - INTERVAL '90 seconds'
         AND u.role = 'student'
         AND (s.school NOT IN ('조교','선생님') OR s.school IS NULL)
       ORDER BY ss.started_at ASC`,
      [req.academyId, req.academyId]
    );

    // 오늘 총 공부시간도 함께 조회
    const today = getTodayKST();
    const todayLogs = await getAll(
      `SELECT user_id, SUM(duration) as today_total
       FROM study_logs WHERE study_date = ? AND academy_id = ?
       GROUP BY user_id`,
      [today, req.academyId]
    );
    const todayMap = {};
    todayLogs.forEach(l => { todayMap[l.user_id] = l.today_total; });

    const sessions = rows.map(r => {
      // 현재 세션의 경과 시간 (서버 기준 계산)
      const now = Date.now();
      const startedAt = new Date(r.started_at).getTime();
      let pausedMs = r.total_paused_ms || 0;
      if (r.is_paused && r.pause_started_at) {
        pausedMs += now - new Date(r.pause_started_at).getTime();
      }
      const currentSessionSeconds = Math.max(0, Math.floor((now - startedAt - pausedMs) / 1000));
      const todayTotalSeconds = (todayMap[r.user_id] || 0) + currentSessionSeconds;

      return {
        id: r.id,
        user_id: r.user_id,
        subject: r.subject,
        started_at: r.started_at,
        is_paused: r.is_paused,
        timer_type: r.timer_type,
        current_session_seconds: currentSessionSeconds,
        today_total_seconds: todayTotalSeconds,
        name: r.name,
        school: r.school,
        grade: r.grade,
        avatar_config: r.avatar_config ? JSON.parse(r.avatar_config) : null,
        nickname: r.nickname,
      };
    });

    res.json({ sessions });
  } catch (e) {
    console.error('활성 세션 조회 오류:', e);
    res.status(500).json({ error: '활성 세션 조회에 실패했습니다.' });
  }
});

// 내 활성 세션 조회
router.get('/sessions/my', async (req, res) => {
  try {
    const session = await getOne(
      'SELECT * FROM study_sessions WHERE user_id = ? AND is_active = true AND academy_id = ?',
      [req.user.id, req.academyId]
    );
    if (!session) return res.json({ session: null });

    // 하트비트 만료 체크
    const lastHb = new Date(session.last_heartbeat_at);
    if (Date.now() - lastHb.getTime() > 90000) {
      // 만료된 세션 - 종료 처리
      await endSessionAndSave(session);
      return res.json({ session: null });
    }

    // 오늘 총 공부시간
    const today = getTodayKST();
    const todayLog = await getOne(
      'SELECT SUM(duration) as today_total FROM study_logs WHERE user_id = ? AND study_date = ? AND academy_id = ?',
      [req.user.id, today, req.academyId]
    );

    res.json({
      session,
      today_total_seconds: todayLog?.today_total || 0,
    });
  } catch (e) {
    console.error('내 세션 조회 오류:', e);
    res.status(500).json({ error: '세션 조회에 실패했습니다.' });
  }
});

// ============================
// 관리자 API
// ============================

// 관리자: 모든 활성 세션 조회
router.get('/admin/sessions', requireAdmin, async (req, res) => {
  try {
    const rows = await getAll(
      `SELECT ss.*, u.name, s.school, s.grade, sc.nickname
       FROM study_sessions ss
       JOIN users u ON ss.user_id = u.id
       LEFT JOIN students s ON s.user_id = u.id AND s.academy_id = ?
       LEFT JOIN student_characters sc ON sc.student_id = s.id
       WHERE ss.is_active = true AND ss.academy_id = ?
       ORDER BY ss.started_at ASC`,
      [req.academyId, req.academyId]
    );

    const sessions = rows.map(r => {
      const now = Date.now();
      const startedAt = new Date(r.started_at).getTime();
      let pausedMs = r.total_paused_ms || 0;
      if (r.is_paused && r.pause_started_at) {
        pausedMs += now - new Date(r.pause_started_at).getTime();
      }
      const currentSeconds = Math.max(0, Math.floor((now - startedAt - pausedMs) / 1000));
      const lastHbAgo = Math.floor((now - new Date(r.last_heartbeat_at).getTime()) / 1000);

      return {
        id: r.id,
        user_id: r.user_id,
        name: r.name,
        nickname: r.nickname,
        school: r.school,
        grade: r.grade,
        subject: r.subject,
        timer_type: r.timer_type,
        started_at: r.started_at,
        is_paused: r.is_paused,
        current_seconds: currentSeconds,
        last_heartbeat_ago: lastHbAgo,
        suspicious: currentSeconds > 21600 && !r.is_paused, // 6시간+
      };
    });

    res.json({ sessions });
  } catch (e) {
    console.error('관리자 세션 조회 오류:', e);
    res.status(500).json({ error: '조회 실패' });
  }
});

// 관리자: 세션 강제 종료
router.post('/admin/sessions/:id/end', requireAdmin, async (req, res) => {
  try {
    const session = await getOne('SELECT * FROM study_sessions WHERE id = ? AND is_active = true AND academy_id = ?', [req.params.id, req.academyId]);
    if (!session) return res.status(404).json({ error: '활성 세션을 찾을 수 없습니다.' });

    const finalDuration = await endSessionAndSave(session);
    res.json({ message: '세션이 강제 종료되었습니다.', finalDuration });
  } catch (e) {
    console.error('세션 강제 종료 오류:', e);
    res.status(500).json({ error: '강제 종료 실패' });
  }
});

// 관리자: 공부 통계
router.get('/admin/study-stats', requireAdmin, async (req, res) => {
  try {
    const today = getTodayKST();
    const kst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    const d = new Date(kst);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const weekStart = d.toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';

    // 오늘 통계
    const todayStats = await getAll(
      `SELECT sl.user_id, u.name, s.school, s.grade, sc.nickname,
              SUM(sl.duration) as total_seconds, COUNT(*) as sessions
       FROM study_logs sl
       JOIN users u ON sl.user_id = u.id
       LEFT JOIN students s ON s.user_id = u.id AND s.academy_id = ?
       LEFT JOIN student_characters sc ON sc.student_id = s.id
       WHERE sl.study_date = ? AND u.role = 'student' AND sl.academy_id = ?
       GROUP BY sl.user_id
       ORDER BY total_seconds DESC`,
      [req.academyId, today, req.academyId]
    );

    // 주간 총합
    const weekTotal = await getOne(
      `SELECT SUM(duration) as total, COUNT(DISTINCT user_id) as students
       FROM study_logs WHERE study_date >= ? AND academy_id = ?`,
      [weekStart, req.academyId]
    );

    // 월간 총합
    const monthTotal = await getOne(
      `SELECT SUM(duration) as total, COUNT(DISTINCT user_id) as students
       FROM study_logs WHERE study_date >= ? AND academy_id = ?`,
      [monthStart, req.academyId]
    );

    // 현재 활성 세션 수
    const activeCount = await getOne(
      `SELECT COUNT(*) as cnt FROM study_sessions
       WHERE is_active = true AND last_heartbeat_at > NOW() - INTERVAL '90 seconds' AND academy_id = ?`,
      [req.academyId]
    );

    res.json({
      today: todayStats,
      week_total: weekTotal?.total || 0,
      week_students: weekTotal?.students || 0,
      month_total: monthTotal?.total || 0,
      month_students: monthTotal?.students || 0,
      active_sessions: activeCount?.cnt || 0,
    });
  } catch (e) {
    console.error('통계 조회 오류:', e);
    res.status(500).json({ error: '통계 조회 실패' });
  }
});

// 관리자: 공부 기록 삭제
router.delete('/admin/study-logs/:id', requireAdmin, async (req, res) => {
  try {
    const log = await getOne('SELECT * FROM study_logs WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!log) return res.status(404).json({ error: '기록을 찾을 수 없습니다.' });
    await runQuery('DELETE FROM study_logs WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    res.json({ message: '기록이 삭제되었습니다.' });
  } catch (e) {
    console.error('기록 삭제 오류:', e);
    res.status(500).json({ error: '삭제 실패' });
  }
});

// ============================
// 세션 자동 만료 (60초마다 실행)
// ============================
setInterval(async () => {
  try {
    const expired = await getAll(
      `SELECT * FROM study_sessions
       /* 배경 cron job — academy_id 무관, 모든 테넌트 대상으로 만료 세션 정리 */
       WHERE is_active = true
         AND last_heartbeat_at < NOW() - INTERVAL '90 seconds'`
    );

    for (const session of expired) {
      try {
        await endSessionAndSave(session);
      } catch (e) {
        console.error(`세션 #${session.id} 자동 만료 실패:`, e.message);
      }
    }
  } catch (e) {
    // 테이블이 아직 없을 수 있으므로 조용히 무시
  }
}, 60000);

module.exports = router;
