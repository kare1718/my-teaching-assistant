const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');
const { TIER_LIMITS } = require('../middleware/subscription');
const { track } = require('../services/analytics');

const router = express.Router();

// 학원 셀프 등록 (온보딩)
router.post('/create-academy', async (req, res) => {
  try {
    const { academyName, slug, adminUsername, adminPassword, adminName, adminPhone, subject } = req.body;

    if (!academyName || !slug || !adminUsername || !adminPassword || !adminName) {
      return res.status(400).json({ error: '모든 필수 항목을 입력해주세요.' });
    }

    // slug 형식 검증
    if (!/^[a-z0-9-]{3,30}$/.test(slug)) {
      return res.status(400).json({ error: 'slug는 3~30자의 영문 소문자, 숫자, 하이픈(-)만 사용 가능합니다.' });
    }

    // 중복 체크
    const existingAcademy = await getOne('SELECT id FROM academies WHERE slug = ?', [slug]);
    if (existingAcademy) {
      return res.status(400).json({ error: '이미 사용 중인 주소입니다. 다른 주소를 입력해주세요.' });
    }

    const existingUser = await getOne('SELECT id FROM users WHERE username = ?', [adminUsername]);
    if (existingUser) {
      return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    }

    // 기본 설정
    const defaultSettings = {
      schools: [{ name: '고등학교', grades: ['1학년', '2학년', '3학년'] }],
      examTypes: [{ key: 'internal', label: '내신', types: ['중간고사'] }],
      siteTitle: academyName,
      mainTitle: subject ? `${subject} 전문 학원` : '',
      branding: {},
    };

    // 학원 생성 (Free 플랜 — Trial 별도 플랜 없음, 체험은 Free로 일원화)
    const academyId = await runInsert(
      'INSERT INTO academies (name, slug, subscription_tier, max_students, settings) VALUES (?, ?, ?, ?, ?)',
      [academyName, slug, 'free', TIER_LIMITS.free.maxStudents, JSON.stringify(defaultSettings)]
    );

    // 관리자 계정 생성
    const hashed = await bcrypt.hash(adminPassword, 10);
    const userId = await runInsert(
      'INSERT INTO users (username, password, name, role, approved, phone, academy_id) VALUES (?, ?, ?, ?, 1, ?, ?)',
      [adminUsername, hashed, adminName, 'admin', adminPhone || '', academyId]
    );

    await runQuery('UPDATE academies SET owner_user_id = ? WHERE id = ?', [userId, academyId]);

    // 기본 캐릭터/칭호 시드
    await seedDefaults(academyId);

    // RBAC 기본 권한 매트릭스 시드
    try {
      const { seedPermissionsForAcademy } = require('../db/seedPermissions');
      await seedPermissionsForAcademy(academyId);
    } catch (err) {
      console.error('[onboarding] 권한 시드 실패:', err.message);
    }

    // 자동 로그인 토큰 발급
    const token = jwt.sign(
      { id: userId, username: adminUsername, name: adminName, role: 'admin', academy_id: academyId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // [KPI] signup + onboarding_completed 이벤트 기록
    req.academyId = academyId;
    req.user = { id: userId, role: 'admin', academy_id: academyId };
    track(req, 'signup', { source: 'onboarding', subject }).catch(() => {});
    track(req, 'onboarding_completed', { subject }).catch(() => {});

    res.json({
      message: '학원이 생성되었습니다!',
      token,
      user: { id: userId, username: adminUsername, name: adminName, role: 'admin' },
      academy: { id: academyId, name: academyName, slug },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// slug 사용 가능 여부 체크
router.get('/check-slug', async (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.json({ available: false });
  const existing = await getOne('SELECT id FROM academies WHERE slug = ?', [slug]);
  res.json({ available: !existing });
});

async function seedDefaults(academyId) {
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

  const titles = [
    ['새싹 학습자', '첫 발을 내딛은 학습자', 'xp_total', 100, '🌱'],
    ['성실한 학생', 'XP 1000 달성', 'xp_total', 1000, '📖'],
    ['퀴즈 도전자', '퀴즈 10회 도전', 'quiz_count', 10, '🎯'],
    ['퀴즈 마스터', '퀴즈 50회 도전', 'quiz_count', 50, '🏆'],
    ['코드 헌터', '히든 코드 3개 입력', 'code_count', 3, '🔍'],
    ['레벨 5 달성', '레벨 5에 도달', 'level', 5, '⭐'],
    ['레벨 10 달성', '레벨 10에 도달', 'level', 10, '🌟'],
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

// GET /api/onboarding/progress — 온보딩 체크리스트 진행 상황
const { authenticateToken, requireAdmin } = require('../middleware/auth');
router.get('/progress', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const academyId = req.academyId;
    if (!academyId) return res.json({ items: [], hidden: true });

    const academy = await getOne('SELECT created_at FROM academies WHERE id = ?', [academyId]);
    const createdAt = academy?.created_at ? new Date(academy.created_at) : new Date();
    const daysOld = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    const safeCount = async (sql, params) => {
      try { const r = await getOne(sql, params); return Number(r?.c || 0); }
      catch (e) { return 0; }
    };

    const studentCount = await safeCount(
      `SELECT COUNT(*) as c FROM students s JOIN users u ON s.user_id = u.id
       WHERE s.academy_id = ? AND u.role = 'student'`,
      [academyId]
    );
    const classCount = await safeCount(`SELECT COUNT(*) as c FROM classes WHERE academy_id = ?`, [academyId]);
    const classStudentCount = await safeCount(
      `SELECT COUNT(*) as c FROM class_students cs JOIN classes c ON cs.class_id = c.id WHERE c.academy_id = ?`,
      [academyId]
    );
    const attendanceCount = await safeCount(`SELECT COUNT(*) as c FROM attendance WHERE academy_id = ?`, [academyId]);
    const tuitionCount = await safeCount(`SELECT COUNT(*) as c FROM tuition_records WHERE academy_id = ?`, [academyId]);
    const noticeCount = await safeCount(`SELECT COUNT(*) as c FROM notices WHERE academy_id = ?`, [academyId]);
    const parentCount = await safeCount(`SELECT COUNT(*) as c FROM parents WHERE academy_id = ?`, [academyId]);
    const automationCount = await safeCount(
      `SELECT COUNT(*) as c FROM automation_rules WHERE academy_id = ? AND enabled = true`,
      [academyId]
    );

    const items = [
      { key: 'academy', label: '학원 정보 등록', done: true, path: '/admin/settings' },
      { key: 'student', label: '첫 학생 등록 (또는 엑셀 Import)', done: studentCount > 0, path: '/admin/students' },
      { key: 'class', label: '첫 반 생성 + 수강생 배정', done: classCount > 0 && classStudentCount > 0, path: '/admin/classes' },
      { key: 'attendance', label: '출결 기록 1건', done: attendanceCount > 0, path: '/admin/attendance' },
      { key: 'tuition', label: '수강료 청구 1건 생성', done: tuitionCount > 0, path: '/admin/tuition' },
      { key: 'notice', label: '공지사항 1건 발송', done: noticeCount > 0, path: '/admin/notices' },
      { key: 'parent', label: '보호자 1명 연결', done: parentCount > 0, path: '/admin/parents' },
      { key: 'automation', label: '자동화 규칙 1개 활성화 (선택)', done: automationCount > 0, path: '/admin/automation', optional: true },
    ];
    const doneCount = items.filter(x => x.done).length;
    const total = items.length;
    const progress = Math.round((doneCount / total) * 100);

    res.json({ items, progress, doneCount, total, hidden: daysOld > 7, daysOld });
  } catch (err) {
    console.error('[onboarding/progress]', err);
    res.status(500).json({ error: '진행 상황을 불러오지 못했습니다.' });
  }
});

module.exports = router;
