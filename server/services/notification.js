const { getOne, getAll, runQuery, runInsert } = require('../db/database');
const { sendSMS } = require('../utils/smsHelper');

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

async function sendToParent(academyId, studentId, message, type = 'general') {
  // 학생의 보호자 전화번호 조회
  const student = await getOne(
    'SELECT s.parent_phone, s.parent_name, u.name as student_name FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.academy_id = ?',
    [studentId, academyId]
  );

  if (!student?.parent_phone) {
    await logNotification(academyId, studentId, message, 'NONE', 'failed', '보호자 연락처 없음');
    return { success: false, error: '보호자 연락처 없음' };
  }

  // SMS 발송 (Solapi)
  try {
    const deductResult = await deductSmsCredit(academyId, 1, 'SMS');
    if (!deductResult.success) {
      await logNotification(academyId, studentId, message, 'SMS', 'failed', deductResult.error);
      return { success: false, error: deductResult.error };
    }

    await sendSMS(student.parent_phone, message);
    await logNotification(academyId, studentId, message, 'SMS', 'sent');
    return { success: true, channel: 'SMS' };
  } catch (e) {
    await logNotification(academyId, studentId, message, 'SMS', 'failed', e.message);
    return { success: false, error: e.message };
  }
}

async function sendBulk(academyId, studentIds, message, type = 'general') {
  const results = [];
  for (const studentId of studentIds) {
    const result = await sendToParent(academyId, studentId, message, type);
    results.push({ studentId, ...result });
  }
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
