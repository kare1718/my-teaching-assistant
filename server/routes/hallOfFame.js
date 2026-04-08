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
    if (!student) return;

    const titleName = achievement
      ? `${category} - ${achievement}`
      : category;

    let title = await getOne("SELECT id FROM titles WHERE name = ? AND condition_type = 'hall_of_fame' AND (academy_id = ? OR academy_id = 0)", [titleName, academyId]);

    if (!title) {
      const titleId = await runInsert(
        "INSERT INTO titles (name, description, condition_type, condition_value, icon, is_hidden, academy_id) VALUES (?, ?, 'hall_of_fame', 0, '🏆', 0, ?)",
        [titleName, `명예의 전당: ${titleName}`, academyId]
      );
      title = { id: titleId };
    }

    const already = await getOne(
      'SELECT id FROM student_titles WHERE student_id = ? AND title_id = ? AND academy_id = ?',
      [student.id, title.id, academyId]
    );
    if (!already) {
      await runInsert(
        'INSERT INTO student_titles (student_id, title_id, academy_id) VALUES (?, ?, ?)',
        [student.id, title.id, academyId]
      );

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
  const academyId = req.academyId;
  const items = await getAll(
    `SELECT * FROM hall_of_fame WHERE is_visible = 1 AND academy_id = ? ORDER BY display_order ASC, created_at DESC`,
    [academyId]
  );
  res.json(items);
});

// === 관리자용 ===

// 전체 목록 (숨김 포함)
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const items = await getAll(
    `SELECT * FROM hall_of_fame WHERE academy_id = ? ORDER BY display_order ASC, created_at DESC`,
    [academyId]
  );
  res.json(items);
});

// 등록
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { category, student_name, school, grade, year, description, achievement, display_order, student_status } = req.body;
  if (!student_name || !category) {
    return res.status(400).json({ error: '카테고리와 학생 이름은 필수입니다.' });
  }
  const id = await runInsert(
    `INSERT INTO hall_of_fame (category, student_name, school, grade, year, description, achievement, display_order, student_status, academy_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [category, student_name.trim(), (school || '').trim(), (grade || '').trim(),
     (year || '').trim(), (description || '').trim(), (achievement || '').trim(), display_order || 0, student_status || '재학생', academyId]
  );

  const titleName = achievement ? `${category} - ${achievement}` : category;
  grantHofTitle(student_name.trim(), category, achievement, school, grade, academyId);

  // 300P 자동 지급
  let student;
  if (school) {
    student = await getOne(`SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE u.name = ? AND s.school = ? AND u.approved = 1 AND s.academy_id = ?`, [student_name.trim(), school.trim(), academyId]);
  }
  if (!student) {
    student = await getOne(`SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE u.name = ? AND u.approved = 1 AND s.academy_id = ?`, [student_name.trim(), academyId]);
  }
  if (student) {
    const sc = await getOne('SELECT xp, points, level FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, academyId]);
    if (sc) {
      const amount = 300;
      const newXp = sc.xp + amount;
      const newPoints = sc.points + amount;
      let level = 1, acc = 0;
      while (true) { const next = Math.floor(40 * Math.pow(level + 1, 1.4)); if (acc + next > newXp) break; acc += next; level++; if (level >= 100) { level = 100; break; } }
      await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?', [newXp, newPoints, level, student.id, academyId]);
      await runInsert('INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, ?, ?, ?)', [student.id, amount, 'hall_of_fame', `명예의 전당: ${titleName}`, academyId]);
      const user = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [student.id, academyId]);
      if (user) {
        await runInsert('INSERT INTO notifications (user_id, type, title, message, academy_id) VALUES (?, ?, ?, ?, ?)',
          [user.user_id, 'reward', '🏆 명예의 전당!', `명예의 전당 등재! 300P + "${titleName}" 칭호를 획득했습니다!`, academyId]);
      }
    }
    await runQuery('UPDATE hall_of_fame SET rewarded = 1 WHERE id = ? AND academy_id = ?', [id, academyId]);
  }

  res.json({ message: '명예의 전당에 등록되었습니다. (300P + 칭호 자동 지급)', id });
});

// 수정
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { category, student_name, school, grade, year, description, achievement, display_order, is_visible, student_status } = req.body;
  const item = await getOne('SELECT id FROM hall_of_fame WHERE id = ? AND academy_id = ?', [req.params.id, academyId]);
  if (!item) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });

  await runQuery(
    `UPDATE hall_of_fame SET category = ?, student_name = ?, school = ?, grade = ?, year = ?,
     description = ?, achievement = ?, display_order = ?, is_visible = ?, student_status = ? WHERE id = ? AND academy_id = ?`,
    [category, student_name.trim(), (school || '').trim(), (grade || '').trim(),
     (year || '').trim(), (description || '').trim(), (achievement || '').trim(), display_order || 0,
     is_visible !== undefined ? (is_visible ? 1 : 0) : 1, student_status || '재학생', req.params.id, academyId]
  );
  res.json({ message: '수정되었습니다.' });
});

// 300P 보상 지급
router.post('/:id/reward', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const item = await getOne('SELECT * FROM hall_of_fame WHERE id = ? AND academy_id = ?', [req.params.id, academyId]);
  if (!item) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  if (item.rewarded) return res.status(400).json({ error: '이미 보상이 지급되었습니다.' });

  let student;
  if (item.school) {
    student = await getOne(
      `SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE u.name = ? AND s.school = ? AND u.approved = 1 AND s.academy_id = ?`,
      [item.student_name, item.school, academyId]
    );
  }
  if (!student) {
    student = await getOne(
      `SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE u.name = ? AND u.approved = 1 AND s.academy_id = ?`,
      [item.student_name, academyId]
    );
  }
  if (!student) return res.status(404).json({ error: '매칭되는 학생을 찾을 수 없습니다.' });

  const sc = await getOne('SELECT xp, points, level FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, academyId]);
  if (sc) {
    const amount = 300;
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
      [newXp, newPoints, level, student.id, academyId]);
    await runInsert('INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, ?, ?, ?)',
      [student.id, amount, 'hall_of_fame', `명예의 전당 보상: ${item.category} - ${item.achievement || ''}`, academyId]);
    const user = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [student.id, academyId]);
    if (user) {
      await runInsert('INSERT INTO notifications (user_id, type, title, message, academy_id) VALUES (?, ?, ?, ?, ?)',
        [user.user_id, 'reward', '🏆 명예의 전당 보상!', `명예의 전당 등재 보상으로 300P가 지급되었습니다!`, academyId]);
    }
  }
  await runQuery('UPDATE hall_of_fame SET rewarded = 1 WHERE id = ? AND academy_id = ?', [req.params.id, academyId]);
  res.json({ message: '300P 보상이 지급되었습니다.' });
});

// 칭호 부여 (관리자가 직접 선택)
router.post('/:id/grant-title', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { titleName } = req.body;
  if (!titleName) return res.status(400).json({ error: '칭호명을 입력해주세요.' });

  const item = await getOne('SELECT * FROM hall_of_fame WHERE id = ? AND academy_id = ?', [req.params.id, academyId]);
  if (!item) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });

  let student;
  if (item.school) {
    student = await getOne(
      `SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE u.name = ? AND s.school = ? AND u.approved = 1 AND s.academy_id = ?`,
      [item.student_name, item.school, academyId]
    );
  }
  if (!student) {
    student = await getOne(
      `SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE u.name = ? AND u.approved = 1 AND s.academy_id = ?`,
      [item.student_name, academyId]
    );
  }
  if (!student) return res.status(404).json({ error: '매칭되는 학생을 찾을 수 없습니다.' });

  let title = await getOne("SELECT id FROM titles WHERE name = ? AND condition_type = 'hall_of_fame' AND (academy_id = ? OR academy_id = 0)", [titleName, academyId]);
  if (!title) {
    const titleId = await runInsert(
      "INSERT INTO titles (name, description, condition_type, condition_value, icon, is_hidden, academy_id) VALUES (?, ?, 'hall_of_fame', 0, '🏆', 0, ?)",
      [titleName, `명예의 전당: ${titleName}`, academyId]
    );
    title = { id: titleId };
  }

  const already = await getOne('SELECT id FROM student_titles WHERE student_id = ? AND title_id = ? AND academy_id = ?', [student.id, title.id, academyId]);
  if (already) return res.status(400).json({ error: '이미 해당 칭호가 부여되어 있습니다.' });

  await runInsert('INSERT INTO student_titles (student_id, title_id, academy_id) VALUES (?, ?, ?)', [student.id, title.id, academyId]);

  const user = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [student.id, academyId]);
  if (user) {
    await runInsert('INSERT INTO notifications (user_id, type, title, message, academy_id) VALUES (?, ?, ?, ?, ?)',
      [user.user_id, 'title', '🏆 새 칭호 획득!', `명예의 전당 등재로 "${titleName}" 칭호를 획득했습니다!`, academyId]);
  }

  res.json({ message: `"${titleName}" 칭호가 부여되었습니다.` });
});

// 카테고리 일괄 수정
router.put('/bulk-rename-category', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  const { oldName, newName } = req.body;
  if (!oldName || !newName) return res.status(400).json({ error: '이전 이름과 새 이름을 입력해주세요.' });
  const items = await getAll('SELECT id FROM hall_of_fame WHERE category = ? AND academy_id = ?', [oldName, academyId]);
  if (items.length === 0) return res.status(404).json({ error: `"${oldName}" 카테고리가 없습니다.` });
  await runQuery('UPDATE hall_of_fame SET category = ? WHERE category = ? AND academy_id = ?', [newName, oldName, academyId]);
  res.json({ message: `"${oldName}" → "${newName}" (${items.length}건) 일괄 수정 완료` });
});

// 삭제
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const academyId = req.academyId;
  await runQuery('DELETE FROM hall_of_fame WHERE id = ? AND academy_id = ?', [req.params.id, academyId]);
  res.json({ message: '삭제되었습니다.' });
});

module.exports = router;
