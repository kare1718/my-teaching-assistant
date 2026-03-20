const express = require('express');
const path = require('path');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// === Helper Functions ===

function getLevelInfo(totalXp) {
  let level = 1, acc = 0;
  while (true) {
    const next = Math.floor(40 * Math.pow(level + 1, 1.4));
    if (acc + next > totalXp) return { level, currentXp: totalXp - acc, xpForNext: next, totalXp };
    acc += next;
    level++;
    if (level >= 100) return { level: 100, currentXp: 0, xpForNext: 0, totalXp };
  }
}

async function checkAndGrantTitles(studentId, academyId) {
  const titles = await getAll("SELECT * FROM titles WHERE condition_type != 'manual' AND academy_id = ?", [academyId]);
  const character = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [studentId, academyId]);
  if (!character) return;

  const quizResult = await getOne('SELECT COALESCE(SUM(correct_count), 0) as total FROM vocab_game_logs WHERE student_id = ? AND academy_id = ?', [studentId, academyId]);
  const codeResult = await getOne('SELECT COUNT(*) as total FROM code_redemptions WHERE student_id = ? AND academy_id = ?', [studentId, academyId]);
  const levelInfo = getLevelInfo(character.xp);

  for (const title of titles) {
    let conditionMet = false;
    const val = title.condition_value;

    switch (title.condition_type) {
      case 'xp_total':
        conditionMet = character.xp >= val;
        break;
      case 'quiz_count':
        conditionMet = quizResult.total >= val;
        break;
      case 'code_count':
        conditionMet = codeResult.total >= val;
        break;
      case 'level':
        conditionMet = levelInfo.level >= val;
        break;
    }

    if (conditionMet) {
      const already = await getOne('SELECT id FROM student_titles WHERE student_id = ? AND title_id = ? AND academy_id = ?', [studentId, title.id, academyId]);
      if (!already) {
        await runInsert('INSERT INTO student_titles (student_id, title_id, academy_id) VALUES (?, ?, ?)', [studentId, title.id, academyId]);
      }
    }
  }
}

function generateCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// === Student Endpoints ===

// 이름 마스킹 (가운데 글자 *)
function maskName(name) {
  if (!name) return '***';
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

// 오늘 자정 기준 (KST)
function getTodayKST() {
  const now = new Date();
  // 일일 초기화 기준: KST 10시 (UTC 01시)
  // 10시 전이면 전날 날짜 반환, 10시 이후면 오늘 날짜 반환
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const kstHour = kst.getUTCHours();
  if (kstHour < 10) {
    // 10시 전이면 하루 빼기
    kst.setUTCDate(kst.getUTCDate() - 1);
  }
  return kst.toISOString().split('T')[0]; // YYYY-MM-DD
}

// 내 캐릭터 정보
router.get('/my-character', authenticateToken, async (req, res) => {
  try {
    const academyId = req.academyId;
    let student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
    // 관리자가 학생 페이지 접근 시 자동으로 학생 레코드 생성
    if (!student && req.user.role === 'admin') {
      await runQuery(
        "INSERT INTO students (user_id, school, grade, parent_name, parent_phone, academy_id) VALUES (?, ?, ?, ?, ?, ?)",
        [req.user.id, '관리자', '관리자', '', '', academyId]
      );
      student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
    }
    if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

    let character = await getOne(
      `SELECT sc.*, COALESCE(c.name, '캐릭터') as char_name, COALESCE(c.emoji, '🐯') as emoji, COALESCE(c.description, '') as char_description
       FROM student_characters sc
       LEFT JOIN characters c ON sc.character_id = c.id AND c.academy_id = ?
       WHERE sc.student_id = ? AND sc.academy_id = ?`,
      [academyId, student.id, academyId]
    );

    if (!character) {
      const firstChar = await getOne('SELECT id FROM characters WHERE academy_id = ? ORDER BY id LIMIT 1', [academyId]);
      const charId = firstChar ? firstChar.id : 1;
      await runInsert(
        'INSERT INTO student_characters (student_id, character_id, xp, level, points, academy_id) VALUES (?, ?, 0, 1, 0, ?)',
        [student.id, charId, academyId]
      );
      character = await getOne(
        `SELECT sc.*, COALESCE(c.name, '캐릭터') as char_name, COALESCE(c.emoji, '🐯') as emoji, COALESCE(c.description, '') as char_description
         FROM student_characters sc
         LEFT JOIN characters c ON sc.character_id = c.id AND c.academy_id = ?
         WHERE sc.student_id = ? AND sc.academy_id = ?`,
        [academyId, student.id, academyId]
      );
    }

    if (!character) return res.status(500).json({ error: '캐릭터 생성 실패' });

    const levelInfo = getLevelInfo(character.xp);

    let titleName = null;
    if (character.selected_title_id) {
      const title = await getOne('SELECT name FROM titles WHERE id = ? AND academy_id = ?', [character.selected_title_id, academyId]);
      if (title) titleName = title.name;
    }

    // 오늘 퀴즈 문제 수 확인
    const today = getTodayKST();
    const todayQuizResult = await getOne(
      "SELECT COALESCE(SUM(total_questions), 0) as cnt FROM vocab_game_logs WHERE student_id = ? AND date(played_at) = date(?) AND academy_id = ?",
      [student.id, today, academyId]
    );
    const todayQuizCount = todayQuizResult ? todayQuizResult.cnt : 0;
    const limitSetting = await getOne("SELECT value FROM game_settings WHERE key = 'daily_quiz_limit' AND academy_id = ?", [academyId]);
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
        "SELECT id FROM xp_logs WHERE student_id = ? AND source = 'daily_login' AND date(created_at) >= date(?) AND academy_id = ?",
        [student.id, satDate, academyId]
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
  const academyId = req.academyId;
  const { stage } = req.body; // stage name or '' for auto
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, academyId]);
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

  await runQuery('UPDATE student_characters SET selected_stage = ? WHERE student_id = ? AND academy_id = ?', [stage || '', student.id, academyId]);
  res.json({ message: stage ? `단계가 "${stage}"(으)로 변경되었습니다.` : '자동 단계로 변경되었습니다.' });
});

// 아바타 커스터마이징 저장
router.put('/my-avatar', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const { avatarConfig, nickname } = req.body;
  if (!avatarConfig) return res.status(400).json({ error: '아바타 설정이 필요합니다.' });

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

  // 주 1회 변경 제한 (첫 설정은 허용)
  if (sc.avatar_config && sc.avatar_config !== '{}') {
    const lastChange = await getOne(
      "SELECT id FROM xp_logs WHERE student_id = ? AND source = 'avatar_change' AND created_at >= datetime('now', '-7 days') AND academy_id = ?",
      [student.id, academyId]
    );
    if (lastChange) {
      return res.status(400).json({ error: '아바타는 주 1회만 변경할 수 있습니다! 다음 주에 다시 시도해주세요.' });
    }
    // 변경 기록 남기기
    await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, 0, 'avatar_change', '아바타 변경', ?)",
      [student.id, academyId]);
  }

  // 닉네임 유효성
  if (nickname !== undefined) {
    const trimmed = (nickname || '').trim();
    if (trimmed.length > 10) return res.status(400).json({ error: '닉네임은 10자 이하로 입력해주세요.' });
    await runQuery('UPDATE student_characters SET avatar_config = ?, nickname = ? WHERE student_id = ? AND academy_id = ?',
      [JSON.stringify(avatarConfig), trimmed, student.id, academyId]);
  } else {
    await runQuery('UPDATE student_characters SET avatar_config = ? WHERE student_id = ? AND academy_id = ?',
      [JSON.stringify(avatarConfig), student.id, academyId]);
  }

  res.json({ message: '아바타가 저장되었습니다!', avatarConfig });
});

// 닉네임만 변경 (주 1회 제한, 아바타 변경과 별도)
router.put('/my-nickname', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const { nickname } = req.body;
  const trimmed = (nickname || '').trim();
  if (trimmed.length > 10) return res.status(400).json({ error: '닉네임은 10자 이하로 입력해주세요.' });
  if (trimmed.length < 1) return res.status(400).json({ error: '닉네임을 입력해주세요.' });

  // 주 1회 제한 체크 (최근 7일 이내 닉네임 변경 기록)
  const recentChange = await getOne(
    "SELECT id FROM xp_logs WHERE student_id = ? AND source = 'nickname_change' AND created_at >= datetime('now', '-7 days') AND academy_id = ?",
    [student.id, academyId]
  );
  if (recentChange) {
    return res.status(400).json({ error: '닉네임은 주 1회만 변경할 수 있습니다.' });
  }

  await runQuery('UPDATE student_characters SET nickname = ? WHERE student_id = ? AND academy_id = ?', [trimmed, student.id, academyId]);
  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, 0, 'nickname_change', ?, ?)",
    [student.id, `닉네임 변경: ${trimmed}`, academyId]);

  res.json({ message: '닉네임이 변경되었습니다!', nickname: trimmed });
});

// 전체 칭호 목록 (학생이 어떤 칭호가 있는지 확인)
router.get('/all-titles', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const titles = await getAll('SELECT * FROM titles WHERE academy_id = ? ORDER BY condition_value ASC', [academyId]);
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  let myTitleIds = [];
  if (student) {
    const myTitles = await getAll('SELECT title_id FROM student_titles WHERE student_id = ? AND academy_id = ?', [student.id, academyId]);
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

// 접속 보상 수령 (토/일만 가능)
router.post('/daily-bonus', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  // 토요일(6), 일요일(0)만 출석 가능
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dayOfWeek = kstNow.getUTCDay(); // 0=일, 6=토
  if (dayOfWeek !== 0 && dayOfWeek !== 6) {
    return res.status(400).json({ error: '출석 보너스는 토요일/일요일에만 받을 수 있습니다! 🗓️' });
  }

  const today = getTodayKST();
  // 이번 주말(토~일) 중 이미 받았는지 확인
  const weekendStart = new Date(kstNow);
  // 이번 주 토요일 찾기
  if (dayOfWeek === 0) weekendStart.setUTCDate(weekendStart.getUTCDate() - 1); // 일요일이면 어제(토요일)부터
  const satDate = weekendStart.toISOString().split('T')[0];

  const already = await getOne(
    "SELECT id FROM xp_logs WHERE student_id = ? AND source = 'daily_login' AND date(created_at) >= date(?) AND academy_id = ?",
    [student.id, satDate, academyId]
  );
  if (already) return res.status(400).json({ error: '이번 주말에 이미 출석 보상을 받았습니다!' });

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

  const bonus = 20;
  const oldLevel = getLevelInfo(sc.xp).level;
  const newXp = sc.xp + bonus;
  const newPoints = sc.points + bonus;
  const newLevel = getLevelInfo(newXp).level;

  await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
    [newXp, newPoints, newLevel, student.id, academyId]);

  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'daily_login', ?, ?)",
    [student.id, bonus, `일일 접속 보상`, academyId]);

  await checkAndGrantTitles(student.id, academyId);

  res.json({ xpEarned: bonus, message: '접속 보상 +20 XP!', leveledUp: newLevel > oldLevel, newLevel });
});

// 캐릭터 변경
router.put('/my-character', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const { characterId } = req.body;
  const char = await getOne('SELECT * FROM characters WHERE id = ? AND academy_id = ?', [characterId, academyId]);
  if (!char) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다.' });

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

  const levelInfo = getLevelInfo(sc.xp);
  if (char.unlock_level && levelInfo.level < char.unlock_level) {
    return res.status(400).json({ error: `레벨 ${char.unlock_level} 이상이어야 합니다.` });
  }

  await runQuery('UPDATE student_characters SET character_id = ? WHERE student_id = ? AND academy_id = ?', [characterId, student.id, academyId]);
  res.json({ message: '캐릭터가 변경되었습니다.' });
});

// 전체 캐릭터 목록
router.get('/characters', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const characters = await getAll('SELECT * FROM characters WHERE academy_id = ?', [academyId]);
  res.json(characters);
});

// 코드 사용
router.post('/redeem', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const { code } = req.body;
  if (!code) return res.status(400).json({ error: '코드를 입력해주세요.' });

  const redeemCode = await getOne('SELECT * FROM redeem_codes WHERE code = ? AND is_active = 1 AND academy_id = ?', [code, academyId]);
  if (!redeemCode) return res.status(404).json({ error: '유효하지 않은 코드입니다.' });

  if (redeemCode.expires_at && new Date(redeemCode.expires_at) <= new Date()) {
    return res.status(400).json({ error: '만료된 코드입니다.' });
  }

  if (redeemCode.max_uses !== null && redeemCode.current_uses >= redeemCode.max_uses) {
    return res.status(400).json({ error: '사용 횟수를 초과한 코드입니다.' });
  }

  const alreadyRedeemed = await getOne(
    'SELECT id FROM code_redemptions WHERE student_id = ? AND code_id = ? AND academy_id = ?',
    [student.id, redeemCode.id, academyId]
  );
  if (alreadyRedeemed) return res.status(400).json({ error: '이미 사용한 코드입니다.' });

  const amount = redeemCode.xp_amount;

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

  const oldLevel = getLevelInfo(sc.xp).level;
  const newXp = sc.xp + amount;
  const newPoints = sc.points + amount;
  const newLevel = getLevelInfo(newXp).level;

  await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
    [newXp, newPoints, newLevel, student.id, academyId]);

  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'code_redeem', ?, ?)",
    [student.id, amount, `코드 사용: ${code}`, academyId]);

  await runInsert('INSERT INTO code_redemptions (student_id, code_id, academy_id) VALUES (?, ?, ?)',
    [student.id, redeemCode.id, academyId]);

  await runQuery('UPDATE redeem_codes SET current_uses = current_uses + 1 WHERE id = ? AND academy_id = ?', [redeemCode.id, academyId]);

  await checkAndGrantTitles(student.id, academyId);

  res.json({ xpEarned: amount, newXp, newPoints, newLevel, leveledUp: newLevel > oldLevel });
});

// 랭킹
// 가장 최근 금요일 자정(KST) 계산
function getLastFridayMidnight() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay(); // 0=일 ~ 6=토
  // 가장 최근 "지난" 금요일 (금요일 당일이면 7일 전 금요일로)
  const diff = ((day - 5 + 7) % 7) || 7;
  kst.setUTCDate(kst.getUTCDate() - diff);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

// 이번 달 첫째 날 자정(KST) 계산
function getMonthStartMidnight() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(1);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

router.get('/rankings', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const type = req.query.type || 'all'; // all, weekly, monthly, school
  const requestedSchool = req.query.school || null; // 관리자가 특정 학교 조회
  const student = await getOne('SELECT id, school FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  const isAdmin = req.user.role === 'admin' || req.user.school === '조교' || req.user.school === '선생님';

  let rankings;

  if (type === 'weekly' || type === 'monthly') {
    const since = type === 'weekly' ? getLastFridayMidnight() : getMonthStartMidnight();
    rankings = await getAll(
      `SELECT sc.student_id, COALESCE(SUM(xl.amount), 0) as period_xp,
              sc.xp, sc.avatar_config, sc.nickname, sc.selected_title_id, sc.character_id, sc.ranking_badge,
              u.name, s.school, s.grade, c.emoji, c.name as char_name, t.name as title_name, t.icon as title_icon
       FROM student_characters sc
       JOIN students s ON sc.student_id = s.id AND s.academy_id = ?
       JOIN users u ON s.user_id = u.id
       LEFT JOIN characters c ON sc.character_id = c.id AND c.academy_id = ?
       LEFT JOIN titles t ON sc.selected_title_id = t.id AND t.academy_id = ?
       LEFT JOIN xp_logs xl ON xl.student_id = sc.student_id AND xl.created_at >= ? AND xl.amount > 0 AND xl.academy_id = ?

       WHERE u.role != 'admin' AND sc.academy_id = ?
       GROUP BY sc.student_id
       HAVING period_xp > 0
       ORDER BY period_xp DESC LIMIT 100`,
      [academyId, academyId, academyId, since, academyId, academyId]
    );
    // cap 후 재정렬하여 올바른 등수 부여
    rankings = rankings.map(r => {
      let avatarConfig = {};
      try { avatarConfig = r.avatar_config ? JSON.parse(r.avatar_config) : {}; } catch(e) {}
      let rankingBadge = null;
      try { rankingBadge = r.ranking_badge ? JSON.parse(r.ranking_badge) : null; } catch(e) {}
      const cappedXp = Math.min(r.period_xp, r.xp);
      return { ...r, xp: cappedXp, totalXp: r.xp, avatarConfig, rankingBadge, nickname: r.nickname || null, displayName: r.nickname || maskName(r.name), realName: maskName(r.name) };
    })
    .filter(r => r.xp > 0)
    .sort((a, b) => b.xp - a.xp)
    .map((r, idx) => ({ ...r, rank: idx + 1 }));

    // 내 기간 XP
    let myRank = null, myInfo = null;
    if (student) {
      const myPeriod = await getOne(
        `SELECT COALESCE(SUM(xl.amount), 0) as period_xp
         FROM xp_logs xl WHERE xl.student_id = ? AND xl.created_at >= ? AND xl.amount > 0 AND xl.academy_id = ?`,
        [student.id, since, academyId]
      );
      const myChar = await getOne(
        `SELECT sc.*, u.name, s.school, s.grade, c.emoji, c.name as char_name, t.name as title_name, t.icon as title_icon
         FROM student_characters sc JOIN students s ON sc.student_id = s.id AND s.academy_id = ? JOIN users u ON s.user_id = u.id
         LEFT JOIN characters c ON sc.character_id = c.id AND c.academy_id = ? LEFT JOIN titles t ON sc.selected_title_id = t.id AND t.academy_id = ?
         WHERE sc.student_id = ? AND sc.academy_id = ?`, [academyId, academyId, academyId, student.id, academyId]
      );
      if (myChar && myPeriod) {
        const myCappedXp = Math.min(myPeriod.period_xp, myChar.xp);
        // cap 적용된 XP 기준으로 내 등수 계산
        const rankResult = await getOne(
          `SELECT COUNT(*) + 1 as rank FROM (
            SELECT sc2.student_id,
              MIN(COALESCE((SELECT SUM(xl2.amount) FROM xp_logs xl2 WHERE xl2.student_id = sc2.student_id AND xl2.created_at >= ? AND xl2.amount > 0 AND xl2.academy_id = ?), 0), sc2.xp) as capped_xp
            FROM student_characters sc2
            JOIN students s2 ON sc2.student_id = s2.id AND s2.academy_id = ? JOIN users u2 ON s2.user_id = u2.id
            WHERE u2.role != 'admin' AND sc2.academy_id = ?
            GROUP BY sc2.student_id HAVING capped_xp > ?
          )`, [since, academyId, academyId, academyId, myCappedXp]
        );
        myRank = rankResult ? rankResult.rank : null;
        let myAvatarConfig = {};
        try { myAvatarConfig = myChar.avatar_config ? JSON.parse(myChar.avatar_config) : {}; } catch(e) {}
        let myRankingBadge = null;
        try { myRankingBadge = myChar.ranking_badge ? JSON.parse(myChar.ranking_badge) : null; } catch(e) {}
        myInfo = {
          ...myChar, avatarConfig: myAvatarConfig, rankingBadge: myRankingBadge, nickname: myChar.nickname || null,
          displayName: myChar.nickname || maskName(myChar.name), realName: maskName(myChar.name),
          school: student.school, rank: myRank, xp: myCappedXp, totalXp: myChar.xp
        };
      }
    }
    return res.json({ rankings, myRank, myInfo, type, since });

  } else if (type === 'school') {
    // 관리자는 requestedSchool 파라미터로 모든 학교 조회 가능
    const mySchool = requestedSchool || (student ? student.school : null);
    if (!mySchool) {
      // 관리자이고 학교 미지정이면 전체 학교 목록 반환
      if (isAdmin) {
        const schools = await getAll("SELECT DISTINCT s.school FROM students s JOIN users u ON s.user_id = u.id WHERE u.approved = 1 AND u.role != 'admin' AND s.academy_id = ? ORDER BY s.school", [academyId]);
        return res.json({ rankings: [], myRank: null, myInfo: null, type, school: null, schools: schools.map(s => s.school) });
      }
      return res.json({ rankings: [], myRank: null, myInfo: null, type, school: null });
    }

    rankings = await getAll(
      `SELECT sc.*, u.name, s.school, s.grade, c.emoji, c.name as char_name, t.name as title_name, t.icon as title_icon
       FROM student_characters sc
       JOIN students s ON sc.student_id = s.id AND s.academy_id = ?
       JOIN users u ON s.user_id = u.id
       LEFT JOIN characters c ON sc.character_id = c.id AND c.academy_id = ?
       LEFT JOIN titles t ON sc.selected_title_id = t.id AND t.academy_id = ?
       WHERE u.role != 'admin' AND s.school = ? AND sc.academy_id = ?
       ORDER BY sc.xp DESC LIMIT 100`,
      [academyId, academyId, academyId, mySchool, academyId]
    );
    const anonymized = rankings.map((r, idx) => {
      let avatarConfig = {};
      try { avatarConfig = r.avatar_config ? JSON.parse(r.avatar_config) : {}; } catch(e) {}
      let rankingBadge = null;
      try { rankingBadge = r.ranking_badge ? JSON.parse(r.ranking_badge) : null; } catch(e) {}
      return { ...r, avatarConfig, rankingBadge, nickname: r.nickname || null, displayName: r.nickname || maskName(r.name), realName: maskName(r.name), rank: idx + 1 };
    });

    let myRank = null, myInfo = null;
    if (student) {
      const myChar = await getOne(
        `SELECT sc.*, u.name, s.school, s.grade, c.emoji, c.name as char_name, t.name as title_name, t.icon as title_icon
         FROM student_characters sc JOIN students s ON sc.student_id = s.id AND s.academy_id = ? JOIN users u ON s.user_id = u.id
         LEFT JOIN characters c ON sc.character_id = c.id AND c.academy_id = ? LEFT JOIN titles t ON sc.selected_title_id = t.id AND t.academy_id = ?
         WHERE sc.student_id = ? AND sc.academy_id = ?`, [academyId, academyId, academyId, student.id, academyId]
      );
      if (myChar) {
        const rankResult = await getOne(
          `SELECT COUNT(*) + 1 as rank FROM student_characters sc
           JOIN students s ON sc.student_id = s.id AND s.academy_id = ? JOIN users u ON s.user_id = u.id
           WHERE sc.xp > ? AND u.role != 'admin' AND s.school = ? AND sc.academy_id = ?`,
          [academyId, myChar.xp, mySchool, academyId]
        );
        myRank = rankResult ? rankResult.rank : null;
        let myAvatarConfig = {};
        try { myAvatarConfig = myChar.avatar_config ? JSON.parse(myChar.avatar_config) : {}; } catch(e) {}
        let myRankingBadge = null;
        try { myRankingBadge = myChar.ranking_badge ? JSON.parse(myChar.ranking_badge) : null; } catch(e) {}
        myInfo = {
          ...myChar, avatarConfig: myAvatarConfig, rankingBadge: myRankingBadge, nickname: myChar.nickname || null,
          displayName: myChar.nickname || maskName(myChar.name), realName: maskName(myChar.name),
          school: student.school, rank: myRank
        };
      }
    }
    // 관리자에게는 학교 목록도 반환
    const schools = isAdmin
      ? (await getAll("SELECT DISTINCT s.school FROM students s JOIN users u ON s.user_id = u.id WHERE u.approved = 1 AND u.role != 'admin' AND s.academy_id = ? ORDER BY s.school", [academyId])).map(s => s.school)
      : undefined;
    return res.json({ rankings: anonymized, myRank, myInfo, type, school: mySchool, schools });

  } else {
    // all - 기존 전체 랭킹
    rankings = await getAll(
      `SELECT sc.*, u.name, s.school, s.grade, c.emoji, c.name as char_name, t.name as title_name, t.icon as title_icon
       FROM student_characters sc
       JOIN students s ON sc.student_id = s.id AND s.academy_id = ?
       JOIN users u ON s.user_id = u.id
       LEFT JOIN characters c ON sc.character_id = c.id AND c.academy_id = ?
       LEFT JOIN titles t ON sc.selected_title_id = t.id AND t.academy_id = ?
       WHERE u.role != 'admin' AND sc.academy_id = ?
       ORDER BY sc.xp DESC LIMIT 100`,
      [academyId, academyId, academyId, academyId]
    );
    const anonymized = rankings.map((r, idx) => {
      let avatarConfig = {};
      try { avatarConfig = r.avatar_config ? JSON.parse(r.avatar_config) : {}; } catch(e) {}
      let rankingBadge = null;
      try { rankingBadge = r.ranking_badge ? JSON.parse(r.ranking_badge) : null; } catch(e) {}
      return { ...r, avatarConfig, rankingBadge, nickname: r.nickname || null, displayName: r.nickname || maskName(r.name), realName: maskName(r.name), rank: idx + 1 };
    });

    let myRank = null, myInfo = null;
    if (student) {
      const myChar = await getOne(
        `SELECT sc.*, u.name, s.school, s.grade, c.emoji, c.name as char_name, t.name as title_name, t.icon as title_icon
         FROM student_characters sc JOIN students s ON sc.student_id = s.id AND s.academy_id = ? JOIN users u ON s.user_id = u.id
         LEFT JOIN characters c ON sc.character_id = c.id AND c.academy_id = ? LEFT JOIN titles t ON sc.selected_title_id = t.id AND t.academy_id = ?
         WHERE sc.student_id = ? AND sc.academy_id = ?`, [academyId, academyId, academyId, student.id, academyId]
      );
      if (myChar) {
        const rankResult = await getOne(
          `SELECT COUNT(*) + 1 as rank FROM student_characters sc
           JOIN students s ON sc.student_id = s.id AND s.academy_id = ? JOIN users u ON s.user_id = u.id
           WHERE sc.xp > ? AND u.role != 'admin' AND sc.academy_id = ?`,
          [academyId, myChar.xp, academyId]
        );
        myRank = rankResult ? rankResult.rank : null;
        let myAvatarConfig = {};
        try { myAvatarConfig = myChar.avatar_config ? JSON.parse(myChar.avatar_config) : {}; } catch(e) {}
        let myRankingBadge = null;
        try { myRankingBadge = myChar.ranking_badge ? JSON.parse(myChar.ranking_badge) : null; } catch(e) {}
        myInfo = {
          ...myChar, avatarConfig: myAvatarConfig, rankingBadge: myRankingBadge, nickname: myChar.nickname || null,
          displayName: myChar.nickname || maskName(myChar.name), realName: maskName(myChar.name),
          school: student.school, rank: myRank
        };
      }
    }
    return res.json({ rankings: anonymized, myRank, myInfo, type });
  }
});

// 내 칭호 목록
router.get('/my-titles', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const titles = await getAll(
    `SELECT t.*, st.earned_at FROM student_titles st
     JOIN titles t ON st.title_id = t.id AND t.academy_id = ?
     WHERE st.student_id = ? AND st.academy_id = ?`,
    [academyId, student.id, academyId]
  );
  res.json(titles);
});

// 칭호 선택
router.put('/my-title', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const { titleId } = req.body;

  if (titleId !== null && titleId !== undefined) {
    const earned = await getOne('SELECT id FROM student_titles WHERE student_id = ? AND title_id = ? AND academy_id = ?', [student.id, titleId, academyId]);
    if (!earned) return res.status(400).json({ error: '획득하지 않은 칭호입니다.' });
  }

  await runQuery('UPDATE student_characters SET selected_title_id = ? WHERE student_id = ? AND academy_id = ?',
    [titleId || null, student.id, academyId]);
  res.json({ message: '칭호가 변경되었습니다.' });
});

// 단어 카테고리 목록
router.get('/vocab/categories', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const categories = await getAll('SELECT category, COUNT(*) as count FROM vocab_words WHERE academy_id = ? GROUP BY category', [academyId]);
  res.json(categories);
});

// 단어 퀴즈 시작
router.get('/vocab/start', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  // 게임 설정에서 일일 제한 가져오기
  const limitSetting = await getOne("SELECT value FROM game_settings WHERE key = 'daily_quiz_limit' AND academy_id = ?", [academyId]);
  const dailyLimit = limitSetting ? parseInt(limitSetting.value) || 50 : 50;

  // 하루 제한 체크
  const today = getTodayKST();
  const todayResult = await getOne(
    "SELECT COALESCE(SUM(total_questions), 0) as cnt FROM vocab_game_logs WHERE student_id = ? AND date(played_at) = date(?) AND academy_id = ?",
    [student.id, today, academyId]
  );
  const todayCount = todayResult ? todayResult.cnt : 0;
  const remaining = dailyLimit - todayCount;
  if (remaining <= 0) {
    return res.status(400).json({ error: `오늘의 퀴즈 제한(${dailyLimit}문제)에 도달했습니다. 내일 다시 도전하세요!` });
  }

  const category = req.query.category;
  let count = parseInt(req.query.count) || 10;
  if (count > dailyLimit) count = dailyLimit;

  // 남은 문제 수로 제한
  if (count > remaining) count = remaining;

  // 최근 풀었던 문제 ID 수집 (3일 이내)
  let recentWordIds = [];
  if (student) {
    const threeDaysAgo = new Date(new Date().getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const recentLogs = await getAll(
      `SELECT DISTINCT vgl.id as log_id FROM vocab_game_logs vgl WHERE vgl.student_id = ? AND vgl.played_at >= ? AND vgl.academy_id = ?`,
      [student.id, threeDaysAgo, academyId]
    );
    // vocab_game_logs doesn't store individual word IDs, so we use a simpler approach:
    // prioritize words NOT recently seen by using weighted random
  }

  let words;
  if (category) {
    words = await getAll('SELECT id, question_text, correct_answer, wrong_answers, difficulty FROM vocab_words WHERE category = ? AND academy_id = ? ORDER BY RANDOM() LIMIT ?', [category, academyId, count * 2]);
  } else {
    words = await getAll('SELECT id, question_text, correct_answer, wrong_answers, difficulty FROM vocab_words WHERE academy_id = ? ORDER BY RANDOM() LIMIT ?', [academyId, count * 2]);
  }
  // Shuffle and take the requested count (ensures randomness even with larger pool)
  words = words.sort(() => Math.random() - 0.5).slice(0, count);

  const questions = words.map(w => {
    let wrongAnswers;
    try {
      wrongAnswers = JSON.parse(w.wrong_answers);
    } catch {
      wrongAnswers = [];
    }
    // 정답 위치를 0~3 중 균등하게 분배
    const wrongSlice = wrongAnswers.slice(0, 3);
    const correctIdx = Math.floor(Math.random() * (wrongSlice.length + 1));
    const options = [...wrongSlice];
    options.splice(correctIdx, 0, w.correct_answer);
    return {
      id: w.id,
      questionText: w.question_text,
      options
    };
  });

  // 시작 즉시 log 삽입 → 오늘 횟수 즉시 차감 (어뷰징 방지)
  const logId = await runInsert(
    "INSERT INTO vocab_game_logs (student_id, total_questions, correct_count, xp_earned, academy_id) VALUES (?, ?, 0, 0, ?)",
    [student.id, questions.length, academyId]
  );

  res.json({ questions, logId });
});

// 단어 퀴즈 제출
router.post('/vocab/submit', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const { answers, logId } = req.body;
  if (!answers || !Array.isArray(answers)) return res.status(400).json({ error: '답안을 제출해주세요.' });

  let totalXpEarned = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let streak = 0;
  const details = [];

  for (const ans of answers) {
    const word = await getOne('SELECT * FROM vocab_words WHERE id = ? AND academy_id = ?', [ans.wordId, academyId]);
    if (!word) continue;

    const isCorrect = ans.selectedAnswer === word.correct_answer;

    if (isCorrect) {
      correctCount++;
      streak++;
      // 정답 보상: 쉬움 +5, 보통 +8, 어려움 +12
      let xp = 5;
      if (word.difficulty === 2) xp = 8;
      else if (word.difficulty === 3) xp = 12;

      // 연속 정답 보너스 (5연속부터 +3)
      if (streak >= 5) xp += 3;

      totalXpEarned += xp;
    } else {
      wrongCount++;
      streak = 0;
      // 오답 감점: 쉬움 -2, 보통 -3, 어려움 -5
      let penalty = -2;
      if (word.difficulty === 2) penalty = -3;
      else if (word.difficulty === 3) penalty = -5;

      totalXpEarned += penalty;
    }

    details.push({
      wordId: word.id,
      correct: isCorrect,
      correctAnswer: word.correct_answer,
      explanation: word.explanation || null
    });
  }

  // Perfect score bonus (+50%)
  if (correctCount === answers.length && answers.length >= 5) {
    totalXpEarned = Math.floor(totalXpEarned * 1.5);
  }

  // 최소 0 XP (마이너스가 되진 않도록)
  if (totalXpEarned < 0) totalXpEarned = 0;

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

  const oldLevel = getLevelInfo(sc.xp).level;
  const newXp = sc.xp + totalXpEarned;
  const newPoints = sc.points + totalXpEarned;
  const newLevel = getLevelInfo(newXp).level;

  await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
    [newXp, newPoints, newLevel, student.id, academyId]);

  // logId가 있으면 start 시 만든 row를 UPDATE, 없으면 INSERT (하위호환)
  if (logId) {
    await runQuery(
      "UPDATE vocab_game_logs SET total_questions = ?, correct_count = ?, xp_earned = ? WHERE id = ? AND student_id = ? AND academy_id = ?",
      [answers.length, correctCount, totalXpEarned, logId, student.id, academyId]
    );
  } else {
    await runInsert(
      "INSERT INTO vocab_game_logs (student_id, total_questions, correct_count, xp_earned, academy_id) VALUES (?, ?, ?, ?, ?)",
      [student.id, answers.length, correctCount, totalXpEarned, academyId]
    );
  }

  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'quiz', ?, ?)",
    [student.id, totalXpEarned, `단어 퀴즈 ${correctCount}/${answers.length}`, academyId]);

  await checkAndGrantTitles(student.id, academyId);

  res.json({ correct: correctCount, total: answers.length, xpEarned: totalXpEarned, details, leveledUp: newLevel > oldLevel, newLevel });
});

// 상점 아이템 목록
router.get('/shop/items', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const items = await getAll('SELECT * FROM shop_items WHERE is_active = 1 AND academy_id = ? ORDER BY price ASC', [academyId]);
  res.json(items);
});

// 상점 구매
router.post('/shop/purchase', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const { itemId } = req.body;
  const item = await getOne('SELECT * FROM shop_items WHERE id = ? AND is_active = 1 AND academy_id = ?', [itemId, academyId]);
  if (!item) return res.status(404).json({ error: '상품을 찾을 수 없습니다.' });

  if (item.stock !== null && item.stock <= 0) {
    return res.status(400).json({ error: '재고가 없습니다.' });
  }

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

  if (sc.points < item.price) {
    return res.status(400).json({ error: '포인트가 부족합니다.' });
  }

  const remainingPoints = sc.points - item.price;
  await runQuery('UPDATE student_characters SET points = ? WHERE student_id = ? AND academy_id = ?', [remainingPoints, student.id, academyId]);

  if (item.stock !== null) {
    await runQuery('UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND academy_id = ?', [item.id, academyId]);
  }

  await runInsert("INSERT INTO shop_purchases (student_id, item_id, price_paid, status, academy_id) VALUES (?, ?, ?, 'pending', ?)",
    [student.id, item.id, item.price, academyId]);

  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'shop_purchase', ?, ?)",
    [student.id, -item.price, `상점 구매: ${item.name}`, academyId]);

  res.json({ success: true, remainingPoints });
});

// 내 구매 내역
router.get('/shop/my-purchases', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const purchases = await getAll(
    `SELECT sp.*, si.name, si.icon FROM shop_purchases sp
     JOIN shop_items si ON sp.item_id = si.id AND si.academy_id = ?
     WHERE sp.student_id = ? AND sp.academy_id = ? ORDER BY sp.created_at DESC`,
    [academyId, student.id, academyId]
  );
  res.json(purchases);
});

// === Admin Endpoints ===

// 코드 목록
router.get('/admin/codes', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const codes = await getAll('SELECT * FROM redeem_codes WHERE academy_id = ? ORDER BY created_at DESC', [academyId]);
  res.json(codes);
});

// 코드 생성
router.post('/admin/codes', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  let { code, codeType, xpAmount, description, maxUses, expiresAt } = req.body;
  if (!code) code = generateCode();

  const id = await runInsert(
    'INSERT INTO redeem_codes (code, code_type, xp_amount, description, max_uses, expires_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [code, codeType || 'general', xpAmount || 0, description || '', maxUses || null, expiresAt || null, academyId]
  );
  res.json({ message: '코드가 생성되었습니다.', id, code });
});

// 코드 수정
router.put('/admin/codes/:id', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { code, codeType, xpAmount, description, maxUses, expiresAt, isActive } = req.body;
  const fields = [];
  const values = [];

  if (code !== undefined) { fields.push('code = ?'); values.push(code); }
  if (codeType !== undefined) { fields.push('code_type = ?'); values.push(codeType); }
  if (xpAmount !== undefined) { fields.push('xp_amount = ?'); values.push(xpAmount); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (maxUses !== undefined) { fields.push('max_uses = ?'); values.push(maxUses); }
  if (expiresAt !== undefined) { fields.push('expires_at = ?'); values.push(expiresAt); }
  if (isActive !== undefined) { fields.push('is_active = ?'); values.push(isActive); }

  if (fields.length === 0) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

  values.push(parseInt(req.params.id));
  values.push(academyId);
  await runQuery(`UPDATE redeem_codes SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`, values);
  res.json({ message: '코드가 수정되었습니다.' });
});

// 코드 삭제
router.delete('/admin/codes/:id', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  await runQuery('DELETE FROM redeem_codes WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), academyId]);
  res.json({ message: '코드가 삭제되었습니다.' });
});

// 코드 일괄 생성
router.post('/admin/codes/bulk', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { count, codeType, xpAmount, description, maxUses, expiresAt } = req.body;
  if (!count || count < 1) return res.status(400).json({ error: '생성 수량을 입력해주세요.' });

  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = generateCode();
    const id = await runInsert(
      'INSERT INTO redeem_codes (code, code_type, xp_amount, description, max_uses, expires_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [code, codeType || 'general', xpAmount || 0, description || '', maxUses || null, expiresAt || null, academyId]
    );
    codes.push({ id, code });
  }
  res.json({ message: `${count}개의 코드가 생성되었습니다.`, codes });
});

// XP 현황
router.get('/admin/xp-overview', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const overview = await getAll(
    `SELECT sc.*, u.name, s.school, s.grade, c.emoji, c.name as char_name
     FROM student_characters sc
     JOIN students s ON sc.student_id = s.id AND s.academy_id = ?
     JOIN users u ON s.user_id = u.id
     LEFT JOIN characters c ON sc.character_id = c.id AND c.academy_id = ?
     WHERE sc.academy_id = ?
     ORDER BY sc.xp DESC`,
    [academyId, academyId, academyId]
  );
  res.json(overview);
});

// XP 조정
router.put('/admin/adjust-xp', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { studentId, amount, description } = req.body;
  if (!studentId || amount === undefined) return res.status(400).json({ error: '학생 ID와 수량을 입력해주세요.' });

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [studentId, academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보를 찾을 수 없습니다.' });

  const newXp = sc.xp + amount;
  let newPoints = sc.points + amount;
  if (newPoints < 0) newPoints = 0;
  const newLevel = getLevelInfo(newXp).level;

  await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
    [newXp, newPoints, newLevel, studentId, academyId]);

  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'admin_adjust', ?, ?)",
    [studentId, amount, description || '관리자 조정', academyId]);

  if (amount > 0) await checkAndGrantTitles(studentId, academyId);

  const updated = await getOne(
    `SELECT sc.*, c.name as char_name, c.emoji
     FROM student_characters sc
     LEFT JOIN characters c ON sc.character_id = c.id AND c.academy_id = ?
     WHERE sc.student_id = ? AND sc.academy_id = ?`,
    [academyId, studentId, academyId]
  );
  res.json(updated);
});

// 랭킹 관리 - 전체 학생 캐릭터 목록 (랭킹순)
router.get('/admin/rankings', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const type = req.query.type || 'all'; // all, weekly, monthly

  if (type === 'weekly' || type === 'monthly') {
    const since = type === 'weekly' ? getLastFridayMidnight() : getMonthStartMidnight();
    const rankings = await getAll(
      `SELECT sc.*, u.name, s.school, s.grade, s.id as student_id, c.emoji, c.name as char_name,
              t.name as title_name, t.icon as title_icon,
              COALESCE((SELECT SUM(xl.amount) FROM xp_logs xl WHERE xl.student_id = sc.student_id AND xl.created_at >= ? AND xl.amount > 0 AND xl.academy_id = ?), 0) as period_xp
       FROM student_characters sc
       JOIN students s ON sc.student_id = s.id AND s.academy_id = ?
       JOIN users u ON s.user_id = u.id
       LEFT JOIN characters c ON sc.character_id = c.id AND c.academy_id = ?
       LEFT JOIN titles t ON sc.selected_title_id = t.id AND t.academy_id = ?
       WHERE u.role != 'admin' AND sc.academy_id = ?
       ORDER BY period_xp DESC`,
      [since, academyId, academyId, academyId, academyId, academyId]
    );
    // period_xp가 총 XP를 초과하지 않도록 cap 후 재정렬
    const ranked = rankings
      .map(r => ({ ...r, period_xp: Math.min(r.period_xp, r.xp) }))
      .sort((a, b) => b.period_xp - a.period_xp)
      .map((r, idx) => ({ ...r, rank: idx + 1 }));
    return res.json({ rankings: ranked, since, type });
  }

  const rankings = await getAll(
    `SELECT sc.*, u.name, s.school, s.grade, s.id as student_id, c.emoji, c.name as char_name,
            t.name as title_name, t.icon as title_icon
     FROM student_characters sc
     JOIN students s ON sc.student_id = s.id AND s.academy_id = ?
     JOIN users u ON s.user_id = u.id
     LEFT JOIN characters c ON sc.character_id = c.id AND c.academy_id = ?
     LEFT JOIN titles t ON sc.selected_title_id = t.id AND t.academy_id = ?
     WHERE sc.academy_id = ?
     ORDER BY sc.xp DESC`,
    [academyId, academyId, academyId, academyId]
  );
  const ranked = rankings.map((r, idx) => ({ ...r, rank: idx + 1 }));
  res.json(ranked);
});

// 랭킹 관리 - 학생 XP/포인트/레벨 직접 수정
router.put('/admin/rankings/:studentId', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { studentId } = req.params;
  const { xp, points } = req.body;

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [studentId, academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보를 찾을 수 없습니다.' });

  const newXp = xp !== undefined ? parseInt(xp) : sc.xp;
  const newPoints = points !== undefined ? Math.max(0, parseInt(points)) : sc.points;
  const newLevel = getLevelInfo(Math.max(0, newXp)).level;

  await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
    [Math.max(0, newXp), newPoints, newLevel, studentId, academyId]);

  const diff = newXp - sc.xp;
  if (diff !== 0) {
    await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'admin_ranking', ?, ?)",
      [studentId, diff, '관리자 랭킹 수정', academyId]);
  }

  res.json({ message: '수정 완료', xp: Math.max(0, newXp), points: newPoints, level: newLevel });
});

// 랭킹 관리 - 학생 게임 데이터 초기화 (XP, 포인트, 레벨 리셋)
router.delete('/admin/rankings/:studentId/reset', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { studentId } = req.params;

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [studentId, academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보를 찾을 수 없습니다.' });

  await runQuery('UPDATE student_characters SET xp = 0, points = 0, level = 1 WHERE student_id = ? AND academy_id = ?', [studentId, academyId]);
  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'admin_reset', ?, ?)",
    [studentId, -sc.xp, '관리자 데이터 초기화', academyId]);

  res.json({ message: '게임 데이터가 초기화되었습니다.' });
});

// 랭킹 관리 - 학생 캐릭터 완전 삭제
router.delete('/admin/rankings/:studentId', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { studentId } = req.params;

  await runQuery('DELETE FROM student_characters WHERE student_id = ? AND academy_id = ?', [studentId, academyId]);
  await runQuery('DELETE FROM student_titles WHERE student_id = ? AND academy_id = ?', [studentId, academyId]);
  await runQuery('DELETE FROM xp_logs WHERE student_id = ? AND academy_id = ?', [studentId, academyId]);
  await runQuery('DELETE FROM vocab_game_logs WHERE student_id = ? AND academy_id = ?', [studentId, academyId]);
  await runQuery('DELETE FROM shop_purchases WHERE student_id = ? AND academy_id = ?', [studentId, academyId]);

  res.json({ message: '학생의 모든 게임 데이터가 삭제되었습니다.' });
});

// 칭호 관리
router.get('/admin/titles', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const titles = await getAll('SELECT * FROM titles WHERE academy_id = ?', [academyId]);
  res.json(titles);
});

router.post('/admin/titles', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { name, description, conditionType, conditionValue, icon } = req.body;
  const id = await runInsert(
    'INSERT INTO titles (name, description, condition_type, condition_value, icon, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
    [name, description || '', conditionType || 'manual', conditionValue || 0, icon || '', academyId]
  );
  res.json({ message: '칭호가 생성되었습니다.', id });
});

router.put('/admin/titles/:id', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { name, description, conditionType, conditionValue, icon } = req.body;
  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (conditionType !== undefined) { fields.push('condition_type = ?'); values.push(conditionType); }
  if (conditionValue !== undefined) { fields.push('condition_value = ?'); values.push(conditionValue); }
  if (icon !== undefined) { fields.push('icon = ?'); values.push(icon); }

  if (fields.length === 0) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

  values.push(parseInt(req.params.id));
  values.push(academyId);
  await runQuery(`UPDATE titles SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`, values);
  res.json({ message: '칭호가 수정되었습니다.' });
});

router.delete('/admin/titles/:id', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const id = parseInt(req.params.id);
  await runQuery('DELETE FROM student_titles WHERE title_id = ? AND academy_id = ?', [id, academyId]);
  await runQuery('DELETE FROM titles WHERE id = ? AND academy_id = ?', [id, academyId]);
  res.json({ message: '칭호가 삭제되었습니다.' });
});

router.post('/admin/titles/grant', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { studentId, titleId } = req.body;
  await runInsert('INSERT INTO student_titles (student_id, title_id, academy_id) VALUES (?, ?, ?)', [studentId, titleId, academyId]);
  res.json({ message: '칭호가 부여되었습니다.' });
});

// 단어 관리
router.get('/admin/vocab', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { category } = req.query;
  let words;
  if (category) {
    words = await getAll('SELECT * FROM vocab_words WHERE category = ? AND academy_id = ?', [category, academyId]);
  } else {
    words = await getAll('SELECT * FROM vocab_words WHERE academy_id = ?', [academyId]);
  }
  res.json(words);
});

router.post('/admin/vocab', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { category, questionText, correctAnswer, wrongAnswers, difficulty, explanation } = req.body;
  const id = await runInsert(
    'INSERT INTO vocab_words (category, question_text, correct_answer, wrong_answers, difficulty, explanation, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [category, questionText, correctAnswer, JSON.stringify(wrongAnswers), difficulty || 1, explanation || '', academyId]
  );
  res.json({ message: '단어가 추가되었습니다.', id });
});

router.put('/admin/vocab/:id', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { category, questionText, correctAnswer, wrongAnswers, difficulty, explanation } = req.body;
  const fields = [];
  const values = [];

  if (category !== undefined) { fields.push('category = ?'); values.push(category); }
  if (questionText !== undefined) { fields.push('question_text = ?'); values.push(questionText); }
  if (correctAnswer !== undefined) { fields.push('correct_answer = ?'); values.push(correctAnswer); }
  if (wrongAnswers !== undefined) { fields.push('wrong_answers = ?'); values.push(JSON.stringify(wrongAnswers)); }
  if (difficulty !== undefined) { fields.push('difficulty = ?'); values.push(difficulty); }
  if (explanation !== undefined) { fields.push('explanation = ?'); values.push(explanation); }

  if (fields.length === 0) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

  values.push(parseInt(req.params.id));
  values.push(academyId);
  await runQuery(`UPDATE vocab_words SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`, values);
  res.json({ message: '단어가 수정되었습니다.' });
});

router.delete('/admin/vocab/:id', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  await runQuery('DELETE FROM vocab_words WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), academyId]);
  res.json({ message: '단어가 삭제되었습니다.' });
});

router.post('/admin/vocab/bulk', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { words } = req.body;
  if (!words || !Array.isArray(words)) return res.status(400).json({ error: '단어 목록을 입력해주세요.' });

  const ids = [];
  for (const w of words) {
    const id = await runInsert(
      'INSERT INTO vocab_words (category, question_text, correct_answer, wrong_answers, difficulty, explanation, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [w.category, w.questionText, w.correctAnswer, JSON.stringify(w.wrongAnswers || []), w.difficulty || 1, w.explanation || '', academyId]
    );
    ids.push(id);
  }
  res.json({ message: `${words.length}개의 단어가 추가되었습니다.`, ids });
});

// 상점 관리
router.get('/admin/shop', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const items = await getAll('SELECT * FROM shop_items WHERE academy_id = ? ORDER BY created_at DESC', [academyId]);
  res.json(items);
});

router.post('/admin/shop', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { name, description, icon, price, stock, imageUrl } = req.body;
  const id = await runInsert(
    'INSERT INTO shop_items (name, description, icon, price, stock, image_url, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, description || '', icon || '', price || 0, stock !== undefined ? stock : null, imageUrl || '', academyId]
  );
  res.json({ message: '상품이 추가되었습니다.', id });
});

router.put('/admin/shop/:id', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { name, description, icon, price, stock, isActive, imageUrl } = req.body;
  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (icon !== undefined) { fields.push('icon = ?'); values.push(icon); }
  if (price !== undefined) { fields.push('price = ?'); values.push(price); }
  if (stock !== undefined) { fields.push('stock = ?'); values.push(stock); }
  if (isActive !== undefined) { fields.push('is_active = ?'); values.push(isActive); }
  if (imageUrl !== undefined) { fields.push('image_url = ?'); values.push(imageUrl); }

  if (fields.length === 0) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

  values.push(parseInt(req.params.id));
  values.push(academyId);
  await runQuery(`UPDATE shop_items SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`, values);
  res.json({ message: '상품이 수정되었습니다.' });
});

router.delete('/admin/shop/:id', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  await runQuery('DELETE FROM shop_items WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), academyId]);
  res.json({ message: '상품이 삭제되었습니다.' });
});

// 구매 내역 (관리자)
router.get('/admin/shop/purchases', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const purchases = await getAll(
    `SELECT sp.*, si.name as item_name, si.icon, u.name as student_name, s.school, s.grade
     FROM shop_purchases sp
     JOIN shop_items si ON sp.item_id = si.id AND si.academy_id = ?
     JOIN students s ON sp.student_id = s.id AND s.academy_id = ?
     JOIN users u ON s.user_id = u.id
     WHERE sp.academy_id = ?
     ORDER BY sp.created_at DESC`,
    [academyId, academyId, academyId]
  );
  res.json(purchases);
});

// 구매 상태 변경
router.put('/admin/shop/purchases/:id', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { status } = req.body;
  await runQuery('UPDATE shop_purchases SET status = ? WHERE id = ? AND academy_id = ?', [status, parseInt(req.params.id), academyId]);
  res.json({ message: '구매 상태가 변경되었습니다.' });
});

// 어휘 데이터 리시드 (시드 문제만 교체, 직접 추가한 문제 보존)
router.post('/admin/vocab/reseed', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  try {
    delete require.cache[require.resolve('../db/vocabSeed')];
    const vocabData = require('../db/vocabSeed');

    // 시드 문제의 question_text 목록
    const seedQuestions = new Set(vocabData.map(([, q]) => q));

    // 기존 DB에서 시드 문제만 삭제 (직접 추가한 문제는 보존)
    const existing = await getAll('SELECT id, question_text FROM vocab_words WHERE academy_id = ?', [academyId]);
    let deletedCount = 0;
    for (const row of existing) {
      if (seedQuestions.has(row.question_text)) {
        await runQuery('DELETE FROM vocab_words WHERE id = ? AND academy_id = ?', [row.id, academyId]);
        deletedCount++;
      }
    }

    // 시드 데이터 다시 삽입
    for (const [cat, q, correct, wrong, diff, exp] of vocabData) {
      await runQuery('INSERT INTO vocab_words (category, question_text, correct_answer, wrong_answers, difficulty, explanation, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [cat, q, correct, wrong, diff, exp, academyId]);
    }

    const manualCount = existing.length - deletedCount;
    res.json({ message: `시드 ${vocabData.length}개 새로고침, 직접 추가 ${manualCount}개 보존됨`, count: vocabData.length + manualCount });
  } catch (e) {
    res.status(500).json({ error: '어휘 리시드 실패: ' + e.message });
  }
});

// 지식 퀴즈 전체 리시드 (기존 문제 모두 교체)
router.post('/admin/knowledge/reseed', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  try {
    delete require.cache[require.resolve('../db/knowledgeQuizSeed')];
    const kqData = require('../db/knowledgeQuizSeed');
    await runQuery('DELETE FROM knowledge_questions WHERE academy_id = ?', [academyId]);
    for (const [cat, q, correct, wrong, diff, exp] of kqData) {
      await runQuery('INSERT INTO knowledge_questions (category, question_text, correct_answer, wrong_answers, difficulty, explanation, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [cat, q, correct, wrong, diff, exp, academyId]);
    }
    res.json({ message: `지식 퀴즈 ${kqData.length}개 문제로 리시드 완료`, count: kqData.length });
  } catch (e) {
    res.status(500).json({ error: '지식 퀴즈 리시드 실패: ' + e.message });
  }
});

router.post('/admin/reading/reseed', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  try {
    delete require.cache[require.resolve('../db/readingPassageSeed')];
    const rpData = require('../db/readingPassageSeed');
    await runQuery('DELETE FROM reading_questions WHERE academy_id = ?', [academyId]);
    await runQuery('DELETE FROM reading_passages WHERE academy_id = ?', [academyId]);
    let passageCount = 0, questionCount = 0;
    for (const p of rpData) {
      const pid = await runInsert('INSERT INTO reading_passages (category, title, content, difficulty, source_info, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
        [p.category, p.title, p.content, p.difficulty || 2, p.source_info || '', academyId]);
      passageCount++;
      for (const q of (p.questions || [])) {
        await runQuery('INSERT INTO reading_questions (passage_id, question_type, question_text, correct_answer, wrong_answers, explanation, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [pid, q.type || '내용일치', q.text, q.correct, JSON.stringify(q.wrongs), q.explanation || '', academyId]);
        questionCount++;
      }
    }
    res.json({ message: `비문학 독해 ${passageCount}개 지문, ${questionCount}개 문제로 리시드 완료`, passageCount, questionCount });
  } catch (e) {
    res.status(500).json({ error: '비문학 리시드 실패: ' + e.message });
  }
});

// === 학생 시드 데이터 ===
router.post('/admin/seed-students', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  try {
    const bcrypt = require('bcryptjs');
    delete require.cache[require.resolve('../db/studentSeed')];
    const studentData = require('../db/studentSeed');
    const hashedPassword = bcrypt.hashSync('1234', 10);

    let created = 0, skipped = 0;
    for (const [username, pw, name, school, grade, parentName, parentPhone] of studentData) {
      const existing = await getOne('SELECT id FROM users WHERE username = ? AND academy_id = ?', [username, academyId]);
      if (existing) { skipped++; continue; }

      const userId = await runInsert(
        'INSERT INTO users (username, password, name, role, approved, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
        [username, hashedPassword, name, 'student', 1, academyId]
      );
      await runInsert(
        'INSERT INTO students (user_id, school, grade, parent_name, parent_phone, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, school, grade, parentName, parentPhone, academyId]
      );
      created++;
    }

    res.json({ message: `학생 시드 완료! ${created}명 생성, ${skipped}명 이미 존재`, created, skipped });
  } catch (e) {
    res.status(500).json({ error: '학생 시드 실패: ' + e.message });
  }
});

// === 학생 데이터 백업 ===
const fs = require('fs');

router.get('/admin/backup/students', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  try {
    const users = await getAll("SELECT * FROM users WHERE role = 'student' AND academy_id = ?", [academyId]);
    const students = await getAll("SELECT * FROM students WHERE academy_id = ?", [academyId]);
    const studentCharacters = await getAll("SELECT * FROM student_characters WHERE academy_id = ?", [academyId]);
    const studentTitles = await getAll("SELECT * FROM student_titles WHERE academy_id = ?", [academyId]);
    const xpLogs = await getAll("SELECT * FROM xp_logs WHERE academy_id = ?", [academyId]);
    const vocabGameLogs = await getAll("SELECT * FROM vocab_game_logs WHERE academy_id = ?", [academyId]);
    const codeRedemptions = await getAll("SELECT * FROM code_redemptions WHERE academy_id = ?", [academyId]);
    const shopPurchases = await getAll("SELECT * FROM shop_purchases WHERE academy_id = ?", [academyId]);
    const scores = await getAll("SELECT * FROM scores WHERE academy_id = ?", [academyId]);
    const reviews = await getAll("SELECT * FROM reviews WHERE academy_id = ?", [academyId]);
    const questions = await getAll("SELECT * FROM questions WHERE academy_id = ?", [academyId]);
    const profileEditRequests = await getAll("SELECT * FROM profile_edit_requests WHERE academy_id = ?", [academyId]);

    const backup = {
      version: 1,
      created_at: new Date().toISOString(),
      data: {
        users, students, student_characters: studentCharacters,
        student_titles: studentTitles, xp_logs: xpLogs,
        vocab_game_logs: vocabGameLogs, code_redemptions: codeRedemptions,
        shop_purchases: shopPurchases, scores, reviews, questions,
        profile_edit_requests: profileEditRequests
      }
    };

    res.setHeader('Content-Disposition', `attachment; filename=student-backup-${new Date().toISOString().slice(0,10)}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (e) {
    res.status(500).json({ error: '백업 실패: ' + e.message });
  }
});

// 자동 백업 (서버 내 파일 저장 — 테이블별 분리)
router.post('/admin/backup/auto', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  try {
    const dateStr = new Date().toISOString().slice(0,10);
    const backupDir = path.join(__dirname, '../../backups', String(academyId), dateStr);
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const tables = {
      users: await getAll("SELECT * FROM users WHERE role = 'student' AND academy_id = ?", [academyId]),
      students: await getAll("SELECT * FROM students WHERE academy_id = ?", [academyId]),
      student_characters: await getAll("SELECT * FROM student_characters WHERE academy_id = ?", [academyId]),
      student_titles: await getAll("SELECT * FROM student_titles WHERE academy_id = ?", [academyId]),
      xp_logs: await getAll("SELECT * FROM xp_logs WHERE academy_id = ?", [academyId]),
      vocab_game_logs: await getAll("SELECT * FROM vocab_game_logs WHERE academy_id = ?", [academyId]),
      code_redemptions: await getAll("SELECT * FROM code_redemptions WHERE academy_id = ?", [academyId]),
      shop_purchases: await getAll("SELECT * FROM shop_purchases WHERE academy_id = ?", [academyId]),
      scores: await getAll("SELECT * FROM scores WHERE academy_id = ?", [academyId]),
      reviews: await getAll("SELECT * FROM reviews WHERE academy_id = ?", [academyId]),
      questions: await getAll("SELECT * FROM questions WHERE academy_id = ?", [academyId]),
      profile_edit_requests: await getAll("SELECT * FROM profile_edit_requests WHERE academy_id = ?", [academyId]),
    };

    // 각 테이블별 분리 저장
    Object.entries(tables).forEach(([name, data]) => {
      fs.writeFileSync(path.join(backupDir, `${name}.json`), JSON.stringify(data, null, 2));
    });

    // 통합 백업도 함께 저장
    const backup = { version: 1, created_at: new Date().toISOString(), data: tables };
    fs.writeFileSync(path.join(backupDir, 'full-backup.json'), JSON.stringify(backup, null, 2));

    // 오래된 백업 폴더 정리 (최근 30일만 유지)
    const rootDir = path.join(__dirname, '../../backups', String(academyId));
    const dirs = fs.readdirSync(rootDir).filter(f => {
      const full = path.join(rootDir, f);
      return fs.statSync(full).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(f);
    }).sort().reverse();
    dirs.slice(30).forEach(d => {
      fs.rmSync(path.join(rootDir, d), { recursive: true, force: true });
    });

    const fileCount = Object.keys(tables).length;
    res.json({ message: `백업 완료! ${dateStr} 폴더에 ${fileCount}개 테이블 분리 저장됨`, folder: dateStr });
  } catch (e) {
    res.status(500).json({ error: '자동 백업 실패: ' + e.message });
  }
});

// 백업 목록
router.get('/admin/backup/list', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  try {
    const rootDir = path.join(__dirname, '../../backups', String(academyId));
    if (!fs.existsSync(rootDir)) return res.json([]);
    const dirs = fs.readdirSync(rootDir).filter(f => {
      const full = path.join(rootDir, f);
      return fs.statSync(full).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(f);
    }).sort().reverse();

    const result = dirs.map(d => {
      const dirPath = path.join(rootDir, d);
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
      const totalSize = files.reduce((sum, f) => sum + fs.statSync(path.join(dirPath, f)).size, 0);
      return { date: d, fileCount: files.length, size: totalSize, files: files };
    });
    res.json(result);
  } catch (e) {
    res.json([]);
  }
});

// === 슬롯 백업 시스템 (서버 1/2/3) ===
router.post('/admin/backup/slot/:slot', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const slot = parseInt(req.params.slot);
  if (slot < 1 || slot > 3) return res.status(400).json({ error: '슬롯은 1~3만 가능합니다.' });

  try {
    const slotDir = path.join(__dirname, '../../backups', String(academyId), `slot-${slot}`);
    if (!fs.existsSync(slotDir)) fs.mkdirSync(slotDir, { recursive: true });

    const tables = {
      users: await getAll("SELECT * FROM users WHERE academy_id = ?", [academyId]),
      students: await getAll("SELECT * FROM students WHERE academy_id = ?", [academyId]),
      student_characters: await getAll("SELECT * FROM student_characters WHERE academy_id = ?", [academyId]),
      student_titles: await getAll("SELECT * FROM student_titles WHERE academy_id = ?", [academyId]),
      xp_logs: await getAll("SELECT * FROM xp_logs WHERE academy_id = ?", [academyId]),
      vocab_game_logs: await getAll("SELECT * FROM vocab_game_logs WHERE academy_id = ?", [academyId]),
      code_redemptions: await getAll("SELECT * FROM code_redemptions WHERE academy_id = ?", [academyId]),
      shop_purchases: await getAll("SELECT * FROM shop_purchases WHERE academy_id = ?", [academyId]),
      scores: await getAll("SELECT * FROM scores WHERE academy_id = ?", [academyId]),
      reviews: await getAll("SELECT * FROM reviews WHERE academy_id = ?", [academyId]),
      questions: await getAll("SELECT * FROM questions WHERE academy_id = ?", [academyId]),
      exams: await getAll("SELECT * FROM exams WHERE academy_id = ?", [academyId]),
      notices: await getAll("SELECT * FROM notices WHERE academy_id = ?", [academyId]),
      clinic_appointments: await getAll("SELECT * FROM clinic_appointments WHERE academy_id = ?", [academyId]),
      student_answers: await getAll("SELECT * FROM student_answers WHERE academy_id = ?", [academyId]),
      exam_answer_keys: await getAll("SELECT * FROM exam_answer_keys WHERE academy_id = ?", [academyId]),
    };

    const backup = {
      version: 2,
      slot,
      created_at: new Date().toISOString(),
      tableCount: Object.keys(tables).length,
      rowCounts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
      data: tables,
    };

    fs.writeFileSync(path.join(slotDir, 'full-backup.json'), JSON.stringify(backup));

    // 메타 정보 저장
    const meta = { slot, created_at: backup.created_at, tableCount: backup.tableCount, rowCounts: backup.rowCounts };
    fs.writeFileSync(path.join(slotDir, 'meta.json'), JSON.stringify(meta, null, 2));

    const totalRows = Object.values(backup.rowCounts).reduce((s, v) => s + v, 0);
    res.json({ message: `서버 ${slot}에 백업 완료! (${backup.tableCount}개 테이블, ${totalRows}행)`, meta });
  } catch (e) {
    res.status(500).json({ error: '백업 실패: ' + e.message });
  }
});

// 슬롯 백업 상태 조회
router.get('/admin/backup/slots', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const slots = [];
  for (let i = 1; i <= 3; i++) {
    const metaPath = path.join(__dirname, '../../backups', String(academyId), `slot-${i}`, 'meta.json');
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const backupPath = path.join(__dirname, '../../backups', String(academyId), `slot-${i}`, 'full-backup.json');
        const size = fs.existsSync(backupPath) ? fs.statSync(backupPath).size : 0;
        slots.push({ slot: i, ...meta, size });
      } catch (e) {
        slots.push({ slot: i, created_at: null, empty: true });
      }
    } else {
      slots.push({ slot: i, created_at: null, empty: true });
    }
  }
  res.json(slots);
});

// 슬롯 백업 복원
router.post('/admin/backup/slot/:slot/restore', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const slot = parseInt(req.params.slot);
  const backupPath = path.join(__dirname, '../../backups', String(academyId), `slot-${slot}`, 'full-backup.json');

  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: `서버 ${slot}에 백업이 없습니다.` });
  }

  try {
    const raw = fs.readFileSync(backupPath, 'utf-8');
    const backup = JSON.parse(raw);

    if (!backup.data) return res.status(400).json({ error: '유효하지 않은 백업 파일입니다.' });

    // 복원 전 현재 상태를 임시 백업
    const tempDir = path.join(__dirname, '../../backups', String(academyId), 'pre-restore-temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const currentBackup = {
      users: await getAll("SELECT * FROM users WHERE academy_id = ?", [academyId]),
      students: await getAll("SELECT * FROM students WHERE academy_id = ?", [academyId]),
      student_characters: await getAll("SELECT * FROM student_characters WHERE academy_id = ?", [academyId]),
    };
    fs.writeFileSync(path.join(tempDir, 'quick-backup.json'), JSON.stringify(currentBackup));

    // 테이블별 복원
    const restoredTables = [];
    const tableOrder = ['users', 'students', 'exams', 'notices', 'student_characters', 'student_titles',
      'xp_logs', 'vocab_game_logs', 'code_redemptions', 'shop_purchases', 'scores', 'reviews',
      'questions', 'clinic_appointments', 'student_answers', 'exam_answer_keys'];

    for (const table of tableOrder) {
      const rows = backup.data[table];
      if (!rows || !Array.isArray(rows) || rows.length === 0) continue;

      // 기존 데이터 삭제 (users는 role별 처리)
      if (table === 'users') {
        await runQuery("DELETE FROM users WHERE role = 'student' AND academy_id = ?", [academyId]);
      } else {
        try { await runQuery(`DELETE FROM ${table} WHERE academy_id = ?`, [academyId]); } catch(e) {}
      }

      // 데이터 삽입
      const cols = Object.keys(rows[0]);
      const placeholders = cols.map(() => '?').join(',');
      let inserted = 0;
      for (const row of rows) {
        if (table === 'users' && row.role === 'admin') continue;
        try {
          await runQuery(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`,
            cols.map(c => row[c]));
          inserted++;
        } catch(e) {}
      }
      restoredTables.push(`${table}: ${inserted}행`);
    }

    res.json({ message: `서버 ${slot} 백업에서 복원 완료!\n${restoredTables.join(', ')}` });
  } catch (e) {
    res.status(500).json({ error: '복원 실패: ' + e.message });
  }
});

// 학생 데이터 복원
router.post('/admin/restore/students', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  try {
    const { data, version } = req.body;
    if (!data || !version) return res.status(400).json({ error: '유효하지 않은 백업 파일입니다.' });

    // 기존 학생 데이터 삭제
    await runQuery("DELETE FROM profile_edit_requests WHERE academy_id = ?", [academyId]);
    await runQuery("DELETE FROM questions WHERE academy_id = ?", [academyId]);
    await runQuery("DELETE FROM reviews WHERE academy_id = ?", [academyId]);
    await runQuery("DELETE FROM scores WHERE academy_id = ?", [academyId]);
    await runQuery("DELETE FROM shop_purchases WHERE academy_id = ?", [academyId]);
    await runQuery("DELETE FROM code_redemptions WHERE academy_id = ?", [academyId]);
    await runQuery("DELETE FROM vocab_game_logs WHERE academy_id = ?", [academyId]);
    await runQuery("DELETE FROM xp_logs WHERE academy_id = ?", [academyId]);
    await runQuery("DELETE FROM student_titles WHERE academy_id = ?", [academyId]);
    await runQuery("DELETE FROM student_characters WHERE academy_id = ?", [academyId]);
    await runQuery("DELETE FROM students WHERE academy_id = ?", [academyId]);
    await runQuery("DELETE FROM users WHERE role = 'student' AND academy_id = ?", [academyId]);

    // 복원
    let userCount = 0, studentCount = 0;

    for (const u of (data.users || [])) {
      await runQuery('INSERT OR IGNORE INTO users (id, username, password, name, role, approved, phone, created_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [u.id, u.username, u.password, u.name, u.role, u.approved, u.phone, u.created_at, academyId]);
      userCount++;
    }

    for (const s of (data.students || [])) {
      await runQuery('INSERT OR IGNORE INTO students (id, user_id, school, grade, parent_name, parent_phone, memo, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [s.id, s.user_id, s.school, s.grade, s.parent_name, s.parent_phone, s.memo || '', academyId]);
      studentCount++;
    }

    for (const sc of (data.student_characters || [])) {
      await runQuery('INSERT OR IGNORE INTO student_characters (id, student_id, character_id, xp, level, points, selected_title_id, created_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [sc.id, sc.student_id, sc.character_id, sc.xp, sc.level, sc.points, sc.selected_title_id, sc.created_at, academyId]);
    }

    for (const st of (data.student_titles || [])) {
      await runQuery('INSERT OR IGNORE INTO student_titles (id, student_id, title_id, earned_at, academy_id) VALUES (?, ?, ?, ?, ?)',
        [st.id, st.student_id, st.title_id, st.earned_at, academyId]);
    }

    for (const x of (data.xp_logs || [])) {
      await runQuery('INSERT OR IGNORE INTO xp_logs (id, student_id, amount, source, description, created_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [x.id, x.student_id, x.amount, x.source, x.description, x.created_at, academyId]);
    }

    for (const v of (data.vocab_game_logs || [])) {
      await runQuery('INSERT OR IGNORE INTO vocab_game_logs (id, student_id, total_questions, correct_count, xp_earned, played_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [v.id, v.student_id, v.total_questions, v.correct_count, v.xp_earned, v.played_at, academyId]);
    }

    for (const c of (data.code_redemptions || [])) {
      await runQuery('INSERT OR IGNORE INTO code_redemptions (id, student_id, code_id, redeemed_at, academy_id) VALUES (?, ?, ?, ?, ?)',
        [c.id, c.student_id, c.code_id, c.redeemed_at, academyId]);
    }

    for (const p of (data.shop_purchases || [])) {
      await runQuery('INSERT OR IGNORE INTO shop_purchases (id, student_id, item_id, price_paid, status, created_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.student_id, p.item_id, p.price_paid, p.status, p.created_at, academyId]);
    }

    for (const s of (data.scores || [])) {
      await runQuery('INSERT OR IGNORE INTO scores (id, student_id, exam_id, score, rank_num, note, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [s.id, s.student_id, s.exam_id, s.score, s.rank_num, s.note, academyId]);
    }

    for (const r of (data.reviews || [])) {
      await runQuery('INSERT OR IGNORE INTO reviews (id, student_id, content, is_best, status, created_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [r.id, r.student_id, r.content, r.is_best, r.status, r.created_at, academyId]);
    }

    for (const q of (data.questions || [])) {
      await runQuery('INSERT OR IGNORE INTO questions (id, student_id, question, answer, status, created_at, answered_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [q.id, q.student_id, q.question, q.answer, q.status, q.created_at, q.answered_at, academyId]);
    }

    for (const p of (data.profile_edit_requests || [])) {
      await runQuery('INSERT OR IGNORE INTO profile_edit_requests (id, student_id, field_name, old_value, new_value, status, created_at, resolved_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.student_id, p.field_name, p.old_value, p.new_value, p.status, p.created_at, p.resolved_at, academyId]);
    }

    res.json({ message: `복원 완료! 학생 ${studentCount}명 복원됨`, userCount, studentCount });
  } catch (e) {
    res.status(500).json({ error: '복원 실패: ' + e.message });
  }
});

// === 상점/칭호/캐릭터 리셋 (시드 데이터 다시 적용) ===
router.post('/admin/reseed-game-config', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  try {
    // 상점 아이템 리셋
    await runQuery('DELETE FROM shop_items WHERE academy_id = ?', [academyId]);
    const shopData = [
      ['두쫀쿠 교환권', '달콤한 두쫀쿠 1개', '🍪', 2000, null, 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&h=300&fit=crop'],
      ['꽈배기 교환권', '맛있는 꽈배기 1개', '🥨', 1500, null, 'https://images.unsplash.com/photo-1558326567-98ae2405596b?w=400&h=300&fit=crop'],
      ['메가커피 5000원권', '메가커피 5,000원 음료 교환권', '☕', 4000, null, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop'],
      ['바나프레소 5000원권', '바나프레소 5,000원 음료 교환권', '🥤', 4000, null, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=300&fit=crop'],
      ['세븐일레븐 3000원권', '세븐일레븐 편의점 3,000원 이용권', '🏪', 5000, null, 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&h=300&fit=crop'],
      ['씨유 3000원권', 'CU 편의점 3,000원 이용권', '🏬', 5000, null, 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&h=300&fit=crop'],
      ['치킨 교환권', '치킨 1마리 교환권', '🍗', 15000, 3, 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=300&fit=crop'],
      ['피자 교환권', '피자 1판 교환권', '🍕', 20000, 2, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop'],
      ['과제 면제권', '과제 1회 면제', '📋', 8000, 5, ''],
      ['선생님 커피 심부름권', '강인쌤한테 커피 사오라고 시키기', '☕', 2000, null, ''],
      ['강인쌤이랑 식사데이트', '강인쌤과 함께하는 특별한 식사!', '🍽️', 30000, 2, ''],
    ];
    for (const [name, desc, icon, price, stock, imageUrl] of shopData) {
      await runQuery('INSERT INTO shop_items (name, description, icon, price, stock, image_url, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, desc, icon, price, stock, imageUrl || '', academyId]);
    }

    // 칭호 리셋
    await runQuery('DELETE FROM titles WHERE academy_id = ?', [academyId]);
    // [name, description, condition_type, condition_value, icon, is_hidden]
    const titles = [
      // 일반 칭호 - XP
      ['천리길도 한걸음부터', '첫 퀴즈 도전!', 'xp_total', 100, '👣', 0],
      ['국어 근성러', 'XP 1,000 달성', 'xp_total', 1000, '💪', 0],
      ['포인트 수집가', 'XP 3,000 달성', 'xp_total', 3000, '💰', 0],
      ['경험의 대가', 'XP 10,000 달성', 'xp_total', 10000, '💎', 0],
      ['포인트 부자', 'XP 30,000 달성', 'xp_total', 30000, '🤑', 0],
      ['만렙 도전자', 'XP 50,000 달성', 'xp_total', 50000, '🔥', 0],
      // 일반 칭호 - 퀴즈
      ['어휘 새싹', '어휘 퀴즈 50문제 정답', 'quiz_count', 50, '🌱', 0],
      ['문제은행 털이범', '퀴즈 100문제 정답', 'quiz_count', 100, '🏦', 0],
      ['어휘왕', '어휘 퀴즈 200문제 정답', 'quiz_count', 200, '👑', 0],
      ['퀴즈 광풍', '퀴즈 500문제 정답', 'quiz_count', 500, '🌪️', 0],
      ['퀴즈의 신', '퀴즈 1000문제 정답', 'quiz_count', 1000, '⚡', 0],
      // 일반 칭호 - 코드
      ['코드 헌터', '코드 10회 입력', 'code_count', 10, '🔎', 0],
      ['출석의 달인', '코드 30회 입력', 'code_count', 30, '⭐', 0],
      ['꾸준함의 미학', '코드 50회 입력', 'code_count', 50, '🏃', 0],
      ['코드 마니아', '코드 100회 입력', 'code_count', 100, '🎯', 0],
      // 일반 칭호 - 레벨
      ['학도의 길', '레벨 10 달성', 'level', 10, '📘', 0],
      ['국어 덕후', '레벨 20 달성', 'level', 20, '🤓', 0],
      ['고수의 경지', '레벨 30 달성', 'level', 30, '🏆', 0],
      ['전설의 시작', '레벨 40 달성', 'level', 40, '🌟', 0],
      ['국어의 신', '레벨 50 달성', 'level', 50, '🌈', 0],
      ['초월자', '레벨 60 달성', 'level', 60, '🌀', 0],
      ['지배자', '레벨 70 달성', 'level', 70, '🦁', 0],
      ['인간 국보', '레벨 80 달성', 'level', 80, '🏛️', 0],
      ['세종대왕급', '레벨 90 달성', 'level', 90, '👑', 0],
      ['강인쌤과 동급', '레벨 100 달성', 'level', 100, '🌈', 0],
      // 히든 칭호
      ['국어 초월자', '???', 'xp_total', 100000, '🌀', 1],
      ['강인쌤의 비밀병기', '???', 'level', 45, '🗡️', 1],
      ['퀴즈 폐인', '???', 'quiz_count', 2000, '🧟', 1],
      ['코드 수집광', '???', 'code_count', 200, '🗃️', 1],
      ['전설은 아니고 레전드', '???', 'level', 35, '🎭', 1],
      ['뭔가 대단한 사람', '???', 'xp_total', 7777, '✴️', 1],
      ['숨겨진 고수', '???', 'quiz_count', 777, '🥷', 1],
      ['강인쌤 절친', '???', 'manual', 0, '🤝', 1],
      ['국어 마스터', '???', 'level', 75, '🐉', 1],
      ['XP 백만장자', '???', 'xp_total', 200000, '💵', 1],
    ];
    for (const [name, desc, type, val, icon, hidden] of titles) {
      await runQuery('INSERT INTO titles (name, description, condition_type, condition_value, icon, is_hidden, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [name, desc, type, val, icon, hidden, academyId]);
    }

    // 캐릭터 잠금레벨 업데이트 (기존 ID 유지하도록 UPSERT)
    const chars = [
      [1, '호랑이', '🐯', '용맹한 한국의 수호 동물', 1],
      [2, '용', '🐲', '하늘을 나는 지혜의 상징', 5],
      [3, '독수리', '🦅', '높이 나는 자유의 새', 1],
      [4, '여우', '🦊', '영리한 숲의 요정', 1],
      [5, '늑대', '🐺', '강인한 달밤의 사냥꾼', 10],
      [6, '사자', '🦁', '당당한 초원의 왕', 15],
      [7, '불사조', '🔥', '전설의 불새', 30],
      [8, '유니콘', '🦄', '신비로운 마법의 존재', 40],
    ];
    await runQuery('DELETE FROM characters WHERE id NOT IN (1,2,3,4,5,6,7,8) AND academy_id = ?', [academyId]);
    for (const [id, name, emoji, desc, lvl] of chars) {
      const existing = await getOne('SELECT id FROM characters WHERE id = ? AND academy_id = ?', [id, academyId]);
      if (existing) {
        await runQuery('UPDATE characters SET name=?, emoji=?, description=?, unlock_level=? WHERE id=? AND academy_id = ?', [name, emoji, desc, lvl, id, academyId]);
      } else {
        await runQuery('INSERT INTO characters (id, name, emoji, description, unlock_level, academy_id) VALUES (?, ?, ?, ?, ?, ?)', [id, name, emoji, desc, lvl, academyId]);
      }
    }
    // 기존 학생들의 character_id가 유효하지 않으면 1로 리셋
    await runQuery('UPDATE student_characters SET character_id = 1 WHERE character_id NOT IN (SELECT id FROM characters WHERE academy_id = ?) AND academy_id = ?', [academyId, academyId]);

    res.json({ message: `게임 설정 리셋 완료! 상점 ${shopData.length}개, 칭호 ${titles.length}개, 캐릭터 ${chars.length}개 재생성` });
  } catch (e) {
    res.status(500).json({ error: '게임 설정 리셋 실패: ' + e.message });
  }
});

// === 만렙 마스터 계정 생성 ===
router.post('/admin/create-master', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  try {
    // 관리자 본인의 user_id로 학생 레코드 생성 (관리자=마스터 통합)
    const adminUserId = req.user.id;

    // 기존 별도 master 유저가 있으면 삭제
    const oldMaster = await getOne("SELECT id FROM users WHERE username = 'master' AND academy_id = ?", [academyId]);
    if (oldMaster) {
      const oldStudent = await getOne("SELECT id FROM students WHERE user_id = ? AND academy_id = ?", [oldMaster.id, academyId]);
      if (oldStudent) {
        await runQuery("DELETE FROM student_characters WHERE student_id = ? AND academy_id = ?", [oldStudent.id, academyId]);
        await runQuery("DELETE FROM student_titles WHERE student_id = ? AND academy_id = ?", [oldStudent.id, academyId]);
        await runQuery("DELETE FROM vocab_game_logs WHERE student_id = ? AND academy_id = ?", [oldStudent.id, academyId]);
        await runQuery("DELETE FROM xp_logs WHERE student_id = ? AND academy_id = ?", [oldStudent.id, academyId]);
        await runQuery("DELETE FROM students WHERE id = ? AND academy_id = ?", [oldStudent.id, academyId]);
      }
      await runQuery("DELETE FROM users WHERE id = ? AND academy_id = ?", [oldMaster.id, academyId]);
    }

    // admin의 학생 레코드 확인/생성
    let adminStudent = await getOne("SELECT id FROM students WHERE user_id = ? AND academy_id = ?", [adminUserId, academyId]);
    if (!adminStudent) {
      await runQuery(
        "INSERT INTO students (user_id, school, grade, parent_name, parent_phone, academy_id) VALUES (?, ?, ?, ?, ?, ?)",
        [adminUserId, '관리자', '관리자', '', '', academyId]
      );
      adminStudent = await getOne("SELECT id FROM students WHERE user_id = ? AND academy_id = ?", [adminUserId, academyId]);
    }

    // Lv.100에 필요한 XP 계산
    let totalXp = 0;
    for (let lv = 1; lv < 100; lv++) {
      totalXp += Math.floor(40 * Math.pow(lv + 1, 1.4));
    }
    totalXp += 100;

    const masterAvatarConfig = JSON.stringify({
      topType: 'WinterHat4',
      accessoriesType: 'Sunglasses',
      hairColor: 'Platinum',
      facialHairType: 'Blank',
      clotheType: 'BlazerSweater',
      clotheColor: 'Black',
      eyeType: 'Happy',
      eyebrowType: 'Default',
      mouthType: 'Smile',
      skinColor: 'Light',
      mascot: 'unicorn',
    });

    // student_characters 생성/업데이트
    const existing = await getOne("SELECT id FROM student_characters WHERE student_id = ? AND academy_id = ?", [adminStudent.id, academyId]);
    if (existing) {
      await runQuery(
        "UPDATE student_characters SET xp = ?, level = 100, points = 999999, avatar_config = ? WHERE student_id = ? AND academy_id = ?",
        [totalXp, masterAvatarConfig, adminStudent.id, academyId]
      );
    } else {
      await runQuery(
        "INSERT INTO student_characters (student_id, character_id, xp, level, points, avatar_config, academy_id) VALUES (?, 8, ?, 100, 999999, ?, ?)",
        [adminStudent.id, totalXp, masterAvatarConfig, academyId]
      );
    }

    // 모든 칭호 부여
    const allTitles = await getAll("SELECT id FROM titles WHERE academy_id = ?", [academyId]);
    for (const t of allTitles) {
      const has = await getOne("SELECT id FROM student_titles WHERE student_id = ? AND title_id = ? AND academy_id = ?", [adminStudent.id, t.id, academyId]);
      if (!has) {
        await runQuery("INSERT INTO student_titles (student_id, title_id, academy_id) VALUES (?, ?, ?)", [adminStudent.id, t.id, academyId]);
      }
    }

    res.json({
      message: '관리자 마스터 캐릭터 설정 완료! (관리자 계정에 통합)',
      level: 100,
      xp: totalXp,
      points: 999999
    });
  } catch (e) {
    res.status(500).json({ error: '마스터 설정 실패: ' + e.message });
  }
});

// === 게임 설정 API ===
router.get('/admin/game-settings', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const settings = await getAll('SELECT * FROM game_settings WHERE academy_id = ?', [academyId]);
  const obj = {};
  settings.forEach(s => { obj[s.key] = s.value; });
  res.json(obj);
});

router.put('/admin/game-settings', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') return res.status(400).json({ error: '설정 데이터가 필요합니다.' });
  for (const [key, value] of Object.entries(settings)) {
    const existing = await getOne('SELECT key FROM game_settings WHERE key = ? AND academy_id = ?', [key, academyId]);
    if (existing) {
      await runQuery('UPDATE game_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ? AND academy_id = ?', [String(value), key, academyId]);
    } else {
      await runQuery('INSERT INTO game_settings (key, value, academy_id) VALUES (?, ?, ?)', [key, String(value), academyId]);
    }
  }
  res.json({ message: '설정이 저장되었습니다.' });
});

// 게임 설정 조회 (학생용)
router.get('/game-settings', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const settings = await getAll('SELECT * FROM game_settings WHERE academy_id = ?', [academyId]);
  const obj = {};
  settings.forEach(s => { obj[s.key] = s.value; });
  res.json(obj);
});

// === 어휘 DB 엑셀 다운로드 ===
router.get('/admin/vocab/export', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const words = await getAll('SELECT category, question_text, correct_answer, wrong_answers, difficulty, explanation FROM vocab_words WHERE academy_id = ? ORDER BY category, id', [academyId]);
  // CSV format
  let csv = '\uFEFF카테고리,질문,정답,오답들,난이도,설명\n';
  words.forEach(w => {
    const escape = (s) => '"' + (s || '').replace(/"/g, '""') + '"';
    csv += `${escape(w.category)},${escape(w.question_text)},${escape(w.correct_answer)},${escape(w.wrong_answers)},${w.difficulty},${escape(w.explanation)}\n`;
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=vocab_words.csv');
  res.send(csv);
});

// 주간/월간 랭킹 보상 지급
router.post('/admin/ranking-rewards', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { type } = req.body; // 'weekly' or 'monthly'
  if (!type || !['weekly', 'monthly'].includes(type)) {
    return res.status(400).json({ error: 'type은 weekly 또는 monthly여야 합니다.' });
  }

  // reward_settings 테이블에서 보상 설정 읽기 (없으면 기본값)
  const rewardRows = await getAll('SELECT rank, amount FROM reward_settings WHERE type = ? AND academy_id = ?', [type, academyId]);
  let rewards;
  if (rewardRows && rewardRows.length > 0) {
    rewards = {};
    rewardRows.forEach(r => { rewards[r.rank] = r.amount; });
  } else {
    rewards = type === 'weekly'
      ? { 1: 500, 2: 300, 3: 200, 4: 100, 5: 100, 6: 100, 7: 100, 8: 100, 9: 100, 10: 100 }
      : { 1: 1000, 2: 600, 3: 400, 4: 200, 5: 200, 6: 200, 7: 200, 8: 200, 9: 200, 10: 200 };
  }

  const since = type === 'weekly' ? getLastFridayMidnight() : getMonthStartMidnight();

  const rankings = await getAll(
    `SELECT sc.student_id, COALESCE(SUM(xl.amount), 0) as period_xp, u.name
     FROM student_characters sc
     JOIN students s ON sc.student_id = s.id AND s.academy_id = ?
     JOIN users u ON s.user_id = u.id
     LEFT JOIN xp_logs xl ON xl.student_id = sc.student_id AND xl.created_at >= ? AND xl.amount > 0 AND xl.academy_id = ?
     WHERE u.role != 'admin' AND sc.academy_id = ?
     GROUP BY sc.student_id
     HAVING period_xp > 0
     ORDER BY period_xp DESC LIMIT 10`,
    [academyId, since, academyId, academyId]
  );

  const rewarded = [];
  for (const [idx, r] of rankings.entries()) {
    const rank = idx + 1;
    const amount = rewards[rank];
    if (!amount) continue;

    const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [r.student_id, academyId]);
    if (!sc) continue;

    const newXp = sc.xp + amount;
    const newPoints = sc.points + amount;
    const newLevel = getLevelInfo(newXp).level;

    await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
      [newXp, newPoints, newLevel, r.student_id, academyId]);

    const label = type === 'weekly' ? '주간' : '월간';
    await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'admin_adjust', ?, ?)",
      [r.student_id, amount, `${label} 랭킹 ${rank}위 보상`, academyId]);

    await checkAndGrantTitles(r.student_id, academyId);
    rewarded.push({ rank, name: r.name, amount, xp: r.period_xp });
  }

  res.json({ message: `${type === 'weekly' ? '주간' : '월간'} 랭킹 보상이 지급되었습니다.`, rewarded });
});

// ============================================================
// ========== 랭킹 보상 설정 관리 ==========
// ============================================================

// 보상 설정 조회
router.get('/reward-settings', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const settings = await getAll('SELECT * FROM reward_settings WHERE academy_id = ? ORDER BY type, rank', [academyId]);
  res.json(settings);
});

// 보상 설정 수정
router.post('/reward-settings', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { settings } = req.body; // [{type, rank, amount}, ...]
  if (!settings || !Array.isArray(settings)) {
    return res.status(400).json({ error: '설정 데이터가 필요합니다.' });
  }

  for (const s of settings) {
    const existing = await getOne('SELECT id FROM reward_settings WHERE type = ? AND rank = ? AND academy_id = ?', [s.type, s.rank, academyId]);
    if (existing) {
      await runQuery('UPDATE reward_settings SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?',
        [s.amount, existing.id, academyId]);
    } else {
      await runInsert('INSERT INTO reward_settings (type, rank, amount, academy_id) VALUES (?, ?, ?, ?)',
        [s.type, s.rank, s.amount, academyId]);
    }
  }

  res.json({ message: '보상 설정이 저장되었습니다.' });
});

// ============================================================
// ========== 지식 퀴즈 (Knowledge Quiz) ==========
// ============================================================

router.get('/knowledge/categories', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const categories = await getAll('SELECT category, COUNT(*) as count FROM knowledge_questions WHERE academy_id = ? GROUP BY category', [academyId]);
  res.json(categories);
});

router.get('/knowledge/start', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const limitSetting = await getOne("SELECT value FROM game_settings WHERE key = 'daily_knowledge_limit' AND academy_id = ?", [academyId]);
  const dailyLimit = limitSetting ? parseInt(limitSetting.value) || 50 : 50;

  const today = getTodayKST();
  const todayResult = await getOne(
    "SELECT COALESCE(SUM(total_questions), 0) as cnt FROM knowledge_game_logs WHERE student_id = ? AND date(played_at) = date(?) AND academy_id = ?",
    [student.id, today, academyId]
  );
  const todayCount = todayResult ? todayResult.cnt : 0;
  const remaining = dailyLimit - todayCount;
  if (remaining <= 0) {
    return res.status(400).json({ error: `오늘의 지식 퀴즈 제한(${dailyLimit}문제)에 도달했습니다.` });
  }

  const category = req.query.category;
  let count = parseInt(req.query.count) || 10;
  if (count > remaining) count = remaining;

  // 맞힌 문제 제외, 틀린 문제는 7일 후 재출제
  const correctIds = (await getAll(
    `SELECT DISTINCT question_id FROM knowledge_question_results
     WHERE student_id = ? AND is_correct = 1 AND academy_id = ?`,
    [student.id, academyId]
  )).map(r => r.question_id);

  const recentWrongIds = (await getAll(
    `SELECT DISTINCT question_id FROM knowledge_question_results
     WHERE student_id = ? AND is_correct = 0
     AND answered_at > datetime('now', '-7 days') AND academy_id = ?`,
    [student.id, academyId]
  )).map(r => r.question_id);

  const excludeIds = [...new Set([...correctIds, ...recentWrongIds])];
  const excludePlaceholder = excludeIds.length > 0 ? `AND id NOT IN (${excludeIds.join(',')})` : '';

  let words;
  if (category) {
    words = await getAll(`SELECT id, category, question_text, correct_answer, wrong_answers, difficulty, explanation FROM knowledge_questions WHERE category = ? AND academy_id = ? ${excludePlaceholder} ORDER BY RANDOM() LIMIT ?`, [category, academyId, count * 2]);
  } else {
    words = await getAll(`SELECT id, category, question_text, correct_answer, wrong_answers, difficulty, explanation FROM knowledge_questions WHERE academy_id = ? ${excludePlaceholder} ORDER BY RANDOM() LIMIT ?`, [academyId, count * 2]);
  }
  words = words.sort(() => Math.random() - 0.5).slice(0, count);

  if (words.length === 0) {
    return res.status(400).json({ error: '출제할 수 있는 문제가 없습니다. 모든 문제를 맞혔거나, 잠시 후 다시 시도해주세요.' });
  }

  const questions = words.map(w => {
    let wrongAnswers;
    try { wrongAnswers = JSON.parse(w.wrong_answers); } catch { wrongAnswers = []; }
    const wrongSlice = wrongAnswers.slice(0, 3);
    const correctIdx = Math.floor(Math.random() * (wrongSlice.length + 1));
    const options = [...wrongSlice];
    options.splice(correctIdx, 0, w.correct_answer);
    return { id: w.id, category: w.category, questionText: w.question_text, options, difficulty: w.difficulty, correctAnswer: w.correct_answer, explanation: w.explanation || '' };
  });

  // 시작 즉시 log 삽입 → 오늘 횟수 즉시 차감 (어뷰징 방지)
  const logId = await runInsert(
    "INSERT INTO knowledge_game_logs (student_id, total_questions, correct_count, xp_earned, academy_id) VALUES (?, ?, 0, 0, ?)",
    [student.id, questions.length, academyId]
  );

  res.json({ questions, logId });
});

router.post('/knowledge/submit', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const { answers, logId } = req.body;
  if (!answers || !Array.isArray(answers)) return res.status(400).json({ error: '답안을 제출해주세요.' });

  let totalXpEarned = 0;
  let correctCount = 0;
  let streak = 0;
  const details = [];

  for (const ans of answers) {
    const q = await getOne('SELECT * FROM knowledge_questions WHERE id = ? AND academy_id = ?', [ans.wordId, academyId]);
    if (!q) continue;

    const isCorrect = ans.selectedAnswer === q.correct_answer;

    // 문제별 결과 기록
    await runInsert(
      'INSERT INTO knowledge_question_results (student_id, question_id, is_correct, academy_id) VALUES (?, ?, ?, ?)',
      [student.id, q.id, isCorrect ? 1 : 0, academyId]
    );

    if (isCorrect) {
      correctCount++;
      streak++;
      let xp = q.difficulty === 3 ? 12 : q.difficulty === 2 ? 8 : 5;
      if (streak >= 5) xp += 3;
      totalXpEarned += xp;
    } else {
      streak = 0;
      let penalty = q.difficulty === 3 ? -5 : q.difficulty === 2 ? -3 : -2;
      totalXpEarned += penalty;
    }

    details.push({
      wordId: q.id,
      correct: isCorrect,
      correctAnswer: q.correct_answer,
      explanation: q.explanation || null
    });
  }

  if (correctCount === answers.length && answers.length >= 5) {
    totalXpEarned = Math.floor(totalXpEarned * 1.5);
  }
  if (totalXpEarned < 0) totalXpEarned = 0;

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

  const oldLevel = getLevelInfo(sc.xp).level;
  const newXp = sc.xp + totalXpEarned;
  const newPoints = sc.points + totalXpEarned;
  const newLevel = getLevelInfo(newXp).level;

  await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
    [newXp, newPoints, newLevel, student.id, academyId]);

  // logId가 있으면 start 시 만든 row를 UPDATE, 없으면 INSERT (하위호환)
  if (logId) {
    await runQuery(
      "UPDATE knowledge_game_logs SET total_questions = ?, correct_count = ?, xp_earned = ? WHERE id = ? AND student_id = ? AND academy_id = ?",
      [answers.length, correctCount, totalXpEarned, logId, student.id, academyId]
    );
  } else {
    await runInsert(
      "INSERT INTO knowledge_game_logs (student_id, total_questions, correct_count, xp_earned, academy_id) VALUES (?, ?, ?, ?, ?)",
      [student.id, answers.length, correctCount, totalXpEarned, academyId]
    );
  }

  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'knowledge_quiz', ?, ?)",
    [student.id, totalXpEarned, `지식 퀴즈 ${correctCount}/${answers.length}`, academyId]);

  await checkAndGrantTitles(student.id, academyId);

  res.json({ correct: correctCount, total: answers.length, xpEarned: totalXpEarned, details, leveledUp: newLevel > oldLevel, newLevel });
});

// 지식 퀴즈 오늘 풀이 수
router.get('/knowledge/today-count', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.json({ count: 0 });
  const today = getTodayKST();
  const result = await getOne(
    "SELECT COALESCE(SUM(total_questions), 0) as cnt FROM knowledge_game_logs WHERE student_id = ? AND date(played_at) = date(?) AND academy_id = ?",
    [student.id, today, academyId]
  );
  res.json({ count: result ? result.cnt : 0 });
});

// ============================================================
// ========== 비문학 독해 (Reading Quiz) ==========
// ============================================================

router.get('/reading/categories', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const categories = await getAll(
    `SELECT rp.category, COUNT(DISTINCT rp.id) as passage_count, COUNT(rq.id) as question_count
     FROM reading_passages rp
     LEFT JOIN reading_questions rq ON rq.passage_id = rp.id AND rq.academy_id = ?
     WHERE rp.academy_id = ?
     GROUP BY rp.category`,
    [academyId, academyId]
  );
  res.json(categories);
});

router.get('/reading/start', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const limitSetting = await getOne("SELECT value FROM game_settings WHERE key = 'daily_reading_limit' AND academy_id = ?", [academyId]);
  const dailyLimit = limitSetting ? parseInt(limitSetting.value) || 5 : 5;

  const today = getTodayKST();
  const todayResult = await getOne(
    "SELECT COUNT(DISTINCT passage_id) as cnt FROM reading_game_logs WHERE student_id = ? AND date(played_at) = date(?) AND academy_id = ?",
    [student.id, today, academyId]
  );
  const todayCount = todayResult ? todayResult.cnt : 0;
  if (todayCount >= dailyLimit) {
    return res.status(400).json({ error: `오늘의 비문학 제한(${dailyLimit}지문)에 도달했습니다.` });
  }

  const category = req.query.category;

  // 모든 문제를 맞힌 지문 제외
  const perfectPassages = (await getAll(
    `SELECT DISTINCT rgl.passage_id FROM reading_game_logs rgl
     WHERE rgl.student_id = ? AND rgl.correct_count = rgl.total_questions AND rgl.total_questions > 0 AND rgl.academy_id = ?`,
    [student.id, academyId]
  )).map(r => r.passage_id);

  // 최근 7일 이내 틀린 지문 제외
  const recentWrongPassages = (await getAll(
    `SELECT DISTINCT rgl.passage_id FROM reading_game_logs rgl
     WHERE rgl.student_id = ? AND rgl.correct_count < rgl.total_questions
     AND rgl.played_at > datetime('now', '-7 days') AND rgl.academy_id = ?`,
    [student.id, academyId]
  )).map(r => r.passage_id);

  // 오늘 이미 시작한(미제출 포함) 지문 제외 → 같은 지문 반복 방지
  const pendingPassages = (await getAll(
    "SELECT passage_id FROM reading_game_logs WHERE student_id = ? AND total_questions = 0 AND date(played_at) = date(?) AND academy_id = ?",
    [student.id, today, academyId]
  )).map(r => r.passage_id);

  const excludeIds = [...new Set([...perfectPassages, ...recentWrongPassages, ...pendingPassages])];
  const excludePlaceholder = excludeIds.length > 0 ? `AND rp.id NOT IN (${excludeIds.join(',')})` : '';

  // 카테고리 파라미터 무시하고 랜덤 선택 (어뷰징 방지)
  const passage = await getOne(`SELECT * FROM reading_passages rp WHERE rp.academy_id = ? ${excludePlaceholder} ORDER BY RANDOM() LIMIT 1`, [academyId]);

  if (!passage) {
    return res.status(400).json({ error: '출제할 수 있는 지문이 없습니다. 모든 지문을 완료했거나, 잠시 후 다시 시도해주세요.' });
  }

  const questions = await getAll('SELECT * FROM reading_questions WHERE passage_id = ? AND academy_id = ?', [passage.id, academyId]);

  const formattedQuestions = questions.map(q => {
    let wrongAnswers;
    try { wrongAnswers = JSON.parse(q.wrong_answers); } catch { wrongAnswers = []; }
    const wrongSlice = wrongAnswers.slice(0, 3);
    const correctIdx = Math.floor(Math.random() * (wrongSlice.length + 1));
    const options = [...wrongSlice];
    options.splice(correctIdx, 0, q.correct_answer);
    return {
      id: q.id,
      type: q.question_type,
      questionText: q.question_text,
      options
    };
  });

  // 시작 즉시 log 삽입 → 오늘 횟수 즉시 차감 (어뷰징 방지)
  const logId = await runInsert(
    "INSERT INTO reading_game_logs (student_id, passage_id, total_questions, correct_count, xp_earned, academy_id) VALUES (?, ?, 0, 0, 0, ?)",
    [student.id, passage.id, academyId]
  );

  res.json({
    passage: {
      id: passage.id,
      title: passage.title,
      content: passage.content,
      category: passage.category,
      difficulty: passage.difficulty
    },
    questions: formattedQuestions,
    logId
  });
});

router.post('/reading/submit', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const { passageId, answers, logId } = req.body;
  if (!passageId || !answers || !Array.isArray(answers)) return res.status(400).json({ error: '답안을 제출해주세요.' });

  const passage = await getOne('SELECT * FROM reading_passages WHERE id = ? AND academy_id = ?', [passageId, academyId]);
  if (!passage) return res.status(404).json({ error: '지문을 찾을 수 없습니다.' });

  let totalXpEarned = 0;
  let correctCount = 0;
  const details = [];
  const diff = passage.difficulty;

  for (const ans of answers) {
    const q = await getOne('SELECT * FROM reading_questions WHERE id = ? AND academy_id = ?', [ans.questionId, academyId]);
    if (!q) continue;

    const isCorrect = ans.selectedAnswer === q.correct_answer;

    await runInsert(
      'INSERT INTO reading_question_results (student_id, question_id, is_correct, academy_id) VALUES (?, ?, ?, ?)',
      [student.id, q.id, isCorrect ? 1 : 0, academyId]
    );

    if (isCorrect) {
      correctCount++;
      let xp = diff === 3 ? 20 : diff === 2 ? 15 : 10;
      totalXpEarned += xp;
    } else {
      let penalty = diff === 3 ? -5 : diff === 2 ? -3 : -2;
      totalXpEarned += penalty;
    }

    details.push({
      questionId: q.id,
      correct: isCorrect,
      correctAnswer: q.correct_answer,
      explanation: q.explanation || null
    });
  }

  // 전문 맞추면 보너스
  if (correctCount === answers.length && answers.length >= 2) {
    totalXpEarned = Math.floor(totalXpEarned * 1.5);
  }
  if (totalXpEarned < 0) totalXpEarned = 0;

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

  const oldLevel = getLevelInfo(sc.xp).level;
  const newXp = sc.xp + totalXpEarned;
  const newPoints = sc.points + totalXpEarned;
  const newLevel = getLevelInfo(newXp).level;

  await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
    [newXp, newPoints, newLevel, student.id, academyId]);

  // start 시점에 삽입된 log를 UPDATE (logId 없으면 INSERT 폴백)
  if (logId) {
    await runQuery(
      "UPDATE reading_game_logs SET total_questions=?, correct_count=?, xp_earned=? WHERE id=? AND academy_id = ?",
      [answers.length, correctCount, totalXpEarned, logId, academyId]
    );
  } else {
    await runInsert(
      "INSERT INTO reading_game_logs (student_id, passage_id, total_questions, correct_count, xp_earned, academy_id) VALUES (?, ?, ?, ?, ?, ?)",
      [student.id, passageId, answers.length, correctCount, totalXpEarned, academyId]
    );
  }

  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'reading_quiz', ?, ?)",
    [student.id, totalXpEarned, `비문학 독해 ${correctCount}/${answers.length}`, academyId]);

  await checkAndGrantTitles(student.id, academyId);

  res.json({ correct: correctCount, total: answers.length, xpEarned: totalXpEarned, details, leveledUp: newLevel > oldLevel, newLevel, passageTitle: passage.title });
});

// 비문학 오늘 풀이 수
router.get('/reading/today-count', authenticateToken, async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.json({ count: 0 });
  const today = getTodayKST();
  const result = await getOne(
    "SELECT COUNT(DISTINCT passage_id) as cnt FROM reading_game_logs WHERE student_id = ? AND date(played_at) = date(?) AND academy_id = ?",
    [student.id, today, academyId]
  );
  res.json({ count: result ? result.cnt : 0 });
});

// === 관리자: 학생 XP/포인트 획득 내역 ===
router.get('/admin/xp-logs/:studentId', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { page, limit: lim } = req.query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(lim) || 50;
  const offset = (pageNum - 1) * limitNum;

  const total = await getOne('SELECT COUNT(*) as cnt FROM xp_logs WHERE student_id = ? AND academy_id = ?', [req.params.studentId, academyId]);
  const logs = await getAll(
    `SELECT * FROM xp_logs WHERE student_id = ? AND academy_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [req.params.studentId, academyId, limitNum, offset]
  );

  res.json({
    logs,
    total: total ? total.cnt : 0,
    page: pageNum,
    totalPages: Math.ceil((total ? total.cnt : 0) / limitNum),
  });
});

// 관리자: 전체 XP 로그 (최근 활동)
router.get('/admin/xp-logs', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { source, days } = req.query;
  const daysNum = parseInt(days) || 7;
  let where = `xl.created_at >= datetime('now', '-${daysNum} days') AND xl.academy_id = ?`;
  const params = [academyId];
  if (source) { where += ' AND xl.source = ?'; params.push(source); }

  const logs = await getAll(
    `SELECT xl.*, u.name as student_name, s.school, s.grade
     FROM xp_logs xl
     JOIN students s ON xl.student_id = s.id AND s.academy_id = ?
     JOIN users u ON s.user_id = u.id
     WHERE ${where}
     ORDER BY xl.created_at DESC LIMIT 200`,
    [academyId, ...params]
  );

  // 소스별 요약
  const summary = await getAll(
    `SELECT source, SUM(amount) as total_amount, COUNT(*) as count
     FROM xp_logs WHERE created_at >= datetime('now', '-${daysNum} days') AND academy_id = ?
     GROUP BY source ORDER BY total_amount DESC`,
    [academyId]
  );

  res.json({ logs, summary });
});

module.exports = router;
