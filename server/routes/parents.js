const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// === 보호자 목록 ===
router.get('/', async (req, res) => {
  try {
    const { search, is_payer } = req.query;
    let sql = `
      SELECT p.*,
             COUNT(sp.id) as children_count
      FROM parents p
      LEFT JOIN student_parents sp ON sp.parent_id = p.id
      WHERE p.academy_id = ?
    `;
    const params = [req.academyId];

    if (search) {
      sql += ' AND (p.name ILIKE ? OR p.phone ILIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (is_payer === '1') {
      sql += ' AND p.is_payer = true';
    }

    sql += ' GROUP BY p.id ORDER BY p.name ASC';

    const rows = await getAll(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[보호자 목록 오류]', err.message);
    res.status(500).json({ error: '보호자 목록 조회 중 오류가 발생했습니다.' });
  }
});

// === 보호자 상세 ===
router.get('/:id', async (req, res) => {
  try {
    const parent = await getOne(
      'SELECT * FROM parents WHERE id = ? AND academy_id = ?',
      [parseInt(req.params.id), req.academyId]
    );
    if (!parent) return res.status(404).json({ error: '보호자를 찾을 수 없습니다.' });

    // 연결된 자녀 배열
    const children = await getAll(
      `SELECT s.id, u.name, s.school, s.grade, s.status, sp.relationship, sp.is_primary, sp.is_payer
       FROM student_parents sp
       JOIN students s ON sp.student_id = s.id
       JOIN users u ON s.user_id = u.id
       WHERE sp.parent_id = ? AND s.academy_id = ?
       ORDER BY u.name`,
      [parent.id, req.academyId]
    );

    res.json({ ...parent, children });
  } catch (err) {
    console.error('[보호자 상세 오류]', err.message);
    res.status(500).json({ error: '보호자 상세 조회 중 오류가 발생했습니다.' });
  }
});

// === 보호자 등록 ===
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, relationship, is_payer, memo } = req.body;
    if (!name) return res.status(400).json({ error: '보호자 이름은 필수입니다.' });
    if (!phone) return res.status(400).json({ error: '보호자 연락처는 필수입니다.' });

    // 같은 학원에 같은 전화번호 중복 체크
    const existing = await getOne(
      'SELECT id FROM parents WHERE academy_id = ? AND phone = ?',
      [req.academyId, phone]
    );
    if (existing) {
      return res.status(409).json({ error: '동일한 연락처의 보호자가 이미 등록되어 있습니다.', existingId: existing.id });
    }

    const id = await runInsert(
      `INSERT INTO parents (academy_id, name, phone, email, relationship, is_payer, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.academyId, name, phone, email || null, relationship || '보호자', is_payer ? true : false, memo || null]
    );

    res.json({ id, message: '보호자가 등록되었습니다.' });
  } catch (err) {
    console.error('[보호자 등록 오류]', err.message);
    res.status(500).json({ error: '보호자 등록 중 오류가 발생했습니다.' });
  }
});

// === 보호자 수정 ===
router.put('/:id', async (req, res) => {
  try {
    const parentId = parseInt(req.params.id);
    const parent = await getOne('SELECT id FROM parents WHERE id = ? AND academy_id = ?', [parentId, req.academyId]);
    if (!parent) return res.status(404).json({ error: '보호자를 찾을 수 없습니다.' });

    const { name, phone, email, relationship, is_payer, memo } = req.body;
    const fields = [];
    const params = [];

    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { fields.push('email = ?'); params.push(email); }
    if (relationship !== undefined) { fields.push('relationship = ?'); params.push(relationship); }
    if (is_payer !== undefined) { fields.push('is_payer = ?'); params.push(is_payer ? true : false); }
    if (memo !== undefined) { fields.push('memo = ?'); params.push(memo); }

    if (fields.length === 0) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

    fields.push('updated_at = NOW()');
    params.push(parentId, req.academyId);

    await runQuery(`UPDATE parents SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`, params);
    res.json({ message: '보호자 정보가 수정되었습니다.' });
  } catch (err) {
    console.error('[보호자 수정 오류]', err.message);
    res.status(500).json({ error: '보호자 수정 중 오류가 발생했습니다.' });
  }
});

// === 보호자 삭제 ===
router.delete('/:id', async (req, res) => {
  try {
    const parentId = parseInt(req.params.id);
    const parent = await getOne('SELECT id FROM parents WHERE id = ? AND academy_id = ?', [parentId, req.academyId]);
    if (!parent) return res.status(404).json({ error: '보호자를 찾을 수 없습니다.' });

    await runQuery('DELETE FROM parents WHERE id = ? AND academy_id = ?', [parentId, req.academyId]);
    res.json({ message: '보호자가 삭제되었습니다.' });
  } catch (err) {
    console.error('[보호자 삭제 오류]', err.message);
    res.status(500).json({ error: '보호자 삭제 중 오류가 발생했습니다.' });
  }
});

// === 자녀 연결 ===
router.post('/:id/link-student', async (req, res) => {
  try {
    const parentId = parseInt(req.params.id);
    const { student_id, relationship, is_primary, is_payer } = req.body;
    if (!student_id) return res.status(400).json({ error: '학생을 선택해주세요.' });

    // 보호자 존재 확인
    const parent = await getOne('SELECT id FROM parents WHERE id = ? AND academy_id = ?', [parentId, req.academyId]);
    if (!parent) return res.status(404).json({ error: '보호자를 찾을 수 없습니다.' });

    // 학생 존재 확인
    const student = await getOne('SELECT id FROM students WHERE id = ? AND academy_id = ?', [student_id, req.academyId]);
    if (!student) return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });

    // 중복 연결 확인
    const existing = await getOne(
      'SELECT id FROM student_parents WHERE student_id = ? AND parent_id = ?',
      [student_id, parentId]
    );
    if (existing) return res.status(409).json({ error: '이미 연결된 학생입니다.' });

    // is_primary가 true이면 기존 primary 해제
    if (is_primary) {
      await runQuery(
        'UPDATE student_parents SET is_primary = false WHERE student_id = ? AND is_primary = true',
        [student_id]
      );
    }

    await runInsert(
      `INSERT INTO student_parents (student_id, parent_id, relationship, is_primary, is_payer)
       VALUES (?, ?, ?, ?, ?)`,
      [student_id, parentId, relationship || null, is_primary ? true : false, is_payer ? true : false]
    );

    res.json({ message: '자녀가 연결되었습니다.' });
  } catch (err) {
    console.error('[자녀 연결 오류]', err.message);
    res.status(500).json({ error: '자녀 연결 중 오류가 발생했습니다.' });
  }
});

// === 자녀 연결 해제 ===
router.delete('/:parentId/unlink-student/:studentId', async (req, res) => {
  try {
    const parentId = parseInt(req.params.parentId);
    const studentId = parseInt(req.params.studentId);

    const link = await getOne(
      'SELECT sp.id FROM student_parents sp JOIN parents p ON sp.parent_id = p.id WHERE sp.parent_id = ? AND sp.student_id = ? AND p.academy_id = ?',
      [parentId, studentId, req.academyId]
    );
    if (!link) return res.status(404).json({ error: '연결 정보를 찾을 수 없습니다.' });

    await runQuery('DELETE FROM student_parents WHERE parent_id = ? AND student_id = ?', [parentId, studentId]);
    res.json({ message: '자녀 연결이 해제되었습니다.' });
  } catch (err) {
    console.error('[자녀 연결 해제 오류]', err.message);
    res.status(500).json({ error: '자녀 연결 해제 중 오류가 발생했습니다.' });
  }
});

// === 자녀 목록 ===
router.get('/:id/children', async (req, res) => {
  try {
    const parentId = parseInt(req.params.id);
    const parent = await getOne('SELECT id FROM parents WHERE id = ? AND academy_id = ?', [parentId, req.academyId]);
    if (!parent) return res.status(404).json({ error: '보호자를 찾을 수 없습니다.' });

    const children = await getAll(
      `SELECT s.id, u.name, u.phone, s.school, s.grade, s.status,
              sp.relationship, sp.is_primary, sp.is_payer
       FROM student_parents sp
       JOIN students s ON sp.student_id = s.id
       JOIN users u ON s.user_id = u.id
       WHERE sp.parent_id = ? AND s.academy_id = ?
       ORDER BY u.name`,
      [parentId, req.academyId]
    );

    res.json(children);
  } catch (err) {
    console.error('[자녀 목록 오류]', err.message);
    res.status(500).json({ error: '자녀 목록 조회 중 오류가 발생했습니다.' });
  }
});

// === 보호자 앱 초대 (stub) ===
router.post('/invite', async (req, res) => {
  try {
    const { parent_id } = req.body;
    if (!parent_id) return res.status(400).json({ error: '보호자를 선택해주세요.' });

    const parent = await getOne('SELECT * FROM parents WHERE id = ? AND academy_id = ?', [parent_id, req.academyId]);
    if (!parent) return res.status(404).json({ error: '보호자를 찾을 수 없습니다.' });

    // TODO: 향후 SMS 발송 연동
    res.json({
      message: '초대 기능은 준비 중입니다. 향후 SMS로 앱 초대 링크가 발송됩니다.',
      parent_name: parent.name,
      parent_phone: parent.phone,
    });
  } catch (err) {
    console.error('[보호자 초대 오류]', err.message);
    res.status(500).json({ error: '보호자 초대 중 오류가 발생했습니다.' });
  }
});

// === 기존 데이터 이전 (students → parents) ===
router.post('/migrate-from-students', async (req, res) => {
  try {
    // 1. 기존 students에서 parent_phone이 있는 고유한 보호자 추출
    const distinctParents = await getAll(
      `SELECT DISTINCT parent_name, parent_phone, academy_id
       FROM students
       WHERE parent_phone IS NOT NULL AND parent_phone != '' AND academy_id = ?`,
      [req.academyId]
    );

    if (distinctParents.length === 0) {
      return res.json({ message: '이전할 보호자 데이터가 없습니다.', created: 0, linked: 0 });
    }

    let created = 0;
    let linked = 0;

    for (const dp of distinctParents) {
      const parentName = dp.parent_name || '보호자';
      const parentPhone = dp.parent_phone;

      // 2. 같은 academy_id + phone이면 하나의 parent로 합침
      let parentId;
      const existing = await getOne(
        'SELECT id FROM parents WHERE academy_id = ? AND phone = ?',
        [req.academyId, parentPhone]
      );

      if (existing) {
        parentId = existing.id;
      } else {
        // 3. parents 테이블에 INSERT
        parentId = await runInsert(
          `INSERT INTO parents (academy_id, name, phone, relationship, is_payer)
           VALUES (?, ?, ?, '보호자', true)`,
          [req.academyId, parentName, parentPhone]
        );
        created++;
      }

      // 4. 해당 parent_phone을 가진 모든 학생과 연결
      const students = await getAll(
        'SELECT id FROM students WHERE parent_phone = ? AND academy_id = ?',
        [parentPhone, req.academyId]
      );

      for (const student of students) {
        const existingLink = await getOne(
          'SELECT id FROM student_parents WHERE student_id = ? AND parent_id = ?',
          [student.id, parentId]
        );
        if (!existingLink) {
          await runInsert(
            `INSERT INTO student_parents (student_id, parent_id, relationship, is_primary, is_payer)
             VALUES (?, ?, '보호자', true, true)`,
            [student.id, parentId]
          );
          linked++;
        }
      }
    }

    res.json({
      message: `이전 완료: 보호자 ${created}명 생성, ${linked}건 연결`,
      created,
      linked,
    });
  } catch (err) {
    console.error('[데이터 이전 오류]', err.message);
    res.status(500).json({ error: '데이터 이전 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
