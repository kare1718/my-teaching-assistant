const express = require('express');
const bcrypt = require('bcryptjs');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');
const { TIER_LIMITS } = require('../middleware/subscription');

const router = express.Router();
router.use(authenticateToken, requireSuperAdmin);

// 전체 학원 목록
router.get('/academies', async (req, res) => {
  try {
    const academies = await getAll(
      `SELECT a.*,
        (SELECT COUNT(*) FROM students WHERE academy_id = a.id AND (status IS NULL OR status = 'active')) as student_count,
        (SELECT COUNT(*) FROM users WHERE academy_id = a.id) as user_count
       FROM academies a ORDER BY a.created_at DESC`
    );
    res.json(academies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 학원 상세
router.get('/academies/:id', async (req, res) => {
  try {
    const academy = await getOne('SELECT * FROM academies WHERE id = ?', [parseInt(req.params.id)]);
    if (!academy) return res.status(404).json({ error: '학원을 찾을 수 없습니다.' });

    const stats = {
      students: await getOne('SELECT COUNT(*) as count FROM students WHERE academy_id = ?', [academy.id]),
      exams: await getOne('SELECT COUNT(*) as count FROM exams WHERE academy_id = ?', [academy.id]),
      quizLogs: await getOne('SELECT COUNT(*) as count FROM vocab_game_logs WHERE academy_id = ?', [academy.id]),
    };

    const subscription = await getOne(
      'SELECT * FROM subscriptions WHERE academy_id = ? AND status = ? ORDER BY id DESC LIMIT 1',
      [academy.id, 'active']
    );

    res.json({ academy, stats, subscription });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 학원 생성
router.post('/academies', async (req, res) => {
  try {
    const { name, slug, ownerUsername, ownerPassword, ownerName, ownerPhone, tier } = req.body;
    if (!name || !slug) return res.status(400).json({ error: '학원 이름과 slug를 입력해주세요.' });

    const existing = await getOne('SELECT id FROM academies WHERE slug = ?', [slug]);
    if (existing) return res.status(400).json({ error: '이미 사용 중인 slug입니다.' });

    const defaultSettings = {
      schools: [{ name: '고등학교', grades: ['1학년', '2학년', '3학년'] }],
      examTypes: ['학력평가 모의고사', '정규반 테스트', '1학기 중간고사', '1학기 기말고사', '2학기 중간고사', '2학기 기말고사'],
      siteTitle: name,
      mainTitle: '',
      branding: {},
    };

    const academyId = await runInsert(
      'INSERT INTO academies (name, slug, subscription_tier, max_students, settings) VALUES (?, ?, ?, ?, ?)',
      [name, slug, tier || 'trial', TIER_LIMITS[tier || 'trial']?.maxStudents || 10, JSON.stringify(defaultSettings)]
    );

    // 관리자 계정 생성
    if (ownerUsername && ownerPassword) {
      const hashed = await bcrypt.hash(ownerPassword, 10);
      const userId = await runInsert(
        'INSERT INTO users (username, password, name, role, approved, phone, academy_id) VALUES (?, ?, ?, ?, 1, ?, ?)',
        [ownerUsername, hashed, ownerName || '관리자', 'admin', ownerPhone || '', academyId]
      );
      await runQuery('UPDATE academies SET owner_user_id = ? WHERE id = ?', [userId, academyId]);
    }

    // 기본 캐릭터/칭호 시드
    await seedAcademyDefaults(academyId);

    res.json({ message: '학원이 생성되었습니다.', academyId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 학원 활성화/비활성화
router.put('/academies/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    await runQuery('UPDATE academies SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, parseInt(req.params.id)]);
    res.json({ message: isActive ? '학원이 활성화되었습니다.' : '학원이 비활성화되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 학원 티어 변경
router.put('/academies/:id/tier', async (req, res) => {
  try {
    const { tier } = req.body;
    const limits = TIER_LIMITS[tier];
    if (!limits) return res.status(400).json({ error: '유효하지 않은 티어입니다.' });

    await runQuery('UPDATE academies SET subscription_tier = ?, max_students = ? WHERE id = ?',
      [tier, limits.maxStudents, parseInt(req.params.id)]);
    res.json({ message: `티어가 ${tier}로 변경되었습니다.` });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 플랫폼 통계
router.get('/stats', async (req, res) => {
  try {
    const totalAcademies = await getOne('SELECT COUNT(*) as count FROM academies WHERE is_active = 1');
    const totalStudents = await getOne("SELECT COUNT(*) as count FROM students WHERE status IS NULL OR status = 'active'");
    const totalUsers = await getOne('SELECT COUNT(*) as count FROM users');

    const month = new Date().toISOString().slice(0, 7);
    const monthlyPayments = await getOne(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'paid' AND to_char(paid_at, 'YYYY-MM') = ?",
      [month]
    );

    const tierDistribution = await getAll(
      'SELECT subscription_tier, COUNT(*) as count FROM academies WHERE is_active = 1 GROUP BY subscription_tier'
    );

    res.json({
      totalAcademies: totalAcademies?.count || 0,
      totalStudents: totalStudents?.count || 0,
      totalUsers: totalUsers?.count || 0,
      monthlyRevenue: monthlyPayments?.total || 0,
      tierDistribution,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 기본 데이터 시드 함수
async function seedAcademyDefaults(academyId) {
  // 캐릭터
  const characters = [
    ['기본 캐릭터', '🐣', '처음 시작하는 모험가', 1],
    ['책벌레', '📚', '지식을 탐구하는 학자', 5],
    ['마법사', '🧙', '언어의 마법을 부리는 자', 10],
    ['기사', '⚔️', '국어 실력으로 무장한 전사', 15],
    ['현자', '🦉', '깊은 지혜를 가진 현인', 20],
    ['용사', '🐉', '어떤 문제도 두렵지 않은 용사', 25],
    ['왕', '👑', '국어 왕국의 통치자', 30],
    ['전설', '🌟', '전설로 남을 국어의 신', 40],
  ];
  for (const [name, emoji, desc, level] of characters) {
    await runInsert(
      'INSERT INTO characters (name, emoji, description, unlock_level, academy_id) VALUES (?, ?, ?, ?, ?)',
      [name, emoji, desc, level, academyId]
    );
  }

  // 칭호
  const titles = [
    ['새싹 학습자', '첫 발을 내딛은 학습자', 'xp_total', 100, '🌱'],
    ['성실한 학생', 'XP 1000 달성', 'xp_total', 1000, '📖'],
    ['퀴즈 도전자', '퀴즈 10회 도전', 'quiz_count', 10, '🎯'],
    ['퀴즈 마스터', '퀴즈 50회 도전', 'quiz_count', 50, '🏆'],
    ['코드 헌터', '히든 코드 3개 입력', 'code_count', 3, '🔍'],
    ['코드 수집가', '히든 코드 10개 입력', 'code_count', 10, '💎'],
    ['레벨 5 달성', '레벨 5에 도달', 'level', 5, '⭐'],
    ['레벨 10 달성', '레벨 10에 도달', 'level', 10, '🌟'],
    ['레벨 20 달성', '레벨 20에 도달', 'level', 20, '💫'],
    ['레벨 30 달성', '레벨 30에 도달', 'level', 30, '👑'],
    ['첫 구매', '상점에서 첫 구매', 'manual', 0, '🛒'],
    ['VIP', '관리자가 직접 부여', 'manual', 0, '💖'],
  ];
  for (const [name, desc, condType, condVal, icon] of titles) {
    await runInsert(
      'INSERT INTO titles (name, description, condition_type, condition_value, icon, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, desc, condType, condVal, icon, academyId]
    );
  }
}

module.exports = router;
