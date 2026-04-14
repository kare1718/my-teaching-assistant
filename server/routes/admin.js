const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { addEvent } = require('../services/timeline');
const { logAction } = require('../services/audit');

// 프로필 수정 허용 필드 화이트리스트
const USERS_EDITABLE_FIELDS = ['name', 'phone'];
const STUDENTS_EDITABLE_FIELDS = ['school', 'grade', 'parent_name', 'parent_phone'];

// SQL 컬럼명 매핑 — 문자열 보간 대신 사전 정의된 쿼리 사용
const USER_UPDATE_QUERIES = {
  name: 'UPDATE users SET name = ? WHERE id = ? AND academy_id = ?',
  phone: 'UPDATE users SET phone = ? WHERE id = ? AND academy_id = ?',
};
const STUDENT_UPDATE_QUERIES = {
  school: 'UPDATE students SET school = ? WHERE id = ? AND academy_id = ?',
  grade: 'UPDATE students SET grade = ? WHERE id = ? AND academy_id = ?',
  parent_name: 'UPDATE students SET parent_name = ? WHERE id = ? AND academy_id = ?',
  parent_phone: 'UPDATE students SET parent_phone = ? WHERE id = ? AND academy_id = ?',
};

async function applyProfileEdit(field_name, new_value, student_id, academyId) {
  if (USER_UPDATE_QUERIES[field_name]) {
    const student = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [student_id, academyId]);
    if (student) {
      await runQuery(USER_UPDATE_QUERIES[field_name], [new_value, student.user_id, academyId]);
    }
  } else if (STUDENT_UPDATE_QUERIES[field_name]) {
    await runQuery(STUDENT_UPDATE_QUERIES[field_name], [new_value, student_id, academyId]);
  }
  // 매핑에 없는 field_name은 무시됨
}


const router = express.Router();
router.use(authenticateToken, requireAdmin);

// 파일 업로드 설정
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, uniqueName + ext);
  }
});
// 업로드 파일 타입 제한 (이미지/문서만 허용)
const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|hwp|hwpx|xls|xlsx|ppt|pptx|txt|csv|zip/;
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  const mime = file.mimetype;
  if (allowedTypes.test(ext) || mime.startsWith('image/') || mime.startsWith('application/pdf')) {
    cb(null, true);
  } else {
    cb(new Error('허용되지 않는 파일 형식입니다.'), false);
  }
};
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter }); // 10MB

// === 승인 관리 ===

router.get('/pending-users', async (req, res) => {
  const users = await getAll(
    `SELECT u.id, u.username, u.name, u.phone, u.created_at,
            s.school, s.grade, s.parent_name, s.parent_phone
     FROM users u LEFT JOIN students s ON u.id = s.user_id
     WHERE u.role = 'student' AND u.approved = 0 AND u.academy_id = ?
     ORDER BY u.created_at DESC`,
    [req.academyId]
  );
  res.json(users);
});

router.put('/approve/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  await runQuery('UPDATE users SET approved = 1 WHERE id = ? AND academy_id = ?', [userId, req.academyId]);
  // 승인 알림 생성
  try {
    await runInsert('INSERT INTO notifications (user_id, type, title, message, academy_id) VALUES (?, ?, ?, ?, ?)',
      [userId, 'approval', '가입 승인 완료!', '회원가입이 승인되었습니다. 지금부터 모든 기능을 이용할 수 있습니다. 환영합니다! 🎉', req.academyId]);
  } catch(e) { /* 알림 실패해도 승인은 진행 */ }
  await logAction({ req, action: 'user_approve', resourceType: 'user', resourceId: userId, after: { userId, approved: true } });
  res.json({ message: '승인되었습니다.' });
});

router.delete('/reject/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  await runQuery('DELETE FROM students WHERE user_id = ? AND academy_id = ?', [userId, req.academyId]);
  await runQuery('DELETE FROM users WHERE id = ? AND role = ? AND academy_id = ?', [userId, 'student', req.academyId]);
  await logAction({ req, action: 'user_reject', resourceType: 'user', resourceId: userId });
  res.json({ message: '거절 처리되었습니다.' });
});

// === 학교/학년/학생 관리 ===

router.get('/schools', async (req, res) => {
  const schools = await getAll(
    `SELECT school, COUNT(*) as student_count
     FROM students s JOIN users u ON s.user_id = u.id
     WHERE u.approved = 1 AND s.academy_id = ?
     GROUP BY school ORDER BY school`,
    [req.academyId]
  );
  res.json(schools);
});

router.get('/schools/:school/grades', async (req, res) => {
  const grades = await getAll(
    `SELECT grade, COUNT(*) as student_count
     FROM students s JOIN users u ON s.user_id = u.id
     WHERE s.school = ? AND u.approved = 1 AND s.academy_id = ?
     GROUP BY grade ORDER BY grade`,
    [req.params.school, req.academyId]
  );
  res.json(grades);
});

router.get('/schools/:school/grades/:grade/students', async (req, res) => {
  const students = await getAll(
    `SELECT s.id, s.user_id, u.name, u.phone, s.school, s.grade,
            s.parent_name, s.parent_phone, s.memo, s.status, u.blocked
     FROM students s JOIN users u ON s.user_id = u.id
     WHERE s.school = ? AND s.grade = ? AND u.approved = 1 AND s.academy_id = ?
     ORDER BY u.name`,
    [req.params.school, req.params.grade, req.academyId]
  );
  res.json(students);
});

router.get('/students', async (req, res) => {
  const includeAll = req.query.all === '1'; // ?all=1 이면 전체 (퇴원생 포함)
  const whereExtra = includeAll
    ? ''
    : " AND s.school NOT IN ('조교', '선생님') AND (s.status IS NULL OR s.status != 'inactive')";
  const students = await getAll(
    `SELECT s.id, s.user_id, u.name, u.phone, u.username, s.school, s.grade,
            s.parent_name, s.parent_phone, s.memo, s.status,
            CASE WHEN u.username LIKE '__pre_%' THEN 1 ELSE 0 END as is_pre_registered
     FROM students s JOIN users u ON s.user_id = u.id
     WHERE u.approved = 1 AND u.role = 'student' AND s.academy_id = ?${whereExtra}
     ORDER BY s.school, s.grade, u.name`,
    [req.academyId]
  );
  res.json(students);
});

router.get('/students/:id', async (req, res) => {
  const student = await getOne(
    `SELECT s.id, s.user_id, u.name, u.phone, u.username, s.school, s.grade,
            s.parent_name, s.parent_phone, s.memo, u.blocked
     FROM students s JOIN users u ON s.user_id = u.id
     WHERE s.id = ? AND s.academy_id = ?`,
    [parseInt(req.params.id), req.academyId]
  );
  if (!student) {
    return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });
  }

  // 연결된 보호자 배열 추가
  try {
    const parents = await getAll(
      `SELECT p.id, p.name, p.phone, p.email, p.relationship as parent_relationship,
              p.is_payer as parent_is_payer, sp.relationship, sp.is_primary, sp.is_payer
       FROM parents p
       JOIN student_parents sp ON sp.parent_id = p.id
       WHERE sp.student_id = ? AND p.academy_id = ?`,
      [student.id, req.academyId]
    );
    student.parents = parents;
  } catch (e) {
    // parents 테이블이 아직 없을 수 있음 (마이그레이션 전)
    student.parents = [];
  }

  res.json(student);
});

// 학생 특이사항 수정
router.put('/students/:id/memo', async (req, res) => {
  const { memo } = req.body;
  await runQuery('UPDATE students SET memo = ? WHERE id = ? AND academy_id = ?', [memo || '', parseInt(req.params.id), req.academyId]);
  res.json({ message: '특이사항이 저장되었습니다.' });
});

// 학생 전체 정보 수정 (관리자 전용)
router.put('/students/:id', async (req, res) => {
  const { name, phone, school, grade, parentName, parentPhone, memo } = req.body;
  const studentId = parseInt(req.params.id);

  // 변경 전 스냅샷 (감사 로그용)
  const beforeSnap = await getOne(
    `SELECT s.school, s.grade, s.parent_name, s.parent_phone, s.memo, u.name, u.phone
     FROM students s JOIN users u ON s.user_id = u.id
     WHERE s.id = ? AND s.academy_id = ?`,
    [studentId, req.academyId]
  );

  // students 테이블 업데이트
  await runQuery(
    `UPDATE students SET school = ?, grade = ?, parent_name = ?, parent_phone = ?, memo = ?
     WHERE id = ? AND academy_id = ?`,
    [school, grade, parentName || '', parentPhone || '', memo || '', studentId, req.academyId]
  );

  // users 테이블도 업데이트 (이름, 연락처)
  const student = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [studentId, req.academyId]);
  if (student) {
    await runQuery(
      'UPDATE users SET name = ?, phone = ? WHERE id = ? AND academy_id = ?',
      [name, phone || '', student.user_id, req.academyId]
    );
  }

  await logAction({
    req, action: 'student_update', resourceType: 'student', resourceId: studentId,
    before: beforeSnap,
    after: { name, phone, school, grade, parent_name: parentName, parent_phone: parentPhone, memo },
  });

  res.json({ message: '학생 정보가 수정되었습니다.' });
});

// === 학생 상태 변경 (재원/퇴원) ===
router.put('/students/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: '유효하지 않은 상태값입니다.' });
  }
  const beforeRow = await getOne('SELECT status FROM students WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  await runQuery('UPDATE students SET status = ? WHERE id = ? AND academy_id = ?', [status, parseInt(req.params.id), req.academyId]);
  await logAction({
    req, action: 'student_status_change', resourceType: 'student', resourceId: parseInt(req.params.id),
    before: { status: beforeRow?.status }, after: { status },
  });

  // 타임라인 이벤트
  const statusLabel = status === 'active' ? '재원' : '퇴원';
  addEvent(req.academyId, parseInt(req.params.id), 'status_change', `상태 변경: ${statusLabel}`,
    null, { status }, req.user?.id
  ).catch(e => console.error('[timeline]', e.message));

  res.json({ message: status === 'active' ? '재원 상태로 변경되었습니다.' : '퇴원 처리되었습니다.' });
});

// === 학생 접속 차단/해제 ===
router.put('/students/:id/block', async (req, res) => {
  const { blocked } = req.body;
  const student = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  if (!student) return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });
  await runQuery('UPDATE users SET blocked = ? WHERE id = ? AND academy_id = ?', [blocked ? 1 : 0, student.user_id, req.academyId]);
  res.json({ message: blocked ? '접속이 차단되었습니다.' : '차단이 해제되었습니다.' });
});

// === 학생 비밀번호 초기화 ===
router.put('/students/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: '새 비밀번호는 최소 4자 이상이어야 합니다.' });
    }
    const student = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
    if (!student) return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(newPassword, 10);
    await runQuery('UPDATE users SET password = ? WHERE id = ? AND academy_id = ?', [hashed, student.user_id, req.academyId]);
    await logAction({ req, action: 'password_reset', resourceType: 'user', resourceId: student.user_id });
    res.json({ message: '비밀번호가 초기화되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// === 학생 학년 변경 ===
router.put('/students/:id/grade', async (req, res) => {
  const { grade } = req.body;
  if (!grade) return res.status(400).json({ error: '학년을 입력해주세요.' });
  await runQuery('UPDATE students SET grade = ? WHERE id = ? AND academy_id = ?', [grade, parseInt(req.params.id), req.academyId]);
  res.json({ message: `학년이 ${grade}(으)로 변경되었습니다.` });
});

// === 학년 일괄 변경 ===
router.put('/bulk-grade', async (req, res) => {
  const { school, fromGrade, toGrade } = req.body;
  if (!school || !fromGrade || !toGrade) {
    return res.status(400).json({ error: '학교, 변경 전 학년, 변경 후 학년을 입력해주세요.' });
  }
  const result = await runQuery(
    `UPDATE students SET grade = ? WHERE school = ? AND grade = ? AND academy_id = ? AND id IN (
      SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE u.approved = 1 AND (s.status IS NULL OR s.status = 'active') AND s.academy_id = ?
    )`,
    [toGrade, school, fromGrade, req.academyId, req.academyId]
  );
  res.json({ message: `${school} ${fromGrade} → ${toGrade} 일괄 변경 완료` });
});

// === 학생 삭제 ===
router.delete('/students/:id', requirePermission('students', 'delete'), async (req, res) => {
  const studentId = parseInt(req.params.id);
  const student = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [studentId, req.academyId]);
  if (!student) return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });

  // 감사 로그용 스냅샷
  const beforeSnap = await getOne(
    `SELECT s.*, u.name, u.phone, u.username
     FROM students s JOIN users u ON s.user_id = u.id
     WHERE s.id = ? AND s.academy_id = ?`,
    [studentId, req.academyId]
  );

  // 관련 데이터 삭제
  await runQuery('DELETE FROM scores WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  await runQuery('DELETE FROM reviews WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  await runQuery('DELETE FROM profile_edit_requests WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  await runQuery('DELETE FROM students WHERE id = ? AND academy_id = ?', [studentId, req.academyId]);
  await runQuery('DELETE FROM users WHERE id = ? AND academy_id = ?', [student.user_id, req.academyId]);

  await logAction({ req, action: 'student_delete', resourceType: 'student', resourceId: studentId, before: beforeSnap });

  res.json({ message: '학생이 삭제되었습니다.' });
});

// === 개인정보 수정 요청 관리 ===

router.get('/edit-requests', async (req, res) => {
  const requests = await getAll(
    `SELECT per.*, u.name as student_name, s.school, s.grade
     FROM profile_edit_requests per
     JOIN students s ON per.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE per.status = 'pending' AND per.academy_id = ?
     ORDER BY per.created_at DESC`,
    [req.academyId]
  );
  res.json(requests);
});

router.put('/edit-requests/:id/approve', async (req, res) => {
  const requestId = parseInt(req.params.id);
  const editReq = await getOne('SELECT * FROM profile_edit_requests WHERE id = ? AND status = ? AND academy_id = ?', [requestId, 'pending', req.academyId]);
  if (!editReq) {
    return res.status(404).json({ error: '수정 요청을 찾을 수 없습니다.' });
  }

  const { student_id, field_name, new_value } = editReq;

  // 화이트리스트 기반 안전한 필드 업데이트
  await applyProfileEdit(field_name, new_value, student_id, req.academyId);

  await runQuery(
    'UPDATE profile_edit_requests SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?',
    ['approved', requestId, req.academyId]
  );

  // 같은 학생의 다른 pending 요청도 함께 승인 처리
  const otherPending = await getAll(
    'SELECT * FROM profile_edit_requests WHERE student_id = ? AND status = ? AND id != ? AND academy_id = ?',
    [student_id, 'pending', requestId, req.academyId]
  );
  for (const other of otherPending) {
    await applyProfileEdit(other.field_name, other.new_value, student_id, req.academyId);
    await runQuery(
      'UPDATE profile_edit_requests SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?',
      ['approved', other.id, req.academyId]
    );
  }

  res.json({ message: '수정 요청이 승인되었습니다.' });
});

router.delete('/edit-requests/:id/reject', async (req, res) => {
  const requestId = parseInt(req.params.id);
  const editReq = await getOne('SELECT student_id FROM profile_edit_requests WHERE id = ? AND status = ? AND academy_id = ?', [requestId, 'pending', req.academyId]);
  if (!editReq) {
    return res.status(404).json({ error: '수정 요청을 찾을 수 없습니다.' });
  }

  // 같은 학생의 모든 pending 요청 거절
  await runQuery(
    'UPDATE profile_edit_requests SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE student_id = ? AND status = ? AND academy_id = ?',
    ['rejected', editReq.student_id, 'pending', req.academyId]
  );

  res.json({ message: '수정 요청이 거절되었습니다.' });
});

// === 수업 후기 관리 ===

router.get('/reviews', async (req, res) => {
  const reviews = await getAll(
    `SELECT r.*, u.name as student_name, s.school, s.grade
     FROM reviews r
     JOIN students s ON r.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE r.academy_id = ?
     ORDER BY r.created_at DESC`,
    [req.academyId]
  );
  res.json(reviews);
});

router.put('/reviews/:id/approve', async (req, res) => {
  await runQuery('UPDATE reviews SET status = ? WHERE id = ? AND academy_id = ?', ['approved', parseInt(req.params.id), req.academyId]);
  res.json({ message: '후기가 승인되었습니다.' });
});

router.put('/reviews/:id/best', async (req, res) => {
  const review = await getOne('SELECT is_best FROM reviews WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  if (!review) return res.status(404).json({ error: '후기를 찾을 수 없습니다.' });
  const newBest = review.is_best ? 0 : 1;
  await runQuery('UPDATE reviews SET is_best = ?, status = ? WHERE id = ? AND academy_id = ?', [newBest, 'approved', parseInt(req.params.id), req.academyId]);
  res.json({ message: newBest ? '베스트 후기로 설정되었습니다.' : '베스트 후기가 해제되었습니다.' });
});

// 관리자 후기 내용 수정
router.put('/reviews/:id/content', async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '내용을 입력해주세요.' });
  await runQuery('UPDATE reviews SET content = ? WHERE id = ? AND academy_id = ?', [content.trim(), parseInt(req.params.id), req.academyId]);
  res.json({ message: '후기가 수정되었습니다.' });
});

// 후기 보상 지급 (승인 후 별도)
router.post('/reviews/:id/reward', async (req, res) => {
  const review = await getOne(
    `SELECT r.*, s.id as sid FROM reviews r JOIN students s ON r.student_id = s.id WHERE r.id = ? AND r.academy_id = ?`,
    [parseInt(req.params.id), req.academyId]
  );
  if (!review) return res.status(404).json({ error: '후기를 찾을 수 없습니다.' });
  if (review.rewarded) return res.status(400).json({ error: '이미 보상이 지급되었습니다.' });

  const sc = await getOne('SELECT xp, points, level FROM student_characters WHERE student_id = ? AND academy_id = ?', [review.sid, req.academyId]);
  if (sc) {
    const amount = 200;
    const newXp = sc.xp + amount;
    const newPoints = sc.points + amount;
    let level = 1, acc = 0;
    while (true) {
      const next = Math.floor(40 * Math.pow(level + 1, 1.4));
      if (acc + next > newXp) break;
      acc += next;
      level++;
      if (level >= 100) { level = 100; break; }
    }
    await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
      [newXp, newPoints, level, review.sid, req.academyId]);
    await runInsert('INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, ?, ?, ?)',
      [review.sid, amount, 'review', '후기 작성 보상 (관리자 승인)', req.academyId]);

    // 알림
    const user = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [review.sid, req.academyId]);
    if (user) {
      await runInsert('INSERT INTO notifications (user_id, type, title, message, academy_id) VALUES (?, ?, ?, ?, ?)',
        [user.user_id, 'reward', '🎁 후기 보상 지급!', `후기 작성 보상으로 ${amount}P가 지급되었습니다!`, req.academyId]);
    }
  }

  await runQuery('UPDATE reviews SET rewarded = 1 WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  res.json({ message: '200P 보상이 지급되었습니다.' });
});

// 베스트 후기 500P 지급
router.post('/reviews/:id/reward-best', async (req, res) => {
  const review = await getOne(
    `SELECT r.*, s.id as sid FROM reviews r JOIN students s ON r.student_id = s.id WHERE r.id = ? AND r.academy_id = ?`,
    [parseInt(req.params.id), req.academyId]
  );
  if (!review) return res.status(404).json({ error: '후기를 찾을 수 없습니다.' });
  if (review.best_rewarded) return res.status(400).json({ error: '이미 베스트 보상이 지급되었습니다.' });

  const sc = await getOne('SELECT xp, points, level FROM student_characters WHERE student_id = ? AND academy_id = ?', [review.sid, req.academyId]);
  if (sc) {
    const amount = 500;
    const newXp = sc.xp + amount;
    const newPoints = sc.points + amount;
    let level = 1, acc = 0;
    while (true) {
      const next = Math.floor(40 * Math.pow(level + 1, 1.4));
      if (acc + next > newXp) break;
      acc += next; level++;
      if (level >= 100) { level = 100; break; }
    }
    await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
      [newXp, newPoints, level, review.sid, req.academyId]);
    await runInsert('INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, ?, ?, ?)',
      [review.sid, amount, 'review_best', '베스트 후기 보상', req.academyId]);
    const user = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [review.sid, req.academyId]);
    if (user) {
      await runInsert('INSERT INTO notifications (user_id, type, title, message, academy_id) VALUES (?, ?, ?, ?, ?)',
        [user.user_id, 'reward', '⭐ 베스트 후기 보상!', `베스트 후기 선정 보상으로 500P가 지급되었습니다!`, req.academyId]);
    }
  }
  await runQuery('UPDATE reviews SET best_rewarded = 1 WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  res.json({ message: '베스트 500P 보상이 지급되었습니다.' });
});

router.delete('/reviews/:id', async (req, res) => {
  await runQuery('DELETE FROM reviews WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  res.json({ message: '후기가 삭제되었습니다.' });
});

// === 수업 자료 관리 ===

// 수업 자료 등록 (유튜브 링크 또는 파일 업로드)
router.post('/materials', upload.single('file'), async (req, res) => {
  const { school, title, description, classDate, youtubeUrl } = req.body;
  if (!school || !title) {
    return res.status(400).json({ error: '학교와 제목을 입력해주세요.' });
  }

  const fileName = req.file ? req.file.originalname : null;
  const filePath = req.file ? req.file.filename : null;

  const id = await runInsert(
    `INSERT INTO class_materials (school, title, description, class_date, youtube_url, file_name, file_path, academy_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [school, title, description || '', classDate || null, youtubeUrl || null, fileName, filePath, req.academyId]
  );
  res.json({ message: '수업 자료가 등록되었습니다.', id });
});

// 학교별 수업 자료 조회
router.get('/materials', async (req, res) => {
  const { school } = req.query;
  let materials;
  if (school) {
    materials = await getAll(
      'SELECT * FROM class_materials WHERE school = ? AND academy_id = ? ORDER BY class_date DESC, id DESC',
      [school, req.academyId]
    );
  } else {
    materials = await getAll('SELECT * FROM class_materials WHERE academy_id = ? ORDER BY class_date DESC, id DESC', [req.academyId]);
  }
  res.json(materials);
});

// 수업 자료 수정 (제목/설명/날짜/링크)
router.put('/materials/:id', async (req, res) => {
  const { title, description, classDate, youtubeUrl } = req.body;
  if (!title) return res.status(400).json({ error: '제목을 입력해주세요.' });
  await runQuery(
    `UPDATE class_materials SET title = ?, description = ?, class_date = ?, youtube_url = ? WHERE id = ? AND academy_id = ?`,
    [title, description || '', classDate || null, youtubeUrl || null, parseInt(req.params.id), req.academyId]
  );
  res.json({ message: '수업 자료가 수정되었습니다.' });
});

// 수업 자료 삭제
router.delete('/materials/:id', async (req, res) => {
  const material = await getOne('SELECT file_path FROM class_materials WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  if (material && material.file_path) {
    const fullPath = path.join(uploadDir, material.file_path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
  await runQuery('DELETE FROM class_materials WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  res.json({ message: '수업 자료가 삭제되었습니다.' });
});

// === 관리자용 학생 페이지 미리보기 ===

router.get('/students/:id/view-data', async (req, res) => {
  const studentId = parseInt(req.params.id);
  const student = await getOne(
    `SELECT s.id, s.user_id, s.school, s.grade, s.parent_name, s.parent_phone, s.status,
            u.name, u.phone, u.username, u.blocked
     FROM students s JOIN users u ON s.user_id = u.id
     WHERE s.id = ? AND s.academy_id = ?`,
    [studentId, req.academyId]
  );
  if (!student) {
    return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });
  }

  // 안내사항
  const notices = await getAll(
    `SELECT * FROM notices
     WHERE academy_id = ? AND (target_type = 'all'
        OR (target_type = 'school' AND target_school = ?)
        OR (target_type = 'grade' AND target_school = ? AND target_grade = ?)
        OR (target_type = 'student' AND target_student_id = ?))
     ORDER BY created_at DESC`,
    [req.academyId, student.school, student.school, student.grade, student.id]
  );

  // 성적
  const scores = await getAll(
    `SELECT sc.*, e.name as exam_name, e.exam_date, e.exam_type, e.max_score
     FROM scores sc JOIN exams e ON sc.exam_id = e.id
     WHERE sc.student_id = ? AND sc.academy_id = ?
     ORDER BY e.exam_date DESC`,
    [studentId, req.academyId]
  );

  res.json({ student, notices: notices.slice(0, 3), scores: scores.slice(-3) });
});

// === 안내사항 ===

router.post('/notices', async (req, res) => {
  const { targetType, targetSchool, targetGrade, targetStudentId, title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
  }
  const id = await runInsert(
    `INSERT INTO notices (target_type, target_school, target_grade, target_student_id, title, content, academy_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [targetType || 'all', targetSchool || null, targetGrade || null, targetStudentId || null, title, content, req.academyId]
  );
  res.json({ message: '안내사항이 등록되었습니다.', id });
});

router.get('/notices', async (req, res) => {
  const notices = await getAll('SELECT * FROM notices WHERE academy_id = ? ORDER BY created_at DESC', [req.academyId]);
  res.json(notices);
});

// 안내사항 수정
router.put('/notices/:id', async (req, res) => {
  const { targetType, targetSchool, targetGrade, targetStudentId, title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
  }
  await runQuery(
    `UPDATE notices SET target_type = ?, target_school = ?, target_grade = ?, target_student_id = ?, title = ?, content = ? WHERE id = ? AND academy_id = ?`,
    [targetType || 'all', targetSchool || null, targetGrade || null, targetStudentId || null, title, content, parseInt(req.params.id), req.academyId]
  );
  res.json({ message: '안내사항이 수정되었습니다.' });
});

router.delete('/notices/:id', async (req, res) => {
  await runQuery('DELETE FROM notices WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  res.json({ message: '안내사항이 삭제되었습니다.' });
});

// ===== 사이트 설정 (강사 프로필 등) =====
router.get('/site-settings/:key', async (req, res) => {
  const row = await getOne('SELECT value FROM site_settings WHERE key = ? AND academy_id = ?', [req.params.key, req.academyId]);
  if (!row) return res.json({});
  try {
    res.json(JSON.parse(row.value));
  } catch {
    res.json({ value: row.value });
  }
});

router.put('/site-settings/:key', async (req, res) => {
  const { value } = req.body;
  const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
  const existing = await getOne('SELECT key FROM site_settings WHERE key = ? AND academy_id = ?', [req.params.key, req.academyId]);
  if (existing) {
    await runQuery('UPDATE site_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ? AND academy_id = ?', [jsonValue, req.params.key, req.academyId]);
  } else {
    await runQuery('INSERT INTO site_settings (key, value, academy_id) VALUES (?, ?, ?)', [req.params.key, jsonValue, req.academyId]);
  }
  res.json({ message: '설정이 저장되었습니다.' });
});

// === 학생 사전등록 관리 ===

// 사전등록 목록 조회
router.get('/pre-registered', async (req, res) => {
  const students = await getAll(
    `SELECT pr.*, s_linked.id as linked_sid
     FROM pre_registered_students pr
     LEFT JOIN students s_linked ON pr.linked_student_id = s_linked.id
     WHERE pr.academy_id = ?
     ORDER BY pr.status ASC, pr.created_at DESC`,
    [req.academyId]
  );
  res.json(students);
});

// 사전등록 학생 등록 — users/students 테이블에도 실제 레코드 생성
router.post('/pre-registered', async (req, res) => {
  const { name, phone, school, grade, parentName, parentPhone, memo } = req.body;
  if (!name || !school || !grade) {
    return res.status(400).json({ error: '이름, 학교, 학년은 필수입니다.' });
  }

  // 학생 수 제한 체크
  const academy = await getOne('SELECT max_students FROM academies WHERE id = ?', [req.academyId]);
  const studentCount = await getOne(
    "SELECT COUNT(*) as count FROM students s JOIN users u ON s.user_id = u.id WHERE s.academy_id = ? AND (s.status IS NULL OR s.status = 'active') AND u.role = 'student'",
    [req.academyId]
  );
  if (academy && (studentCount?.count || 0) >= (academy.max_students || 0)) {
    return res.status(403).json({ error: `현재 플랜의 최대 학생 수(${academy.max_students}명)에 도달했습니다. 플랜을 업그레이드해주세요.` });
  }

  // 1. users 테이블에 계정 생성 (비밀번호 없음, 로그인 불가, approved=1)
  const userId = await runInsert(
    `INSERT INTO users (username, password, name, role, approved, phone, academy_id) VALUES (?, ?, ?, 'student', 1, ?, ?)`,
    [`__pre_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, '', name, phone || '', req.academyId]
  );

  // 2. students 테이블에 학생 정보 생성
  const studentId = await runInsert(
    `INSERT INTO students (user_id, school, grade, parent_name, parent_phone, memo, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [userId, school, grade, parentName || '', parentPhone || '', memo || '', req.academyId]
  );

  // 3. pre_registered_students에도 기록 (연동 상태로)
  const preRegId = await runInsert(
    `INSERT INTO pre_registered_students (name, phone, school, grade, parent_name, parent_phone, memo, linked_student_id, status, linked_at, academy_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'linked', CURRENT_TIMESTAMP, ?)`,
    [name, phone || '', school, grade, parentName || '', parentPhone || '', memo || '', studentId, req.academyId]
  );

  res.json({ message: '학생이 등록되었습니다. 모든 목록에 표시됩니다.', id: preRegId, studentId, userId });
});

// 사전등록 학생 수정 — 실제 students/users도 같이 업데이트
router.put('/pre-registered/:id', async (req, res) => {
  const { name, phone, school, grade, parentName, parentPhone, memo } = req.body;
  if (!name || !school || !grade) {
    return res.status(400).json({ error: '이름, 학교, 학년은 필수입니다.' });
  }
  await runQuery(
    `UPDATE pre_registered_students SET name = ?, phone = ?, school = ?, grade = ?, parent_name = ?, parent_phone = ?, memo = ? WHERE id = ? AND academy_id = ?`,
    [name, phone || '', school, grade, parentName || '', parentPhone || '', memo || '', parseInt(req.params.id), req.academyId]
  );
  // 연동된 students/users도 업데이트
  const preReg = await getOne('SELECT linked_student_id FROM pre_registered_students WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  if (preReg && preReg.linked_student_id) {
    const student = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [preReg.linked_student_id, req.academyId]);
    if (student) {
      await runQuery('UPDATE users SET name = ?, phone = ? WHERE id = ? AND academy_id = ?', [name, phone || '', student.user_id, req.academyId]);
      await runQuery('UPDATE students SET school = ?, grade = ?, parent_name = ?, parent_phone = ?, memo = ? WHERE id = ? AND academy_id = ?',
        [school, grade, parentName || '', parentPhone || '', memo || '', preReg.linked_student_id, req.academyId]);
    }
  }
  res.json({ message: '학생 정보가 수정되었습니다.' });
});

// 사전등록 학생 삭제 — 아직 가입 전(username이 __pre_로 시작)이면 users/students도 삭제
router.delete('/pre-registered/:id', async (req, res) => {
  const preReg = await getOne('SELECT * FROM pre_registered_students WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  if (preReg && preReg.linked_student_id) {
    const student = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [preReg.linked_student_id, req.academyId]);
    if (student) {
      const user = await getOne('SELECT username FROM users WHERE id = ? AND academy_id = ?', [student.user_id, req.academyId]);
      // 아직 실제 가입 전인 경우만 삭제 (username이 __pre_로 시작)
      if (user && user.username.startsWith('__pre_')) {
        await runQuery('DELETE FROM students WHERE id = ? AND academy_id = ?', [preReg.linked_student_id, req.academyId]);
        await runQuery('DELETE FROM users WHERE id = ? AND academy_id = ?', [student.user_id, req.academyId]);
      }
    }
  }
  await runQuery('DELETE FROM pre_registered_students WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  res.json({ message: '삭제되었습니다.' });
});

// 사전등록 ↔ 가입 학생 수동 연동
router.put('/pre-registered/:id/link', async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ error: '연동할 학생 ID가 필요합니다.' });

  const preReg = await getOne('SELECT * FROM pre_registered_students WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  if (!preReg) return res.status(404).json({ error: '사전등록 정보를 찾을 수 없습니다.' });

  // 사전등록 정보를 실제 학생에게 반영 (학부모 정보, 메모 등)
  if (preReg.parent_name) {
    await runQuery('UPDATE students SET parent_name = ? WHERE id = ? AND academy_id = ?', [preReg.parent_name, studentId, req.academyId]);
  }
  if (preReg.parent_phone) {
    await runQuery('UPDATE students SET parent_phone = ? WHERE id = ? AND academy_id = ?', [preReg.parent_phone, studentId, req.academyId]);
  }
  if (preReg.memo) {
    await runQuery('UPDATE students SET memo = ? WHERE id = ? AND academy_id = ?', [preReg.memo, studentId, req.academyId]);
  }

  await runQuery(
    `UPDATE pre_registered_students SET linked_student_id = ?, status = 'linked', linked_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?`,
    [studentId, parseInt(req.params.id), req.academyId]
  );
  res.json({ message: '학생 연동이 완료되었습니다.' });
});

// 사전등록 연동 해제
router.put('/pre-registered/:id/unlink', async (req, res) => {
  await runQuery(
    `UPDATE pre_registered_students SET linked_student_id = NULL, status = 'pending', linked_at = NULL WHERE id = ? AND academy_id = ?`,
    [parseInt(req.params.id), req.academyId]
  );
  res.json({ message: '연동이 해제되었습니다.' });
});

// 관리자 배지 카운트 (사이드바 + 대시보드용)
router.get('/badge-counts', async (req, res) => {
  const [pending, edits, clinic, questions, reviews] = await Promise.all([
    getOne("SELECT COUNT(*) as cnt FROM users WHERE role = 'student' AND approved = 0 AND username NOT LIKE '__pre_%' AND academy_id = ?", [req.academyId]),
    getOne("SELECT COUNT(*) as cnt FROM profile_edit_requests WHERE status = 'pending' AND academy_id = ?", [req.academyId]),
    getOne("SELECT COUNT(*) as cnt FROM clinic_appointments WHERE status = 'pending' AND academy_id = ?", [req.academyId]),
    getOne("SELECT COUNT(*) as cnt FROM questions WHERE status = 'pending' AND academy_id = ?", [req.academyId]),
    getOne("SELECT COUNT(*) as cnt FROM reviews WHERE is_approved = 0 AND academy_id = ?", [req.academyId]),
  ]);
  res.json({
    pending_users: pending?.cnt || 0,
    edit_requests: edits?.cnt || 0,
    pending_clinic: clinic?.cnt || 0,
    pending_questions: questions?.cnt || 0,
    pending_reviews: reviews?.cnt || 0,
  });
});

module.exports = router;
