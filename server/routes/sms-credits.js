const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { checkBalance, deductSmsCredit, SMS_PRICING } = require('../services/notification');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// 현재 SMS 잔액
router.get('/balance', async (req, res) => {
  try {
    const balance = await checkBalance(req.academyId);
    res.json({ balance });
  } catch (err) {
    console.error('[SMS 잔액 조회 오류]', err.message);
    res.json({ balance: 0 });
  }
});

// 크레딧 충전 (PortOne 결제 완료 후 호출)
router.post('/charge', async (req, res) => {
  try {
    const { amount, payment_id } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: '충전 금액은 0보다 커야 합니다.' });

    const allowedAmounts = [5000, 10000, 30000, 50000, 100000];
    if (!allowedAmounts.includes(amount)) {
      return res.status(400).json({ error: '유효한 충전 금액이 아닙니다.', allowedAmounts });
    }

    if (payment_id) {
      const { verifyPayment } = require('../services/billing');
      const verification = await verifyPayment(payment_id);
      if (!verification.verified) {
        return res.status(400).json({ error: '결제 검증에 실패했습니다.' });
      }
      if (!verification.testMode && verification.amount !== amount) {
        return res.status(400).json({ error: '결제 금액이 일치하지 않습니다.' });
      }
    }

    const existing = await getOne('SELECT id FROM sms_credits WHERE academy_id = ?', [req.academyId]);
    if (existing) {
      await runQuery('UPDATE sms_credits SET balance = balance + ?, total_charged = total_charged + ?, last_charged_at = NOW(), updated_at = NOW() WHERE academy_id = ?', [amount, amount, req.academyId]);
    } else {
      await runInsert('INSERT INTO sms_credits (academy_id, balance, total_charged, last_charged_at) VALUES (?, ?, ?, NOW())', [req.academyId, amount, amount]);
    }

    const newBalance = await checkBalance(req.academyId);

    await runInsert(
      'INSERT INTO sms_credit_transactions (academy_id, type, amount, balance_after, description, portone_payment_id) VALUES (?, ?, ?, ?, ?, ?)',
      [req.academyId, 'charge', amount, newBalance, `크레딧 충전 ${amount.toLocaleString()}원`, payment_id || null]
    );

    res.json({ message: '충전이 완료되었습니다.', balance: newBalance });
  } catch (err) {
    console.error('[SMS 충전 오류]', err.message);
    res.status(500).json({ error: '충전 처리 중 오류가 발생했습니다.' });
  }
});

// 충전/사용 내역
router.get('/transactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const rows = await getAll(
      'SELECT * FROM sms_credit_transactions WHERE academy_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.academyId, limit, offset]
    );

    const countRow = await getOne('SELECT COUNT(*) as total FROM sms_credit_transactions WHERE academy_id = ?', [req.academyId]);

    res.json({ transactions: rows, total: countRow?.total || 0, page, limit });
  } catch (err) {
    console.error('[SMS 거래내역 오류]', err.message);
    res.json({ transactions: [], total: 0, page: 1, limit: 50 });
  }
});

// SMS 발송
router.post('/send', async (req, res) => {
  try {
    const { recipients, message, type } = req.body;
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: '수신자 목록이 필요합니다.' });
    }
    if (!message) return res.status(400).json({ error: '메시지 내용이 필요합니다.' });

    const smsType = message.length > 90 ? 'LMS' : (type || 'SMS');
    const unitCost = SMS_PRICING[smsType] || SMS_PRICING.SMS;
    const totalCost = Math.ceil(unitCost * recipients.length);

    const balance = await checkBalance(req.academyId);
    if (balance < totalCost) {
      return res.status(400).json({
        error: '크레딧이 부족합니다.',
        balance,
        required: totalCost,
        unitCost,
        type: smsType
      });
    }

    const deductResult = await deductSmsCredit(req.academyId, recipients.length, smsType);
    if (!deductResult.success) {
      return res.status(400).json({ error: deductResult.error });
    }

    res.json({
      message: `${recipients.length}건 발송 요청 완료`,
      type: smsType,
      deducted: deductResult.deducted,
      remaining: deductResult.remaining
    });
  } catch (err) {
    console.error('[SMS 발송 오류]', err.message);
    res.status(500).json({ error: 'SMS 발송 중 오류가 발생했습니다.' });
  }
});

// 단가 안내
router.get('/pricing', async (req, res) => {
  res.json({
    pricing: [
      { type: 'SMS', description: '단문 (90자 이내)', unitPrice: SMS_PRICING.SMS },
      { type: 'LMS', description: '장문 (2000자 이내)', unitPrice: SMS_PRICING.LMS },
      { type: 'ALIMTALK', description: '카카오 알림톡', unitPrice: SMS_PRICING.ALIMTALK },
    ]
  });
});

module.exports = router;
