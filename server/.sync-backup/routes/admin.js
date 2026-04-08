const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, requireAdmin);

// 파일 업로드 설정 (per-academy upload directory)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const academyDir = path.join(__dirname, '../../uploads', String(req.academyId || 'default'));
    if (!fs.existsSync(academyDir)) {
      fs.mkdirSync(academyDir, { recursive: true });
    }
    cb(null, academyDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueName + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

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
  res.json({ message: '승인되었습니다.' });
});

router.delete('/reject/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  await runQuery('DELETE FROM students WHERE user_id = ? AND academy_id = ?', [userId, req.academyId]);
  await runQuery('DELETE FROM users WHERE id = ? AND role = ? AND academy_id = ?', [userId, 'student', req.academyId]);
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
  const students = await getAll(
    `SELECT s.id, s.user_id, u.name, u.phone, s.school, s.grade,
            s.parent_name, s.parent_phone, s.memo
     FROM students s JOIN users u ON s.user_id = u.id
     WHERE u.approved = 1 AND s.academy_id = ?
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

  res.json({ message: '학생 정보가 수정되었습니다.' });
});

// === 학생 상태 변경 (재원/퇴원) ===
router.put('/students/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: '유효하지 않은 상태값입니다.' });
  }
  await runQuery('UPDATE students SET status = ? WHERE id = ? AND academy_id = ?', [status, parseInt(req.params.id), req.academyId]);
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
router.delete('/students/:id', async (req, res) => {
  const studentId = parseInt(req.params.id);
  const student = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [studentId, req.academyId]);
  if (!student) return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });

  // 관련 데이터 삭제
  await runQuery('DELETE FROM scores WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  await runQuery('DELETE FROM reviews WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  await runQuery('DELETE FROM profile_edit_requests WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  await runQuery('DELETE FROM students WHERE id = ? AND academy_id = ?', [studentId, req.academyId]);
  await runQuery('DELETE FROM users WHERE id = ? AND academy_id = ?', [student.user_id, req.academyId]);

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

  // users 테이블 필드
  if (field_name === 'name' || field_name === 'phone') {
    const student = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [student_id, req.academyId]);
    if (student) {
      await runQuery(`UPDATE users SET ${field_name} = ? WHERE id = ? AND academy_id = ?`, [new_value, student.user_id, req.academyId]);
    }
  }
  // students 테이블 필드
  else if (['school', 'grade', 'parent_name', 'parent_phone'].includes(field_name)) {
    await runQuery(`UPDATE students SET ${field_name} = ? WHERE id = ? AND academy_id = ?`, [new_value, student_id, req.academyId]);
  }

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
    if (other.field_name === 'name' || other.field_name === 'phone') {
      const student = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [student_id, req.academyId]);
      if (student) {
        await runQuery(`UPDATE users SET ${other.field_name} = ? WHERE id = ? AND academy_id = ?`, [other.new_value, student.user_id, req.academyId]);
      }
    } else if (['school', 'grade', 'parent_name', 'parent_phone'].includes(other.field_name)) {
      await runQuery(`UPDATE students SET ${other.field_name} = ? WHERE id = ? AND academy_id = ?`, [other.new_value, student_id, req.academyId]);
    }
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
    materials = await getAll(
      'SELECT * FROM class_materials WHERE academy_id = ? ORDER BY class_date DESC, id DESC',
      [req.academyId]
    );
  }
  res.json(materials);
});

// 수업 자료 삭제
router.delete('/materials/:id', async (req, res) => {
  const material = await getOne('SELECT file_path FROM class_materials WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  if (material && material.file_path) {
    const academyUploadDir = path.join(__dirname, '../../uploads', String(req.academyId || 'default'));
    const fullPath = path.join(academyUploadDir, material.file_path);
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
     WHERE academy_id = ? AND (
       target_type = 'all'
        OR (target_type = 'school' AND target_school = ?)
        OR (target_type = 'grade' AND target_school = ? AND target_grade = ?)
        OR (target_type = 'student' AND target_student_id = ?)
     )
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
  const notices = await getAll(
    'SELECT * FROM notices WHERE academy_id = ? ORDER BY created_at DESC',
    [req.academyId]
  );

  // 각 공지별 읽음 수 추가
  for (const notice of notices) {
    const readCount = await getOne(
      'SELECT COUNT(*) as count FROM notice_reads WHERE notice_id = ?',
      [notice.id]
    );
    notice.read_count = readCount ? readCount.count : 0;
  }

  res.json(notices);
});

// 공지 읽음 현황 상세
router.get('/notices/:id/reads', async (req, res) => {
  const reads = await getAll(
    `SELECT nr.read_at, u.name, u.username
     FROM notice_reads nr
     JOIN users u ON nr.user_id = u.id
     WHERE nr.notice_id = ?
     ORDER BY nr.read_at DESC`,
    [parseInt(req.params.id)]
  );
  res.json(reads);
});

router.delete('/notices/:id', async (req, res) => {
  await runQuery('DELETE FROM notices WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  res.json({ message: '안내사항이 삭제되었습니다.' });
});

module.exports = router;
