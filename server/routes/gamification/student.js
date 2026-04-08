const express = require('express');
const router = express.Router();
const { runQuery, runInsert, getOne, getAll } = require('../../db/database');
const { authenticateToken } = require('../../middleware/auth');
const { getLevelInfo, checkAndGrantTitles, rankingCache, getTodayKST } = require('./utils');

// 게임 참여 가능한 사용자인지 확인 (조교/선생님만 차단, 관리자는 허용)
async function getGameStudent(req) {
  let student = await getOne(
    "SELECT s.id, s.school FROM students s WHERE s.user_id = ? AND s.academy_id = ?",
    [req.user.id, req.academyId]
  );
  // 관리자는 학생 레코드가 없으면 자동 생성 (랭킹에는 제외됨)
  if (!student && req.user.role === 'admin') {
    await runQuery(
      "INSERT INTO students (user_id, school, grade, parent_name, parent_phone, academy_id) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
      [req.user.id, '관리자', '관리자', '', '', req.academyId]
    );
    student = await getOne("SELECT s.id, s.school FROM students s WHERE s.user_id = ? AND s.academy_id = ?", [req.user.id, req.academyId]);
  }
  // 조교/선생님은 차단
  if (student && ['조교', '선생님'].includes(student.school)) return null;
  return student || null;
}

// 내 캐릭터 정보
router.get('/my-character', authenticateToken, async (req, res) => {
  try {
    const student = await getGameStudent(req);
    if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.', notStudent: true });

    let character = await getOne(
      `SELECT sc.*, COALESCE(c.name, '캐릭터') as char_name, COALESCE(c.emoji, '🐯') as emoji, COALESCE(c.description, '') as char_description
       FROM student_characters sc
       LEFT JOIN characters c ON sc.character_id = c.id AND (c.academy_id = ? OR c.academy_id = 0)
       WHERE sc.student_id = ? AND sc.academy_id = ?`,
      [req.academyId, student.id, req.academyId]
    );

    if (!character) {
      const firstChar = await getOne('SELECT id FROM characters WHERE (academy_id = ? OR academy_id = 0) ORDER BY id LIMIT 1', [req.academyId]);
      const charId = firstChar ? firstChar.id : 1;
      await runInsert(
        'INSERT INTO student_characters (student_id, character_id, xp, level, points, academy_id) VALUES (?, ?, 0, 1, 0, ?)',
        [student.id, charId, req.academyId]
      );
      character = await getOne(
        `SELECT sc.*, COALESCE(c.name, '캐릭터') as char_name, COALESCE(c.emoji, '🐯') as emoji, COALESCE(c.description, '') as char_description
         FROM student_characters sc
         LEFT JOIN characters c ON sc.character_id = c.id AND (c.academy_id = ? OR c.academy_id = 0)
         WHERE sc.student_id = ? AND sc.academy_id = ?`,
        [req.academyId, student.id, req.academyId]
      );
    }

    if (!character) return res.status(500).json({ error: '캐릭터 생성 실패' });

    const levelInfo = getLevelInfo(character.xp);

    let titleName = null;
    if (character.selected_title_id) {
      const title = await getOne('SELECT name FROM titles WHERE id = ? AND (academy_id = ? OR academy_id = 0)', [character.selected_title_id, req.academyId]);
      if (title) titleName = title.name;
    }

    // 오늘 퀴즈 문제 수 확인
    const today = getTodayKST();
    const todayQuizResult = await getOne(
      "SELECT COALESCE(SUM(total_questions), 0) as cnt FROM vocab_game_logs WHERE student_id = ? AND date(played_at) = date(?) AND academy_id = ?",
      [student.id, today, req.academyId]
    );
    const todayQuizCount = todayQuizResult ? todayQuizResult.cnt : 0;
    const limitSetting = await getOne("SELECT value FROM game_settings WHERE key = 'daily_quiz_limit' AND academy_id = ?", [req.academyId]);
    const dailyQuizLimit = limitSetting ? parseInt(limitSetting.value) || 50 : 50;

    // 접속 보상 확인 (주말 기준)
    const now = new Date();
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dayOfWeek = kstNow.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    let dailyBonusClaimed = false;
    if (isWeekend) {
      const weekendStart = new Date(kstNow);
      if (dayOfWeek === 0) weekendStart.setUTCDate(weekendStart.getUTCDate() - 1);
      const satDate = weekendStart.toISOString().split('T')[0];
      const weekendLogin = await getOne(
        "SELECT id FROM xp_logs WHERE student_id = $1 AND source = 'daily_login' AND (created_at AT TIME ZONE 'Asia/Seoul')::date >= $2::date AND academy_id = $3",
        [student.id, satDate, req.academyId]
      );
      dailyBonusClaimed = !!weekendLogin;
    }

    // avatar_config JSON 파싱
    let avatarConfig = {};
    try { avatarConfig = character.avatar_config ? JSON.parse(character.avatar_config) : {}; } catch(e) {}

    res.json({ ...character, avatarConfig, levelInfo, titleName, todayQuizCount, dailyQuizLimit, dailyBonusClaimed, isWeekend, selectedStage: character.selected_stage || '' });
  } catch (e) {
    console.error('my-character error:', e);
    res.status(500).json({ error: 'my-character 오류: ' + e.message });
  }
});

// 성장 단계 선택
router.put('/my-stage', authenticateToken, async (req, res) => {
  const { stage } = req.body; // stage name or '' for auto
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, req.academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

  // 선택한 단계가 현재 레벨에서 달성 가능한지 검증
  if (stage) {
    const levelInfo = getLevelInfo(sc.xp);
    const allStages = [
      { level: 1, stage: '국어 응애' }, { level: 5, stage: '국어 기어다니기' },
      { level: 10, stage: '국어 걸음마' }, { level: 15, stage: '국어 초딩' },
      { level: 20, stage: '국어 중딩' }, { level: 25, stage: '나 국어 좀 할지도?' },
      { level: 30, stage: "맞춤법 빌런 '외않되?'" }, { level: 35, stage: '국어 대학생' },
      { level: 40, stage: '국어 먹는 하마' }, { level: 45, stage: '국어 마동석' },
      { level: 50, stage: '국어의 절대자' }, { level: 55, stage: '국립국어원 취직 예정' },
      { level: 60, stage: '국어의 지배자' }, { level: 65, stage: '인간 국어사전' },
      { level: 70, stage: '국어의 레전드' }, { level: 75, stage: '국어의 신' },
      { level: 80, stage: '정철 술친구' }, { level: 85, stage: '세종대왕 절친' },
      { level: 90, stage: '훈민정음 원본' }, { level: 95, stage: '언어의 빅뱅' },
      { level: 100, stage: '강인쌤과 동급' },
    ];
    const found = allStages.find(s => s.stage === stage);
    if (!found) return res.status(400).json({ error: '존재하지 않는 단계입니다.' });
    if (levelInfo.level < found.level) return res.status(400).json({ error: '아직 달성하지 않은 단계입니다.' });
  }

  await runQuery('UPDATE student_characters SET selected_stage = ? WHERE student_id = ? AND academy_id = ?', [stage || '', student.id, req.academyId]);
  res.json({ message: stage ? `단계가 "${stage}"(으)로 변경되었습니다.` : '자동 단계로 변경되었습니다.' });
});

// 아바타 커스터마이징 저장
router.put('/my-avatar', authenticateToken, async (req, res) => {
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  const { avatarConfig, nickname } = req.body;
  if (!avatarConfig) return res.status(400).json({ error: '아바타 설정이 필요합니다.' });

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, req.academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

  // 주 1회 변경 제한 (첫 설정은 허용)
  if (sc.avatar_config && sc.avatar_config !== '{}') {
    const lastChange = await getOne(
      "SELECT id FROM xp_logs WHERE student_id = ? AND source = 'avatar_change' AND created_at >= datetime('now', '-7 days') AND academy_id = ?",
      [student.id, req.academyId]
    );
    if (lastChange) {
      return res.status(400).json({ error: '아바타는 주 1회만 변경할 수 있습니다! 다음 주에 다시 시도해주세요.' });
    }
    // 변경 기록 남기기
    await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, 0, 'avatar_change', '아바타 변경', ?)",
      [student.id, req.academyId]);
  }

  // 닉네임 유효성
  if (nickname !== undefined) {
    const trimmed = (nickname || '').trim();
    if (trimmed.length > 10) return res.status(400).json({ error: '닉네임은 10자 이하로 입력해주세요.' });
    await runQuery('UPDATE student_characters SET avatar_config = ?, nickname = ? WHERE student_id = ? AND academy_id = ?',
      [JSON.stringify(avatarConfig), trimmed, student.id, req.academyId]);
  } else {
    await runQuery('UPDATE student_characters SET avatar_config = ? WHERE student_id = ? AND academy_id = ?',
      [JSON.stringify(avatarConfig), student.id, req.academyId]);
  }

  res.json({ message: '아바타가 저장되었습니다!', avatarConfig });
});

// 닉네임만 변경 (주 1회 제한, 아바타 변경과 별도)
router.put('/my-nickname', authenticateToken, async (req, res) => {
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  const { nickname } = req.body;
  const trimmed = (nickname || '').trim();
  if (trimmed.length > 10) return res.status(400).json({ error: '닉네임은 10자 이하로 입력해주세요.' });
  if (trimmed.length < 1) return res.status(400).json({ error: '닉네임을 입력해주세요.' });

  // 주 1회 제한 체크 (최근 7일 이내 닉네임 변경 기록)
  const recentChange = await getOne(
    "SELECT id FROM xp_logs WHERE student_id = ? AND source = 'nickname_change' AND created_at >= datetime('now', '-7 days') AND academy_id = ?",
    [student.id, req.academyId]
  );
  if (recentChange) {
    return res.status(400).json({ error: '닉네임은 주 1회만 변경할 수 있습니다.' });
  }

  await runQuery('UPDATE student_characters SET nickname = ? WHERE student_id = ? AND academy_id = ?', [trimmed, student.id, req.academyId]);
  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, 0, 'nickname_change', ?, ?)",
    [student.id, `닉네임 변경: ${trimmed}`, req.academyId]);

  res.json({ message: '닉네임이 변경되었습니다!', nickname: trimmed });
});

// 전체 칭호 목록 (학생이 어떤 칭호가 있는지 확인)
router.get('/all-titles', authenticateToken, async (req, res) => {
  const titles = await getAll('SELECT * FROM titles WHERE (academy_id = ? OR academy_id = 0) ORDER BY condition_value ASC', [req.academyId]);
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  let myTitleIds = [];
  if (student) {
    const myTitles = await getAll('SELECT title_id FROM student_titles WHERE student_id = ? AND academy_id = ?', [student.id, req.academyId]);
    myTitleIds = myTitles.map(t => t.title_id);
  }
  res.json(titles.map(t => {
    const earned = myTitleIds.includes(t.id);
    // 히든 칭호는 조건 숨김
    if (t.is_hidden) {
      return {
        ...t,
        earned,
        description: earned ? t.description : '???',
        condition_type: earned ? t.condition_type : 'hidden',
        condition_value: earned ? t.condition_value : 0,
      };
    }
    return { ...t, earned };
  }));
});

// 출석 보상 중복 방지 락
const dailyBonusLocks = new Set();

// 접속 보상 수령 (토/일만 가능)
router.post('/daily-bonus', authenticateToken, async (req, res) => {
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  // 동시 요청 방지 (인메모리 락)
  if (dailyBonusLocks.has(student.id)) {
    return res.status(429).json({ error: '처리 중입니다. 잠시 후 다시 시도하세요.' });
  }
  dailyBonusLocks.add(student.id);

  try {
    // 토요일(6), 일요일(0)만 출석 가능
    const now = new Date();
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dayOfWeek = kstNow.getUTCDay(); // 0=일, 6=토
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      return res.status(400).json({ error: '출석 보너스는 토요일/일요일에만 받을 수 있습니다! 🗓️' });
    }

    // 이번 주말(토~일) 중 이미 받았는지 확인
    const weekendStart = new Date(kstNow);
    if (dayOfWeek === 0) weekendStart.setUTCDate(weekendStart.getUTCDate() - 1);
    const satDate = weekendStart.toISOString().split('T')[0];

    const already = await getOne(
      "SELECT id FROM xp_logs WHERE student_id = $1 AND source = 'daily_login' AND (created_at AT TIME ZONE 'Asia/Seoul')::date >= $2::date AND academy_id = $3",
      [student.id, satDate, req.academyId]
    );
    if (already) return res.status(400).json({ error: '이번 주말에 이미 출석 보상을 받았습니다!' });

    const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, req.academyId]);
    if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

    // 보너스 지급 직전 한 번 더 중복 체크 (race condition 방지)
    const doubleCheck = await getOne(
      "SELECT id FROM xp_logs WHERE student_id = $1 AND source = 'daily_login' AND (created_at AT TIME ZONE 'Asia/Seoul')::date >= $2::date AND academy_id = $3",
      [student.id, satDate, req.academyId]
    );
    if (doubleCheck) return res.status(400).json({ error: '이번 주말에 이미 출석 보상을 받았습니다!' });

    const bonus = 20;
    const oldLevel = getLevelInfo(sc.xp).level;
    const newXp = sc.xp + bonus;
    const newPoints = sc.points + bonus;
    const newLevel = getLevelInfo(newXp).level;

    await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
      [newXp, newPoints, newLevel, student.id, req.academyId]);

    await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'daily_login', ?, ?)",
    [student.id, bonus, `일일 접속 보상`, req.academyId]);

  await checkAndGrantTitles(student.id, req.academyId);

  rankingCache.invalidate();
  res.json({ xpEarned: bonus, message: '접속 보상 +20 XP!', leveledUp: newLevel > oldLevel, newLevel });
  } finally {
    dailyBonusLocks.delete(student.id);
  }
});

// 캐릭터 변경
router.put('/my-character', authenticateToken, async (req, res) => {
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  const { characterId } = req.body;
  const char = await getOne('SELECT * FROM characters WHERE id = ? AND (academy_id = ? OR academy_id = 0)', [characterId, req.academyId]);
  if (!char) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다.' });

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, req.academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

  const levelInfo = getLevelInfo(sc.xp);
  if (char.unlock_level && levelInfo.level < char.unlock_level) {
    return res.status(400).json({ error: `레벨 ${char.unlock_level} 이상이어야 합니다.` });
  }

  await runQuery('UPDATE student_characters SET character_id = ? WHERE student_id = ? AND academy_id = ?', [characterId, student.id, req.academyId]);
  res.json({ message: '캐릭터가 변경되었습니다.' });
});

// 전체 캐릭터 목록
router.get('/characters', authenticateToken, async (req, res) => {
  const characters = await getAll('SELECT * FROM characters WHERE (academy_id = ? OR academy_id = 0)', [req.academyId]);
  res.json(characters);
});

// 코드 사용
// 히든 코드 중복 방지 락
const redeemLocks = new Set();

router.post('/redeem', authenticateToken, async (req, res) => {
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  // 동시 요청 방지
  if (redeemLocks.has(student.id)) {
    return res.status(429).json({ error: '처리 중입니다. 잠시 후 다시 시도하세요.' });
  }
  redeemLocks.add(student.id);

  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: '코드를 입력해주세요.' });

    const redeemCode = await getOne('SELECT * FROM redeem_codes WHERE code = ? AND is_active = 1 AND academy_id = ?', [code, req.academyId]);
    if (!redeemCode) return res.status(404).json({ error: '유효하지 않은 코드입니다.' });

    if (redeemCode.expires_at && new Date(redeemCode.expires_at) <= new Date()) {
      return res.status(400).json({ error: '만료된 코드입니다.' });
    }

    if (redeemCode.max_uses !== null && redeemCode.current_uses >= redeemCode.max_uses) {
      return res.status(400).json({ error: '사용 횟수를 초과한 코드입니다.' });
    }

    const alreadyRedeemed = await getOne(
      'SELECT id FROM code_redemptions WHERE student_id = ? AND code_id = ? AND academy_id = ?',
      [student.id, redeemCode.id, req.academyId]
    );
    if (alreadyRedeemed) return res.status(400).json({ error: '이미 사용한 코드입니다.' });

    const amount = redeemCode.xp_amount;

    const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, req.academyId]);
    if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

    const oldLevel = getLevelInfo(sc.xp).level;
    const newXp = sc.xp + amount;
    const newPoints = sc.points + amount;
    const newLevel = getLevelInfo(newXp).level;

    await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
      [newXp, newPoints, newLevel, student.id, req.academyId]);

    await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'code_redeem', ?, ?)",
      [student.id, amount, `코드 사용: ${code}`, req.academyId]);

    await runInsert('INSERT INTO code_redemptions (student_id, code_id, academy_id) VALUES (?, ?, ?)',
      [student.id, redeemCode.id, req.academyId]);

    await runQuery('UPDATE redeem_codes SET current_uses = current_uses + 1 WHERE id = ? AND academy_id = ?', [redeemCode.id, req.academyId]);

    await checkAndGrantTitles(student.id, req.academyId);

    rankingCache.invalidate();
    res.json({ xpEarned: amount, newXp, newPoints, newLevel, leveledUp: newLevel > oldLevel });
  } finally {
    redeemLocks.delete(student.id);
  }
});

// 내 칭호 목록
router.get('/my-titles', authenticateToken, async (req, res) => {
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  const titles = await getAll(
    `SELECT t.*, st.earned_at FROM student_titles st
     JOIN titles t ON st.title_id = t.id AND (t.academy_id = ? OR t.academy_id = 0)
     WHERE st.student_id = ? AND st.academy_id = ?`,
    [req.academyId, student.id, req.academyId]
  );
  res.json(titles);
});

// 칭호 선택
router.put('/my-title', authenticateToken, async (req, res) => {
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  const { titleId } = req.body;

  if (titleId !== null && titleId !== undefined) {
    const earned = await getOne('SELECT id FROM student_titles WHERE student_id = ? AND title_id = ? AND academy_id = ?', [student.id, titleId, req.academyId]);
    if (!earned) return res.status(400).json({ error: '획득하지 않은 칭호입니다.' });
  }

  await runQuery('UPDATE student_characters SET selected_title_id = ? WHERE student_id = ? AND academy_id = ?',
    [titleId || null, student.id, req.academyId]);
  res.json({ message: '칭호가 변경되었습니다.' });
});

// 게임 설정 조회 (학생용)
router.get('/game-settings', authenticateToken, async (req, res) => {
  const settings = await getAll('SELECT * FROM game_settings WHERE academy_id = ?', [req.academyId]);
  const obj = {};
  for (const s of settings) { obj[s.key] = s.value; }
  res.json(obj);
});

module.exports = router;
