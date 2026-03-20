const express = require('express');
const router = express.Router();
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 수업 목록 가져오기 (수업 일정 테이블에서 고유 수업명 추출)
router.get('/classes', authenticateToken, async (req, res) => {
  const classes = await getAll(
    `SELECT DISTINCT title as name FROM class_schedules WHERE status = 'active' AND academy_id = ? ORDER BY title ASC`,
    [req.academyId]
  );
  res.json(classes);
});

// 수업+날짜별 학생 목록 + 과제 기록 조회
router.get('/class/:className/date/:date', authenticateToken, async (req, res) => {
  const { className, date } = req.params;

  // 해당 수업에 속하는 학생 조회 (approved + active)
  const students = await getAll(
    `SELECT s.id, s.school, s.grade, u.name
     FROM students s
     JOIN users u ON s.user_id = u.id
     WHERE u.approved = 1 AND u.role = 'student' AND s.status = 'active'
       AND s.school NOT IN ('조교', '선생님') AND s.academy_id = ?
     ORDER BY s.school, s.grade, u.name`,
    [req.academyId]
  );

  // 해당 날짜+수업의 기존 기록
  const records = await getAll(
    `SELECT * FROM homework_records WHERE class_name = ? AND date = ? AND academy_id = ?`,
    [className, date, req.academyId]
  );

  const recordMap = {};
  records.forEach(r => { recordMap[r.student_id] = r; });

  const result = students.map(s => ({
    studentId: s.id,
    name: s.name,
    school: s.school,
    grade: s.grade,
    record: recordMap[s.id] || null,
  }));

  res.json(result);
});

// 일괄 저장
router.post('/bulk-save', authenticateToken, async (req, res) => {
  const { className, date, records } = req.body;
  if (!className || !date || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: '필수 입력값이 부족합니다.' });
  }

  let saved = 0;
  for (const r of records) {
    const existing = await getOne(
      'SELECT id FROM homework_records WHERE student_id = ? AND class_name = ? AND date = ? AND academy_id = ?',
      [r.studentId, className, date, req.academyId]
    );

    if (existing) {
      await runQuery(
        `UPDATE homework_records SET homework_status = ?, word_test = ?, retest = ?,
         submission_status = ?, memo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?`,
        [r.homeworkStatus || '', r.wordTest || '', r.retest || '',
         r.submissionStatus || '', r.memo || '', existing.id, req.academyId]
      );
    } else {
      await runInsert(
        `INSERT INTO homework_records (student_id, class_name, date, homework_status, word_test, retest, submission_status, memo, created_by, academy_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.studentId, className, date, r.homeworkStatus || '', r.wordTest || '', r.retest || '',
         r.submissionStatus || '', r.memo || '', req.user.id, req.academyId]
      );
    }
    saved++;
  }

  res.json({ message: `${saved}건 저장됨`, saved });
});

// 학생 개별 누적 기록 (학생용)
router.get('/student/:studentId', authenticateToken, async (req, res) => {
  const { studentId } = req.params;

  const records = await getAll(
    `SELECT * FROM homework_records WHERE student_id = ? AND academy_id = ? ORDER BY date DESC LIMIT 50`,
    [studentId, req.academyId]
  );

  const bonuses = await getAll(
    `SELECT * FROM homework_bonus WHERE student_id = ? AND academy_id = ? ORDER BY created_at DESC LIMIT 20`,
    [studentId, req.academyId]
  );

  res.json({ records, bonuses });
});

// 내 과제 기록 (학생 자신)
router.get('/my', authenticateToken, async (req, res) => {
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보 없음' });

  const records = await getAll(
    `SELECT * FROM homework_records WHERE student_id = ? AND academy_id = ? ORDER BY date DESC LIMIT 50`,
    [student.id, req.academyId]
  );

  const bonuses = await getAll(
    `SELECT * FROM homework_bonus WHERE student_id = ? AND academy_id = ? ORDER BY created_at DESC LIMIT 20`,
    [student.id, req.academyId]
  );

  res.json({ records, bonuses });
});

// 누적 기록 조회 (관리자 - 수업별)
router.get('/history/:className', authenticateToken, async (req, res) => {
  const { className } = req.params;
  const { studentId, school, grade, limit: lim } = req.query;

  let where = 'hr.class_name = ? AND hr.academy_id = ?';
  const params = [className, req.academyId];

  if (studentId) { where += ' AND hr.student_id = ?'; params.push(studentId); }
  if (school) { where += ' AND s.school = ?'; params.push(school); }
  if (grade) { where += ' AND s.grade = ?'; params.push(grade); }

  const records = await getAll(
    `SELECT hr.*, u.name as student_name, s.school, s.grade
     FROM homework_records hr
     JOIN students s ON hr.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE ${where}
     ORDER BY hr.date DESC, s.school, u.name
     LIMIT ?`,
    [...params, parseInt(lim) || 500]
  );

  res.json(records);
});

// 특별 포인트 지급
router.post('/bonus', authenticateToken, async (req, res) => {
  const { studentId, amount, reason, homeworkRecordId } = req.body;
  if (!studentId || !amount) {
    return res.status(400).json({ error: '학생 ID와 포인트 양은 필수입니다.' });
  }

  const student = await getOne('SELECT id FROM students WHERE id = ? AND academy_id = ?', [studentId, req.academyId]);
  if (!student) return res.status(404).json({ error: '학생 없음' });

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  if (!sc) return res.status(404).json({ error: '게임 캐릭터 없음' });

  // XP + 포인트 지급
  const newXp = sc.xp + amount;
  const newPoints = sc.points + amount;
  // 레벨 계산
  const getLevelInfo = (xp) => {
    let level = 1;
    let required = 100;
    let total = 0;
    while (total + required <= xp) {
      total += required;
      level++;
      required = Math.floor(100 * Math.pow(1.2, level - 1));
    }
    return { level };
  };
  const newLevel = getLevelInfo(newXp).level;

  await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
    [newXp, newPoints, newLevel, studentId, req.academyId]);

  // XP 로그
  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'homework_bonus', ?, ?)",
    [studentId, amount, reason || '과제 특별 포인트', req.academyId]);

  // 보너스 기록
  await runInsert(
    'INSERT INTO homework_bonus (student_id, homework_record_id, amount, reason, granted_by, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
    [studentId, homeworkRecordId || null, amount, reason || '', req.user.id, req.academyId]
  );

  // 알림 생성
  const user = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [studentId, req.academyId]);
  if (user) {
    await runInsert(
      'INSERT INTO notifications (user_id, type, title, message, academy_id) VALUES (?, ?, ?, ?, ?)',
      [user.user_id, 'bonus', '🎉 특별 포인트 지급!',
       `과제 우수 보상으로 ${amount} 포인트를 받았습니다! ${reason ? '(' + reason + ')' : ''}`, req.academyId]
    );
  }

  res.json({ message: `${amount} 포인트 지급 완료`, newXp, newPoints, newLevel });
});

module.exports = router;
