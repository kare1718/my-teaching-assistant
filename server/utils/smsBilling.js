const crypto = require('crypto');
const { getOne, getAll, runBatch } = require('../db/database');

// 기본 단가 (sms_pricing 테이블 조회 실패 시 fallback)
const DEFAULT_PRICING = { SMS: 13, LMS: 29, MMS: 60, ALIMTALK: 8 };

// 단가 캐시 (5분)
let pricingCache = null;
let pricingCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

// EUC-KR 바이트 수 계산 (솔라피 기준: 90바이트 이하 SMS, 초과 LMS)
function getByteLength(text) {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 0x7F) bytes += 1;        // ASCII
    else if (code <= 0x7FF) bytes += 2;   // 기본 2바이트
    else bytes += 2;                       // 한글 등 EUC-KR 2바이트
  }
  return bytes;
}

// 메시지 유형 판별
function getMessageType(text) {
  return getByteLength(text) > 90 ? 'LMS' : 'SMS';
}

// 단가 조회 (캐시 포함)
async function getPricing(academyId = 1) {
  const now = Date.now();
  if (pricingCache && (now - pricingCacheTime) < CACHE_TTL) return pricingCache;

  try {
    const rows = await getAll(
      'SELECT message_type, cost_per_message FROM sms_pricing WHERE academy_id = ?',
      [academyId]
    );
    const pricing = { ...DEFAULT_PRICING };
    rows.forEach(r => { pricing[r.message_type] = r.cost_per_message; });
    pricingCache = pricing;
    pricingCacheTime = now;
    return pricing;
  } catch (e) {
    return DEFAULT_PRICING;
  }
}

// 유형별 단가
async function getCostPerMessage(messageType, academyId = 1) {
  const pricing = await getPricing(academyId);
  return pricing[messageType] || DEFAULT_PRICING[messageType] || 13;
}

// 메시지 배열의 총 비용 계산
async function calculateTotalCost(messages, academyId = 1) {
  const pricing = await getPricing(academyId);
  const breakdown = {};
  let totalCost = 0;

  for (const m of messages) {
    const type = m.messageType || getMessageType(m.message || m.text || '');
    const cost = pricing[type] || DEFAULT_PRICING[type] || 13;
    if (!breakdown[type]) breakdown[type] = { count: 0, unitCost: cost, subtotal: 0 };
    breakdown[type].count++;
    breakdown[type].subtotal += cost;
    totalCost += cost;
  }

  return { totalCost, breakdown };
}

// 크레딧 차감 (트랜잭션)
async function checkAndDeductCredits(academyId, totalCost, description, adminId) {
  let result = null;

  try {
    await runBatch(async (tx) => {
      // 잔액 행이 없으면 생성
      await tx.run(
        'INSERT INTO sms_credits (academy_id, balance, total_charged, total_used) VALUES (?, 0, 0, 0) ON CONFLICT (academy_id) DO NOTHING',
        [academyId]
      );

      // FOR UPDATE로 행 잠금
      const credit = await tx.getOne(
        'SELECT balance FROM sms_credits WHERE academy_id = ? FOR UPDATE',
        [academyId]
      );

      if (!credit || credit.balance < totalCost) {
        result = { success: false, error: '크레딧이 부족합니다', balance: credit?.balance || 0, required: totalCost };
        throw new Error('INSUFFICIENT_CREDITS');
      }

      const newBalance = credit.balance - totalCost;

      await tx.run(
        'UPDATE sms_credits SET balance = balance - ?, total_used = total_used + ?, updated_at = NOW() WHERE academy_id = ?',
        [totalCost, totalCost, academyId]
      );

      await tx.run(
        'INSERT INTO sms_credit_transactions (academy_id, type, amount, balance_after, description, admin_id) VALUES (?, ?, ?, ?, ?, ?)',
        [academyId, 'deduct', -totalCost, newBalance, description, adminId]
      );

      result = { success: true, balance: newBalance };
    });
  } catch (e) {
    if (e.message === 'INSUFFICIENT_CREDITS') {
      return result; // 이미 result에 실패 정보 설정됨
    }
    throw e; // 다른 에러는 그대로 전파
  }

  return result;
}

// 크레딧 충전 (트랜잭션)
async function chargeCredits(academyId, amount, description, adminId) {
  let result = null;

  await runBatch(async (tx) => {
    await tx.run(
      'INSERT INTO sms_credits (academy_id, balance, total_charged, total_used) VALUES (?, 0, 0, 0) ON CONFLICT (academy_id) DO NOTHING',
      [academyId]
    );

    await tx.run(
      'UPDATE sms_credits SET balance = balance + ?, total_charged = total_charged + ?, updated_at = NOW() WHERE academy_id = ?',
      [amount, amount, academyId]
    );

    const credit = await tx.getOne('SELECT balance FROM sms_credits WHERE academy_id = ?', [academyId]);

    await tx.run(
      'INSERT INTO sms_credit_transactions (academy_id, type, amount, balance_after, description, admin_id) VALUES (?, ?, ?, ?, ?, ?)',
      [academyId, 'charge', amount, credit.balance, description, adminId]
    );

    result = { success: true, balance: credit.balance };
  });

  return result;
}

// 발송 로그 기록
async function logSentMessages(batchId, messages, adminId, academyId = 1) {
  for (const m of messages) {
    try {
      const type = m.messageType || getMessageType(m.message || '');
      const pricing = await getPricing(academyId);
      const cost = pricing[type] || DEFAULT_PRICING[type] || 13;

      await require('../db/database').runQuery(
        `INSERT INTO sms_send_logs (academy_id, batch_id, message_type, recipient_phone, recipient_name, message_content, cost, status, solapi_message_id, error_message, sent_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [academyId, batchId, type, m.phone || '', m.name || '', m.message || '', cost, m.status || 'sent', m.solapiMessageId || null, m.error || null, adminId]
      );
    } catch (e) {
      console.error('발송 로그 기록 실패:', e.message);
    }
  }
}

// 실패 건 환불
async function refundFailedMessages(academyId, failedCount, failedCost, adminId, batchId) {
  if (failedCost <= 0) return;

  await runBatch(async (tx) => {
    await tx.run(
      'UPDATE sms_credits SET balance = balance + ?, total_used = total_used - ?, updated_at = NOW() WHERE academy_id = ?',
      [failedCost, failedCost, academyId]
    );

    const credit = await tx.getOne('SELECT balance FROM sms_credits WHERE academy_id = ?', [academyId]);

    await tx.run(
      'INSERT INTO sms_credit_transactions (academy_id, type, amount, balance_after, description, admin_id) VALUES (?, ?, ?, ?, ?, ?)',
      [academyId, 'refund', failedCost, credit.balance, `발송 실패 ${failedCount}건 환불 (batch: ${batchId})`, adminId]
    );
  });
}

// 잔액 조회
async function getCredits(academyId = 1) {
  // 행이 없으면 생성
  await require('../db/database').runQuery(
    'INSERT INTO sms_credits (academy_id, balance, total_charged, total_used) VALUES (?, 0, 0, 0) ON CONFLICT (academy_id) DO NOTHING',
    [academyId]
  );
  return await getOne('SELECT * FROM sms_credits WHERE academy_id = ?', [academyId]);
}

module.exports = {
  getMessageType,
  getByteLength,
  getCostPerMessage,
  calculateTotalCost,
  checkAndDeductCredits,
  chargeCredits,
  logSentMessages,
  refundFailedMessages,
  getCredits,
  getPricing,
  DEFAULT_PRICING,
};
