const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { sendBulk } = require('../services/notification');
const { addEvent } = require('../services/timeline');
const { logAction } = require('../services/audit');
const { track, trackFirst } = require('../services/analytics');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// RBAC: 수납 수정/삭제는 tuition 리소스 권한이 있는 역할만
router.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const action = req.method === 'DELETE' ? 'delete' : 'edit';
  return requirePermission('tuition', action)(req, res, next);
});

// === 수강료 플랜 ===

// 플랜 목록
router.get('/plans', async (req, res) => {
  try {
    const rows = await getAll(
      'SELECT * FROM tuition_plans WHERE academy_id = ? ORDER BY created_at DESC',
      [req.academyId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[수납 플랜 목록 오류]', err.message);
    res.status(500).json({ error: '플랜 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 플랜 생성
router.post('/plans', async (req, res) => {
  try {
    const { name, amount, billing_cycle } = req.body;
    if (!name || !amount) return res.status(400).json({ error: '플랜 이름과 금액은 필수입니다.' });

    const validCycles = ['monthly', 'quarterly', 'yearly', 'once'];
    const cycle = validCycles.includes(billing_cycle) ? billing_cycle : 'monthly';

    const id = await runInsert(
      'INSERT INTO tuition_plans (academy_id, name, amount, billing_cycle) VALUES (?, ?, ?, ?)',
      [req.academyId, name, amount, cycle]
    );
    res.json({ id, message: '플랜이 생성되었습니다.' });
  } catch (err) {
    console.error('[수납 플랜 생성 오류]', err.message);
    res.status(500).json({ error: '플랜 생성 중 오류가 발생했습니다.' });
  }
});

// 플랜 수정
router.put('/plans/:id', async (req, res) => {
  try {
    const { name, amount, billing_cycle, is_active } = req.body;
    const plan = await getOne('SELECT id FROM tuition_plans WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!plan) return res.status(404).json({ error: '플랜을 찾을 수 없습니다.' });

    const fields = [];
    const params = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (amount !== undefined) { fields.push('amount = ?'); params.push(amount); }
    if (billing_cycle !== undefined) { fields.push('billing_cycle = ?'); params.push(billing_cycle); }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    if (fields.length === 0) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

    params.push(req.params.id, req.academyId);
    await runQuery(`UPDATE tuition_plans SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`, params);
    res.json({ message: '플랜이 수정되었습니다.' });
  } catch (err) {
    console.error('[수납 플랜 수정 오류]', err.message);
    res.status(500).json({ error: '플랜 수정 중 오류가 발생했습니다.' });
  }
});

// === 수납 기록 ===

// 수납 기록 목록
router.get('/records', async (req, res) => {
  try {
    const { status, student_id, page: pageStr, limit: limitStr } = req.query;
    const page = parseInt(pageStr) || 1;
    const limit = parseInt(limitStr) || 50;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT tr.*, u.name as student_name, s.school, tp.name as plan_name
      FROM tuition_records tr
      LEFT JOIN students s ON s.id = tr.student_id
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN tuition_plans tp ON tp.id = tr.plan_id
      WHERE tr.academy_id = ?
    `;
    const params = [req.academyId];

    if (status) { sql += ' AND tr.status = ?'; params.push(status); }
    if (student_id) { sql += ' AND tr.student_id = ?'; params.push(student_id); }

    sql += ' ORDER BY tr.due_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await getAll(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[수납 기록 목록 오류]', err.message);
    res.status(500).json({ error: '수납 기록 조회 중 오류가 발생했습니다.' });
  }
});

// 수납 기록 생성
router.post('/records', async (req, res) => {
  try {
    const { student_id, plan_id, due_date, amount, memo } = req.body;
    if (!student_id || !due_date) return res.status(400).json({ error: '학생과 납부일은 필수입니다.' });

    let finalAmount = amount;
    if (!finalAmount && plan_id) {
      const plan = await getOne('SELECT amount FROM tuition_plans WHERE id = ? AND academy_id = ?', [plan_id, req.academyId]);
      if (plan) finalAmount = plan.amount;
    }
    if (!finalAmount) return res.status(400).json({ error: '금액을 입력하거나 플랜을 선택해주세요.' });

    const id = await runInsert(
      'INSERT INTO tuition_records (academy_id, student_id, plan_id, amount, due_date, memo) VALUES (?, ?, ?, ?, ?, ?)',
      [req.academyId, student_id, plan_id || null, finalAmount, due_date, memo || '']
    );

    // 타임라인 이벤트
    addEvent(req.academyId, student_id, 'tuition_billed', `수강료 청구: ${Number(finalAmount).toLocaleString()}원`,
      null, { tuition_record_id: id, amount: finalAmount, due_date }, req.user?.id
    ).catch(e => console.error('[timeline]', e.message));

    // [KPI] first_tuition_billed + feature_used
    trackFirst(req, 'first_tuition_billed', { amount: Number(finalAmount) }).catch(() => {});
    track(req, 'feature_used', { feature: 'tuition.create', amount: Number(finalAmount) }).catch(() => {});

    res.json({ id, message: '수납 기록이 생성되었습니다.' });
  } catch (err) {
    console.error('[수납 기록 생성 오류]', err.message);
    res.status(500).json({ error: '수납 기록 생성 중 오류가 발생했습니다.' });
  }
});

// 수납 완료 처리
router.put('/records/:id/pay', async (req, res) => {
  try {
    const record = await getOne(
      'SELECT id, status, student_id, amount FROM tuition_records WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!record) return res.status(404).json({ error: '수납 기록을 찾을 수 없습니다.' });
    if (record.status === 'paid') return res.status(400).json({ error: '이미 완납 처리되었습니다.' });

    await runQuery(
      "UPDATE tuition_records SET status = 'paid', paid_at = NOW() WHERE id = ? AND academy_id = ?",
      [req.params.id, req.academyId]
    );

    // 타임라인 이벤트
    addEvent(req.academyId, record.student_id, 'tuition_paid', `수강료 납부: ${Number(record.amount).toLocaleString()}원`,
      null, { tuition_record_id: record.id, amount: record.amount }, req.user?.id
    ).catch(e => console.error('[timeline]', e.message));

    res.json({ message: '완납 처리되었습니다.' });
  } catch (err) {
    console.error('[완납 처리 오류]', err.message);
    res.status(500).json({ error: '완납 처리 중 오류가 발생했습니다.' });
  }
});

// 미납 목록
router.get('/overdue', async (req, res) => {
  try {
    const rows = await getAll(`
      SELECT tr.*, u.name as student_name, s.school, s.parent_phone, tp.name as plan_name,
             (SELECT p.phone FROM parents p
              JOIN student_parents sp ON sp.parent_id = p.id
              WHERE sp.student_id = tr.student_id AND sp.is_payer = true
              LIMIT 1) as payer_phone
      FROM tuition_records tr
      LEFT JOIN students s ON s.id = tr.student_id
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN tuition_plans tp ON tp.id = tr.plan_id
      WHERE tr.academy_id = ? AND tr.status != 'paid' AND tr.due_date < CURRENT_DATE
      ORDER BY tr.due_date ASC
    `, [req.academyId]);
    res.json(rows);
  } catch (err) {
    console.error('[미납 목록 오류]', err.message);
    res.status(500).json({ error: '미납 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 미납자 일괄 알림
router.post('/overdue/notify', async (req, res) => {
  try {
    const overdueRows = await getAll(
      "SELECT DISTINCT student_id FROM tuition_records WHERE academy_id = ? AND status != 'paid' AND due_date < CURRENT_DATE",
      [req.academyId]
    );

    if (overdueRows.length === 0) return res.json({ message: '미납자가 없습니다.', sent: 0 });

    const studentIds = overdueRows.map(r => r.student_id);
    const results = await sendBulk(req.academyId, studentIds, '수강료 미납 안내: 수강료 납부를 확인해주세요.', 'tuition');

    // 미납 자동화 트리거 (비동기, 에러 무시)
    try {
      const { onTuitionOverdue } = require('../services/automation');
      const overdueDetails = await getAll(
        "SELECT * FROM tuition_records WHERE academy_id = ? AND status != 'paid' AND due_date < CURRENT_DATE",
        [req.academyId]
      );
      for (const record of overdueDetails) {
        onTuitionOverdue(req.academyId, record).catch(e => console.error('[자동화] 미납 트리거 오류:', e.message));
      }
    } catch (e) { console.error('[자동화] 미납 트리거 로드 오류:', e.message); }

    const sent = results.filter(r => r.success).length;
    res.json({ message: `${sent}/${studentIds.length}명에게 알림을 발송했습니다.`, sent, total: studentIds.length });
  } catch (err) {
    console.error('[미납 알림 오류]', err.message);
    res.status(500).json({ error: '알림 발송 중 오류가 발생했습니다.' });
  }
});

// === 학부모 결제 링크 생성 ===

const crypto = require('crypto');

// 결제 링크 생성 (학원 관리자가 호출)
router.post('/records/:id/payment-link', async (req, res) => {
  try {
    const record = await getOne(
      `SELECT tr.*, u.name as student_name, a.name as academy_name
       FROM tuition_records tr
       JOIN students s ON s.id = tr.student_id
       JOIN users u ON u.id = s.user_id
       JOIN academies a ON a.id = tr.academy_id
       WHERE tr.id = ? AND tr.academy_id = ?`,
      [req.params.id, req.academyId]
    );
    if (!record) return res.status(404).json({ error: '수납 기록을 찾을 수 없습니다.' });
    if (record.status === 'paid') return res.status(400).json({ error: '이미 완납되었습니다.' });

    const token = crypto.randomBytes(32).toString('hex');
    await runQuery(
      'UPDATE tuition_records SET payment_token = ? WHERE id = ?',
      [token, req.params.id]
    );

    const paymentUrl = `${process.env.CORS_ORIGIN || 'http://localhost:3001'}/pay/${token}`;

    res.json({
      paymentUrl,
      token,
      studentName: record.student_name,
      amount: record.amount,
      dueDate: record.due_date,
    });
  } catch (err) {
    console.error('[결제 링크 생성 오류]', err.message);
    res.status(500).json({ error: '결제 링크 생성 중 오류가 발생했습니다.' });
  }
});

// === 금액 조정 ===

// 금액 조정
router.post('/records/:id/adjust', async (req, res) => {
  try {
    const { adjustment_type, amount, reason } = req.body;
    const validTypes = ['discount', 'surcharge', 'correction', 'waiver'];
    if (!validTypes.includes(adjustment_type)) {
      return res.status(400).json({ error: '유효하지 않은 조정 유형입니다. (discount/surcharge/correction/waiver)' });
    }
    if (!amount || !reason) {
      return res.status(400).json({ error: '금액과 사유는 필수입니다.' });
    }

    const record = await getOne(
      'SELECT id, amount, adjusted_amount FROM tuition_records WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!record) return res.status(404).json({ error: '수납 기록을 찾을 수 없습니다.' });

    // 조정 이력 저장
    await runInsert(
      'INSERT INTO tuition_adjustments (tuition_record_id, academy_id, adjustment_type, amount, reason, approved_by) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, req.academyId, adjustment_type, amount, reason, req.userId]
    );

    // 조정 금액 계산: 기존 조정 이력 합산
    const adjustments = await getAll(
      'SELECT adjustment_type, amount FROM tuition_adjustments WHERE tuition_record_id = ?',
      [req.params.id]
    );
    let totalAdj = 0;
    for (const adj of adjustments) {
      if (adj.adjustment_type === 'discount' || adj.adjustment_type === 'waiver') {
        totalAdj -= adj.amount;
      } else {
        totalAdj += adj.amount;
      }
    }
    const adjustedAmount = record.amount + totalAdj;

    await runQuery(
      'UPDATE tuition_records SET adjusted_amount = ?, adjustment_reason = ? WHERE id = ?',
      [adjustedAmount, reason, req.params.id]
    );

    await logAction({
      req, action: 'tuition_adjust', resourceType: 'tuition_record', resourceId: parseInt(req.params.id),
      after: { type: adjustment_type, amount, reason, adjusted_amount: adjustedAmount },
    });
    res.json({ message: '금액이 조정되었습니다.', adjusted_amount: adjustedAmount });
  } catch (err) {
    console.error('[금액 조정 오류]', err.message);
    res.status(500).json({ error: '금액 조정 중 오류가 발생했습니다.' });
  }
});

// 조정 이력 조회
router.get('/records/:id/adjustments', async (req, res) => {
  try {
    const record = await getOne(
      'SELECT id FROM tuition_records WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!record) return res.status(404).json({ error: '수납 기록을 찾을 수 없습니다.' });

    const rows = await getAll(
      'SELECT * FROM tuition_adjustments WHERE tuition_record_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[조정 이력 조회 오류]', err.message);
    res.status(500).json({ error: '조정 이력 조회 중 오류가 발생했습니다.' });
  }
});

// === 환불 ===

// 환불 요청
router.post('/records/:id/refund', async (req, res) => {
  try {
    const { refund_amount, reason, refund_method, calculation_detail } = req.body;
    if (!refund_amount || !reason) {
      return res.status(400).json({ error: '환불 금액과 사유는 필수입니다.' });
    }

    const record = await getOne(
      'SELECT id, amount, paid_amount, status FROM tuition_records WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!record) return res.status(404).json({ error: '수납 기록을 찾을 수 없습니다.' });

    const id = await runInsert(
      `INSERT INTO tuition_refunds (tuition_record_id, academy_id, refund_amount, reason, calculation_detail, refund_method, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, req.academyId, refund_amount, reason, JSON.stringify(calculation_detail || null), refund_method || null, req.userId]
    );

    await logAction({
      req, action: 'tuition_refund_request', resourceType: 'tuition_refund', resourceId: id,
      after: { amount: refund_amount, reason, method: refund_method },
    });
    res.json({ id, message: '환불 요청이 등록되었습니다.' });
  } catch (err) {
    console.error('[환불 요청 오류]', err.message);
    res.status(500).json({ error: '환불 요청 중 오류가 발생했습니다.' });
  }
});

// 환불 승인
router.put('/refunds/:id/approve', async (req, res) => {
  try {
    const refund = await getOne(
      'SELECT rf.* FROM tuition_refunds rf WHERE rf.id = ? AND rf.academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!refund) return res.status(404).json({ error: '환불 요청을 찾을 수 없습니다.' });
    if (refund.status !== 'pending') return res.status(400).json({ error: '대기 상태의 환불만 승인할 수 있습니다.' });

    await runQuery(
      "UPDATE tuition_refunds SET status = 'approved', approved_by = ? WHERE id = ?",
      [req.userId, req.params.id]
    );
    await logAction({ req, action: 'tuition_refund_approve', resourceType: 'tuition_refund', resourceId: parseInt(req.params.id) });
    res.json({ message: '환불이 승인되었습니다.' });
  } catch (err) {
    console.error('[환불 승인 오류]', err.message);
    res.status(500).json({ error: '환불 승인 중 오류가 발생했습니다.' });
  }
});

// 환불 완료
router.put('/refunds/:id/complete', async (req, res) => {
  try {
    const refund = await getOne(
      'SELECT rf.* FROM tuition_refunds rf WHERE rf.id = ? AND rf.academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!refund) return res.status(404).json({ error: '환불 요청을 찾을 수 없습니다.' });
    if (refund.status !== 'approved') return res.status(400).json({ error: '승인된 환불만 완료 처리할 수 있습니다.' });

    await runQuery(
      "UPDATE tuition_refunds SET status = 'completed', completed_at = NOW() WHERE id = ?",
      [req.params.id]
    );

    // 수납 기록에 환불 정보 반영
    await runQuery(
      `UPDATE tuition_records SET refund_amount = COALESCE(refund_amount, 0) + ?, refund_at = NOW(), refund_reason = ?, refund_method = ?, status = 'refunded'
       WHERE id = ?`,
      [refund.refund_amount, refund.reason, refund.refund_method, refund.tuition_record_id]
    );

    await logAction({ req, action: 'tuition_refund_complete', resourceType: 'tuition_refund', resourceId: parseInt(req.params.id) });
    res.json({ message: '환불이 완료되었습니다.' });
  } catch (err) {
    console.error('[환불 완료 오류]', err.message);
    res.status(500).json({ error: '환불 완료 처리 중 오류가 발생했습니다.' });
  }
});

// 환불 거절
router.put('/refunds/:id/reject', async (req, res) => {
  try {
    const refund = await getOne(
      'SELECT rf.* FROM tuition_refunds rf WHERE rf.id = ? AND rf.academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!refund) return res.status(404).json({ error: '환불 요청을 찾을 수 없습니다.' });
    if (refund.status !== 'pending') return res.status(400).json({ error: '대기 상태의 환불만 거절할 수 있습니다.' });

    await runQuery(
      "UPDATE tuition_refunds SET status = 'rejected' WHERE id = ?",
      [req.params.id]
    );
    res.json({ message: '환불이 거절되었습니다.' });
  } catch (err) {
    console.error('[환불 거절 오류]', err.message);
    res.status(500).json({ error: '환불 거절 중 오류가 발생했습니다.' });
  }
});

// 환불 목록
router.get('/refunds', async (req, res) => {
  try {
    const { status, start_date, end_date } = req.query;
    let sql = `
      SELECT rf.*, tr.amount as original_amount, u.name as student_name
      FROM tuition_refunds rf
      LEFT JOIN tuition_records tr ON tr.id = rf.tuition_record_id
      LEFT JOIN students s ON s.id = tr.student_id
      LEFT JOIN users u ON u.id = s.user_id
      WHERE rf.academy_id = ?
    `;
    const params = [req.academyId];

    if (status) { sql += ' AND rf.status = ?'; params.push(status); }
    if (start_date) { sql += ' AND rf.created_at >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND rf.created_at <= ?'; params.push(end_date); }

    sql += ' ORDER BY rf.created_at DESC';
    const rows = await getAll(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[환불 목록 오류]', err.message);
    res.status(500).json({ error: '환불 목록 조회 중 오류가 발생했습니다.' });
  }
});

// === 정산 ===

// 월별 정산 요약
router.get('/settlement/:month', async (req, res) => {
  try {
    const month = req.params.month; // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: '월 형식은 YYYY-MM이어야 합니다.' });
    }

    const monthStart = `${month}-01`;
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEnd = nextMonth.toISOString().slice(0, 10);

    // 청구 합계
    const billed = await getOne(
      `SELECT COALESCE(SUM(amount), 0) as total FROM tuition_records
       WHERE academy_id = ? AND due_date >= ? AND due_date < ?`,
      [req.academyId, monthStart, monthEnd]
    );

    // 수납 합계
    const collected = await getOne(
      `SELECT COALESCE(SUM(paid_amount), 0) as total FROM tuition_records
       WHERE academy_id = ? AND paid_at >= ? AND paid_at < ?`,
      [req.academyId, monthStart, monthEnd]
    );

    // 미수 합계
    const outstanding = await getOne(
      `SELECT COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0) as total FROM tuition_records
       WHERE academy_id = ? AND due_date >= ? AND due_date < ? AND status IN ('pending', 'overdue')`,
      [req.academyId, monthStart, monthEnd]
    );

    // 환불 합계
    const refunded = await getOne(
      `SELECT COALESCE(SUM(refund_amount), 0) as total FROM tuition_records
       WHERE academy_id = ? AND refund_at >= ? AND refund_at < ?`,
      [req.academyId, monthStart, monthEnd]
    );

    // 조정 합계
    const adjusted = await getOne(
      `SELECT COALESCE(SUM(amount), 0) as total FROM tuition_adjustments
       WHERE academy_id = ? AND created_at >= ? AND created_at < ?`,
      [req.academyId, monthStart, monthEnd]
    );

    // 기존 정산 레코드 확인
    const existing = await getOne(
      'SELECT * FROM tuition_settlements WHERE academy_id = ? AND settlement_month = ?',
      [req.academyId, month]
    );

    const summary = {
      settlement_month: month,
      total_billed: billed.total,
      total_collected: collected.total,
      total_outstanding: outstanding.total,
      total_refunded: refunded.total,
      total_adjusted: adjusted.total,
      net_revenue: collected.total - refunded.total,
      status: existing ? existing.status : 'open',
      closed_by: existing ? existing.closed_by : null,
      closed_at: existing ? existing.closed_at : null,
      memo: existing ? existing.memo : null,
    };

    res.json(summary);
  } catch (err) {
    console.error('[정산 요약 오류]', err.message);
    res.status(500).json({ error: '정산 요약 조회 중 오류가 발생했습니다.' });
  }
});

// 월마감
router.post('/settlement/:month/close', async (req, res) => {
  try {
    const month = req.params.month;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: '월 형식은 YYYY-MM이어야 합니다.' });
    }
    const { memo } = req.body;

    const monthStart = `${month}-01`;
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEnd = nextMonth.toISOString().slice(0, 10);

    const billed = await getOne(
      `SELECT COALESCE(SUM(amount), 0) as total FROM tuition_records WHERE academy_id = ? AND due_date >= ? AND due_date < ?`,
      [req.academyId, monthStart, monthEnd]
    );
    const collected = await getOne(
      `SELECT COALESCE(SUM(paid_amount), 0) as total FROM tuition_records WHERE academy_id = ? AND paid_at >= ? AND paid_at < ?`,
      [req.academyId, monthStart, monthEnd]
    );
    const outstanding = await getOne(
      `SELECT COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0) as total FROM tuition_records WHERE academy_id = ? AND due_date >= ? AND due_date < ? AND status IN ('pending', 'overdue')`,
      [req.academyId, monthStart, monthEnd]
    );
    const refunded = await getOne(
      `SELECT COALESCE(SUM(refund_amount), 0) as total FROM tuition_records WHERE academy_id = ? AND refund_at >= ? AND refund_at < ?`,
      [req.academyId, monthStart, monthEnd]
    );
    const adjusted = await getOne(
      `SELECT COALESCE(SUM(amount), 0) as total FROM tuition_adjustments WHERE academy_id = ? AND created_at >= ? AND created_at < ?`,
      [req.academyId, monthStart, monthEnd]
    );

    // UPSERT
    const existing = await getOne(
      'SELECT id FROM tuition_settlements WHERE academy_id = ? AND settlement_month = ?',
      [req.academyId, month]
    );

    if (existing) {
      await runQuery(
        `UPDATE tuition_settlements SET total_billed = ?, total_collected = ?, total_outstanding = ?, total_refunded = ?, total_adjusted = ?, net_revenue = ?, status = 'closed', closed_by = ?, closed_at = NOW(), memo = ? WHERE id = ?`,
        [billed.total, collected.total, outstanding.total, refunded.total, adjusted.total, collected.total - refunded.total, req.userId, memo || null, existing.id]
      );
    } else {
      await runInsert(
        `INSERT INTO tuition_settlements (academy_id, settlement_month, total_billed, total_collected, total_outstanding, total_refunded, total_adjusted, net_revenue, status, closed_by, closed_at, memo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'closed', ?, NOW(), ?)`,
        [req.academyId, month, billed.total, collected.total, outstanding.total, refunded.total, adjusted.total, collected.total - refunded.total, req.userId, memo || null]
      );
    }

    await logAction({ req, action: 'settlement_close', resourceType: 'settlement', after: { month } });
    res.json({ message: `${month} 월마감이 완료되었습니다.` });
  } catch (err) {
    console.error('[월마감 오류]', err.message);
    res.status(500).json({ error: '월마감 처리 중 오류가 발생했습니다.' });
  }
});

// 마감 취소
router.post('/settlement/:month/reopen', async (req, res) => {
  try {
    const month = req.params.month;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: '월 형식은 YYYY-MM이어야 합니다.' });
    }

    const existing = await getOne(
      'SELECT id, status FROM tuition_settlements WHERE academy_id = ? AND settlement_month = ?',
      [req.academyId, month]
    );
    if (!existing) return res.status(404).json({ error: '해당 월의 정산 기록이 없습니다.' });
    if (existing.status === 'open') return res.status(400).json({ error: '이미 열려있는 상태입니다.' });

    await runQuery(
      "UPDATE tuition_settlements SET status = 'open', closed_by = NULL, closed_at = NULL WHERE id = ?",
      [existing.id]
    );
    res.json({ message: `${month} 마감이 취소되었습니다.` });
  } catch (err) {
    console.error('[마감 취소 오류]', err.message);
    res.status(500).json({ error: '마감 취소 중 오류가 발생했습니다.' });
  }
});

// === 자동 청구 생성 ===

// 월초 자동 청구
router.post('/generate-monthly', async (req, res) => {
  try {
    const { target_month } = req.body; // YYYY-MM (optional, defaults to current month)
    const now = new Date();
    const month = target_month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dueDate = `${month}-01`;

    // 활성 반 + 학생 + 플랜 조회
    const students = await getAll(
      `SELECT cs.student_id, c.id as class_id, c.tuition_plan_id, tp.amount
       FROM class_students cs
       JOIN classes c ON c.id = cs.class_id AND c.academy_id = ?
       JOIN tuition_plans tp ON tp.id = c.tuition_plan_id AND tp.is_active = true
       WHERE cs.status = 'active'`,
      [req.academyId]
    );

    let created = 0;
    let skipped = 0;

    for (const s of students) {
      // 중복 체크: 같은 학생 + 플랜 + 월
      const exists = await getOne(
        `SELECT id FROM tuition_records
         WHERE academy_id = ? AND student_id = ? AND plan_id = ? AND due_date >= ? AND due_date < ?`,
        [req.academyId, s.student_id, s.tuition_plan_id, dueDate, `${month}-32`]
      );

      if (exists) {
        skipped++;
        continue;
      }

      await runInsert(
        `INSERT INTO tuition_records (academy_id, student_id, plan_id, amount, due_date, class_id, memo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.academyId, s.student_id, s.tuition_plan_id, s.amount, dueDate, s.class_id, `${month} 자동 청구`]
      );
      created++;
    }

    res.json({
      message: `${month} 자동 청구 완료: ${created}건 생성, ${skipped}건 스킵`,
      created,
      skipped,
    });
  } catch (err) {
    console.error('[자동 청구 생성 오류]', err.message);
    res.status(500).json({ error: '자동 청구 생성 중 오류가 발생했습니다.' });
  }
});

// ===========================================================================
// === 수납 예외 처리 8가지 (migration 022) ==================================
// ===========================================================================

const tuitionCalc = require('../services/tuitionCalculator');

// --- 할인 규칙 CRUD ---

router.get('/discount-rules', async (req, res) => {
  try {
    const rows = await getAll(
      'SELECT * FROM discount_rules WHERE academy_id = ? ORDER BY created_at DESC',
      [req.academyId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[할인 규칙 목록]', err.message);
    res.status(500).json({ error: '할인 규칙 조회 중 오류가 발생했습니다.' });
  }
});

router.post('/discount-rules', async (req, res) => {
  try {
    const { name, rule_type, condition, discount_type, discount_value, is_active } = req.body;
    if (!name || !rule_type || !discount_type || discount_value == null) {
      return res.status(400).json({ error: 'name, rule_type, discount_type, discount_value는 필수입니다.' });
    }
    if (!['sibling', 'scholarship', 'promotion', 'custom'].includes(rule_type)) {
      return res.status(400).json({ error: '유효하지 않은 rule_type입니다.' });
    }
    if (!['percent', 'fixed'].includes(discount_type)) {
      return res.status(400).json({ error: 'discount_type은 percent 또는 fixed여야 합니다.' });
    }
    const cond = typeof condition === 'string' ? condition : JSON.stringify(condition || {});
    const id = await runInsert(
      `INSERT INTO discount_rules (academy_id, name, rule_type, condition, discount_type, discount_value, is_active)
       VALUES (?, ?, ?, ?::jsonb, ?, ?, ?)`,
      [req.academyId, name, rule_type, cond, discount_type, discount_value, is_active !== false]
    );
    res.json({ id, message: '할인 규칙이 생성되었습니다.' });
  } catch (err) {
    console.error('[할인 규칙 생성]', err.message);
    res.status(500).json({ error: '할인 규칙 생성 중 오류가 발생했습니다.' });
  }
});

router.put('/discount-rules/:id', async (req, res) => {
  try {
    const rule = await getOne('SELECT id FROM discount_rules WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!rule) return res.status(404).json({ error: '할인 규칙을 찾을 수 없습니다.' });
    const { name, condition, discount_type, discount_value, is_active } = req.body;
    const fields = []; const params = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (condition !== undefined) { fields.push('condition = ?::jsonb'); params.push(typeof condition === 'string' ? condition : JSON.stringify(condition)); }
    if (discount_type !== undefined) { fields.push('discount_type = ?'); params.push(discount_type); }
    if (discount_value !== undefined) { fields.push('discount_value = ?'); params.push(discount_value); }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(!!is_active); }
    if (!fields.length) return res.status(400).json({ error: '수정할 항목이 없습니다.' });
    params.push(req.params.id, req.academyId);
    await runQuery(`UPDATE discount_rules SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`, params);
    res.json({ message: '할인 규칙이 수정되었습니다.' });
  } catch (err) {
    console.error('[할인 규칙 수정]', err.message);
    res.status(500).json({ error: '할인 규칙 수정 중 오류가 발생했습니다.' });
  }
});

router.delete('/discount-rules/:id', async (req, res) => {
  try {
    const rule = await getOne('SELECT id FROM discount_rules WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!rule) return res.status(404).json({ error: '할인 규칙을 찾을 수 없습니다.' });
    await runQuery('DELETE FROM discount_rules WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    res.json({ message: '할인 규칙이 삭제되었습니다.' });
  } catch (err) {
    console.error('[할인 규칙 삭제]', err.message);
    res.status(500).json({ error: '할인 규칙 삭제 중 오류가 발생했습니다.' });
  }
});

// --- 학생 개별 할인 ---

router.post('/students/:id/discounts', async (req, res) => {
  try {
    const { rule_id, amount, discount_type, reason, valid_from, valid_until } = req.body;
    const student = await getOne('SELECT id FROM students WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!student) return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });
    const id = await runInsert(
      `INSERT INTO student_discounts (academy_id, student_id, rule_id, amount, discount_type, reason, valid_from, valid_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.academyId, req.params.id, rule_id || null, amount || null, discount_type || null, reason || '', valid_from || null, valid_until || null]
    );
    res.json({ id, message: '개별 할인이 등록되었습니다.' });
  } catch (err) {
    console.error('[개별 할인 등록]', err.message);
    res.status(500).json({ error: '개별 할인 등록 중 오류가 발생했습니다.' });
  }
});

router.get('/students/:id/discounts', async (req, res) => {
  try {
    const rows = await getAll(
      `SELECT sd.*, dr.name as rule_name, dr.rule_type
       FROM student_discounts sd
       LEFT JOIN discount_rules dr ON dr.id = sd.rule_id
       WHERE sd.academy_id = ? AND sd.student_id = ?
       ORDER BY sd.created_at DESC`,
      [req.academyId, req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[학생 할인 목록]', err.message);
    res.status(500).json({ error: '할인 목록 조회 중 오류가 발생했습니다.' });
  }
});

router.delete('/student-discounts/:id', async (req, res) => {
  try {
    const row = await getOne('SELECT id FROM student_discounts WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!row) return res.status(404).json({ error: '개별 할인을 찾을 수 없습니다.' });
    await runQuery('DELETE FROM student_discounts WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    res.json({ message: '삭제되었습니다.' });
  } catch (err) {
    console.error('[개별 할인 삭제]', err.message);
    res.status(500).json({ error: '삭제 중 오류가 발생했습니다.' });
  }
});

// --- 혼합 수납 ---

router.post('/records/:id/split-payment', async (req, res) => {
  try {
    const { splits } = req.body; // [{method, amount, memo}]
    if (!Array.isArray(splits) || splits.length === 0) {
      return res.status(400).json({ error: 'splits 배열이 필요합니다.' });
    }
    const record = await getOne(
      'SELECT id, amount, status, student_id, discount_amount FROM tuition_records WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!record) return res.status(404).json({ error: '수납 기록을 찾을 수 없습니다.' });

    const validMethods = ['card', 'cash', 'bank', 'portone'];
    let totalPaid = 0;
    for (const s of splits) {
      if (!validMethods.includes(s.method)) {
        return res.status(400).json({ error: `유효하지 않은 결제 수단: ${s.method}` });
      }
      if (!s.amount || s.amount <= 0) {
        return res.status(400).json({ error: '각 분할 금액은 0보다 커야 합니다.' });
      }
      totalPaid += Number(s.amount);
    }

    const payable = Number(record.amount) - Number(record.discount_amount || 0);
    if (totalPaid > payable) {
      return res.status(400).json({ error: `합계(${totalPaid})가 청구액(${payable})을 초과합니다.` });
    }

    for (const s of splits) {
      await runInsert(
        `INSERT INTO payment_splits (tuition_record_id, academy_id, method, amount, memo, received_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.params.id, req.academyId, s.method, s.amount, s.memo || '', req.userId]
      );
    }

    // 합계가 청구액과 같으면 완납 처리
    if (totalPaid >= payable) {
      await runQuery(
        "UPDATE tuition_records SET status = 'paid', paid_at = NOW() WHERE id = ? AND academy_id = ?",
        [req.params.id, req.academyId]
      );
      addEvent(req.academyId, record.student_id, 'tuition_paid',
        `수강료 납부(혼합): ${totalPaid.toLocaleString()}원`,
        null, { tuition_record_id: record.id, splits }, req.user?.id
      ).catch(() => {});
    }

    res.json({ message: '혼합 수납이 기록되었습니다.', totalPaid, fullyPaid: totalPaid >= payable });
  } catch (err) {
    console.error('[혼합 수납]', err.message);
    res.status(500).json({ error: '혼합 수납 처리 중 오류가 발생했습니다.' });
  }
});

router.get('/records/:id/payment-splits', async (req, res) => {
  try {
    const rows = await getAll(
      'SELECT * FROM payment_splits WHERE tuition_record_id = ? AND academy_id = ? ORDER BY paid_at ASC',
      [req.params.id, req.academyId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[혼합 수납 조회]', err.message);
    res.status(500).json({ error: '혼합 수납 조회 중 오류가 발생했습니다.' });
  }
});

// --- 분할 납부 ---

router.post('/records/:id/installments', async (req, res) => {
  try {
    const { count } = req.body;
    const n = Math.max(2, Math.min(12, Number(count) || 2));
    const record = await getOne(
      'SELECT * FROM tuition_records WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!record) return res.status(404).json({ error: '수납 기록을 찾을 수 없습니다.' });
    if (record.status === 'paid') return res.status(400).json({ error: '이미 완납된 건은 분할할 수 없습니다.' });

    const total = Number(record.amount);
    const base = Math.floor(total / n);
    const remainder = total - base * n;
    const groupId = `inst-${record.id}-${Date.now()}`;
    const baseDue = new Date(record.due_date);

    const ids = [];
    for (let i = 0; i < n; i++) {
      const due = new Date(baseDue);
      due.setMonth(due.getMonth() + i);
      const amt = base + (i === 0 ? remainder : 0);
      const id = await runInsert(
        `INSERT INTO tuition_records (academy_id, student_id, plan_id, amount, due_date, class_id, memo, installment_group_id, installment_seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.academyId, record.student_id, record.plan_id, amt, due.toISOString().slice(0, 10), record.class_id,
         `${record.memo || ''} [${i + 1}/${n}회차 분할]`, groupId, i + 1]
      );
      ids.push(id);
    }

    // 원본은 취소 처리 (status='cancelled' 없다면 금액 0 조정으로 무효화)
    await runQuery(
      `UPDATE tuition_records SET memo = COALESCE(memo,'') || ' [분할 처리됨: ${groupId}]', amount = 0 WHERE id = ? AND academy_id = ?`,
      [req.params.id, req.academyId]
    );

    res.json({ message: `${n}회 분할 납부가 생성되었습니다.`, groupId, records: ids });
  } catch (err) {
    console.error('[분할 납부]', err.message);
    res.status(500).json({ error: '분할 납부 생성 중 오류가 발생했습니다.' });
  }
});

// --- 환불 미리보기 ---

router.post('/records/:id/calculate-refund', async (req, res) => {
  try {
    const { drop_date } = req.body;
    if (!drop_date) return res.status(400).json({ error: 'drop_date가 필요합니다.' });
    const owner = await getOne('SELECT id FROM tuition_records WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!owner) return res.status(404).json({ error: '수납 기록을 찾을 수 없습니다.' });
    const result = await tuitionCalc.calculateRefund(req.params.id, drop_date);
    res.json(result);
  } catch (err) {
    console.error('[환불 계산]', err.message);
    res.status(500).json({ error: '환불 계산 중 오류가 발생했습니다.' });
  }
});

// --- 보강 차감 적용 ---

router.post('/records/:id/apply-makeup-credit', async (req, res) => {
  try {
    const { credit_ids } = req.body; // 적용할 크레딧 ID 배열 (옵션 — 없으면 전체)
    const record = await getOne(
      'SELECT * FROM tuition_records WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!record) return res.status(404).json({ error: '수납 기록을 찾을 수 없습니다.' });
    if (record.status === 'paid') return res.status(400).json({ error: '완납된 건은 차감할 수 없습니다.' });

    const credits = await getAll(
      `SELECT * FROM makeup_credits
       WHERE academy_id = ? AND student_id = ? AND status = 'pending'
        ${Array.isArray(credit_ids) && credit_ids.length ? `AND id IN (${credit_ids.map(() => '?').join(',')})` : ''}`,
      [req.academyId, record.student_id, ...(Array.isArray(credit_ids) ? credit_ids : [])]
    );

    if (credits.length === 0) return res.json({ message: '적용할 보강 크레딧이 없습니다.', applied: 0, amount: 0 });

    let totalCredit = credits.reduce((s, c) => s + Number(c.credit_amount), 0);
    const currentDiscount = Number(record.discount_amount || 0);
    const maxApplicable = Math.max(0, Number(record.amount) - currentDiscount);
    totalCredit = Math.min(totalCredit, maxApplicable);

    await runQuery(
      `UPDATE tuition_records SET discount_amount = COALESCE(discount_amount,0) + ?,
         discount_reason = COALESCE(discount_reason,'') || ' [보강차감 ${totalCredit}원]'
       WHERE id = ? AND academy_id = ?`,
      [totalCredit, req.params.id, req.academyId]
    );

    for (const c of credits) {
      await runQuery(
        `UPDATE makeup_credits SET status = 'applied', applied_to_record_id = ? WHERE id = ? AND academy_id = ?`,
        [req.params.id, c.id, req.academyId]
      );
    }

    res.json({ message: '보강 차감이 적용되었습니다.', applied: credits.length, amount: totalCredit });
  } catch (err) {
    console.error('[보강 차감]', err.message);
    res.status(500).json({ error: '보강 차감 적용 중 오류가 발생했습니다.' });
  }
});

// --- 월 청구 생성 + 할인 자동 적용 + 보강 차감 ---

router.post('/generate-monthly-with-discounts', async (req, res) => {
  try {
    const { target_month } = req.body;
    const now = new Date();
    const month = target_month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dueDate = `${month}-01`;

    const students = await getAll(
      `SELECT cs.student_id, c.id as class_id, c.tuition_plan_id, tp.amount
       FROM class_students cs
       JOIN classes c ON c.id = cs.class_id AND c.academy_id = ?
       JOIN tuition_plans tp ON tp.id = c.tuition_plan_id AND tp.is_active = true
       WHERE cs.status = 'active'`,
      [req.academyId]
    );

    let created = 0, skipped = 0, totalDiscount = 0, totalMakeup = 0;
    const details = [];

    for (const s of students) {
      const exists = await getOne(
        `SELECT id FROM tuition_records
         WHERE academy_id = ? AND student_id = ? AND plan_id = ? AND due_date >= ? AND due_date < ?`,
        [req.academyId, s.student_id, s.tuition_plan_id, dueDate, `${month}-32`]
      );
      if (exists) { skipped++; continue; }

      // 할인 계산
      const disc = await tuitionCalc.applyDiscounts(req.academyId, s.student_id, Number(s.amount), month);
      // 보강 크레딧
      const mc = await tuitionCalc.getMakeupCredits(req.academyId, s.student_id);
      const makeupAmount = Math.min(mc.total, disc.final_amount);
      const finalAmount = disc.final_amount - makeupAmount;

      const discountReason = [
        ...disc.applied.map(a => `${a.name}:${a.amount}`),
        makeupAmount > 0 ? `보강차감:${makeupAmount}` : null,
      ].filter(Boolean).join(', ');

      const recordId = await runInsert(
        `INSERT INTO tuition_records
         (academy_id, student_id, plan_id, amount, discount_amount, discount_reason, due_date, class_id, memo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.academyId, s.student_id, s.tuition_plan_id, Number(s.amount),
         disc.total_discount + makeupAmount, discountReason, dueDate, s.class_id, `${month} 자동 청구`]
      );

      // 보강 크레딧 사용 처리
      if (makeupAmount > 0) {
        let remaining = makeupAmount;
        for (const cr of mc.credits) {
          if (remaining <= 0) break;
          const use = Math.min(remaining, Number(cr.credit_amount));
          await runQuery(
            `UPDATE makeup_credits SET status = 'applied', applied_to_record_id = ? WHERE id = ? AND academy_id = ?`,
            [recordId, cr.id, req.academyId]
          );
          remaining -= use;
        }
      }

      created++;
      totalDiscount += disc.total_discount;
      totalMakeup += makeupAmount;
      details.push({ student_id: s.student_id, base: Number(s.amount), discount: disc.total_discount, makeup: makeupAmount, final: finalAmount });
    }

    res.json({
      message: `${month} 청구 ${created}건 생성, ${skipped}건 스킵. 할인 ${totalDiscount.toLocaleString()}원, 보강차감 ${totalMakeup.toLocaleString()}원`,
      created, skipped, totalDiscount, totalMakeup, details,
    });
  } catch (err) {
    console.error('[월 청구+할인]', err.message);
    res.status(500).json({ error: '월 청구 생성 중 오류가 발생했습니다.' });
  }
});

module.exports = router;

// === 공개 API (인증 불필요 — server.js에서 별도 등록) ===

const publicRouter = express.Router();

// 결제 정보 조회 (공개)
publicRouter.get('/tuition/:token', async (req, res) => {
  try {
    const record = await getOne(
      `SELECT tr.id, tr.amount, tr.due_date, tr.status, tr.memo,
              u.name as student_name, a.name as academy_name, tp.name as plan_name
       FROM tuition_records tr
       JOIN students s ON s.id = tr.student_id
       JOIN users u ON u.id = s.user_id
       JOIN academies a ON a.id = tr.academy_id
       LEFT JOIN tuition_plans tp ON tp.id = tr.plan_id
       WHERE tr.payment_token = ?`,
      [req.params.token]
    );

    if (!record) return res.status(404).json({ error: '결제 정보를 찾을 수 없습니다.' });
    if (record.status === 'paid') return res.json({ ...record, alreadyPaid: true });

    res.json(record);
  } catch (err) {
    console.error('[결제 정보 조회 오류]', err.message);
    res.status(500).json({ error: '결제 정보 조회 중 오류가 발생했습니다.' });
  }
});

// 결제 완료 처리 (공개 — PortOne 콜백)
publicRouter.post('/tuition/:token/pay', async (req, res) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId가 필요합니다.' });

    const record = await getOne(
      'SELECT id, academy_id, amount, status FROM tuition_records WHERE payment_token = ?',
      [req.params.token]
    );
    if (!record) return res.status(404).json({ error: '결제 정보를 찾을 수 없습니다.' });
    if (record.status === 'paid') return res.status(400).json({ error: '이미 완납되었습니다.' });

    const { verifyPayment } = require('../services/billing');
    const verification = await verifyPayment(paymentId);
    if (!verification.verified) {
      return res.status(400).json({ error: '결제 검증에 실패했습니다.' });
    }

    await runQuery(
      `UPDATE tuition_records SET status = 'paid', paid_at = NOW(), portone_payment_id = ?, payment_token = NULL WHERE id = ?`,
      [paymentId, record.id]
    );

    res.json({ message: '결제가 완료되었습니다.' });
  } catch (err) {
    console.error('[결제 완료 처리 오류]', err.message);
    res.status(500).json({ error: '결제 처리 중 오류가 발생했습니다.' });
  }
});

module.exports.publicRouter = publicRouter;
