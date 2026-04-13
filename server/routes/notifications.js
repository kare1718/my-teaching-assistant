const express = require('express');
const { getAll, getOne, runQuery } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, requireAdmin);

// 학원의 플랫폼 알림 목록
router.get('/', async (req, res) => {
  try {
    const notifications = await getAll(
      'SELECT * FROM platform_notifications WHERE academy_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.academyId]
    );
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 미읽음 개수
router.get('/unread-count', async (req, res) => {
  try {
    const result = await getOne(
      'SELECT COUNT(*) as count FROM platform_notifications WHERE academy_id = ? AND is_read = 0',
      [req.academyId]
    );
    res.json({ count: result?.count || 0 });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 읽음 처리
router.put('/:id/read', async (req, res) => {
  try {
    await runQuery(
      'UPDATE platform_notifications SET is_read = 1 WHERE id = ? AND academy_id = ?',
      [parseInt(req.params.id), req.academyId]
    );
    res.json({ message: '확인되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 전체 읽음 처리
router.put('/read-all', async (req, res) => {
  try {
    await runQuery(
      'UPDATE platform_notifications SET is_read = 1 WHERE academy_id = ? AND is_read = 0',
      [req.academyId]
    );
    res.json({ message: '모두 확인되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 쿠폰 코드 적용
router.post('/redeem-coupon', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: '쿠폰 코드를 입력해주세요.' });

    const promo = await getOne(
      "SELECT * FROM promotions WHERE code = ? AND is_active = 1",
      [code.trim().toUpperCase()]
    );
    if (!promo) return res.status(404).json({ error: '유효하지 않은 쿠폰 코드입니다.' });
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) return res.status(400).json({ error: '만료된 쿠폰입니다.' });
    if (promo.max_uses && promo.used_count >= promo.max_uses) return res.status(400).json({ error: '사용 한도를 초과한 쿠폰입니다.' });

    // 이미 사용했는지 확인
    const existing = await getOne(
      'SELECT id FROM promotion_grants WHERE promotion_id = ? AND academy_id = ?',
      [promo.id, req.academyId]
    );
    if (existing) return res.status(400).json({ error: '이미 사용한 쿠폰입니다.' });

    const value = typeof promo.value === 'string' ? JSON.parse(promo.value) : promo.value;
    let message = '';

    switch (promo.type) {
      case 'sms_credits': {
        const amt = value.amount || 0;
        const ex = await getOne('SELECT * FROM sms_credits WHERE academy_id = ?', [req.academyId]);
        if (ex) await runQuery('UPDATE sms_credits SET balance = balance + ? WHERE academy_id = ?', [amt, req.academyId]);
        else await runQuery('INSERT INTO sms_credits (academy_id, balance) VALUES (?, ?)', [req.academyId, amt]);
        message = `SMS 크레딧 ${amt}건이 충전되었습니다.`;
        break;
      }
      case 'discount_coupon':
        message = `${value.percent || 0}% 할인 쿠폰이 등록되었습니다. 다음 결제 시 자동 적용됩니다.`;
        break;
      case 'trial_extension': {
        const days = value.days || 14;
        const sub = await getOne("SELECT * FROM subscriptions WHERE academy_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [req.academyId]);
        if (sub) {
          const exp = new Date(sub.expires_at || Date.now());
          exp.setDate(exp.getDate() + days);
          await runQuery('UPDATE subscriptions SET expires_at = ? WHERE id = ?', [exp.toISOString(), sub.id]);
        }
        message = `체험 기간이 ${days}일 연장되었습니다.`;
        break;
      }
      default:
        message = `${promo.name}이(가) 적용되었습니다.`;
    }

    await runQuery(
      'INSERT INTO promotion_grants (promotion_id, academy_id, granted_by, status, applied_at) VALUES (?, ?, ?, ?, NOW())',
      [promo.id, req.academyId, req.user.id, 'applied']
    );
    await runQuery('UPDATE promotions SET used_count = used_count + 1 WHERE id = ?', [promo.id]);

    res.json({ message, promotion: promo.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
