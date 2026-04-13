const express = require('express');
const bcrypt = require('bcryptjs');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// ─── 리드 목록 (필터, 페이지네이션) ─────────────────────────
router.get('/', async (req, res) => {
  try {
    // /stats 라우트가 먼저 매치되도록 확인
    const { status, source, assigned_to, from, to, page: pageStr, limit: limitStr } = req.query;
    const page = parseInt(pageStr) || 1;
    const limit = Math.min(parseInt(limitStr) || 30, 100);
    const offset = (page - 1) * limit;

    let sql = `
      SELECT l.*, u.name as assigned_name
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_to
      WHERE l.academy_id = ?
    `;
    const params = [req.academyId];

    if (status) { sql += ' AND l.status = ?'; params.push(status); }
    if (source) { sql += ' AND l.source = ?'; params.push(source); }
    if (assigned_to) { sql += ' AND l.assigned_to = ?'; params.push(parseInt(assigned_to)); }
    if (from) { sql += ' AND l.created_at >= ?'; params.push(from); }
    if (to) { sql += ' AND l.created_at <= ?'; params.push(to + 'T23:59:59'); }

    sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await getAll(sql, params);

    // 총 건수
    let countSql = 'SELECT COUNT(*) as total FROM leads WHERE academy_id = ?';
    const countParams = [req.academyId];
    if (status) { countSql += ' AND status = ?'; countParams.push(status); }
    if (source) { countSql += ' AND source = ?'; countParams.push(source); }
    if (assigned_to) { countSql += ' AND assigned_to = ?'; countParams.push(parseInt(assigned_to)); }
    if (from) { countSql += ' AND created_at >= ?'; countParams.push(from); }
    if (to) { countSql += ' AND created_at <= ?'; countParams.push(to + 'T23:59:59'); }

    const countRow = await getOne(countSql, countParams);
    res.json({ leads: rows, total: countRow?.total || 0, page, limit });
  } catch (err) {
    console.error('[리드 목록 오류]', err.message);
    res.status(500).json({ error: '리드 목록 조회 중 오류가 발생했습니다.' });
  }
});

// ─── 파이프라인 통계 ────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    // 상태별 건수
    const statusCounts = await getAll(
      'SELECT status, COUNT(*) as count FROM leads WHERE academy_id = ? GROUP BY status',
      [req.academyId]
    );

    // 이번달 전환율
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStats = await getOne(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'enrolled') as enrolled
      FROM leads WHERE academy_id = ? AND created_at >= ?`,
      [req.academyId, monthStart.toISOString()]
    );

    // 유입 채널별
    const sourceCounts = await getAll(
      'SELECT source, COUNT(*) as count FROM leads WHERE academy_id = ? AND source IS NOT NULL GROUP BY source ORDER BY count DESC',
      [req.academyId]
    );

    // 평균 전환 기간
    const avgConversion = await getOne(
      `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) as avg_days
      FROM leads WHERE academy_id = ? AND status = 'enrolled'`,
      [req.academyId]
    );

    res.json({
      statusCounts: statusCounts.reduce((acc, r) => { acc[r.status] = parseInt(r.count); return acc; }, {}),
      conversionRate: monthStats?.total > 0 ? Math.round((monthStats.enrolled / monthStats.total) * 100) : 0,
      monthTotal: parseInt(monthStats?.total || 0),
      monthEnrolled: parseInt(monthStats?.enrolled || 0),
      sourceCounts,
      avgConversionDays: avgConversion?.avg_days ? Math.round(avgConversion.avg_days * 10) / 10 : null,
    });
  } catch (err) {
    console.error('[리드 통계 오류]', err.message);
    res.status(500).json({ error: '통계 조회 중 오류가 발생했습니다.' });
  }
});

// ─── 체험 수업 전체 목록 ────────────────────────────────────
router.get('/trials', async (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `
      SELECT ts.*, l.student_name, l.parent_name, l.parent_phone
      FROM trial_sessions ts
      LEFT JOIN leads l ON l.id = ts.lead_id
      WHERE ts.academy_id = ?
    `;
    const params = [req.academyId];
    if (from) { sql += ' AND ts.trial_date >= ?'; params.push(from); }
    if (to) { sql += ' AND ts.trial_date <= ?'; params.push(to); }
    sql += ' ORDER BY ts.trial_date DESC, ts.trial_time DESC';

    const rows = await getAll(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[체험수업 목록 오류]', err.message);
    res.status(500).json({ error: '체험 수업 목록 조회 중 오류가 발생했습니다.' });
  }
});

// ─── 리드 등록 ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { student_name, parent_name, parent_phone, school, grade, source, source_detail, interest_class_id, assigned_to, priority, memo } = req.body;
    if (!student_name) return res.status(400).json({ error: '학생 이름은 필수입니다.' });

    const id = await runInsert(
      `INSERT INTO leads (academy_id, student_name, parent_name, parent_phone, school, grade, source, source_detail, interest_class_id, assigned_to, priority, memo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.academyId, student_name, parent_name || null, parent_phone || null, school || null, grade || null, source || null, source_detail || null, interest_class_id || null, assigned_to || null, priority || 'normal', memo || null]
    );

    res.json({ id, message: '리드가 등록되었습니다.' });
  } catch (err) {
    console.error('[리드 등록 오류]', err.message);
    res.status(500).json({ error: '리드 등록 중 오류가 발생했습니다.' });
  }
});

// ─── 리드 상세 (+ 활동 이력 + 체험 수업) ────────────────────
router.get('/:id', async (req, res) => {
  try {
    const lead = await getOne(
      `SELECT l.*, u.name as assigned_name
      FROM leads l LEFT JOIN users u ON u.id = l.assigned_to
      WHERE l.id = ? AND l.academy_id = ?`,
      [req.params.id, req.academyId]
    );
    if (!lead) return res.status(404).json({ error: '리드를 찾을 수 없습니다.' });

    const activities = await getAll(
      `SELECT la.*, u.name as created_by_name
      FROM lead_activities la LEFT JOIN users u ON u.id = la.created_by
      WHERE la.lead_id = ? ORDER BY la.created_at DESC`,
      [req.params.id]
    );

    const trials = await getAll(
      'SELECT * FROM trial_sessions WHERE lead_id = ? ORDER BY trial_date DESC',
      [req.params.id]
    );

    res.json({ ...lead, activities, trials });
  } catch (err) {
    console.error('[리드 상세 오류]', err.message);
    res.status(500).json({ error: '리드 상세 조회 중 오류가 발생했습니다.' });
  }
});

// ─── 리드 수정 ──────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const lead = await getOne('SELECT id FROM leads WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!lead) return res.status(404).json({ error: '리드를 찾을 수 없습니다.' });

    const allowedFields = ['student_name', 'parent_name', 'parent_phone', 'school', 'grade', 'source', 'source_detail', 'interest_class_id', 'assigned_to', 'next_contact_date', 'next_contact_memo', 'priority', 'memo'];
    const fields = [];
    const params = [];

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }
    fields.push('updated_at = NOW()');

    if (fields.length === 1) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

    params.push(req.params.id, req.academyId);
    await runQuery(`UPDATE leads SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`, params);
    res.json({ message: '리드가 수정되었습니다.' });
  } catch (err) {
    console.error('[리드 수정 오류]', err.message);
    res.status(500).json({ error: '리드 수정 중 오류가 발생했습니다.' });
  }
});

// ─── 리드 상태 변경 ─────────────────────────────────────────
router.put('/:id/status', async (req, res) => {
  try {
    const { status, lost_reason } = req.body;
    const validStatuses = ['new', 'contacted', 'consulting', 'trial', 'enrolled', 'lost'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: '유효하지 않은 상태입니다.' });

    const lead = await getOne('SELECT id, status as old_status FROM leads WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!lead) return res.status(404).json({ error: '리드를 찾을 수 없습니다.' });

    const updateFields = ['status = ?', 'updated_at = NOW()'];
    const updateParams = [status];
    if (status === 'lost' && lost_reason) {
      updateFields.push('lost_reason = ?');
      updateParams.push(lost_reason);
    }
    updateParams.push(req.params.id, req.academyId);
    await runQuery(`UPDATE leads SET ${updateFields.join(', ')} WHERE id = ? AND academy_id = ?`, updateParams);

    // 활동 이력 자동 기록
    await runInsert(
      'INSERT INTO lead_activities (lead_id, activity_type, description, created_by) VALUES (?, ?, ?, ?)',
      [req.params.id, 'status_change', `상태 변경: ${lead.old_status} → ${status}`, req.user.id]
    );

    res.json({ message: '상태가 변경되었습니다.' });
  } catch (err) {
    console.error('[리드 상태 변경 오류]', err.message);
    res.status(500).json({ error: '상태 변경 중 오류가 발생했습니다.' });
  }
});

// ─── 리드 삭제 ──────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const lead = await getOne('SELECT id FROM leads WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!lead) return res.status(404).json({ error: '리드를 찾을 수 없습니다.' });

    await runQuery('DELETE FROM leads WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    res.json({ message: '리드가 삭제되었습니다.' });
  } catch (err) {
    console.error('[리드 삭제 오류]', err.message);
    res.status(500).json({ error: '리드 삭제 중 오류가 발생했습니다.' });
  }
});

// ─── 활동 기록 추가 ─────────────────────────────────────────
router.post('/:id/activities', async (req, res) => {
  try {
    const lead = await getOne('SELECT id FROM leads WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!lead) return res.status(404).json({ error: '리드를 찾을 수 없습니다.' });

    const { activity_type, description, result, next_action } = req.body;
    if (!activity_type || !description) return res.status(400).json({ error: '활동 유형과 내용은 필수입니다.' });

    const id = await runInsert(
      'INSERT INTO lead_activities (lead_id, activity_type, description, result, next_action, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, activity_type, description, result || null, next_action || null, req.user.id]
    );

    // next_action이 있으면 리드의 next_contact_memo 업데이트
    if (next_action) {
      await runQuery('UPDATE leads SET next_contact_memo = ?, updated_at = NOW() WHERE id = ?', [next_action, req.params.id]);
    }

    res.json({ id, message: '활동이 기록되었습니다.' });
  } catch (err) {
    console.error('[활동 기록 오류]', err.message);
    res.status(500).json({ error: '활동 기록 중 오류가 발생했습니다.' });
  }
});

// ─── 활동 이력 조회 ─────────────────────────────────────────
router.get('/:id/activities', async (req, res) => {
  try {
    const rows = await getAll(
      `SELECT la.*, u.name as created_by_name
      FROM lead_activities la LEFT JOIN users u ON u.id = la.created_by
      WHERE la.lead_id = ? ORDER BY la.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[활동 이력 오류]', err.message);
    res.status(500).json({ error: '활동 이력 조회 중 오류가 발생했습니다.' });
  }
});

// ─── 체험 수업 예약 ─────────────────────────────────────────
router.post('/:id/trial', async (req, res) => {
  try {
    const lead = await getOne('SELECT id, academy_id FROM leads WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!lead) return res.status(404).json({ error: '리드를 찾을 수 없습니다.' });

    const { class_id, trial_date, trial_time } = req.body;
    if (!trial_date) return res.status(400).json({ error: '체험 수업 날짜는 필수입니다.' });

    const id = await runInsert(
      'INSERT INTO trial_sessions (lead_id, academy_id, class_id, trial_date, trial_time) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, req.academyId, class_id || null, trial_date, trial_time || null]
    );

    // 리드 상태가 trial 이전이면 자동으로 trial로 변경
    const currentLead = await getOne('SELECT status FROM leads WHERE id = ?', [req.params.id]);
    if (['new', 'contacted', 'consulting'].includes(currentLead?.status)) {
      await runQuery("UPDATE leads SET status = 'trial', updated_at = NOW() WHERE id = ?", [req.params.id]);
      await runInsert(
        'INSERT INTO lead_activities (lead_id, activity_type, description, created_by) VALUES (?, ?, ?, ?)',
        [req.params.id, 'status_change', `상태 변경: ${currentLead.status} → trial (체험수업 예약)`, req.user.id]
      );
    }

    // 활동 기록
    await runInsert(
      'INSERT INTO lead_activities (lead_id, activity_type, description, created_by) VALUES (?, ?, ?, ?)',
      [req.params.id, 'trial_class', `체험 수업 예약: ${trial_date}${trial_time ? ' ' + trial_time : ''}`, req.user.id]
    );

    res.json({ id, message: '체험 수업이 예약되었습니다.' });
  } catch (err) {
    console.error('[체험수업 예약 오류]', err.message);
    res.status(500).json({ error: '체험 수업 예약 중 오류가 발생했습니다.' });
  }
});

// ─── 체험 수업 결과 기록 ────────────────────────────────────
router.put('/trials/:trialId', async (req, res) => {
  try {
    const trial = await getOne('SELECT id FROM trial_sessions WHERE id = ? AND academy_id = ?', [req.params.trialId, req.academyId]);
    if (!trial) return res.status(404).json({ error: '체험 수업을 찾을 수 없습니다.' });

    const { status, feedback, satisfaction, follow_up_date } = req.body;
    const fields = [];
    const params = [];

    if (status) { fields.push('status = ?'); params.push(status); }
    if (feedback !== undefined) { fields.push('feedback = ?'); params.push(feedback); }
    if (satisfaction !== undefined) { fields.push('satisfaction = ?'); params.push(satisfaction); }
    if (follow_up_date !== undefined) { fields.push('follow_up_date = ?'); params.push(follow_up_date || null); }

    if (fields.length === 0) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

    params.push(req.params.trialId, req.academyId);
    await runQuery(`UPDATE trial_sessions SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`, params);
    res.json({ message: '체험 수업 결과가 기록되었습니다.' });
  } catch (err) {
    console.error('[체험수업 결과 오류]', err.message);
    res.status(500).json({ error: '체험 수업 결과 기록 중 오류가 발생했습니다.' });
  }
});

// ─── 리드 → 학생 전환 ───────────────────────────────────────
router.post('/:id/convert', async (req, res) => {
  try {
    const lead = await getOne('SELECT * FROM leads WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!lead) return res.status(404).json({ error: '리드를 찾을 수 없습니다.' });
    if (lead.status === 'enrolled') return res.status(400).json({ error: '이미 등록된 리드입니다.' });

    // 1. 학생 계정 생성 (users)
    const username = lead.parent_phone
      ? `lead_${lead.parent_phone.replace(/[^0-9]/g, '')}`
      : `lead_${Date.now()}`;
    const hashedPw = await bcrypt.hash('0000', 10);

    // 중복 체크
    const existingUser = await getOne('SELECT id FROM users WHERE username = ?', [username]);
    let userId;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      userId = await runInsert(
        'INSERT INTO users (username, password, name, role, academy_id, approved) VALUES (?, ?, ?, ?, ?, ?)',
        [username, hashedPw, lead.student_name, 'student', req.academyId, 1]
      );
    }

    // 2. students 테이블 INSERT
    const studentId = await runInsert(
      'INSERT INTO students (user_id, school, grade, parent_name, parent_phone, academy_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, lead.school || null, lead.grade || null, lead.parent_name || null, lead.parent_phone || null, req.academyId, 'active']
    );

    // 3. parents 테이블 INSERT (ON CONFLICT phone DO NOTHING)
    let parentId = null;
    if (lead.parent_name && lead.parent_phone) {
      const existingParent = await getOne(
        'SELECT id FROM parents WHERE academy_id = ? AND phone = ?',
        [req.academyId, lead.parent_phone]
      );
      if (existingParent) {
        parentId = existingParent.id;
      } else {
        parentId = await runInsert(
          'INSERT INTO parents (academy_id, name, phone) VALUES (?, ?, ?)',
          [req.academyId, lead.parent_name, lead.parent_phone]
        );
      }

      // 4. student_parents 관계 INSERT
      if (parentId && studentId) {
        const existingLink = await getOne(
          'SELECT id FROM student_parents WHERE student_id = ? AND parent_id = ?',
          [studentId, parentId]
        );
        if (!existingLink) {
          await runInsert(
            'INSERT INTO student_parents (student_id, parent_id, is_primary) VALUES (?, ?, ?)',
            [studentId, parentId, true]
          );
        }
      }
    }

    // 5. leads 상태 업데이트
    await runQuery(
      "UPDATE leads SET status = 'enrolled', converted_student_id = ?, updated_at = NOW() WHERE id = ?",
      [studentId, req.params.id]
    );

    // 6. 활동 기록
    await runInsert(
      'INSERT INTO lead_activities (lead_id, activity_type, description, created_by) VALUES (?, ?, ?, ?)',
      [req.params.id, 'status_change', `학생 등록 완료 (student_id: ${studentId})`, req.user.id]
    );

    // 7. 관심 수업 자동 등록
    if (lead.interest_class_id && studentId) {
      try {
        const existingEnroll = await getOne(
          'SELECT id FROM class_students WHERE class_id = ? AND student_id = ?',
          [lead.interest_class_id, studentId]
        );
        if (!existingEnroll) {
          await runInsert(
            'INSERT INTO class_students (class_id, student_id) VALUES (?, ?)',
            [lead.interest_class_id, studentId]
          );
        }
      } catch (e) {
        console.error('[수업 자동 등록 실패]', e.message);
      }
    }

    res.json({ studentId, parentId, enrolled: true, message: '학생 등록이 완료되었습니다.' });
  } catch (err) {
    console.error('[리드 전환 오류]', err.message);
    res.status(500).json({ error: '학생 전환 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
