const express = require('express');
const crypto = require('crypto');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin, requireAdminOnly } = require('../middleware/auth');
const { sendSMS, sendBulkSMS, isConfigured } = require('../utils/smsHelper');
const {
  getMessageType, calculateTotalCost, checkAndDeductCredits, chargeCredits,
  logSentMessages, refundFailedMessages, getCredits, getPricing,
} = require('../utils/smsBilling');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// SaaS: 각 요청에서 req.academyId 사용

// SMS 설정 상태 확인
router.get('/status', async (req, res) => {
  res.json({ configured: isConfigured() });
});

// === 크레딧 관리 ===

// 잔액 + 최근 거래
router.get('/credits', async (req, res) => {
  const credit = await getCredits(req.academyId);
  const recent = await getAll(
    'SELECT * FROM sms_credit_transactions WHERE academy_id = ? ORDER BY created_at DESC LIMIT 10',
    [req.academyId]
  );
  res.json({ ...credit, recent_transactions: recent });
});

// 수동 충전 (관리자 전용)
router.post('/credits/charge', requireAdminOnly, async (req, res) => {
  const { amount, description } = req.body;
  const numAmount = parseInt(amount);
  if (!numAmount || numAmount <= 0) return res.status(400).json({ error: '유효한 금액을 입력해주세요.' });
  if (numAmount > 10000000) return res.status(400).json({ error: '최대 충전 금액은 10,000,000원입니다.' });

  const result = await chargeCredits(req.academyId, numAmount, description || '수동 충전', req.user.id);
  res.json({ message: `${numAmount.toLocaleString()}원 충전 완료`, balance: result.balance });
});

// 거래 내역 (페이지네이션)
router.get('/credits/transactions', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const total = await getOne('SELECT COUNT(*) as cnt FROM sms_credit_transactions WHERE academy_id = ?', [req.academyId]);
  const rows = await getAll(
    'SELECT * FROM sms_credit_transactions WHERE academy_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [req.academyId, limit, offset]
  );
  res.json({ transactions: rows, total: total.cnt, page, limit });
});

// 월별 사용 통계
router.get('/credits/stats', async (req, res) => {
  const stats = await getAll(
    `SELECT date_trunc('month', created_at)::date as month, message_type,
            COUNT(*) as count, SUM(cost) as total_cost,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as fail_count
     FROM sms_send_logs WHERE academy_id = $1
     GROUP BY date_trunc('month', created_at)::date, message_type
     ORDER BY month DESC LIMIT 60`,
    [req.academyId]
  );
  res.json(stats);
});

// 발송 로그 (페이지네이션)
router.get('/send-logs', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const total = await getOne('SELECT COUNT(*) as cnt FROM sms_send_logs WHERE academy_id = ?', [req.academyId]);
  const rows = await getAll(
    'SELECT * FROM sms_send_logs WHERE academy_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [req.academyId, limit, offset]
  );
  res.json({ logs: rows, total: total.cnt, page, limit });
});

// 배치별 발송 요약
router.get('/send-logs/batches', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const batches = await getAll(
    `SELECT batch_id, MIN(created_at) as sent_at,
            COUNT(*) as total_count,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as fail_count,
            SUM(cost) as total_cost,
            string_agg(DISTINCT message_type, ',') as types
     FROM sms_send_logs WHERE academy_id = $1
     GROUP BY batch_id
     ORDER BY MIN(created_at) DESC LIMIT $2 OFFSET $3`,
    [req.academyId, limit, offset]
  );
  res.json(batches);
});

// 현재 단가표
router.get('/pricing', async (req, res) => {
  const pricing = await getPricing(req.academyId);
  res.json(pricing);
});

// === 학생/수신자 조회 ===

router.get('/recipients', async (req, res) => {
  const { school, grade } = req.query;
  let query = `
    SELECT s.id, u.name, s.school, s.grade, u.phone, s.parent_phone
    FROM students s JOIN users u ON s.user_id = u.id
    WHERE s.status = 'active' AND s.school NOT IN ('조교', '선생님') AND s.academy_id = ?
  `;
  const params = [req.academyId];
  if (school) { query += ' AND s.school = ?'; params.push(school); }
  if (grade) { query += ' AND s.grade = ?'; params.push(grade); }
  query += ' ORDER BY s.school, s.grade, u.name';
  const students = await getAll(query, params);
  res.json(students);
});

router.get('/student-scores/:studentId', async (req, res) => {
  const scores = await getAll(
    `SELECT sc.score, sc.rank_num, sc.note,
            e.name as exam_name, e.exam_date, e.max_score,
            (SELECT COUNT(*) FROM scores WHERE exam_id = e.id AND academy_id = ?) as total_students
     FROM scores sc JOIN exams e ON sc.exam_id = e.id
     WHERE sc.student_id = ? AND sc.academy_id = ?
     ORDER BY e.exam_date DESC, e.id DESC LIMIT 5`,
    [req.academyId, req.params.studentId, req.academyId]
  );
  res.json(scores);
});

router.get('/clinic-appointments', async (req, res) => {
  const { studentIds } = req.query;
  let where = "ca.status IN ('approved', 'completed') AND ca.academy_id = ?";
  const params = [req.academyId];
  if (studentIds) {
    const ids = studentIds.split(',').map(Number).filter(Boolean);
    if (ids.length > 0) {
      where += ` AND ca.student_id IN (${ids.map(() => '?').join(',')})`;
      params.push(...ids);
    }
  }
  const appointments = await getAll(
    `SELECT ca.id, ca.student_id, ca.appointment_date, ca.time_slot, ca.topic, ca.detail,
            ca.status, ca.admin_note, u.name as student_name, s.school, s.grade
     FROM clinic_appointments ca
     JOIN students s ON ca.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE ${where}
     ORDER BY ca.appointment_date DESC, ca.time_slot ASC`,
    params
  );
  const result = [];
  for (const a of appointments) {
    const notes = await getAll(
      `SELECT cn.content, u.name as author_name FROM clinic_notes cn
       JOIN users u ON cn.author_id = u.id
       WHERE cn.appointment_id = ? AND cn.academy_id = ? ORDER BY cn.created_at ASC`,
      [a.id, req.academyId]
    );
    result.push({ ...a, notes });
  }
  res.json(result);
});

// === 템플릿 CRUD ===

router.get('/templates', async (req, res) => {
  const templates = await getAll('SELECT * FROM sms_templates WHERE academy_id = ? ORDER BY id ASC', [req.academyId]);
  res.json(templates);
});

router.post('/templates', async (req, res) => {
  const { name, content } = req.body;
  if (!name || !content) return res.status(400).json({ error: '이름과 내용을 입력해주세요.' });
  const id = await runInsert('INSERT INTO sms_templates (name, content, academy_id) VALUES (?, ?, ?)', [name, content, req.academyId]);
  res.json({ message: '템플릿 저장됨', id });
});

router.put('/templates/:id', async (req, res) => {
  const { name, content } = req.body;
  await runQuery('UPDATE sms_templates SET name = ?, content = ? WHERE id = ? AND academy_id = ?', [name, content, req.params.id, req.academyId]);
  res.json({ message: '템플릿 수정됨' });
});

router.delete('/templates/:id', async (req, res) => {
  await runQuery('DELETE FROM sms_templates WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  res.json({ message: '템플릿 삭제됨' });
});

// === SMS 발송 (크레딧 과금 적용) ===

// 개별 SMS (학생별 메시지 다를 수 있음)
router.post('/send-individual', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '발송 대상이 없습니다.' });
  }

  const batchId = crypto.randomUUID();

  // 비용 계산
  const costResult = await calculateTotalCost(messages, req.academyId);

  // 크레딧 차감
  const deductResult = await checkAndDeductCredits(
    req.academyId, costResult.totalCost,
    `SMS 개별발송 ${messages.length}건`, req.user.id
  );
  if (!deductResult.success) {
    return res.status(402).json({
      error: '크레딧이 부족합니다',
      balance: deductResult.balance,
      required: costResult.totalCost,
      breakdown: costResult.breakdown,
    });
  }

  // 발송
  let success = 0, fail = 0;
  const errors = [];
  const logEntries = [];

  for (const m of messages) {
    const msgType = getMessageType(m.message);
    try {
      const result = await sendSMS(m.phone, m.message);
      success++;
      logEntries.push({ ...m, messageType: msgType, status: 'sent', solapiMessageId: result?.messageId || null });
    } catch (e) {
      fail++;
      errors.push({ name: m.name, phone: m.phone, error: e.message });
      logEntries.push({ ...m, messageType: msgType, status: 'failed', error: e.message });
    }
  }

  // 로그 기록
  await logSentMessages(batchId, logEntries, req.user.id, req.academyId);

  // 실패 건 환불
  if (fail > 0) {
    const failedCost = logEntries
      .filter(l => l.status === 'failed')
      .reduce((sum, l) => sum + (costResult.breakdown[l.messageType]?.unitCost || 13), 0);
    await refundFailedMessages(req.academyId, fail, failedCost, req.user.id, batchId);
  }

  const credit = await getCredits(req.academyId);
  res.json({
    message: `전송 완료: 성공 ${success}건, 실패 ${fail}건`,
    success, fail, errors,
    cost: costResult.totalCost,
    refunded: fail > 0 ? `${fail}건 환불됨` : null,
    balance: credit.balance,
  });
});

// 단일 SMS 발송
router.post('/send', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: '수신번호와 메시지를 입력해주세요.' });
  if (message.length > 2000) return res.status(400).json({ error: '메시지가 너무 깁니다 (최대 2000자).' });

  const batchId = crypto.randomUUID();
  const msgType = getMessageType(message);
  const costResult = await calculateTotalCost([{ message }], req.academyId);

  const deductResult = await checkAndDeductCredits(
    req.academyId, costResult.totalCost,
    `SMS 단일발송`, req.user.id
  );
  if (!deductResult.success) {
    return res.status(402).json({
      error: '크레딧이 부족합니다',
      balance: deductResult.balance,
      required: costResult.totalCost,
    });
  }

  try {
    const result = await sendSMS(to, message);
    await logSentMessages(batchId, [{ phone: to, message, messageType: msgType, status: 'sent', solapiMessageId: result?.messageId || null }], req.user.id, req.academyId);
    const credit = await getCredits(req.academyId);
    res.json({ message: 'SMS 전송 완료', result, cost: costResult.totalCost, balance: credit.balance });
  } catch (e) {
    await logSentMessages(batchId, [{ phone: to, message, messageType: msgType, status: 'failed', error: e.message }], req.user.id, req.academyId);
    await refundFailedMessages(req.academyId, 1, costResult.totalCost, req.user.id, batchId);
    res.status(500).json({ error: e.message });
  }
});

// 대량 SMS 발송
router.post('/send-bulk', async (req, res) => {
  const { recipients, message, targetType } = req.body;
  if (!message) return res.status(400).json({ error: '메시지를 입력해주세요.' });

  let phones = [];
  if (targetType === 'custom' && Array.isArray(recipients)) {
    phones = recipients;
  } else if (targetType === 'student' || targetType === 'parent') {
    const { school, grade } = req.body;
    let query = `SELECT u.phone, s.parent_phone FROM students s JOIN users u ON s.user_id = u.id WHERE s.status = 'active' AND s.academy_id = ?`;
    const params = [req.academyId];
    if (school) { query += ' AND s.school = ?'; params.push(school); }
    if (grade) { query += ' AND s.grade = ?'; params.push(grade); }
    const students = await getAll(query, params);
    phones = targetType === 'student'
      ? students.map(s => s.phone).filter(Boolean)
      : students.map(s => s.parent_phone).filter(Boolean);
  } else {
    return res.status(400).json({ error: '발송 대상을 선택해주세요.' });
  }

  if (phones.length === 0) return res.status(400).json({ error: '발송 대상이 없습니다.' });

  const batchId = crypto.randomUUID();
  const msgType = getMessageType(message);
  const msgs = phones.map(p => ({ phone: p, message }));
  const costResult = await calculateTotalCost(msgs, req.academyId);

  const deductResult = await checkAndDeductCredits(
    req.academyId, costResult.totalCost,
    `SMS 대량발송 ${phones.length}건`, req.user.id
  );
  if (!deductResult.success) {
    return res.status(402).json({
      error: '크레딧이 부족합니다',
      balance: deductResult.balance,
      required: costResult.totalCost,
      breakdown: costResult.breakdown,
    });
  }

  try {
    const result = await sendBulkSMS(phones, message);
    const logEntries = phones.map(p => ({ phone: p, message, messageType: msgType, status: 'sent' }));
    await logSentMessages(batchId, logEntries, req.user.id, req.academyId);
    const credit = await getCredits(req.academyId);
    res.json({
      message: `${phones.length}건 SMS 전송 완료`,
      result, cost: costResult.totalCost, balance: credit.balance,
    });
  } catch (e) {
    await refundFailedMessages(req.academyId, phones.length, costResult.totalCost, req.user.id, batchId);
    const logEntries = phones.map(p => ({ phone: p, message, messageType: msgType, status: 'failed', error: e.message }));
    await logSentMessages(batchId, logEntries, req.user.id, req.academyId);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
