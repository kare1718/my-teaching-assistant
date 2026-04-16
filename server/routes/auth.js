const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const { track } = require('../services/analytics');

const router = express.Router();

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { username, password, name, phone, school, grade, parentName, parentPhone, academySlug, inviteCode, invite_code, agreePrivacy, agreeMarketing } = req.body;

    const isStaff = school === '조교' || school === '선생님';
    if (!username || !password || !name || !phone || !school || !grade) {
      return res.status(400).json({ error: '모든 항목을 빠짐없이 입력해주세요.' });
    }
    if (!isStaff && (!parentName || !parentPhone)) {
      return res.status(400).json({ error: '학부모 정보를 입력해주세요.' });
    }

    // 비밀번호 최소 길이 검증
    if (password.length < 4) {
      return res.status(400).json({ error: '비밀번호는 최소 4자 이상이어야 합니다.' });
    }

    // 아이디 형식 검증 (영문, 숫자, _ 만 허용)
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: '아이디는 3~20자의 영문, 숫자, 밑줄(_)만 사용 가능합니다.' });
    }

    // 학원 식별: 우선순위 - invite_code(student/parent) > academySlug(레거시)
    const rawCode = inviteCode || invite_code;
    let academy = null;

    if (rawCode) {
      // 학생 가입인지 staff 인지에 따라 필드 우선순위 조정
      const primaryField = isStaff ? 'student_invite_code' : 'student_invite_code';
      academy = await getOne(
        `SELECT id, max_students FROM academies WHERE ${primaryField} = ? AND is_active = 1`,
        [rawCode]
      );
      // 학부모 코드 fallback
      if (!academy) {
        academy = await getOne(
          'SELECT id, max_students FROM academies WHERE parent_invite_code = ? AND is_active = 1',
          [rawCode]
        );
      }
      // 레거시 slug fallback
      if (!academy) {
        academy = await getOne(
          'SELECT id, max_students FROM academies WHERE slug = ? AND is_active = 1',
          [rawCode]
        );
      }
      if (!academy) {
        return res.status(400).json({ error: '유효하지 않은 초대 코드입니다.' });
      }
    } else if (academySlug) {
      academy = await getOne(
        'SELECT id, max_students FROM academies WHERE slug = ? AND is_active = 1',
        [academySlug]
      );
      if (!academy) {
        return res.status(400).json({ error: '유효하지 않은 학원입니다.' });
      }
    } else {
      return res.status(400).json({ error: '학원 초대 코드가 필요합니다.' });
    }
    const academyId = academy.id;

    const existing = await getOne('SELECT id FROM users WHERE username = ? AND academy_id = ?', [username, academyId]);
    if (existing) {
      return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    }

    const existingPhone = await getOne('SELECT id FROM users WHERE phone = ? AND phone IS NOT NULL AND phone <> \'\' AND academy_id = ?', [phone, academyId]);
    if (existingPhone) {
      return res.status(400).json({ error: '이미 등록된 전화번호입니다. 중복 가입은 불가합니다.' });
    }

    // 학생 수 제한 체크 (조교/선생님은 제외)
    if (!isStaff) {
      const studentCount = await getOne(
        "SELECT COUNT(*) as count FROM students s JOIN users u ON s.user_id = u.id WHERE s.academy_id = ? AND (s.status IS NULL OR s.status = 'active') AND u.role = 'student'",
        [academyId]
      );
      if ((studentCount?.count || 0) >= (academy.max_students || 0)) {
        return res.status(403).json({ error: `현재 플랜의 최대 학생 수(${academy.max_students}명)에 도달했습니다. 학원 관리자에게 문의하세요.` });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = isStaff ? 'assistant' : 'student';
    const userId = await runInsert(
      'INSERT INTO users (username, password, name, role, approved, phone, academy_id, agree_privacy, agree_marketing, agree_marketing_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, name, userRole, 0, phone || '', academyId, agreePrivacy ? 1 : 0, agreeMarketing ? 1 : 0, agreeMarketing ? new Date().toISOString() : null]
    );

    await runQuery(
      'INSERT INTO students (user_id, school, grade, parent_name, parent_phone, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, school, grade, parentName || '', parentPhone || '', academyId]
    );

    // [KPI] signup 이벤트 기록
    req.academyId = academyId;
    track(req, 'signup', { role: userRole, school, grade }).catch(() => {});

    res.json({ message: '회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { username, password, academySlug, rememberMe } = req.body;

    // 학원 슬러그로 academy 조회
    let academyId = null;
    if (academySlug) {
      const academy = await getOne('SELECT id FROM academies WHERE slug = ? AND is_active = 1', [academySlug]);
      if (!academy) {
        return res.status(400).json({ error: '유효하지 않은 학원입니다.' });
      }
      academyId = academy.id;
    }

    // 아이디 또는 핸드폰번호로 로그인
    let user;
    if (academyId) {
      user = await getOne('SELECT * FROM users WHERE username = ? AND academy_id = ?', [username, academyId]);
      if (!user) {
        // 핸드폰번호로 시도
        user = await getOne('SELECT * FROM users WHERE phone = ? AND phone IS NOT NULL AND phone <> \'\' AND academy_id = ?', [username, academyId]);
      }
    } else {
      user = await getOne('SELECT * FROM users WHERE username = ?', [username]);
      if (!user) {
        user = await getOne('SELECT * FROM users WHERE phone = ? AND phone IS NOT NULL AND phone <> \'\'', [username]);
      }
    }

    if (!user) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 관리자는 항상 승인 상태, 학생/조교는 승인 체크
    if (!['admin', 'superadmin'].includes(user.role) && !user.approved) {
      return res.status(403).json({ error: '관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.' });
    }

    // 차단된 계정 체크
    if (user.blocked) {
      return res.status(403).json({ error: '접속이 차단된 계정입니다. 선생님에게 문의해주세요.' });
    }

    // 퇴원 학생 체크
    if (user.role === 'student') {
      const studentStatus = await getOne('SELECT status FROM students WHERE user_id = ? AND academy_id = ?', [user.id, user.academy_id]);
      if (studentStatus && studentStatus.status === 'inactive') {
        return res.status(403).json({ error: '퇴원 처리된 계정입니다. 선생님에게 문의해주세요.' });
      }
    }

    // 학생/조교이면 school 정보 조회
    let school = null;
    if (user.role === 'student' || user.role === 'assistant') {
      const student = await getOne('SELECT school FROM students WHERE user_id = ? AND academy_id = ?', [user.id, user.academy_id]);
      if (student) school = student.school;
    }

    const admin_type = user.admin_type || 'owner';
    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, school, academy_id: user.academy_id, admin_type },
      JWT_SECRET,
      { expiresIn: rememberMe ? '30d' : '1d' }
    );

    // [KPI] login 이벤트 기록
    req.user = user;
    req.academyId = user.academy_id;
    track(req, 'login', { role: user.role }).catch(() => {});

    res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role, school, academy_id: user.academy_id, admin_type }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 내 정보 조회
router.get('/me', authenticateToken, async (req, res) => {
  const user = await getOne('SELECT id, username, name, role, phone, academy_id, admin_type FROM users WHERE id = ? AND academy_id = ?', [req.user.id, req.user.academy_id]);
  if (!user) {
    return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  }

  if (user.role === 'student') {
    const student = await getOne('SELECT * FROM students WHERE user_id = ? AND academy_id = ?', [user.id, user.academy_id]);
    return res.json({ ...user, student });
  }

  res.json(user);
});

// 비밀번호 변경 (로그인 사용자)
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ error: '새 비밀번호는 최소 4자 이상이어야 합니다.' });
    }
    const user = await getOne('SELECT * FROM users WHERE id = ? AND academy_id = ?', [req.user.id, req.user.academy_id]);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ error: '현재 비밀번호가 일치하지 않습니다.' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await runQuery('UPDATE users SET password = ? WHERE id = ? AND academy_id = ?', [hashed, user.id, user.academy_id]);
    res.json({ message: '비밀번호가 변경되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 비밀번호 찾기 Rate Limiting (IP 기반, 5회/15분)
const findPwAttempts = new Map();
const FIND_PW_MAX = 5;
const FIND_PW_WINDOW = 15 * 60 * 1000;

// 비밀번호 찾기 (아이디 + 이름 + 전화번호 일치 시 임시 비번 발급)
router.post('/find-password', async (req, res) => {
  try {
    // Rate limiting 체크
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const attempts = findPwAttempts.get(ip) || [];
    const recent = attempts.filter(t => now - t < FIND_PW_WINDOW);
    if (recent.length >= FIND_PW_MAX) {
      return res.status(429).json({ error: '너무 많은 시도가 있었습니다. 15분 후 다시 시도해주세요.' });
    }
    recent.push(now);
    findPwAttempts.set(ip, recent);

    const { username, name, phone, academySlug } = req.body;
    if (!username || !name || !phone) {
      return res.status(400).json({ error: '아이디, 이름, 전화번호를 모두 입력해주세요.' });
    }

    let user;
    if (academySlug) {
      const academy = await getOne('SELECT id FROM academies WHERE slug = ? AND is_active = 1', [academySlug]);
      if (academy) {
        user = await getOne('SELECT * FROM users WHERE username = ? AND name = ? AND phone = ? AND academy_id = ?', [username, name, phone, academy.id]);
      }
    } else {
      user = await getOne('SELECT * FROM users WHERE username = ? AND name = ? AND phone = ?', [username, name, phone]);
    }

    if (!user) {
      return res.status(404).json({ error: '일치하는 계정을 찾을 수 없습니다. 정보를 다시 확인해주세요.' });
    }

    // 임시 비밀번호 생성 (8자리 암호학적 안전)
    const crypto = require('crypto');
    const tempPw = crypto.randomBytes(6).toString('base64url').slice(0, 8);

    const hashed = await bcrypt.hash(tempPw, 10);
    await runQuery('UPDATE users SET password = ? WHERE id = ? AND academy_id = ?', [hashed, user.id, user.academy_id]);
    res.json({ message: '임시 비밀번호가 발급되었습니다.', tempPassword: tempPw });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 내 알림 조회
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await getAll(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(notifications);
  } catch (err) {
    res.json([]);
  }
});

// 알림 읽음 처리
router.put('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await runQuery('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'ok' });
  } catch (err) {
    res.json({ message: 'ok' });
  }
});

// 모든 알림 읽음 처리
router.put('/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await runQuery('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'ok' });
  } catch (err) {
    res.json({ message: 'ok' });
  }
});

// 초대 코드 확인 (공개 - 가입 페이지에서 사용)
// 레거시: slug 기반. 신규: student_invite_code / parent_invite_code 지원.
router.get('/verify-invite-code/:code', async (req, res) => {
  try {
    const code = req.params.code;
    // 1) 신규 학생 코드
    let academy = await getOne(
      'SELECT id, name, slug FROM academies WHERE student_invite_code = ? AND is_active = 1',
      [code]
    );
    let type = academy ? 'student' : null;
    // 2) 신규 학부모 코드
    if (!academy) {
      academy = await getOne(
        'SELECT id, name, slug FROM academies WHERE parent_invite_code = ? AND is_active = 1',
        [code]
      );
      if (academy) type = 'parent';
    }
    // 3) 레거시 slug
    if (!academy) {
      academy = await getOne(
        'SELECT id, name, slug FROM academies WHERE slug = ? AND is_active = 1',
        [code]
      );
      if (academy) type = 'legacy';
    }
    if (!academy) return res.status(404).json({ error: '유효하지 않은 초대 코드입니다.' });
    res.json({ academyName: academy.name, slug: academy.slug, academyId: academy.id, type });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 타입 지정 공개 검증 API — ?code=XXX&type=student|parent
router.get('/verify-invite-code', async (req, res) => {
  try {
    const { code, type } = req.query;
    if (!code) return res.status(400).json({ error: '코드가 필요합니다.' });

    const field = type === 'parent' ? 'parent_invite_code' : 'student_invite_code';
    let academy = await getOne(
      `SELECT id, name, slug FROM academies WHERE ${field} = ? AND is_active = 1`,
      [code]
    );
    // 레거시 slug fallback
    if (!academy) {
      academy = await getOne(
        'SELECT id, name, slug FROM academies WHERE slug = ? AND is_active = 1',
        [code]
      );
    }
    if (!academy) return res.status(404).json({ error: '유효하지 않은 초대 코드입니다.' });
    res.json({ valid: true, academyId: academy.id, academyName: academy.name, slug: academy.slug });
  } catch (err) {
    console.error('[verify-invite-code]', err);
    res.status(500).json({ error: '검증 실패' });
  }
});

// 내 학원 초대 코드 조회 (관리자용)
router.get('/my-invite-code', authenticateToken, async (req, res) => {
  try {
    const academy = await getOne('SELECT id, name, slug FROM academies WHERE id = ?', [req.user.academy_id]);
    if (!academy) return res.status(404).json({ error: '학원 정보를 찾을 수 없습니다.' });
    res.json({ inviteCode: academy.slug, academyName: academy.name });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 관리자 직함(admin_type) 변경
router.put('/admin-type', authenticateToken, async (req, res) => {
  try {
    const { admin_type } = req.body;
    const validTypes = ['owner', 'instructor', 'staff', 'counselor'];
    if (!validTypes.includes(admin_type)) {
      return res.status(400).json({ error: '유효하지 않은 직함입니다.' });
    }
    await runQuery('UPDATE users SET admin_type = ? WHERE id = ?', [admin_type, req.user.id]);
    res.json({ ok: true, admin_type });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '직함 변경 실패' });
  }
});

module.exports = router;
