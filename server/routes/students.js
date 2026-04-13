const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// 내 안내사항 조회
router.get('/my-notices', async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT * FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  const isAdminLike = ['admin', 'assistant'].includes(req.user.role) || req.user.school === '조교' || req.user.school === '선생님';
  if (!student && !isAdminLike) {
    return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });
  }

  let notices;
  if (isAdminLike) {
    notices = await getAll('SELECT * FROM notices WHERE academy_id = ? ORDER BY created_at DESC', [academyId]);
  } else {
    notices = await getAll(
      `SELECT * FROM notices
       WHERE academy_id = ?
         AND (target_type = 'all'
          OR (target_type = 'school' AND target_school = ?)
          OR (target_type = 'grade' AND target_school = ? AND target_grade = ?)
          OR (target_type = 'student' AND target_student_id = ?))
       ORDER BY created_at DESC`,
      [academyId, student.school, student.school, student.grade, student.id]
    );
  }

  // 각 공지에 읽음 여부 추가
  const noticeIds = notices.map(n => n.id);
  if (noticeIds.length > 0) {
    const placeholders = noticeIds.map((_, i) => `$${i + 1}`).join(',');
    const reads = await getAll(
      `SELECT notice_id FROM notice_reads WHERE user_id = $${noticeIds.length + 1} AND notice_id IN (${placeholders})`,
      [...noticeIds, req.user.id]
    );
    const readSet = new Set(reads.map(r => r.notice_id));
    notices = notices.map(n => ({ ...n, is_read: readSet.has(n.id) ? 1 : 0 }));
  }

  res.json(notices);
});

// 공지 읽음 표시
router.post('/notices/:id/read', async (req, res) => {
  try {
    await runInsert(
      `INSERT INTO notice_reads (notice_id, user_id) VALUES (?, ?) ON CONFLICT (notice_id, user_id) DO NOTHING`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Notice read error:', err);
    res.status(500).json({ error: '읽음 처리 실패' });
  }
});

// 마케팅 동의 토글
router.put('/marketing-consent', async (req, res) => {
  try {
    const { agree } = req.body;
    await runQuery(
      'UPDATE users SET agree_marketing = ?, agree_marketing_at = ? WHERE id = ?',
      [agree ? 1 : 0, agree ? new Date().toISOString() : null, req.user.id]
    );
    res.json({ message: agree ? '마케팅 정보 수신에 동의했습니다.' : '마케팅 정보 수신 동의를 철회했습니다.' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 내 정보 조회
router.get('/my-info', async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne(
    `SELECT s.id, s.user_id, s.school, s.grade, s.parent_name, s.parent_phone, s.status,
            u.name, u.phone, u.username, u.agree_marketing, u.agree_marketing_at
     FROM students s JOIN users u ON s.user_id = u.id
     WHERE s.user_id = ? AND s.academy_id = ?`,
    [req.user.id, academyId]
  );

  if (!student) {
    return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });
  }

  res.json(student);
});

// 내 학교 수업 자료 조회
router.get('/my-materials', async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT school FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) {
    return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });
  }

  const materials = await getAll(
    'SELECT * FROM class_materials WHERE school = ? AND academy_id = ? ORDER BY class_date DESC, id DESC',
    [student.school, academyId]
  );
  res.json(materials);
});

// === 수업 후기 ===

// 후기 작성
router.post('/reviews', async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const { content } = req.body;
  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: '후기 내용을 입력해주세요.' });
  }

  await runInsert(
    'INSERT INTO reviews (student_id, content, academy_id) VALUES (?, ?, ?)',
    [student.id, content.trim(), academyId]
  );

  // 후기 작성 보상 (1일 1회, 50XP + 50P)
  try {
    // KST 10시 기준 일일 초기화
    const kstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    if (kstNow.getUTCHours() < 10) kstNow.setUTCDate(kstNow.getUTCDate() - 1);
    const today = kstNow.toISOString().split('T')[0];
    const alreadyRewarded = await getOne(
      "SELECT id FROM xp_logs WHERE student_id = ? AND source = 'review' AND date(created_at) = date(?) AND academy_id = ?",
      [student.id, today, academyId]
    );
    if (!alreadyRewarded) {
      const sc = await getOne('SELECT xp, points, level FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, academyId]);
      if (sc) {
        const newXp = sc.xp + 50;
        const newPoints = sc.points + 50;
        // 레벨 재계산
        let level = 1, acc = 0;
        while (true) {
          const next = Math.floor(40 * Math.pow(level + 1, 1.4));
          if (acc + next > newXp) break;
          acc += next;
          level++;
          if (level >= 100) { level = 100; break; }
        }
        await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
          [newXp, newPoints, level, student.id, academyId]);
        await runInsert('INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, ?, ?, ?)',
          [student.id, 50, 'review', '후기 작성 보상', academyId]);
      }
    }
  } catch(e) { /* 보상 실패해도 후기는 등록 */ }

  res.json({ message: '후기가 등록되었습니다. 관리자 승인 후 표시됩니다. (+50 XP/P 보상!)' });
});

// 승인된 후기 조회 (전체 공개 - 익명 처리)
router.get('/reviews', async (req, res) => {
  const academyId = req.academyId;
  const reviews = await getAll(
    `SELECT r.id, r.content, r.is_best, r.created_at, u.name as student_name
     FROM reviews r
     JOIN students s ON r.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE r.status = 'approved' AND r.academy_id = ?
     ORDER BY r.is_best DESC, r.created_at DESC`,
    [academyId]
  );

  // 이름 익명 처리: 홍길동 → 홍**
  const anonymized = reviews.map(r => ({
    ...r,
    display_name: r.student_name.length > 1
      ? r.student_name[0] + '*'.repeat(r.student_name.length - 1)
      : r.student_name
  }));

  res.json(anonymized);
});

// 내 후기 목록
router.get('/my-reviews', async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const reviews = await getAll(
    'SELECT * FROM reviews WHERE student_id = ? AND academy_id = ? ORDER BY created_at DESC',
    [student.id, academyId]
  );
  res.json(reviews);
});

// 후기 수정
router.put('/reviews/:id', async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const review = await getOne('SELECT * FROM reviews WHERE id = ? AND student_id = ? AND academy_id = ?', [req.params.id, student.id, academyId]);
  if (!review) return res.status(404).json({ error: '수정할 후기를 찾을 수 없습니다.' });

  const { content } = req.body;
  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: '후기 내용을 입력해주세요.' });
  }

  await runQuery('UPDATE reviews SET content = ?, status = ? WHERE id = ? AND academy_id = ?', [content.trim(), 'pending', review.id, academyId]);
  res.json({ message: '후기가 수정되었습니다. 다시 승인 대기 상태로 변경됩니다.' });
});

// 개인정보 수정 요청 제출
router.post('/edit-request', async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne(
    `SELECT s.*, u.name, u.phone
     FROM students s JOIN users u ON s.user_id = u.id
     WHERE s.user_id = ? AND s.academy_id = ?`,
    [req.user.id, academyId]
  );
  if (!student) {
    return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });
  }

  const { changes } = req.body;
  if (!changes || !Array.isArray(changes) || changes.length === 0) {
    return res.status(400).json({ error: '변경할 항목이 없습니다.' });
  }

  // 이미 대기 중인 요청이 있으면 거절
  const pending = await getOne(
    'SELECT id FROM profile_edit_requests WHERE student_id = ? AND status = ? AND academy_id = ?',
    [student.id, 'pending', academyId]
  );
  if (pending) {
    return res.status(400).json({ error: '이미 대기 중인 수정 요청이 있습니다. 승인/거절 후 다시 요청해주세요.' });
  }

  const fieldMap = {
    name: student.name,
    phone: student.phone,
    school: student.school,
    grade: student.grade,
    parent_name: student.parent_name,
    parent_phone: student.parent_phone
  };

  for (const c of changes) {
    if (fieldMap[c.field] === undefined) continue;
    await runInsert(
      `INSERT INTO profile_edit_requests (student_id, field_name, old_value, new_value, academy_id)
       VALUES (?, ?, ?, ?, ?)`,
      [student.id, c.field, fieldMap[c.field] || '', c.value, academyId]
    );
  }

  res.json({ message: '수정 요청이 제출되었습니다. 관리자 승인 후 반영됩니다.' });
});

// 내 수정 요청 조회
router.get('/my-edit-requests', async (req, res) => {
  const academyId = req.academyId;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
  if (!student) {
    return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });
  }

  const requests = await getAll(
    'SELECT * FROM profile_edit_requests WHERE student_id = ? AND academy_id = ? ORDER BY created_at DESC',
    [student.id, academyId]
  );
  res.json(requests);
});

// === 대시보드 BFF (MyPage 다중 API → 1개 통합) ===
router.get('/dashboard', async (req, res) => {
  const academyId = req.academyId;
  const userId = req.user.id;

  const student = await getOne(
    `SELECT s.id, s.user_id, s.school, s.grade, s.parent_name, s.parent_phone, s.status,
            u.name, u.phone, u.username
     FROM students s JOIN users u ON s.user_id = u.id
     WHERE s.user_id = ? AND s.academy_id = ?`,
    [userId, academyId]
  );

  if (!student) {
    return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });
  }

  const [notices, scores, editRequests, bestReviews, character, notifications, upcomingClinics, hallOfFame, myReviews, homework] = await Promise.all([
    getAll(
      `SELECT * FROM notices
       WHERE academy_id = ? AND (
         target_type = 'all'
         OR (target_type = 'school' AND target_school = ?)
         OR (target_type = 'grade' AND target_school = ? AND target_grade = ?)
         OR (target_type = 'student' AND target_student_id = ?)
       )
       ORDER BY created_at DESC LIMIT 3`,
      [academyId, student.school, student.school, student.grade, student.id]
    ),
    getAll(
      `SELECT sc.score, sc.rank_num, sc.note,
              e.name as exam_name, e.exam_date, e.exam_type, e.max_score, e.id as exam_id,
              (SELECT COUNT(*) FROM scores WHERE exam_id = e.id AND academy_id = ?) as total_students
       FROM scores sc JOIN exams e ON sc.exam_id = e.id
       WHERE sc.student_id = ? AND sc.academy_id = ?
       ORDER BY e.exam_date DESC, e.id DESC LIMIT 3`,
      [academyId, student.id, academyId]
    ),
    getAll(
      'SELECT * FROM profile_edit_requests WHERE student_id = ? AND academy_id = ? ORDER BY created_at DESC',
      [student.id, academyId]
    ),
    getAll(
      `SELECT r.id, r.content, r.is_best, r.created_at, u.name as student_name, s.school, s.grade
       FROM reviews r
       JOIN students s ON r.student_id = s.id
       JOIN users u ON s.user_id = u.id
       WHERE r.status = 'approved' AND r.is_best = 1 AND r.academy_id = ?
       ORDER BY r.created_at DESC`,
      [academyId]
    ),
    getOne(
      `SELECT sc.*, COALESCE(c.name, '캐릭터') as char_name, COALESCE(c.emoji, '🐯') as emoji, COALESCE(c.description, '') as char_description
       FROM student_characters sc
       LEFT JOIN characters c ON sc.character_id = c.id AND (c.academy_id = ? OR c.academy_id = 0)
       WHERE sc.student_id = ? AND sc.academy_id = ?`,
      [academyId, student.id, academyId]
    ),
    getAll(
      'SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT 20',
      [userId]
    ),
    getAll(
      `SELECT * FROM clinic_appointments
       WHERE student_id = ? AND status = 'approved' AND appointment_date >= ? AND academy_id = ?
       ORDER BY appointment_date ASC, time_slot ASC LIMIT 5`,
      [student.id, new Date().toISOString().split('T')[0], academyId]
    ).catch(() => []),
    getAll(
      'SELECT * FROM hall_of_fame WHERE is_visible = 1 AND academy_id = ? ORDER BY display_order ASC, created_at DESC',
      [academyId]
    ),
    getAll(
      'SELECT id FROM reviews WHERE student_id = ? AND academy_id = ? LIMIT 1',
      [student.id, academyId]
    ),
    getAll(
      'SELECT * FROM homework_records WHERE student_id = ? AND academy_id = ? ORDER BY date DESC LIMIT 50',
      [student.id, academyId]
    ).catch(() => []),
  ]);

  const maskName = (name) => {
    if (!name || name.length <= 1) return name;
    if (name.length === 2) return name[0] + '*';
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  };

  res.json({
    info: student,
    notices,
    scores,
    editRequests,
    bestReviews: bestReviews.map(r => ({
      ...r,
      display_name: maskName(r.student_name),
      display_grade: r.grade || '',
    })),
    character,
    notifications,
    upcomingClinics,
    hallOfFame,
    hasWrittenReview: myReviews && myReviews.length > 0,
    homework: { records: homework },
  });
});

module.exports = router;
