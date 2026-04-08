const { getOne, getAll, runQuery, runInsert } = require('../db/database');

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
    'INSERT INTO sms_transactions (academy_id, type, amount, unit_type, description) VALUES (?, ?, ?, ?, ?)',
    [academyId, 'deduct', totalCost, type, `${type} ${count}건 발송`]
  );

  return { success: true, deducted: totalCost, remaining: balance - totalCost };
}

async function sendToParent(academyId, studentId, message, type = 'general') {
  // 1단계: FCM 푸시
  try {
    const result = await sendFcmPush(academyId, studentId, message, type);
    if (result.success) {
      await logNotification(academyId, studentId, message, 'FCM', 'sent');
      return { success: true, channel: 'FCM' };
    }
  } catch (e) {
    await logNotification(academyId, studentId, message, 'FCM', 'failed', e.message);
  }

  // 2단계: 카카오 알림톡 fallback
  try {
    const deductResult = await deductSmsCredit(academyId, 1, 'ALIMTALK');
    if (deductResult.success) {
      const result = await sendKakaoAlimtalk(academyId, studentId, message, type);
      if (result.success) {
        await logNotification(academyId, studentId, message, 'ALIMTALK', 'sent');
        return { success: true, channel: 'ALIMTALK' };
      }
    }
  } catch (e) {
    await logNotification(academyId, studentId, message, 'ALIMTALK', 'failed', e.message);
  }

  // 3단계: SMS fallback
  try {
    const deductResult = await deductSmsCredit(academyId, 1, 'SMS');
    if (deductResult.success) {
      const result = await sendSms(academyId, studentId, message);
      if (result.success) {
        await logNotification(academyId, studentId, message, 'SMS', 'sent');
        return { success: true, channel: 'SMS' };
      }
    }
  } catch (e) {
    await logNotification(academyId, studentId, message, 'SMS', 'failed', e.message);
  }

  return { success: false, error: '모든 알림 채널 실패' };
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
  await runInsert(
    'INSERT INTO notification_logs (academy_id, student_id, message, channel, status, error_message) VALUES (?, ?, ?, ?, ?, ?)',
    [academyId, studentId, message, channel, status, errorMessage]
  );
}

// --- 외부 서비스 플레이스홀더 ---

// TODO: Firebase Admin SDK 연동
async function sendFcmPush(academyId, studentId, message, type) {
  // const student = await getOne('SELECT parent_fcm_token FROM students WHERE id = ? AND academy_id = ?', [studentId, academyId]);
  // if (!student?.parent_fcm_token) return { success: false };
  // await admin.messaging().send({ token: student.parent_fcm_token, notification: { title, body: message } });
  return { success: false, error: 'FCM not configured' };
}

// TODO: 카카오 알림톡 API 연동
async function sendKakaoAlimtalk(academyId, studentId, message, type) {
  // SOLAPI 또는 카카오 비즈메시지 API 호출
  return { success: false, error: 'Alimtalk not configured' };
}

// TODO: SOLAPI SMS 연동
async function sendSms(academyId, studentId, message) {
  // const student = await getOne('SELECT s.id, u.phone as parent_phone FROM students s JOIN users u ON ... WHERE s.id = ?', [studentId]);
  // SOLAPI API 호출
  return { success: false, error: 'SMS not configured' };
}

module.exports = { sendToParent, sendBulk, deductSmsCredit, checkBalance, SMS_PRICING };
