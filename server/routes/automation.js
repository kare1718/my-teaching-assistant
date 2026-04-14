const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);
router.use(requirePermission('automation', 'edit'));

// ══════════════════════════════════════
// 규칙 관리
// ══════════════════════════════════════

// 규칙 목록
router.get('/rules', async (req, res) => {
  try {
    const rows = await getAll(
      'SELECT * FROM automation_rules WHERE academy_id = ? ORDER BY created_at DESC',
      [req.academyId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[자동화 규칙 목록 오류]', err.message);
    res.status(500).json({ error: '규칙 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 규칙 생성
router.post('/rules', async (req, res) => {
  try {
    const { name, trigger_type, conditions, action_type, action_config } = req.body;
    if (!name || !trigger_type || !action_type || !action_config) {
      return res.status(400).json({ error: '이름, 트리거 유형, 액션 유형, 액션 설정은 필수입니다.' });
    }

    const validTriggers = ['absence', 'overdue', 'withdrawal', 'consecutive_absence', 'makeup_pending', 'consultation_followup'];
    if (!validTriggers.includes(trigger_type)) {
      return res.status(400).json({ error: `유효하지 않은 트리거 유형입니다. (${validTriggers.join('/')})` });
    }

    const validActions = ['send_sms', 'create_task', 'send_notification'];
    if (!validActions.includes(action_type)) {
      return res.status(400).json({ error: `유효하지 않은 액션 유형입니다. (${validActions.join('/')})` });
    }

    const id = await runInsert(
      `INSERT INTO automation_rules (academy_id, name, trigger_type, conditions, action_type, action_config)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.academyId, name, trigger_type, JSON.stringify(conditions || {}), action_type, JSON.stringify(action_config)]
    );

    res.json({ id, message: '자동화 규칙이 생성되었습니다.' });
  } catch (err) {
    console.error('[자동화 규칙 생성 오류]', err.message);
    res.status(500).json({ error: '규칙 생성 중 오류가 발생했습니다.' });
  }
});

// 규칙 수정
router.put('/rules/:id', async (req, res) => {
  try {
    const rule = await getOne(
      'SELECT id FROM automation_rules WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!rule) return res.status(404).json({ error: '규칙을 찾을 수 없습니다.' });

    const { name, trigger_type, conditions, action_type, action_config } = req.body;
    const fields = [];
    const params = [];

    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (trigger_type !== undefined) { fields.push('trigger_type = ?'); params.push(trigger_type); }
    if (conditions !== undefined) { fields.push('conditions = ?'); params.push(JSON.stringify(conditions)); }
    if (action_type !== undefined) { fields.push('action_type = ?'); params.push(action_type); }
    if (action_config !== undefined) { fields.push('action_config = ?'); params.push(JSON.stringify(action_config)); }

    if (fields.length === 0) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

    fields.push('updated_at = NOW()');
    params.push(req.params.id, req.academyId);

    await runQuery(
      `UPDATE automation_rules SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`,
      params
    );

    res.json({ message: '규칙이 수정되었습니다.' });
  } catch (err) {
    console.error('[자동화 규칙 수정 오류]', err.message);
    res.status(500).json({ error: '규칙 수정 중 오류가 발생했습니다.' });
  }
});

// 규칙 활성/비활성 토글
router.put('/rules/:id/toggle', async (req, res) => {
  try {
    const rule = await getOne(
      'SELECT id, is_active FROM automation_rules WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!rule) return res.status(404).json({ error: '규칙을 찾을 수 없습니다.' });

    const newActive = !rule.is_active;
    await runQuery(
      'UPDATE automation_rules SET is_active = ?, updated_at = NOW() WHERE id = ? AND academy_id = ?',
      [newActive, req.params.id, req.academyId]
    );

    res.json({ message: newActive ? '규칙이 활성화되었습니다.' : '규칙이 비활성화되었습니다.', is_active: newActive });
  } catch (err) {
    console.error('[자동화 규칙 토글 오류]', err.message);
    res.status(500).json({ error: '규칙 토글 중 오류가 발생했습니다.' });
  }
});

// 규칙 삭제
router.delete('/rules/:id', async (req, res) => {
  try {
    const rule = await getOne(
      'SELECT id FROM automation_rules WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!rule) return res.status(404).json({ error: '규칙을 찾을 수 없습니다.' });

    await runQuery('DELETE FROM automation_rules WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    res.json({ message: '규칙이 삭제되었습니다.' });
  } catch (err) {
    console.error('[자동화 규칙 삭제 오류]', err.message);
    res.status(500).json({ error: '규칙 삭제 중 오류가 발생했습니다.' });
  }
});

// 실행 이력
router.get('/logs', async (req, res) => {
  try {
    const { rule_id, status, start_date, end_date, page: pageStr, limit: limitStr } = req.query;
    const page = parseInt(pageStr) || 1;
    const limit = parseInt(limitStr) || 50;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT al.*, ar.name as rule_name, ar.trigger_type, ar.action_type
      FROM automation_logs al
      LEFT JOIN automation_rules ar ON ar.id = al.rule_id
      WHERE al.academy_id = ?
    `;
    const params = [req.academyId];

    if (rule_id) { sql += ' AND al.rule_id = ?'; params.push(rule_id); }
    if (status) { sql += ' AND al.status = ?'; params.push(status); }
    if (start_date) { sql += ' AND al.executed_at >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND al.executed_at <= ?'; params.push(end_date); }

    // 전체 건수
    const countSql = sql.replace(/SELECT al\.\*, ar\.name as rule_name, ar\.trigger_type, ar\.action_type/, 'SELECT COUNT(*) as total');
    const countRow = await getOne(countSql, params);

    sql += ' ORDER BY al.executed_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await getAll(sql, params);
    res.json({ logs: rows, total: countRow?.total || 0, page, limit });
  } catch (err) {
    console.error('[자동화 이력 조회 오류]', err.message);
    res.status(500).json({ error: '실행 이력 조회 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════
// 업무 큐
// ══════════════════════════════════════

// 업무 목록
router.get('/tasks', async (req, res) => {
  try {
    const { status, priority, assigned_to, task_type, page: pageStr, limit: limitStr } = req.query;
    const page = parseInt(pageStr) || 1;
    const limit = parseInt(limitStr) || 50;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT tq.*, u_student.name as student_name, u_assigned.name as assigned_name
      FROM task_queue tq
      LEFT JOIN students s ON s.id = tq.related_student_id
      LEFT JOIN users u_student ON u_student.id = s.user_id
      LEFT JOIN users u_assigned ON u_assigned.id = tq.assigned_to
      WHERE tq.academy_id = ?
    `;
    const params = [req.academyId];

    if (status) { sql += ' AND tq.status = ?'; params.push(status); }
    if (priority) { sql += ' AND tq.priority = ?'; params.push(priority); }
    if (assigned_to) { sql += ' AND tq.assigned_to = ?'; params.push(assigned_to); }
    if (task_type) { sql += ' AND tq.task_type = ?'; params.push(task_type); }

    const countSql = sql.replace(/SELECT tq\.\*, u_student\.name as student_name, u_assigned\.name as assigned_name/, 'SELECT COUNT(*) as total');
    const countRow = await getOne(countSql, params);

    sql += ' ORDER BY CASE tq.priority WHEN \'urgent\' THEN 0 WHEN \'high\' THEN 1 WHEN \'normal\' THEN 2 WHEN \'low\' THEN 3 ELSE 4 END, tq.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await getAll(sql, params);
    res.json({ tasks: rows, total: countRow?.total || 0, page, limit });
  } catch (err) {
    console.error('[업무 목록 오류]', err.message);
    res.status(500).json({ error: '업무 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 내 업무
router.get('/tasks/my', async (req, res) => {
  try {
    const rows = await getAll(
      `SELECT tq.*, u.name as student_name
       FROM task_queue tq
       LEFT JOIN students s ON s.id = tq.related_student_id
       LEFT JOIN users u ON u.id = s.user_id
       WHERE tq.academy_id = ? AND tq.assigned_to = ? AND tq.status != 'completed'
       ORDER BY CASE tq.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 ELSE 4 END, tq.created_at DESC`,
      [req.academyId, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[내 업무 조회 오류]', err.message);
    res.status(500).json({ error: '내 업무 조회 중 오류가 발생했습니다.' });
  }
});

// 업무 요약
router.get('/tasks/summary', async (req, res) => {
  try {
    const pending = await getOne(
      "SELECT COUNT(*) as count FROM task_queue WHERE academy_id = ? AND status = 'pending'",
      [req.academyId]
    );
    const urgent = await getOne(
      "SELECT COUNT(*) as count FROM task_queue WHERE academy_id = ? AND status = 'pending' AND priority IN ('urgent', 'high')",
      [req.academyId]
    );
    const overdue = await getOne(
      "SELECT COUNT(*) as count FROM task_queue WHERE academy_id = ? AND status = 'pending' AND due_date < NOW()",
      [req.academyId]
    );
    const completedToday = await getOne(
      "SELECT COUNT(*) as count FROM task_queue WHERE academy_id = ? AND status = 'completed' AND completed_at >= CURRENT_DATE",
      [req.academyId]
    );

    res.json({
      pending: pending?.count || 0,
      urgent: urgent?.count || 0,
      overdue: overdue?.count || 0,
      completed_today: completedToday?.count || 0,
    });
  } catch (err) {
    console.error('[업무 요약 오류]', err.message);
    res.status(500).json({ error: '업무 요약 조회 중 오류가 발생했습니다.' });
  }
});

// 업무 수정
router.put('/tasks/:id', async (req, res) => {
  try {
    const task = await getOne(
      'SELECT id FROM task_queue WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!task) return res.status(404).json({ error: '업무를 찾을 수 없습니다.' });

    const { title, description, assigned_to, priority, due_date, status } = req.body;
    const fields = [];
    const params = [];

    if (title !== undefined) { fields.push('title = ?'); params.push(title); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (assigned_to !== undefined) { fields.push('assigned_to = ?'); params.push(assigned_to); }
    if (priority !== undefined) { fields.push('priority = ?'); params.push(priority); }
    if (due_date !== undefined) { fields.push('due_date = ?'); params.push(due_date); }
    if (status !== undefined) { fields.push('status = ?'); params.push(status); }

    if (fields.length === 0) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

    params.push(req.params.id, req.academyId);
    await runQuery(
      `UPDATE task_queue SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`,
      params
    );

    res.json({ message: '업무가 수정되었습니다.' });
  } catch (err) {
    console.error('[업무 수정 오류]', err.message);
    res.status(500).json({ error: '업무 수정 중 오류가 발생했습니다.' });
  }
});

// 업무 완료
router.put('/tasks/:id/complete', async (req, res) => {
  try {
    const task = await getOne(
      'SELECT id, status FROM task_queue WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!task) return res.status(404).json({ error: '업무를 찾을 수 없습니다.' });
    if (task.status === 'completed') return res.status(400).json({ error: '이미 완료된 업무입니다.' });

    await runQuery(
      "UPDATE task_queue SET status = 'completed', completed_at = NOW(), completed_by = ? WHERE id = ? AND academy_id = ?",
      [req.user.id, req.params.id, req.academyId]
    );

    res.json({ message: '업무가 완료 처리되었습니다.' });
  } catch (err) {
    console.error('[업무 완료 오류]', err.message);
    res.status(500).json({ error: '업무 완료 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
