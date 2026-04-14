const express = require('express');
const crypto = require('crypto');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin, requireAdminOnly } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { sendSMS, sendBulkSMS, isConfigured } = require('../utils/smsHelper');
const {
  getMessageType, getByteLength, calculateTotalCost, checkAndDeductCredits, chargeCredits,
  logSentMessages, refundFailedMessages, getCredits, getPricing,
} = require('../utils/smsBilling');
const { logAction } = require('../services/audit');
const { track, trackFirst } = require('../services/analytics');

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
  const { school, grade, include_parents } = req.query;
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

  // parents 테이블에서 연결된 보호자 정보도 함께 조회
  if (include_parents === '1') {
    try {
      for (const student of students) {
        const parentRows = await getAll(
          `SELECT p.id as parent_id, p.name as parent_name_new, p.phone as parent_phone_new
           FROM parents p JOIN student_parents sp ON sp.parent_id = p.id
           WHERE sp.student_id = ? AND p.academy_id = ?`,
          [student.id, req.academyId]
        );
        student.linked_parents = parentRows;
      }
    } catch (e) {
      // parents 테이블 미존재 시 무시
    }
  }

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
     /* academy_id는 where 변수에 항상 포함됨 (ca.academy_id = ?) */
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

// === 템플릿 CRUD (확장) ===

// 변수 자동 감지
function detectVariables(content) {
  const matches = content.match(/\{[a-z_]+\}/g);
  return matches ? [...new Set(matches)] : [];
}

router.get('/templates', async (req, res) => {
  const { message_type } = req.query;
  let query = 'SELECT * FROM sms_templates WHERE academy_id = ?';
  const params = [req.academyId];
  if (message_type) { query += ' AND message_type = ?'; params.push(message_type); }
  query += ' ORDER BY usage_count DESC, id ASC';
  const templates = await getAll(query, params);
  res.json(templates);
});

router.post('/templates', async (req, res) => {
  const { name, content, message_type } = req.body;
  if (!name || !content) return res.status(400).json({ error: '이름과 내용을 입력해주세요.' });
  const variables = JSON.stringify(detectVariables(content));
  const id = await runInsert(
    'INSERT INTO sms_templates (name, content, academy_id, message_type, variables, updated_at) VALUES (?, ?, ?, ?, ?, NOW())',
    [name, content, req.academyId, message_type || 'operational', variables]
  );
  res.json({ message: '템플릿 저장됨', id });
});

router.put('/templates/:id', async (req, res) => {
  const { name, content, message_type } = req.body;
  const variables = content ? JSON.stringify(detectVariables(content)) : null;
  let query = 'UPDATE sms_templates SET name = ?, content = ?, updated_at = NOW()';
  const params = [name, content];
  if (message_type) { query += ', message_type = ?'; params.push(message_type); }
  if (variables) { query += ', variables = ?'; params.push(variables); }
  query += ' WHERE id = ? AND academy_id = ?';
  params.push(req.params.id, req.academyId);
  await runQuery(query, params);
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
router.post('/send', requirePermission('sms', 'create'), async (req, res) => {
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
    await logAction({
      req, action: 'sms_send', resourceType: 'sms',
      after: { recipient_count: 1, cost: costResult.totalCost, type: msgType },
    });
    // [KPI] first_notice_sent + feature_used
    trackFirst(req, 'first_notice_sent', { channel: 'sms' }).catch(() => {});
    track(req, 'feature_used', { feature: 'sms.send', count: 1 }).catch(() => {});

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
    await logAction({
      req, action: 'sms_send', resourceType: 'sms',
      after: { recipient_count: phones.length, cost: costResult.totalCost, type: msgType },
    });
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

// ============================================================
// === 발송 전 검증 ===
// ============================================================

router.post('/validate', async (req, res) => {
  const { message, message_type, recipient_ids, target_type } = req.body;
  // message_type: operational, marketing, relationship
  // target_type: student, parent, both
  const warnings = [];
  const errors = [];

  if (!message) {
    errors.push('메시지 내용이 비어있습니다.');
    return res.json({ valid: false, errors, warnings });
  }

  // 1) 마케팅 메시지면 수신 동의 체크
  if (message_type === 'marketing') {
    if (!message.includes('(광고)')) {
      warnings.push('광고성 메시지에는 "(광고)" 표시가 필요합니다. 자동 삽입됩니다.');
    }
    if (!message.includes('수신거부')) {
      warnings.push('광고성 메시지에는 수신거부 안내가 필요합니다.');
    }

    // 수신 동의하지 않은 보호자 필터
    if (recipient_ids && recipient_ids.length > 0 && target_type !== 'student') {
      const nonconsented = await getAll(
        `SELECT p.id, p.name FROM parents p
         LEFT JOIN message_consent mc ON mc.parent_id = p.id AND mc.academy_id = ?
         WHERE p.id IN (${recipient_ids.map(() => '?').join(',')})
           AND (mc.marketing_consent IS NULL OR mc.marketing_consent = false OR mc.withdrawn_at IS NOT NULL)`,
        [req.academyId, ...recipient_ids]
      );
      if (nonconsented.length > 0) {
        warnings.push(`수신 동의하지 않은 보호자 ${nonconsented.length}명이 제외됩니다: ${nonconsented.map(p => p.name).join(', ')}`);
      }
    }
  }

  // 2) 퇴원생 필터링
  if (recipient_ids && recipient_ids.length > 0) {
    const withdrawn = await getAll(
      `SELECT s.id, u.name FROM students s JOIN users u ON s.user_id = u.id
       WHERE s.id IN (${recipient_ids.map(() => '?').join(',')})
         AND s.status = 'withdrawn' AND s.academy_id = ?`,
      [...recipient_ids, req.academyId]
    );
    if (withdrawn.length > 0) {
      warnings.push(`퇴원생 ${withdrawn.length}명이 제외됩니다: ${withdrawn.map(s => s.name).join(', ')}`);
    }
  }

  // 3) 중복 발송 체크 (같은 내용 24시간 내)
  const duplicateCheck = await getOne(
    `SELECT COUNT(*) as cnt FROM sms_send_logs
     WHERE academy_id = ? AND message_content = ? AND status = 'sent'
       AND created_at > NOW() - INTERVAL '24 hours'`,
    [req.academyId, message]
  );
  if (duplicateCheck && duplicateCheck.cnt > 0) {
    warnings.push(`동일한 내용이 최근 24시간 내에 ${duplicateCheck.cnt}건 발송되었습니다.`);
  }

  // 4) SMS 잔액 확인
  const credit = await getCredits(req.academyId);
  const msgType = getMessageType(message);
  const pricing = await getPricing(req.academyId);
  const recipientCount = recipient_ids ? recipient_ids.length : 0;
  const estimatedCost = recipientCount * (pricing[msgType] || 13);

  if (credit.balance < estimatedCost) {
    errors.push(`잔액 부족: 필요 ${estimatedCost.toLocaleString()}원, 잔액 ${credit.balance.toLocaleString()}원`);
  }

  res.json({
    valid: errors.length === 0,
    errors,
    warnings,
    estimated_cost: estimatedCost,
    balance: credit.balance,
    message_type_detected: msgType,
    recipient_count: recipientCount,
  });
});

// ============================================================
// === 예약 발송 ===
// ============================================================

router.post('/schedule', async (req, res) => {
  const { message, message_type, recipients, scheduled_at, template_id } = req.body;
  if (!message || !scheduled_at || !recipients) {
    return res.status(400).json({ error: '메시지, 예약 시간, 수신자를 입력해주세요.' });
  }

  const scheduledTime = new Date(scheduled_at);
  if (scheduledTime <= new Date()) {
    return res.status(400).json({ error: '예약 시간은 현재 시간 이후여야 합니다.' });
  }

  const id = await runInsert(
    `INSERT INTO message_schedule (academy_id, template_id, message, message_type, recipients, scheduled_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.academyId, template_id || null, message, message_type || 'operational',
     JSON.stringify(recipients), scheduled_at, req.user.id]
  );

  await logAction({
    req, action: 'sms_schedule', resourceType: 'sms_schedule', resourceId: id,
    after: { scheduled_at, recipient_count: Array.isArray(recipients) ? recipients.length : null },
  });
  res.json({ message: '예약 발송이 등록되었습니다.', id, scheduled_at });
});

router.get('/schedule', async (req, res) => {
  const schedules = await getAll(
    `SELECT ms.*, u.name as created_by_name
     FROM message_schedule ms
     LEFT JOIN users u ON ms.created_by = u.id
     WHERE ms.academy_id = ?
     ORDER BY ms.scheduled_at DESC`,
    [req.academyId]
  );
  res.json(schedules);
});

router.delete('/schedule/:id', async (req, res) => {
  const schedule = await getOne(
    'SELECT * FROM message_schedule WHERE id = ? AND academy_id = ?',
    [req.params.id, req.academyId]
  );
  if (!schedule) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
  if (schedule.status !== 'pending') {
    return res.status(400).json({ error: '대기 중인 예약만 취소할 수 있습니다.' });
  }

  await runQuery(
    'UPDATE message_schedule SET status = ? WHERE id = ? AND academy_id = ?',
    ['cancelled', req.params.id, req.academyId]
  );
  res.json({ message: '예약이 취소되었습니다.' });
});

// ============================================================
// === 수신 동의 관리 ===
// ============================================================

router.get('/consent', async (req, res) => {
  const consents = await getAll(
    `SELECT p.id as parent_id, p.name, p.phone,
            mc.marketing_consent, mc.consented_at, mc.consent_method, mc.withdrawn_at,
            (SELECT string_agg(u.name, ', ')
             FROM student_parents sp
             JOIN students s ON sp.student_id = s.id
             JOIN users u ON s.user_id = u.id
             WHERE sp.parent_id = p.id) as children_names
     FROM parents p
     LEFT JOIN message_consent mc ON mc.parent_id = p.id AND mc.academy_id = ?
     WHERE p.tenant_id = ?
     ORDER BY p.name`,
    [req.academyId, req.academyId]
  );
  res.json(consents);
});

router.put('/consent/:parentId', async (req, res) => {
  const { marketing_consent, consent_method } = req.body;
  const parentId = parseInt(req.params.parentId);

  if (marketing_consent) {
    await runQuery(
      `INSERT INTO message_consent (academy_id, parent_id, marketing_consent, consented_at, consent_method, withdrawn_at, updated_at)
       VALUES (?, ?, true, NOW(), ?, NULL, NOW())
       ON CONFLICT (academy_id, parent_id)
       DO UPDATE SET marketing_consent = true, consented_at = NOW(), consent_method = ?, withdrawn_at = NULL, updated_at = NOW()`,
      [req.academyId, parentId, consent_method || 'online', consent_method || 'online']
    );
    res.json({ message: '수신 동의가 등록되었습니다.' });
  } else {
    await runQuery(
      `INSERT INTO message_consent (academy_id, parent_id, marketing_consent, withdrawn_at, updated_at)
       VALUES (?, ?, false, NOW(), NOW())
       ON CONFLICT (academy_id, parent_id)
       DO UPDATE SET marketing_consent = false, withdrawn_at = NOW(), updated_at = NOW()`,
      [req.academyId, parentId]
    );
    res.json({ message: '수신 동의가 철회되었습니다.' });
  }
});

// 일괄 동의 등록
router.post('/consent/bulk', async (req, res) => {
  const { parent_ids, marketing_consent, consent_method } = req.body;
  if (!parent_ids || !Array.isArray(parent_ids) || parent_ids.length === 0) {
    return res.status(400).json({ error: '보호자를 선택해주세요.' });
  }

  let updated = 0;
  for (const parentId of parent_ids) {
    try {
      if (marketing_consent) {
        await runQuery(
          `INSERT INTO message_consent (academy_id, parent_id, marketing_consent, consented_at, consent_method, withdrawn_at, updated_at)
           VALUES (?, ?, true, NOW(), ?, NULL, NOW())
           ON CONFLICT (academy_id, parent_id)
           DO UPDATE SET marketing_consent = true, consented_at = NOW(), consent_method = ?, withdrawn_at = NULL, updated_at = NOW()`,
          [req.academyId, parentId, consent_method || 'online', consent_method || 'online']
        );
      } else {
        await runQuery(
          `INSERT INTO message_consent (academy_id, parent_id, marketing_consent, withdrawn_at, updated_at)
           VALUES (?, ?, false, NOW(), NOW())
           ON CONFLICT (academy_id, parent_id)
           DO UPDATE SET marketing_consent = false, withdrawn_at = NOW(), updated_at = NOW()`,
          [req.academyId, parentId]
        );
      }
      updated++;
    } catch (e) { /* skip individual errors */ }
  }

  res.json({ message: `${updated}명의 동의 상태가 업데이트되었습니다.`, updated });
});

// ============================================================
// === 발송 통계 ===
// ============================================================

router.get('/stats', async (req, res) => {
  // 월별 유형별 발송 통계
  const monthly = await getAll(
    `SELECT date_trunc('month', created_at)::date as month,
            message_category,
            channel,
            COUNT(*) as total_count,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as fail_count,
            SUM(cost) as total_cost
     FROM sms_send_logs WHERE academy_id = $1
     GROUP BY date_trunc('month', created_at)::date, message_category, channel
     ORDER BY month DESC
     LIMIT 120`,
    [req.academyId]
  );

  // 오늘/이번 달 요약
  const todaySummary = await getOne(
    `SELECT COUNT(*) as count, COALESCE(SUM(cost), 0) as cost
     FROM sms_send_logs
     WHERE academy_id = ? AND created_at >= CURRENT_DATE AND status = 'sent'`,
    [req.academyId]
  );

  const monthSummary = await getOne(
    `SELECT COUNT(*) as count, COALESCE(SUM(cost), 0) as cost
     FROM sms_send_logs
     WHERE academy_id = ? AND created_at >= date_trunc('month', CURRENT_DATE) AND status = 'sent'`,
    [req.academyId]
  );

  res.json({ monthly, today: todaySummary, this_month: monthSummary });
});

module.exports = router;
