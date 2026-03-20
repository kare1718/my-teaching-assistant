const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { username, password, name, phone, school, grade, parentName, parentPhone, academySlug } = req.body;

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

    // 학원 슬러그로 academy 조회
    if (!academySlug) {
      return res.status(400).json({ error: '학원 정보가 필요합니다.' });
    }
    const academy = await getOne('SELECT id FROM academies WHERE slug = ? AND is_active = 1', [academySlug]);
    if (!academy) {
      return res.status(400).json({ error: '유효하지 않은 학원입니다.' });
    }
    const academyId = academy.id;

    const existing = await getOne('SELECT id FROM users WHERE username = ? AND academy_id = ?', [username, academyId]);
    if (existing) {
      return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    }

    const existingPhone = await getOne('SELECT id FROM users WHERE phone = ? AND phone != "" AND academy_id = ?', [phone, academyId]);
    if (existingPhone) {
      return res.status(400).json({ error: '이미 등록된 전화번호입니다. 중복 가입은 불가합니다.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await runInsert(
      'INSERT INTO users (username, password, name, role, approved, phone, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, name, 'student', 0, phone || '', academyId]
    );

    await runQuery(
      'INSERT INTO students (user_id, school, grade, parent_name, parent_phone, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, school, grade, parentName || '', parentPhone || '', academyId]
    );

    res.json({ message: '회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { username, password, academySlug } = req.body;

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
        user = await getOne('SELECT * FROM users WHERE phone = ? AND phone != "" AND academy_id = ?', [username, academyId]);
      }
    } else {
      user = await getOne('SELECT * FROM users WHERE username = ?', [username]);
      if (!user) {
        user = await getOne('SELECT * FROM users WHERE phone = ? AND phone != ""', [username]);
      }
    }

    if (!user) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 관리자는 항상 승인 상태, 학생은 승인 체크
    if (user.role !== 'admin' && !user.approved) {
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

    // 학생이면 school 정보 조회
    let school = null;
    if (user.role === 'student') {
      const student = await getOne('SELECT school FROM students WHERE user_id = ? AND academy_id = ?', [user.id, user.academy_id]);
      if (student) school = student.school;
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, school, academy_id: user.academy_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role, school, academy_id: user.academy_id }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 내 정보 조회
router.get('/me', authenticateToken, async (req, res) => {
  const user = await getOne('SELECT id, username, name, role, phone, academy_id FROM users WHERE id = ? AND academy_id = ?', [req.user.id, req.user.academy_id]);
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

// 비밀번호 찾기 (아이디 + 이름 + 전화번호 일치 시 임시 비번 발급)
router.post('/find-password', async (req, res) => {
  try {
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
    // 임시 비밀번호 생성 (6자리 영숫자)
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let tempPw = '';
    for (let i = 0; i < 6; i++) tempPw += chars[Math.floor(Math.random() * chars.length)];

    const hashed = await bcrypt.hash(tempPw, 10);
    await runQuery('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);
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

module.exports = router;
