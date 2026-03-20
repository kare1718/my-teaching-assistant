const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 명예의 전당 칭호 자동 부여 함수
async function grantHofTitle(studentName, category, achievement, school, grade, academyId) {
  try {
    // 학생 이름+학교로 매칭 (동명이인 방지)
    let student;
    if (school) {
      student = await getOne(
        `SELECT s.id FROM students s JOIN users u ON s.user_id = u.id
         WHERE u.name = ? AND s.school = ? AND u.approved = 1 AND s.academy_id = ?`,
        [studentName, school, academyId]
      );
    }
    if (!student) {
      student = await getOne(
        `SELECT s.id FROM students s JOIN users u ON s.user_id = u.id
         WHERE u.name = ? AND u.approved = 1 AND s.academy_id = ?`,
        [studentName, academyId]
      );
    }
    if (!student) return; // 매칭되는 학생 없음

    // 칭호 이름 생성: 카테고리 + 성과
    const titleName = achievement
      ? `${category} - ${achievement}`
      : category;

    // 이미 같은 이름 칭호가 있는지 확인
    let title = await getOne("SELECT id FROM titles WHERE name = ? AND condition_type = 'hall_of_fame' AND academy_id = ?", [titleName, academyId]);

    if (!title) {
      // 새 칭호 생성
      const titleId = await runInsert(
        "INSERT INTO titles (name, description, condition_type, condition_value, icon, is_hidden, academy_id) VALUES (?, ?, 'hall_of_fame', 0, '🏆', 0, ?)",
        [titleName, `명예의 전당: ${titleName}`, academyId]
      );
      title = { id: titleId };
    }

    // 학생에게 칭호 부여 (중복 방지)
    const already = await getOne(
      'SELECT id FROM student_titles WHERE student_id = ? AND title_id = ? AND academy_id = ?',
      [student.id, title.id, academyId]
    );
    if (!already) {
      await runInsert(
        'INSERT INTO student_titles (student_id, title_id, academy_id) VALUES (?, ?, ?)',
        [student.id, title.id, academyId]
      );

      // 알림
      const user = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [student.id, academyId]);
      if (user) {
        await runInsert(
          'INSERT INTO notifications (user_id, type, title, message, academy_id) VALUES (?, ?, ?, ?, ?)',
          [user.user_id, 'title', '🏆 새 칭호 획득!',
           `명예의 전당 등재로 "${titleName}" 칭호를 획득했습니다!`, academyId]
        );
      }
    }
  } catch (e) {
    console.error('명예의 전당 칭호 부여 오류:', e.message);
  }
}

// 공개 API: 명예의 전당 목록 (학생용)
router.get('/', authenticateToken, async (req, res) => {
  const items = await getAll(
    `SELECT * FROM hall_of_fame WHERE is_visible = 1 AND academy_id = ? ORDER BY display_order ASC, created_at DESC`,
    [req.academyId]
  );
  res.json(items);
});

// === 관리자용 ===

// 전체 목록 (숨김 포함)
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
  const items = await getAll(
    `SELECT * FROM hall_of_fame WHERE academy_id = ? ORDER BY display_order ASC, created_at DESC`,
    [req.academyId]
  );
  res.json(items);
});

// 등록
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { category, student_name, school, grade, year, description, achievement, display_order, student_status } = req.body;
  if (!student_name || !category) {
    return res.status(400).json({ error: '카테고리와 학생 이름은 필수입니다.' });
  }
  const id = await runInsert(
    `INSERT INTO hall_of_fame (category, student_name, school, grade, year, description, achievement, display_order, student_status, academy_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [category, student_name.trim(), (school || '').trim(), (grade || '').trim(),
     (year || '').trim(), (description || '').trim(), (achievement || '').trim(), display_order || 0, student_status || '재학생', req.academyId]
  );

  // 명예의 전당 칭호 자동 부여
  await grantHofTitle(student_name.trim(), category, achievement, school, grade, req.academyId);

  res.json({ message: '명예의 전당에 등록되었습니다.', id });
});

// 수정
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { category, student_name, school, grade, year, description, achievement, display_order, is_visible, student_status } = req.body;
  const item = await getOne('SELECT id FROM hall_of_fame WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  if (!item) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });

  await runQuery(
    `UPDATE hall_of_fame SET category = ?, student_name = ?, school = ?, grade = ?, year = ?,
     description = ?, achievement = ?, display_order = ?, is_visible = ?, student_status = ? WHERE id = ? AND academy_id = ?`,
    [category, student_name.trim(), (school || '').trim(), (grade || '').trim(),
     (year || '').trim(), (description || '').trim(), (achievement || '').trim(), display_order || 0,
     is_visible !== undefined ? (is_visible ? 1 : 0) : 1, student_status || '재학생', req.params.id, req.academyId]
  );
  res.json({ message: '수정되었습니다.' });
});

// 삭제
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  await runQuery('DELETE FROM hall_of_fame WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  res.json({ message: '삭제되었습니다.' });
});

module.exports = router;
