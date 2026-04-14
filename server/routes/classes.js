const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { addEvent } = require('../services/timeline');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// ═══════════════════════════════════════════
// 반 관리
// ═══════════════════════════════════════════

// 반 목록
router.get('/', async (req, res) => {
  try {
    const { status, class_type, teacher_id } = req.query;
    let sql = `
      SELECT c.*,
        (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id AND cs.status = 'active') as current_count,
        u.name as teacher_name
      FROM classes c
      LEFT JOIN users u ON u.id = c.teacher_id
      WHERE c.academy_id = ?
    `;
    const params = [req.academyId];

    if (status) { sql += ' AND c.status = ?'; params.push(status); }
    if (class_type) { sql += ' AND c.class_type = ?'; params.push(class_type); }
    if (teacher_id) { sql += ' AND c.teacher_id = ?'; params.push(teacher_id); }

    sql += ' ORDER BY c.created_at DESC';

    const rows = await getAll(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[반 목록 오류]', err.message);
    res.status(500).json({ error: '반 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 반 생성
router.post('/', async (req, res) => {
  try {
    const { name, class_type, subject, teacher_id, capacity, room, tuition_plan_id, start_date, end_date, memo } = req.body;
    if (!name) return res.status(400).json({ error: '반 이름은 필수입니다.' });

    const id = await runInsert(
      `INSERT INTO classes (academy_id, name, class_type, subject, teacher_id, capacity, room, tuition_plan_id, start_date, end_date, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.academyId, name, class_type || 'regular', subject || null, teacher_id || null, capacity || null, room || null, tuition_plan_id || null, start_date || null, end_date || null, memo || null]
    );

    // 강사 배정 이력
    if (teacher_id) {
      await runInsert(
        'INSERT INTO teacher_assignments (class_id, teacher_id, reason) VALUES (?, ?, ?)',
        [id, teacher_id, '반 생성 시 배정']
      );
    }

    res.json({ id, message: '반이 생성되었습니다.' });
  } catch (err) {
    console.error('[반 생성 오류]', err.message);
    res.status(500).json({ error: '반 생성 중 오류가 발생했습니다.' });
  }
});

// 반 상세
router.get('/:id', async (req, res) => {
  try {
    const cls = await getOne(
      `SELECT c.*,
        (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id AND cs.status = 'active') as current_count,
        u.name as teacher_name
       FROM classes c
       LEFT JOIN users u ON u.id = c.teacher_id
       WHERE c.id = ? AND c.academy_id = ?`,
      [req.params.id, req.academyId]
    );
    if (!cls) return res.status(404).json({ error: '반을 찾을 수 없습니다.' });

    // 수강생 목록
    const students = await getAll(
      `SELECT cs.*, u.name as student_name, s.school, s.grade
       FROM class_students cs
       JOIN students s ON s.id = cs.student_id
       JOIN users u ON u.id = s.user_id
       WHERE cs.class_id = ? AND cs.status = 'active'
       ORDER BY u.name`,
      [req.params.id]
    );

    // 반복 일정
    const recurring = await getAll(
      'SELECT * FROM class_schedules_recurring WHERE class_id = ? AND is_active = true ORDER BY day_of_week',
      [req.params.id]
    );

    // 최근 세션 10개
    const sessions = await getAll(
      `SELECT cs.*, u.name as teacher_name
       FROM class_sessions cs
       LEFT JOIN users u ON u.id = cs.teacher_id
       WHERE cs.class_id = ? AND cs.academy_id = ?
       ORDER BY cs.session_date DESC, cs.start_time DESC
       LIMIT 10`,
      [req.params.id, req.academyId]
    );

    res.json({ ...cls, students, recurring, sessions });
  } catch (err) {
    console.error('[반 상세 오류]', err.message);
    res.status(500).json({ error: '반 상세 조회 중 오류가 발생했습니다.' });
  }
});

// 반 수정
router.put('/:id', async (req, res) => {
  try {
    const cls = await getOne('SELECT id FROM classes WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!cls) return res.status(404).json({ error: '반을 찾을 수 없습니다.' });

    const { name, class_type, subject, teacher_id, capacity, room, tuition_plan_id, start_date, end_date, memo, status } = req.body;
    const fields = [];
    const params = [];

    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (class_type !== undefined) { fields.push('class_type = ?'); params.push(class_type); }
    if (subject !== undefined) { fields.push('subject = ?'); params.push(subject); }
    if (teacher_id !== undefined) { fields.push('teacher_id = ?'); params.push(teacher_id); }
    if (capacity !== undefined) { fields.push('capacity = ?'); params.push(capacity); }
    if (room !== undefined) { fields.push('room = ?'); params.push(room); }
    if (tuition_plan_id !== undefined) { fields.push('tuition_plan_id = ?'); params.push(tuition_plan_id); }
    if (start_date !== undefined) { fields.push('start_date = ?'); params.push(start_date); }
    if (end_date !== undefined) { fields.push('end_date = ?'); params.push(end_date); }
    if (memo !== undefined) { fields.push('memo = ?'); params.push(memo); }
    if (status !== undefined) { fields.push('status = ?'); params.push(status); }
    fields.push('updated_at = NOW()');

    if (fields.length === 1) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

    params.push(req.params.id, req.academyId);
    await runQuery(`UPDATE classes SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`, params);
    res.json({ message: '반 정보가 수정되었습니다.' });
  } catch (err) {
    console.error('[반 수정 오류]', err.message);
    res.status(500).json({ error: '반 수정 중 오류가 발생했습니다.' });
  }
});

// 반 종료 (소프트 삭제)
router.delete('/:id', async (req, res) => {
  try {
    const cls = await getOne('SELECT id FROM classes WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!cls) return res.status(404).json({ error: '반을 찾을 수 없습니다.' });

    await runQuery("UPDATE classes SET status = 'closed', updated_at = NOW() WHERE id = ? AND academy_id = ?", [req.params.id, req.academyId]);
    res.json({ message: '반이 종료되었습니다.' });
  } catch (err) {
    console.error('[반 종료 오류]', err.message);
    res.status(500).json({ error: '반 종료 중 오류가 발생했습니다.' });
  }
});

// ═══════════════════════════════════════════
// 수강생 관리
// ═══════════════════════════════════════════

// 수강생 목록
router.get('/:id/students', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT cs.*, u.name as student_name, s.school, s.grade
      FROM class_students cs
      JOIN students s ON s.id = cs.student_id
      JOIN users u ON u.id = s.user_id
      WHERE cs.class_id = ?
    `;
    const params = [req.params.id];
    if (status) { sql += ' AND cs.status = ?'; params.push(status); }
    sql += ' ORDER BY u.name';

    const rows = await getAll(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[수강생 목록 오류]', err.message);
    res.status(500).json({ error: '수강생 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 수강생 등록
router.post('/:id/enroll', async (req, res) => {
  try {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: '학생을 선택해주세요.' });

    const cls = await getOne('SELECT id, capacity FROM classes WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!cls) return res.status(404).json({ error: '반을 찾을 수 없습니다.' });

    // 이미 등록 여부 확인
    const existing = await getOne(
      "SELECT id, status FROM class_students WHERE class_id = ? AND student_id = ?",
      [req.params.id, student_id]
    );
    if (existing && existing.status === 'active') {
      return res.status(400).json({ error: '이미 등록된 학생입니다.' });
    }

    // 정원 체크
    if (cls.capacity) {
      const countRow = await getOne(
        "SELECT COUNT(*) as cnt FROM class_students WHERE class_id = ? AND status = 'active'",
        [req.params.id]
      );
      if (countRow.cnt >= cls.capacity) {
        // 대기자 등록
        await runInsert(
          'INSERT INTO class_waitlist (class_id, student_id) VALUES (?, ?)',
          [req.params.id, student_id]
        );
        return res.json({ enrolled: false, waitlisted: true, message: '정원 초과로 대기자로 등록되었습니다.' });
      }
    }

    // 기존 dropped 상태면 업데이트, 아니면 새로 INSERT
    if (existing) {
      await runQuery(
        "UPDATE class_students SET status = 'active', enrolled_at = NOW(), dropped_at = NULL WHERE id = ?",
        [existing.id]
      );
    } else {
      await runInsert(
        'INSERT INTO class_students (class_id, student_id) VALUES (?, ?)',
        [req.params.id, student_id]
      );
    }

    // 타임라인 이벤트
    const clsInfo = await getOne('SELECT name FROM classes WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    addEvent(req.academyId, student_id, 'class_enrolled', `반 등록: ${clsInfo?.name || ''}`,
      null, { class_id: parseInt(req.params.id) }, req.user?.id
    ).catch(e => console.error('[timeline]', e.message));

    res.json({ enrolled: true, waitlisted: false, message: '수강생이 등록되었습니다.' });
  } catch (err) {
    console.error('[수강생 등록 오류]', err.message);
    res.status(500).json({ error: '수강생 등록 중 오류가 발생했습니다.' });
  }
});

// 다수 수강생 일괄 등록
router.post('/:id/enroll-bulk', async (req, res) => {
  try {
    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: '등록할 학생 목록이 필요합니다.' });
    }

    const cls = await getOne('SELECT id, capacity FROM classes WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!cls) return res.status(404).json({ error: '반을 찾을 수 없습니다.' });

    let enrolled = 0;
    let waitlisted = 0;
    let skipped = 0;

    for (const studentId of studentIds) {
      const existing = await getOne(
        "SELECT id, status FROM class_students WHERE class_id = ? AND student_id = ?",
        [req.params.id, studentId]
      );
      if (existing && existing.status === 'active') { skipped++; continue; }

      // 정원 체크
      if (cls.capacity) {
        const countRow = await getOne(
          "SELECT COUNT(*) as cnt FROM class_students WHERE class_id = ? AND status = 'active'",
          [req.params.id]
        );
        if (countRow.cnt >= cls.capacity) {
          await runInsert('INSERT INTO class_waitlist (class_id, student_id) VALUES (?, ?)', [req.params.id, studentId]);
          waitlisted++;
          continue;
        }
      }

      if (existing) {
        await runQuery("UPDATE class_students SET status = 'active', enrolled_at = NOW(), dropped_at = NULL WHERE id = ?", [existing.id]);
      } else {
        await runInsert('INSERT INTO class_students (class_id, student_id) VALUES (?, ?)', [req.params.id, studentId]);
      }
      enrolled++;
    }

    res.json({ enrolled, waitlisted, skipped, message: `${enrolled}명 등록, ${waitlisted}명 대기, ${skipped}명 중복` });
  } catch (err) {
    console.error('[일괄 등록 오류]', err.message);
    res.status(500).json({ error: '일괄 등록 중 오류가 발생했습니다.' });
  }
});

// 수강 취소
router.delete('/:classId/students/:studentId', async (req, res) => {
  try {
    const record = await getOne(
      "SELECT id FROM class_students WHERE class_id = ? AND student_id = ? AND status = 'active'",
      [req.params.classId, req.params.studentId]
    );
    if (!record) return res.status(404).json({ error: '수강 기록을 찾을 수 없습니다.' });

    await runQuery(
      "UPDATE class_students SET status = 'dropped', dropped_at = NOW() WHERE id = ?",
      [record.id]
    );

    // 타임라인 이벤트
    const clsInfo = await getOne('SELECT name FROM classes WHERE id = ? AND academy_id = ?', [req.params.classId, req.academyId]);
    addEvent(req.academyId, parseInt(req.params.studentId), 'class_dropped', `반 해제: ${clsInfo?.name || ''}`,
      null, { class_id: parseInt(req.params.classId) }, req.user?.id
    ).catch(e => console.error('[timeline]', e.message));

    res.json({ message: '수강이 취소되었습니다.' });
  } catch (err) {
    console.error('[수강 취소 오류]', err.message);
    res.status(500).json({ error: '수강 취소 중 오류가 발생했습니다.' });
  }
});

// ═══════════════════════════════════════════
// 수업 세션
// ═══════════════════════════════════════════

// 세션 목록
router.get('/:id/sessions', async (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `
      SELECT cs.*, u.name as teacher_name
      FROM class_sessions cs
      LEFT JOIN users u ON u.id = cs.teacher_id
      WHERE cs.class_id = ?
    `;
    const params = [req.params.id];

    if (from) { sql += ' AND cs.session_date >= ?'; params.push(from); }
    if (to) { sql += ' AND cs.session_date <= ?'; params.push(to); }

    sql += ' ORDER BY cs.session_date, cs.start_time';

    const rows = await getAll(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[세션 목록 오류]', err.message);
    res.status(500).json({ error: '세션 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 반복 규칙 기반 세션 자동 생성
router.post('/:id/sessions/generate', async (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) return res.status(400).json({ error: '시작일과 종료일은 필수입니다.' });

    const cls = await getOne('SELECT id, teacher_id FROM classes WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!cls) return res.status(404).json({ error: '반을 찾을 수 없습니다.' });

    const rules = await getAll(
      'SELECT * FROM class_schedules_recurring WHERE class_id = ? AND is_active = true',
      [req.params.id]
    );
    if (rules.length === 0) return res.status(400).json({ error: '반복 일정 규칙이 없습니다.' });

    let created = 0;
    const startDate = new Date(from);
    const endDate = new Date(to);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay(); // 0=Sun
      const dateStr = d.toISOString().slice(0, 10);

      for (const rule of rules) {
        if (rule.day_of_week !== dayOfWeek) continue;
        if (rule.effective_from && dateStr < rule.effective_from) continue;
        if (rule.effective_until && dateStr > rule.effective_until) continue;

        // 중복 체크
        const exists = await getOne(
          'SELECT id FROM class_sessions WHERE class_id = ? AND session_date = ? AND start_time = ? AND academy_id = ?',
          [req.params.id, dateStr, rule.start_time, req.academyId]
        );
        if (exists) continue;

        await runInsert(
          `INSERT INTO class_sessions (class_id, academy_id, session_date, start_time, end_time, teacher_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [req.params.id, req.academyId, dateStr, rule.start_time, rule.end_time, cls.teacher_id || null]
        );
        created++;
      }
    }

    res.json({ created, message: `${created}개의 수업 세션이 생성되었습니다.` });
  } catch (err) {
    console.error('[세션 생성 오류]', err.message);
    res.status(500).json({ error: '세션 생성 중 오류가 발생했습니다.' });
  }
});

// 세션 수정
router.put('/sessions/:id', async (req, res) => {
  try {
    const session = await getOne(
      'SELECT cs.id FROM class_sessions cs JOIN classes c ON c.id = cs.class_id WHERE cs.id = ? AND c.academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });

    // 화이트리스트 기반 동적 UPDATE — 파라미터 주입 방지
    const ALLOWED = ['session_date', 'start_time', 'end_time', 'teacher_id', 'status', 'memo'];
    const fields = [];
    const params = [];
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }

    if (fields.length === 0) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

    params.push(req.params.id, req.academyId);
    await runQuery(`UPDATE class_sessions SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`, params);
    res.json({ message: '세션이 수정되었습니다.' });
  } catch (err) {
    console.error('[세션 수정 오류]', err.message);
    res.status(500).json({ error: '세션 수정 중 오류가 발생했습니다.' });
  }
});

// 휴강 처리
router.post('/sessions/:id/cancel', async (req, res) => {
  try {
    const session = await getOne(
      'SELECT cs.id FROM class_sessions cs JOIN classes c ON c.id = cs.class_id WHERE cs.id = ? AND c.academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });

    const { cancel_reason } = req.body;
    await runQuery(
      "UPDATE class_sessions SET status = 'cancelled', cancel_reason = ? WHERE id = ? AND academy_id = ?",
      [cancel_reason || null, req.params.id, req.academyId]
    );
    res.json({ message: '휴강 처리되었습니다.' });
  } catch (err) {
    console.error('[휴강 처리 오류]', err.message);
    res.status(500).json({ error: '휴강 처리 중 오류가 발생했습니다.' });
  }
});

// 보강 세션 생성
router.post('/sessions/:id/makeup', async (req, res) => {
  try {
    const original = await getOne(
      `SELECT cs.*, c.academy_id FROM class_sessions cs JOIN classes c ON c.id = cs.class_id WHERE cs.id = ? AND c.academy_id = ?`,
      [req.params.id, req.academyId]
    );
    if (!original) return res.status(404).json({ error: '원본 세션을 찾을 수 없습니다.' });

    const { session_date, start_time, end_time, teacher_id } = req.body;
    if (!session_date || !start_time || !end_time) {
      return res.status(400).json({ error: '보강 날짜와 시간은 필수입니다.' });
    }

    const id = await runInsert(
      `INSERT INTO class_sessions (class_id, academy_id, session_date, start_time, end_time, teacher_id, is_makeup, original_session_id)
       VALUES (?, ?, ?, ?, ?, ?, true, ?)`,
      [original.class_id, req.academyId, session_date, start_time, end_time, teacher_id || original.teacher_id, req.params.id]
    );

    res.json({ id, message: '보강 세션이 생성되었습니다.' });
  } catch (err) {
    console.error('[보강 생성 오류]', err.message);
    res.status(500).json({ error: '보강 생성 중 오류가 발생했습니다.' });
  }
});

// ═══════════════════════════════════════════
// 반복 일정
// ═══════════════════════════════════════════

// 반복 일정 목록
router.get('/:id/recurring', async (req, res) => {
  try {
    const rows = await getAll(
      'SELECT * FROM class_schedules_recurring WHERE class_id = ? ORDER BY day_of_week',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[반복 일정 목록 오류]', err.message);
    res.status(500).json({ error: '반복 일정 조회 중 오류가 발생했습니다.' });
  }
});

// 반복 일정 추가
router.post('/:id/recurring', async (req, res) => {
  try {
    const cls = await getOne('SELECT id FROM classes WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!cls) return res.status(404).json({ error: '반을 찾을 수 없습니다.' });

    const { day_of_week, start_time, end_time, effective_from, effective_until } = req.body;
    if (day_of_week === undefined || !start_time || !end_time) {
      return res.status(400).json({ error: '요일과 시간은 필수입니다.' });
    }

    const id = await runInsert(
      'INSERT INTO class_schedules_recurring (class_id, day_of_week, start_time, end_time, effective_from, effective_until) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, day_of_week, start_time, end_time, effective_from || null, effective_until || null]
    );
    res.json({ id, message: '반복 일정이 추가되었습니다.' });
  } catch (err) {
    console.error('[반복 일정 추가 오류]', err.message);
    res.status(500).json({ error: '반복 일정 추가 중 오류가 발생했습니다.' });
  }
});

// 반복 일정 수정
router.put('/recurring/:id', async (req, res) => {
  try {
    const rule = await getOne(
      `SELECT r.id FROM class_schedules_recurring r JOIN classes c ON c.id = r.class_id WHERE r.id = ? AND c.academy_id = ?`,
      [req.params.id, req.academyId]
    );
    if (!rule) return res.status(404).json({ error: '반복 일정을 찾을 수 없습니다.' });

    // 화이트리스트 기반 동적 UPDATE
    const ALLOWED = ['day_of_week', 'start_time', 'end_time', 'effective_from', 'effective_until', 'is_active'];
    const fields = [];
    const params = [];
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }

    if (fields.length === 0) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

    // class_schedules_recurring에 academy_id 없음 — 부모 classes 테이블로 테넌트 검증
    params.push(req.params.id, req.academyId);
    await runQuery(
      `UPDATE class_schedules_recurring SET ${fields.join(', ')} WHERE id = ? AND class_id IN (SELECT id FROM classes WHERE academy_id = ?)`,
      params
    );
    res.json({ message: '반복 일정이 수정되었습니다.' });
  } catch (err) {
    console.error('[반복 일정 수정 오류]', err.message);
    res.status(500).json({ error: '반복 일정 수정 중 오류가 발생했습니다.' });
  }
});

// 반복 일정 삭제
router.delete('/recurring/:id', async (req, res) => {
  try {
    const rule = await getOne(
      `SELECT r.id FROM class_schedules_recurring r JOIN classes c ON c.id = r.class_id WHERE r.id = ? AND c.academy_id = ?`,
      [req.params.id, req.academyId]
    );
    if (!rule) return res.status(404).json({ error: '반복 일정을 찾을 수 없습니다.' });

    await runQuery(
      'DELETE FROM class_schedules_recurring WHERE id = ? AND class_id IN (SELECT id FROM classes WHERE academy_id = ?)',
      [req.params.id, req.academyId]
    );
    res.json({ message: '반복 일정이 삭제되었습니다.' });
  } catch (err) {
    console.error('[반복 일정 삭제 오류]', err.message);
    res.status(500).json({ error: '반복 일정 삭제 중 오류가 발생했습니다.' });
  }
});

// ═══════════════════════════════════════════
// 강사 배정
// ═══════════════════════════════════════════

// 강사 변경
router.put('/:id/teacher', async (req, res) => {
  try {
    const cls = await getOne('SELECT id, teacher_id FROM classes WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!cls) return res.status(404).json({ error: '반을 찾을 수 없습니다.' });

    const { teacher_id, reason } = req.body;

    // 이전 강사 해제 (class_id 경유로 academy_id 검증)
    if (cls.teacher_id) {
      await runQuery(
        "UPDATE teacher_assignments SET released_at = NOW() WHERE class_id = ? AND teacher_id = ? AND released_at IS NULL AND class_id IN (SELECT id FROM classes WHERE academy_id = ?)",
        [req.params.id, cls.teacher_id, req.academyId]
      );
    }

    // 새 강사 배정 — 위 cls lookup에서 academy_id 검증 완료
    if (teacher_id) {
      await runInsert(
        'INSERT INTO teacher_assignments (class_id, teacher_id, reason) /* academy_id verified via parent class lookup */ VALUES (?, ?, ?)',
        [req.params.id, teacher_id, reason || '강사 변경']
      );
    }

    await runQuery('UPDATE classes SET teacher_id = ?, updated_at = NOW() WHERE id = ? AND academy_id = ?', [teacher_id || null, req.params.id, req.academyId]);
    res.json({ message: '강사가 변경되었습니다.' });
  } catch (err) {
    console.error('[강사 변경 오류]', err.message);
    res.status(500).json({ error: '강사 변경 중 오류가 발생했습니다.' });
  }
});

// ═══════════════════════════════════════════
// 대기자
// ═══════════════════════════════════════════

// 대기자 목록
router.get('/:id/waitlist', async (req, res) => {
  try {
    const rows = await getAll(
      `SELECT w.*, u.name as student_name, s.school, s.grade
       FROM class_waitlist w
       JOIN students s ON s.id = w.student_id
       JOIN users u ON u.id = s.user_id
       WHERE w.class_id = ? AND w.status = 'waiting'
       ORDER BY w.requested_at`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[대기자 목록 오류]', err.message);
    res.status(500).json({ error: '대기자 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 대기 등록
router.post('/:id/waitlist', async (req, res) => {
  try {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: '학생을 선택해주세요.' });

    const id = await runInsert(
      'INSERT INTO class_waitlist (class_id, student_id) VALUES (?, ?)',
      [req.params.id, student_id]
    );
    res.json({ id, message: '대기자로 등록되었습니다.' });
  } catch (err) {
    console.error('[대기 등록 오류]', err.message);
    res.status(500).json({ error: '대기 등록 중 오류가 발생했습니다.' });
  }
});

// 대기 → 등록 전환
router.post('/waitlist/:id/enroll', async (req, res) => {
  try {
    const waitItem = await getOne(
      `SELECT w.*, c.academy_id, c.capacity FROM class_waitlist w JOIN classes c ON c.id = w.class_id WHERE w.id = ? AND w.status = 'waiting'`,
      [req.params.id]
    );
    if (!waitItem) return res.status(404).json({ error: '대기 기록을 찾을 수 없습니다.' });
    if (waitItem.academy_id !== req.academyId) return res.status(403).json({ error: '권한이 없습니다.' });

    // class_students에 등록
    const existing = await getOne(
      "SELECT id, status FROM class_students WHERE class_id = ? AND student_id = ?",
      [waitItem.class_id, waitItem.student_id]
    );
    if (existing && existing.status === 'active') {
      await runQuery("UPDATE class_waitlist SET status = 'enrolled' WHERE id = ?", [req.params.id]);
      return res.json({ message: '이미 등록된 학생입니다. 대기 상태를 갱신했습니다.' });
    }

    if (existing) {
      await runQuery("UPDATE class_students SET status = 'active', enrolled_at = NOW(), dropped_at = NULL WHERE id = ?", [existing.id]);
    } else {
      await runInsert('INSERT INTO class_students (class_id, student_id) VALUES (?, ?)', [waitItem.class_id, waitItem.student_id]);
    }

    await runQuery("UPDATE class_waitlist SET status = 'enrolled' WHERE id = ?", [req.params.id]);
    res.json({ message: '대기자가 정식 등록되었습니다.' });
  } catch (err) {
    console.error('[대기→등록 오류]', err.message);
    res.status(500).json({ error: '등록 전환 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
