// SMS 큐 — Solapi 발송을 비동기화
//
// 사용법:
//   const { enqueueSMS } = require('./services/smsQueue');
//   await enqueueSMS({ academyId, to, text, type: 'SMS', meta: { ... } });
//
// 워커가 실제 발송 + 크레딧 차감 + 로그 기록까지 처리.
// HTTP 요청은 enqueue 즉시 return → 응답 빠름.
//
// Rate limit: Solapi는 초당 50건까지 안전. 본 큐는 초당 20건으로 보수적 설정.
const { enqueue, registerWorker, QUEUES } = require('./queue');
const { sendSMS, sendBulkSMS, isConfigured } = require('../utils/smsHelper');
const { runInsert } = require('../db/database');
const { getCostPerMessage, checkAndDeductCredits } = require('../utils/smsBilling');

// ── DB 로깅 (성공/실패) ──
async function logSmsSend({ academyId, studentId, to, text, type, status, errorMsg }) {
  try {
    await runInsert(
      `INSERT INTO sms_send_logs (academy_id, student_id, recipient_phone, message_content, message_type, status, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [academyId || null, studentId || null, to, text?.slice(0, 500), type, status, errorMsg || null]
    );
  } catch (e) {
    console.error('[smsQueue/log]', e.message);
  }
}

// ── 크레딧 차감 — smsBilling 단일소스 위임 (FOR UPDATE 트랜잭션 + 테이블 기반 단가) ──
async function deductCredit(academyId, count, type) {
  if (!academyId) return { success: true, skipped: true }; // 시스템 메시지 (가입 인증 등) 은 크레딧 무관
  const unitCost = await getCostPerMessage(type, academyId);
  const totalCost = Math.ceil(unitCost * count);
  const result = await checkAndDeductCredits(
    academyId, totalCost, `${type} ${count}건 발송`, null,
    { smsType: type, unitPrice: unitCost, messageCount: count }
  );
  if (!result.success) return result;
  return { success: true, deducted: totalCost };
}

// ── 실제 발송 프로세서 (큐 워커 or 인라인 폴백 공용) ──
async function processSmsJob(job) {
  const { academyId, studentId, to, text, type = 'SMS', systemMessage = false } = job.data;

  if (!isConfigured()) {
    console.warn('[smsQueue] SMS 미설정 — skip', { to, text: text?.slice(0, 40) });
    await logSmsSend({ academyId, studentId, to, text, type, status: 'skipped', errorMsg: 'Solapi 미설정' });
    return { skipped: true };
  }

  // 시스템 메시지 (가입 인증 등) 는 크레딧 차감 없음
  if (!systemMessage) {
    const credit = await deductCredit(academyId, 1, type);
    if (!credit.success && !credit.skipped) {
      await logSmsSend({ academyId, studentId, to, text, type, status: 'failed', errorMsg: credit.error });
      throw new Error(credit.error); // BullMQ 재시도 트리거
    }
  }

  try {
    await sendSMS(to, text);
    await logSmsSend({ academyId, studentId, to, text, type, status: 'sent' });
    return { sent: true };
  } catch (err) {
    await logSmsSend({ academyId, studentId, to, text, type, status: 'failed', errorMsg: err.message });
    throw err; // 재시도
  }
}

// ── 큐 API ──
async function enqueueSMS(payload, opts = {}) {
  return enqueue(QUEUES.SMS, 'send', payload, opts, processSmsJob);
}

async function enqueueBulkSMS({ academyId, recipients, text, type = 'SMS' }) {
  // 큰 배치는 개별 작업으로 쪼개 rate-limit 적용
  const jobs = recipients.map((to) => enqueueSMS({ academyId, to, text, type }));
  return Promise.all(jobs);
}

// ── 워커 등록 (server.js에서 1회 호출) ──
function startSmsWorker() {
  registerWorker(QUEUES.SMS, processSmsJob, {
    concurrency: 5,
    limiter: { max: 20, duration: 1000 }, // 초당 20건 안전
  });
}

module.exports = { enqueueSMS, enqueueBulkSMS, startSmsWorker, processSmsJob };
