const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendBulk } = require('../services/notification');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// === 수강료 플랜 ===

// 플랜 목록
router.get('/plans', async (req, res) => {
  const rows = await getAll(
    'SELECT * FROM tuition_plans WHERE academy_id = ? ORDER BY created_at DESC',
    [req.academyId]
  );
  res.json(rows);
});

// 플랜 생성
router.post('/plans', async (req, res) => {
  const { name, amount, billing_cycle } = req.body;
  if (!name || !amount) return res.status(400).json({ error: '플랜 이름과 금액은 필수입니다.' });

  const validCycles = ['monthly', 'quarterly', 'yearly', 'once'];
  const cycle = validCycles.includes(billing_cycle) ? billing_cycle : 'monthly';

  const id = await runInsert(
    'INSERT INTO tuition_plans (academy_id, name, amount, billing_cycle) VALUES (?, ?, ?, ?)',
    [req.academyId, name, amount, cycle]
  );
  res.json({ id, message: '플랜이 생성되었습니다.' });
});

// 플랜 수정
router.put('/plans/:id', async (req, res) => {
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
});

// === 수납 기록 ===

// 수납 기록 목록
router.get('/records', async (req, res) => {
  const { status, student_id, page: pageStr, limit: limitStr } = req.query;
  const page = parseInt(pageStr) || 1;
  const limit = parseInt(limitStr) || 50;
  const offset = (page - 1) * limit;

  let sql = `
    SELECT tr.*, s.name as student_name, s.school, tp.name as plan_name
    FROM tuition_records tr
    LEFT JOIN students s ON s.id = tr.student_id
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
});

// 수납 기록 생성
router.post('/records', async (req, res) => {
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
  res.json({ id, message: '수납 기록이 생성되었습니다.' });
});

// 수납 완료 처리
router.put('/records/:id/pay', async (req, res) => {
  const record = await getOne(
    'SELECT id, status FROM tuition_records WHERE id = ? AND academy_id = ?',
    [req.params.id, req.academyId]
  );
  if (!record) return res.status(404).json({ error: '수납 기록을 찾을 수 없습니다.' });
  if (record.status === 'paid') return res.status(400).json({ error: '이미 완납 처리되었습니다.' });

  await runQuery(
    "UPDATE tuition_records SET status = 'paid', paid_at = NOW() WHERE id = ? AND academy_id = ?",
    [req.params.id, req.academyId]
  );
  res.json({ message: '완납 처리되었습니다.' });
});

// 미납 목록
router.get('/overdue', async (req, res) => {
  const rows = await getAll(`
    SELECT tr.*, s.name as student_name, s.school, s.parent_phone, tp.name as plan_name
    FROM tuition_records tr
    LEFT JOIN students s ON s.id = tr.student_id
    LEFT JOIN tuition_plans tp ON tp.id = tr.plan_id
    WHERE tr.academy_id = ? AND tr.status != 'paid' AND tr.due_date < CURRENT_DATE
    ORDER BY tr.due_date ASC
  `, [req.academyId]);
  res.json(rows);
});

// 미납자 일괄 알림
router.post('/overdue/notify', async (req, res) => {
  const overdueRows = await getAll(
    "SELECT DISTINCT student_id FROM tuition_records WHERE academy_id = ? AND status != 'paid' AND due_date < CURRENT_DATE",
    [req.academyId]
  );

  if (overdueRows.length === 0) return res.json({ message: '미납자가 없습니다.', sent: 0 });

  const studentIds = overdueRows.map(r => r.student_id);
  const results = await sendBulk(req.academyId, studentIds, '수강료 미납 안내: 수강료 납부를 확인해주세요.', 'tuition');

  const sent = results.filter(r => r.success).length;
  res.json({ message: `${sent}/${studentIds.length}명에게 알림을 발송했습니다.`, sent, total: studentIds.length });
});

// === 학부모 결제 링크 생성 ===

const crypto = require('crypto');

// 결제 링크 생성 (학원 관리자가 호출)
router.post('/records/:id/payment-link', async (req, res) => {
  const record = await getOne(
    `SELECT tr.*, s.name as student_name, a.name as academy_name
     FROM tuition_records tr
     JOIN students s ON s.id = tr.student_id
     JOIN academies a ON a.id = tr.academy_id
     WHERE tr.id = ? AND tr.academy_id = ?`,
    [req.params.id, req.academyId]
  );
  if (!record) return res.status(404).json({ error: '수납 기록을 찾을 수 없습니다.' });
  if (record.status === 'paid') return res.status(400).json({ error: '이미 완납되었습니다.' });

  // 일회성 결제 토큰 생성
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
});

module.exports = router;

// === 공개 API (인증 불필요 — server.js에서 별도 등록) ===
// 학부모가 결제 링크로 접근하면 인증 없이 수납 정보 + 결제 처리

const publicRouter = express.Router();

// 결제 정보 조회 (공개)
publicRouter.get('/tuition/:token', async (req, res) => {
  const record = await getOne(
    `SELECT tr.id, tr.amount, tr.due_date, tr.status, tr.memo,
            s.name as student_name, a.name as academy_name, tp.name as plan_name
     FROM tuition_records tr
     JOIN students s ON s.id = tr.student_id
     JOIN academies a ON a.id = tr.academy_id
     LEFT JOIN tuition_plans tp ON tp.id = tr.plan_id
     WHERE tr.payment_token = ?`,
    [req.params.token]
  );

  if (!record) return res.status(404).json({ error: '결제 정보를 찾을 수 없습니다.' });
  if (record.status === 'paid') return res.json({ ...record, alreadyPaid: true });

  res.json(record);
});

// 결제 완료 처리 (공개 — PortOne 콜백)
publicRouter.post('/tuition/:token/pay', async (req, res) => {
  const { paymentId } = req.body;
  if (!paymentId) return res.status(400).json({ error: 'paymentId가 필요합니다.' });

  const record = await getOne(
    'SELECT id, academy_id, amount, status FROM tuition_records WHERE payment_token = ?',
    [req.params.token]
  );
  if (!record) return res.status(404).json({ error: '결제 정보를 찾을 수 없습니다.' });
  if (record.status === 'paid') return res.status(400).json({ error: '이미 완납되었습니다.' });

  // PortOne 결제 검증
  const { verifyPayment } = require('../services/billing');
  const verification = await verifyPayment(paymentId);
  if (!verification.verified) {
    return res.status(400).json({ error: '결제 검증에 실패했습니다.' });
  }

  // 수납 완료 처리
  await runQuery(
    `UPDATE tuition_records SET status = 'paid', paid_at = NOW(), portone_payment_id = ?, payment_token = NULL WHERE id = ?`,
    [paymentId, record.id]
  );

  res.json({ message: '결제가 완료되었습니다.' });
});

module.exports.publicRouter = publicRouter;
