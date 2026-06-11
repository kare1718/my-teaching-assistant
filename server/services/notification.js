const { getOne, getAll, runQuery, runInsert } = require('../db/database');
const { sendSMS } = require('../utils/smsHelper');
const { enqueueSMS } = require('./smsQueue');

const SMS_PRICING = {
  SMS: 9.9,
  LMS: 30,
  ALIMTALK: 7.5,
};

async function checkBalance(academyId) {
  const row = await getOne('SELECT balance FROM sms_credits WHERE academy_id = ?', [academyId]);
  return row ? row.balance : 0;
}

async function deductSmsCredit(academyId, count, type = 'SMS') {
  const unitCost = SMS_PRICING[type] || SMS_PRICING.SMS;
  const totalCost = Math.ceil(unitCost * count);

  const balance = await checkBalance(academyId);
  if (balance < totalCost) {
    return { success: false, error: '크레딧 잔액이 부족합니다.', balance, required: totalCost };
  }

  await runQuery('UPDATE sms_credits SET balance = balance - ?, updated_at = NOW() WHERE academy_id = ?', [totalCost, academyId]);
  await runInsert(
    'INSERT INTO sms_credit_transactions (academy_id, type, amount, balance_after, description, sms_type, unit_price, message_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [academyId, 'use', totalCost, balance - totalCost, `${type} ${count}건 발송`, type, unitCost, count]
  );

  return { success: true, deducted: totalCost, remaining: balance - totalCost };
}

// 보호자에게 SMS — 큐를 통한 비동기 발송 (HTTP 응답 지연 방지)
// 크레딧 차감은 워커에서 처리하지만, UI 피드백을 위해 사전에 잔액만 확인
async function sendToParent(academyId, studentId, message, type = 'general') {
  const student = await getOne(
    'SELECT s.parent_phone, s.parent_name, u.name as student_name FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.academy_id = ?',
    [studentId, academyId]
  );

  if (!student?.parent_phone) {
    await logNotification(academyId, studentId, message, 'NONE', 'failed', '보호자 연락처 없음');
    return { success: false, error: '보호자 연락처 없음' };
  }

  // 사전 잔액 확인 (큐 적재 전 차단 — 사용자에게 즉시 피드백)
  const balance = await checkBalance(academyId);
  const unitCost = Math.ceil(SMS_PRICING.SMS);
  if (balance < unitCost) {
    await logNotification(academyId, studentId, message, 'SMS', 'failed', '크레딧 잔액 부족');
    return { success: false, error: 'SMS 크레딧 잔액이 부족합니다. 충전 후 다시 시도해주세요.' };
  }

  // 큐에 적재 (비동기 발송)
  try {
    await enqueueSMS({
      academyId, studentId, to: student.parent_phone,
      text: message, type: 'SMS',
      meta: { notificationType: type, studentName: student.student_name },
    });
    // 큐 적재 기록 (실제 발송 결과는 워커가 sms_send_logs에 씀)
    await logNotification(academyId, studentId, message, 'SMS', 'queued');
    return { success: true, channel: 'SMS', queued: true };
  } catch (e) {
    await logNotification(academyId, studentId, message, 'SMS', 'failed', e.message);
    return { success: false, error: e.message };
  }
}

async function sendBulk(academyId, studentIds, message, type = 'general') {
  // 병렬 큐 적재 (개별 워커가 rate limit 적용)
  const results = await Promise.all(
    studentIds.map(async (studentId) => {
      const r = await sendToParent(academyId, studentId, message, type);
      return { studentId, ...r };
    })
  );
  return results;
}

async function logNotification(academyId, studentId, message, channel, status, errorMessage = null) {
  try {
    await runInsert(
      'INSERT INTO notification_logs (academy_id, student_id, message, channel, status, error_message) VALUES (?, ?, ?, ?, ?, ?)',
      [academyId, studentId, message, channel, status, errorMessage]
    );
  } catch (e) {
    console.error('[notification] logNotification 실패:', e.message);
  }
}

module.exports = { sendToParent, sendBulk, deductSmsCredit, checkBalance, logNotification, SMS_PRICING };
