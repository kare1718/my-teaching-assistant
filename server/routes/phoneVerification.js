const express = require('express');
const crypto = require('crypto');
const { runQuery, runInsert, getOne } = require('../db/database');
const { sendSMS, isConfigured } = require('../utils/smsHelper');
const { enqueueSMS } = require('../services/smsQueue');

const router = express.Router();

// 규칙 ─────────────────────────────────────────────
const CODE_TTL_MS = 5 * 60 * 1000;         // 인증번호 유효기간 5분
const TOKEN_TTL_MS = 15 * 60 * 1000;       // 인증 완료 후 토큰 유효기간 15분
const PER_PHONE_COOLDOWN_MS = 60 * 1000;   // 번호당 재발송 1분
const PER_IP_LIMIT = 10;                   // IP당 시간당 10회
const PER_IP_WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;                    // 코드 입력 최대 시도
const VALID_PURPOSES = ['signup', 'password_reset'];

function normalizePhone(p) {
  return (p || '').replace(/[^0-9]/g, '');
}

function isValidPhone(p) {
  const n = normalizePhone(p);
  return /^01[016789][0-9]{7,8}$/.test(n);
}

function genCode() {
  // 6자리 숫자 코드 (crypto로 안전하게)
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function genToken() {
  return crypto.randomBytes(24).toString('hex');
}

// POST /send-code { phone, purpose }
router.post('/send-code', async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const purpose = String(req.body?.purpose || '').trim();
    const ip = (req.ip || req.connection?.remoteAddress || '').slice(0, 64);

    if (!isValidPhone(phone)) return res.status(400).json({ error: '유효하지 않은 휴대폰 번호입니다.' });
    if (!VALID_PURPOSES.includes(purpose)) return res.status(400).json({ error: '잘못된 요청입니다.' });

    // 번호당 1분 쿨다운
    const lastByPhone = await getOne(
      `SELECT created_at FROM phone_verifications WHERE phone = ? ORDER BY id DESC LIMIT 1`,
      [phone]
    );
    if (lastByPhone?.created_at) {
      const elapsed = Date.now() - new Date(lastByPhone.created_at).getTime();
      if (elapsed < PER_PHONE_COOLDOWN_MS) {
        const wait = Math.ceil((PER_PHONE_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({ error: `${wait}초 후 다시 시도해주세요.` });
      }
    }

    // IP당 1시간 10회
    const ipRow = await getOne(
      `SELECT COUNT(*)::int as c FROM phone_verifications
       WHERE ip = ? AND created_at > NOW() - INTERVAL '1 hour'`,
      [ip]
    );
    if ((ipRow?.c || 0) >= PER_IP_LIMIT) {
      return res.status(429).json({ error: '인증 요청이 너무 많습니다. 1시간 후 다시 시도해주세요.' });
    }

    const code = genCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
    await runInsert(
      `INSERT INTO phone_verifications (phone, code, purpose, ip, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [phone, code, purpose, ip, expiresAt]
    );

    const text = `[나만의 조교] 인증번호 [${code}]를 입력해주세요. 5분 내 유효.`;
    if (isConfigured()) {
      // 인증번호는 시스템 메시지(크레딧 차감 없음) + 큐를 통한 비동기 발송
      // 단, 인증번호는 "보내진 직후 사용자가 봐야" 하므로 최우선 처리 (priority 높임)
      try {
        await enqueueSMS(
          { academyId: null, to: phone, text, type: 'SMS', systemMessage: true },
          { priority: 1, attempts: 2 } // 재시도 2회로 제한 (오래된 코드는 무의미)
        );
      } catch (err) {
        console.error('[phone-verify enqueue]', err.message);
        return res.status(502).json({ error: 'SMS 전송에 실패했습니다. 잠시 후 다시 시도해주세요.' });
      }
    } else {
      // 미구성 시: 개발 편의상 콘솔에만 출력 (프로덕션엔 설정 필수)
      console.warn('[phone-verify] SMS 미설정 — 개발 모드로 코드 표시:', phone, code);
    }

    res.json({ message: '인증번호가 발송되었습니다.', ttlSeconds: CODE_TTL_MS / 1000 });
  } catch (err) {
    console.error('[phone-verify/send-code]', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /verify-code { phone, code, purpose } -> { token }
router.post('/verify-code', async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const code = String(req.body?.code || '').trim();
    const purpose = String(req.body?.purpose || '').trim();

    if (!isValidPhone(phone) || !/^[0-9]{6}$/.test(code) || !VALID_PURPOSES.includes(purpose)) {
      return res.status(400).json({ error: '잘못된 요청입니다.' });
    }

    const row = await getOne(
      `SELECT * FROM phone_verifications
       WHERE phone = ? AND purpose = ? AND verified = FALSE
       ORDER BY id DESC LIMIT 1`,
      [phone, purpose]
    );
    if (!row) return res.status(400).json({ error: '인증 요청을 먼저 진행해주세요.' });

    if (new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: '인증번호가 만료되었습니다. 다시 요청해주세요.' });
    }
    if ((row.attempts || 0) >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: '시도 횟수를 초과했습니다. 다시 요청해주세요.' });
    }

    if (row.code !== code) {
      await runQuery('UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = ?', [row.id]);
      return res.status(400).json({ error: '인증번호가 일치하지 않습니다.' });
    }

    const token = genToken();
    await runQuery(
      `UPDATE phone_verifications
       SET verified = TRUE, verified_at = NOW(), token = ?, expires_at = ?
       WHERE id = ?`,
      [token, new Date(Date.now() + TOKEN_TTL_MS).toISOString(), row.id]
    );

    res.json({ message: '인증되었습니다.', token, ttlSeconds: TOKEN_TTL_MS / 1000 });
  } catch (err) {
    console.error('[phone-verify/verify-code]', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 다른 라우트에서 쓸 헬퍼: 토큰 소비 (성공 시 해당 verification을 token_used=true 로 마킹)
async function consumePhoneVerificationToken({ token, phone, purpose }) {
  if (!token || !phone || !purpose) return false;
  const row = await getOne(
    `SELECT * FROM phone_verifications
     WHERE token = ? AND phone = ? AND purpose = ? AND verified = TRUE AND token_used = FALSE`,
    [token, normalizePhone(phone), purpose]
  );
  if (!row) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) return false;
  await runQuery('UPDATE phone_verifications SET token_used = TRUE WHERE id = ?', [row.id]);
  return true;
}

module.exports = router;
module.exports.consumePhoneVerificationToken = consumePhoneVerificationToken;
module.exports.normalizePhone = normalizePhone;
