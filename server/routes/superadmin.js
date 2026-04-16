const express = require('express');
const bcrypt = require('bcryptjs');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');
const { TIER_LIMITS } = require('../middleware/subscription');

const router = express.Router();
router.use(authenticateToken, requireSuperAdmin);

// 전체 학원 목록
router.get('/academies', async (req, res) => {
  try {
    const academies = await getAll(
      `SELECT a.*,
        (SELECT COUNT(*) FROM students WHERE academy_id = a.id AND (status IS NULL OR status = 'active')) as student_count,
        (SELECT COUNT(*) FROM users WHERE academy_id = a.id) as user_count
       FROM academies a ORDER BY a.created_at DESC`
    );
    res.json(academies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 학원 상세
router.get('/academies/:id', async (req, res) => {
  try {
    const academy = await getOne('SELECT * FROM academies WHERE id = ?', [parseInt(req.params.id)]);
    if (!academy) return res.status(404).json({ error: '학원을 찾을 수 없습니다.' });

    const stats = {
      students: await getOne('SELECT COUNT(*) as count FROM students WHERE academy_id = ?', [academy.id]),
      exams: await getOne('SELECT COUNT(*) as count FROM exams WHERE academy_id = ?', [academy.id]),
      quizLogs: await getOne('SELECT COUNT(*) as count FROM vocab_game_logs WHERE academy_id = ?', [academy.id]),
    };

    const subscription = await getOne(
      'SELECT * FROM subscriptions WHERE academy_id = ? AND status = ? ORDER BY id DESC LIMIT 1',
      [academy.id, 'active']
    );

    res.json({ academy, stats, subscription });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 학원 생성
router.post('/academies', async (req, res) => {
  try {
    const { name, slug, ownerUsername, ownerPassword, ownerName, ownerPhone, tier } = req.body;
    if (!name || !slug) return res.status(400).json({ error: '학원 이름과 slug를 입력해주세요.' });

    const existing = await getOne('SELECT id FROM academies WHERE slug = ?', [slug]);
    if (existing) return res.status(400).json({ error: '이미 사용 중인 slug입니다.' });

    const defaultSettings = {
      schools: [{ name: '고등학교', grades: ['1학년', '2학년', '3학년'] }],
      examTypes: [],
      siteTitle: name,
      mainTitle: '',
      branding: {},
    };

    const academyId = await runInsert(
      'INSERT INTO academies (name, slug, subscription_tier, max_students, settings) VALUES (?, ?, ?, ?, ?)',
      [name, slug, tier || 'free', TIER_LIMITS[tier || 'free']?.maxStudents || 15, JSON.stringify(defaultSettings)]
    );

    // 관리자 계정 생성
    if (ownerUsername && ownerPassword) {
      const hashed = await bcrypt.hash(ownerPassword, 10);
      const userId = await runInsert(
        'INSERT INTO users (username, password, name, role, approved, phone, academy_id) VALUES (?, ?, ?, ?, 1, ?, ?)',
        [ownerUsername, hashed, ownerName || '관리자', 'admin', ownerPhone || '', academyId]
      );
      await runQuery('UPDATE academies SET owner_user_id = ? WHERE id = ?', [userId, academyId]);
    }

    // 기본 캐릭터/칭호 시드
    await seedAcademyDefaults(academyId);

    res.json({ message: '학원이 생성되었습니다.', academyId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 학원 활성화/비활성화
router.put('/academies/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    await runQuery('UPDATE academies SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, parseInt(req.params.id)]);
    res.json({ message: isActive ? '학원이 활성화되었습니다.' : '학원이 비활성화되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 학원 티어 변경
router.put('/academies/:id/tier', async (req, res) => {
  try {
    const { tier } = req.body;
    const limits = TIER_LIMITS[tier];
    if (!limits) return res.status(400).json({ error: '유효하지 않은 티어입니다.' });

    await runQuery('UPDATE academies SET subscription_tier = ?, max_students = ? WHERE id = ?',
      [tier, limits.maxStudents, parseInt(req.params.id)]);
    res.json({ message: `티어가 ${tier}로 변경되었습니다.` });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 플랫폼 통계 (강화)
router.get('/stats', async (req, res) => {
  try {
    const totalAcademies = await getOne('SELECT COUNT(*) as count FROM academies WHERE is_active = 1');
    const totalStudents = await getOne("SELECT COUNT(*) as count FROM students WHERE status IS NULL OR status = 'active'");
    const totalUsers = await getOne('SELECT COUNT(*) as count FROM users');

    const month = new Date().toISOString().slice(0, 7);
    const monthlyPayments = await getOne(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'paid' AND to_char(paid_at, 'YYYY-MM') = ?",
      [month]
    );

    const tierDistribution = await getAll(
      'SELECT subscription_tier, COUNT(*) as count FROM academies WHERE is_active = 1 GROUP BY subscription_tier'
    );

    // MRR 계산 (active subscriptions) — VAT 별도, 현행 4단 + 레거시 매핑
    const mrr = await getOne(
      `SELECT COALESCE(SUM(CASE
        WHEN a.subscription_tier = 'starter' THEN 49000
        WHEN a.subscription_tier = 'pro' THEN 129000
        WHEN a.subscription_tier = 'basic' THEN 49000
        WHEN a.subscription_tier IN ('standard', 'growth') THEN 129000
        ELSE 0
      END), 0) as total
      FROM academies a WHERE a.is_active = 1 AND a.subscription_tier NOT IN ('free', 'trial', 'first_class', 'premium')`
    );

    // 이번달 신규 학원
    const newThisMonth = await getOne(
      "SELECT COUNT(*) as count FROM academies WHERE to_char(created_at, 'YYYY-MM') = ?",
      [month]
    );

    // 실패한 결제 수
    const failedPayments = await getOne(
      "SELECT COUNT(*) as count FROM payments WHERE status = 'failed' AND to_char(created_at, 'YYYY-MM') = ?",
      [month]
    );

    // 체험 만료 임박 (7일 내)
    const expiringTrials = await getAll(
      `SELECT a.id, a.name, a.slug, s.expires_at
       FROM academies a
       LEFT JOIN subscriptions s ON s.academy_id = a.id AND s.status = 'active'
       WHERE a.subscription_tier = 'trial' AND a.is_active = 1
       AND s.expires_at IS NOT NULL AND s.expires_at < NOW() + INTERVAL '7 days'
       ORDER BY s.expires_at ASC LIMIT 10`
    );

    // 6개월 매출 트렌드
    const revenueTrend = await getAll(
      `SELECT to_char(paid_at, 'YYYY-MM') as month, COALESCE(SUM(amount), 0) as total
       FROM payments WHERE status = 'paid' AND paid_at > NOW() - INTERVAL '6 months'
       GROUP BY to_char(paid_at, 'YYYY-MM') ORDER BY month ASC`
    );

    res.json({
      totalAcademies: totalAcademies?.count || 0,
      totalStudents: totalStudents?.count || 0,
      totalUsers: totalUsers?.count || 0,
      monthlyRevenue: monthlyPayments?.total || 0,
      mrr: mrr?.total || 0,
      newThisMonth: newThisMonth?.count || 0,
      failedPayments: failedPayments?.count || 0,
      expiringTrials,
      revenueTrend,
      tierDistribution,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ======================== 활동 로그 ========================

async function logActivity(actorId, action, targetType, targetId, details) {
  try {
    await runInsert(
      'INSERT INTO platform_activity_logs (actor_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [actorId, action, targetType, targetId, JSON.stringify(details || {})]
    );
  } catch (e) { console.error('Activity log error:', e.message); }
}

router.get('/activity', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const logs = await getAll(
      `SELECT l.*, u.name as actor_name
       FROM platform_activity_logs l
       LEFT JOIN users u ON u.id = l.actor_id
       ORDER BY l.created_at DESC LIMIT ?`,
      [limit]
    );
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ======================== 프로모션 시스템 ========================

// 프로모션 목록
router.get('/promotions', async (req, res) => {
  try {
    const promos = await getAll(
      `SELECT p.*, u.name as creator_name,
        (SELECT COUNT(*) FROM promotion_grants WHERE promotion_id = p.id) as grant_count
       FROM promotions p
       LEFT JOIN users u ON u.id = p.created_by
       ORDER BY p.created_at DESC`
    );
    res.json(promos);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 프로모션 생성
router.post('/promotions', async (req, res) => {
  try {
    const { name, type, value, code, max_uses, expires_at } = req.body;
    if (!name || !type || !value) return res.status(400).json({ error: '필수 항목을 입력해주세요.' });

    const validTypes = ['free_month', 'tier_upgrade', 'sms_credits', 'discount_coupon', 'trial_extension', 'feature_unlock'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: '유효하지 않은 프로모션 타입입니다.' });

    if (code) {
      const existing = await getOne('SELECT id FROM promotions WHERE code = ?', [code]);
      if (existing) return res.status(400).json({ error: '이미 사용 중인 코드입니다.' });
    }

    const id = await runInsert(
      'INSERT INTO promotions (name, type, value, code, max_uses, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, type, JSON.stringify(value), code || null, max_uses || null, expires_at || null, req.user.id]
    );

    await logActivity(req.user.id, 'promotion_create', 'promotion', id, { name, type });
    res.json({ message: '프로모션이 생성되었습니다.', id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 프로모션 수정
router.put('/promotions/:id', async (req, res) => {
  try {
    const { name, value, code, max_uses, expires_at, is_active } = req.body;
    const promoId = parseInt(req.params.id);
    const promo = await getOne('SELECT * FROM promotions WHERE id = ?', [promoId]);
    if (!promo) return res.status(404).json({ error: '프로모션을 찾을 수 없습니다.' });

    await runQuery(
      `UPDATE promotions SET
        name = COALESCE(?, name),
        value = COALESCE(?, value),
        code = COALESCE(?, code),
        max_uses = COALESCE(?, max_uses),
        expires_at = COALESCE(?, expires_at),
        is_active = COALESCE(?, is_active)
      WHERE id = ?`,
      [name || null, value ? JSON.stringify(value) : null, code || null, max_uses || null, expires_at || null, is_active !== undefined ? (is_active ? 1 : 0) : null, promoId]
    );

    res.json({ message: '프로모션이 수정되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 프로모션 삭제
router.delete('/promotions/:id', async (req, res) => {
  try {
    const promoId = parseInt(req.params.id);
    await runQuery('DELETE FROM promotion_grants WHERE promotion_id = ?', [promoId]);
    await runQuery('DELETE FROM promotions WHERE id = ?', [promoId]);
    res.json({ message: '프로모션이 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 프로모션 지급 내역
router.get('/promotions/:id/grants', async (req, res) => {
  try {
    const grants = await getAll(
      `SELECT g.*, a.name as academy_name, a.slug as academy_slug, u.name as grantor_name
       FROM promotion_grants g
       LEFT JOIN academies a ON a.id = g.academy_id
       LEFT JOIN users u ON u.id = g.granted_by
       WHERE g.promotion_id = ?
       ORDER BY g.created_at DESC`,
      [parseInt(req.params.id)]
    );
    res.json(grants);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 핵심: 특정 학원에 프로모션 지급
router.post('/promotions/:id/grant', async (req, res) => {
  try {
    const promoId = parseInt(req.params.id);
    const { academy_id, note } = req.body;
    if (!academy_id) return res.status(400).json({ error: '학원을 선택해주세요.' });

    const promo = await getOne('SELECT * FROM promotions WHERE id = ?', [promoId]);
    if (!promo) return res.status(404).json({ error: '프로모션을 찾을 수 없습니다.' });
    if (!promo.is_active) return res.status(400).json({ error: '비활성 프로모션입니다.' });
    if (promo.max_uses && promo.used_count >= promo.max_uses) return res.status(400).json({ error: '사용 한도를 초과했습니다.' });

    const academy = await getOne('SELECT * FROM academies WHERE id = ?', [academy_id]);
    if (!academy) return res.status(404).json({ error: '학원을 찾을 수 없습니다.' });

    const value = typeof promo.value === 'string' ? JSON.parse(promo.value) : promo.value;

    // 프로모션 타입별 즉시 적용
    let appliedMessage = '';
    let grantExpires = null;
    switch (promo.type) {
      case 'free_month': {
        const months = value.months || 1;
        const sub = await getOne("SELECT * FROM subscriptions WHERE academy_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [academy_id]);
        if (sub) {
          const newExpiry = new Date(sub.expires_at || Date.now());
          newExpiry.setMonth(newExpiry.getMonth() + months);
          await runQuery('UPDATE subscriptions SET expires_at = ? WHERE id = ?', [newExpiry.toISOString(), sub.id]);
        }
        appliedMessage = `${months}개월 무료 이용권이 적용되었습니다.`;
        break;
      }
      case 'tier_upgrade': {
        const days = value.days || 30;
        grantExpires = new Date(Date.now() + days * 86400000).toISOString();
        await runQuery('UPDATE academies SET subscription_tier = ?, max_students = ? WHERE id = ?',
          [value.tier, TIER_LIMITS[value.tier]?.maxStudents || 9999, academy_id]);
        appliedMessage = `${TIER_LIMITS[value.tier] ? value.tier : 'pro'} 티어로 ${days}일간 업그레이드되었습니다.`;
        break;
      }
      case 'sms_credits': {
        const amount = value.amount || 0;
        const existing = await getOne('SELECT * FROM sms_credits WHERE academy_id = ?', [academy_id]);
        if (existing) {
          await runQuery('UPDATE sms_credits SET balance = balance + ? WHERE academy_id = ?', [amount, academy_id]);
        } else {
          await runInsert('INSERT INTO sms_credits (academy_id, balance) VALUES (?, ?)', [academy_id, amount]);
        }
        appliedMessage = `SMS 크레딧 ${amount}건이 충전되었습니다.`;
        break;
      }
      case 'discount_coupon': {
        appliedMessage = `${value.percent || 0}% 할인 쿠폰이 지급되었습니다.`;
        break;
      }
      case 'trial_extension': {
        const days = value.days || 14;
        const sub = await getOne("SELECT * FROM subscriptions WHERE academy_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [academy_id]);
        if (sub) {
          const newExpiry = new Date(sub.expires_at || Date.now());
          newExpiry.setDate(newExpiry.getDate() + days);
          await runQuery('UPDATE subscriptions SET expires_at = ? WHERE id = ?', [newExpiry.toISOString(), sub.id]);
        }
        appliedMessage = `체험 기간이 ${days}일 연장되었습니다.`;
        break;
      }
      case 'feature_unlock': {
        const days = value.days || 30;
        grantExpires = new Date(Date.now() + days * 86400000).toISOString();
        appliedMessage = `${(value.features || []).join(', ')} 기능이 ${days}일간 해제되었습니다.`;
        break;
      }
    }

    // 지급 기록 생성
    const grantId = await runInsert(
      'INSERT INTO promotion_grants (promotion_id, academy_id, granted_by, status, applied_at, expires_at, note) VALUES (?, ?, ?, ?, NOW(), ?, ?)',
      [promoId, academy_id, req.user.id, 'applied', grantExpires, note || null]
    );

    // 사용 횟수 증가
    await runQuery('UPDATE promotions SET used_count = used_count + 1 WHERE id = ?', [promoId]);

    // 알림 발송
    await runInsert(
      'INSERT INTO platform_notifications (academy_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)',
      [academy_id, 'gift', `🎁 ${promo.name}`, appliedMessage, JSON.stringify({ promotion_id: promoId, grant_id: grantId })]
    );

    await logActivity(req.user.id, 'promotion_grant', 'academy', academy_id, { promotion: promo.name, type: promo.type });
    res.json({ message: `${academy.name}에 ${promo.name}이(가) 지급되었습니다.`, appliedMessage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 일괄 지급
router.post('/promotions/:id/grant-bulk', async (req, res) => {
  try {
    const promoId = parseInt(req.params.id);
    const { academy_ids, note } = req.body;
    if (!academy_ids?.length) return res.status(400).json({ error: '학원을 선택해주세요.' });

    let successCount = 0;
    const errors = [];
    for (const aid of academy_ids) {
      try {
        // 내부적으로 grant 로직 재사용 - 간단히 redirect 방식 대신 직접 호출
        const fakeReq = { ...req, params: { id: promoId.toString() }, body: { academy_id: aid, note } };
        const fakeRes = {
          json: () => { successCount++; },
          status: (code) => ({ json: (data) => { errors.push({ academy_id: aid, error: data.error }); } }),
        };
        // 대신 직접 grant 엔드포인트 로직을 간소화하여 처리
        const promo = await getOne('SELECT * FROM promotions WHERE id = ? AND is_active = 1', [promoId]);
        if (!promo) { errors.push({ academy_id: aid, error: '프로모션 없음' }); continue; }

        await runInsert(
          'INSERT INTO promotion_grants (promotion_id, academy_id, granted_by, status, applied_at, note) VALUES (?, ?, ?, ?, NOW(), ?)',
          [promoId, aid, req.user.id, 'applied', note || null]
        );
        await runInsert(
          'INSERT INTO platform_notifications (academy_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)',
          [aid, 'gift', `🎁 ${promo.name}`, `${promo.name}이(가) 지급되었습니다.`, JSON.stringify({ promotion_id: promoId })]
        );
        await runQuery('UPDATE promotions SET used_count = used_count + 1 WHERE id = ?', [promoId]);
        successCount++;
      } catch (e) {
        errors.push({ academy_id: aid, error: e.message });
      }
    }

    await logActivity(req.user.id, 'promotion_grant_bulk', 'promotion', promoId, { count: successCount });
    res.json({ message: `${successCount}개 학원에 지급 완료`, successCount, errors });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ======================== 매출 관리 ========================

router.get('/revenue/summary', async (req, res) => {
  try {
    const month = new Date().toISOString().slice(0, 7);

    const mrr = await getOne(
      `SELECT COALESCE(SUM(CASE
        WHEN subscription_tier = 'starter' THEN 49000
        WHEN subscription_tier = 'pro' THEN 129000
        WHEN subscription_tier = 'basic' THEN 49000
        WHEN subscription_tier IN ('standard', 'growth') THEN 129000
        ELSE 0
      END), 0) as total
      FROM academies WHERE is_active = 1 AND subscription_tier NOT IN ('free', 'trial', 'first_class', 'premium')`
    );

    const monthlyRevenue = await getOne(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'paid' AND to_char(paid_at, 'YYYY-MM') = ?",
      [month]
    );

    const failedCount = await getOne(
      "SELECT COUNT(*) as count FROM payments WHERE status = 'failed'"
    );

    const refundedTotal = await getOne(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'refunded'"
    );

    const revenueTrend = await getAll(
      `SELECT to_char(paid_at, 'YYYY-MM') as month, COALESCE(SUM(amount), 0) as total
       FROM payments WHERE status = 'paid' AND paid_at > NOW() - INTERVAL '6 months'
       GROUP BY to_char(paid_at, 'YYYY-MM') ORDER BY month ASC`
    );

    res.json({
      mrr: mrr?.total || 0,
      arr: (mrr?.total || 0) * 12,
      monthlyRevenue: monthlyRevenue?.total || 0,
      failedCount: failedCount?.count || 0,
      refundedTotal: refundedTotal?.total || 0,
      revenueTrend,
    });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

router.get('/revenue/payments', async (req, res) => {
  try {
    const { status, academy_id, page = 1 } = req.query;
    const limit = 30;
    const offset = (parseInt(page) - 1) * limit;

    let where = '1=1';
    const params = [];
    if (status) { params.push(status); where += ` AND p.status = $${params.length}`; }
    if (academy_id) { params.push(parseInt(academy_id)); where += ` AND p.academy_id = $${params.length}`; }

    const countResult = await getOne(`SELECT COUNT(*) as count FROM payments p WHERE ${where}`, params);
    params.push(limit, offset);
    const payments = await getAll(
      `SELECT p.*, a.name as academy_name, a.slug as academy_slug
       FROM payments p
       LEFT JOIN academies a ON a.id = p.academy_id
       WHERE ${where}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ payments, total: countResult?.count || 0, page: parseInt(page), totalPages: Math.ceil((countResult?.count || 0) / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ======================== 알림 API (학원 admin용) ========================

// 이건 superadmin 전용이 아니라 일반 admin도 접근 가능해야 함 - 별도로 export
// 하지만 편의상 여기서 정의하고, server.js에서 별도 등록

// ======================== 학원 메모 ========================

router.get('/academies/:id/memos', async (req, res) => {
  try {
    const memos = await getAll(
      `SELECT m.*, u.name as author_name
       FROM academy_memos m
       LEFT JOIN users u ON u.id = m.author_id
       WHERE m.academy_id = ?
       ORDER BY m.created_at DESC`,
      [parseInt(req.params.id)]
    );
    res.json(memos);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

router.post('/academies/:id/memos', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: '내용을 입력해주세요.' });
    await runInsert(
      'INSERT INTO academy_memos (academy_id, author_id, content) VALUES (?, ?, ?)',
      [parseInt(req.params.id), req.user.id, content.trim()]
    );
    res.json({ message: '메모가 저장되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

router.delete('/memos/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM academy_memos WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ message: '메모가 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 기본 데이터 시드 함수
async function seedAcademyDefaults(academyId) {
  // 캐릭터
  const characters = [
    ['기본 캐릭터', '🐣', '처음 시작하는 모험가', 1],
    ['책벌레', '📚', '지식을 탐구하는 학자', 5],
    ['마법사', '🧙', '언어의 마법을 부리는 자', 10],
    ['기사', '⚔️', '국어 실력으로 무장한 전사', 15],
    ['현자', '🦉', '깊은 지혜를 가진 현인', 20],
    ['용사', '🐉', '어떤 문제도 두렵지 않은 용사', 25],
    ['왕', '👑', '국어 왕국의 통치자', 30],
    ['전설', '🌟', '전설로 남을 국어의 신', 40],
  ];
  for (const [name, emoji, desc, level] of characters) {
    await runInsert(
      'INSERT INTO characters (name, emoji, description, unlock_level, academy_id) VALUES (?, ?, ?, ?, ?)',
      [name, emoji, desc, level, academyId]
    );
  }

  // 칭호
  const titles = [
    ['새싹 학습자', '첫 발을 내딛은 학습자', 'xp_total', 100, '🌱'],
    ['성실한 학생', 'XP 1000 달성', 'xp_total', 1000, '📖'],
    ['퀴즈 도전자', '퀴즈 10회 도전', 'quiz_count', 10, '🎯'],
    ['퀴즈 마스터', '퀴즈 50회 도전', 'quiz_count', 50, '🏆'],
    ['코드 헌터', '히든 코드 3개 입력', 'code_count', 3, '🔍'],
    ['코드 수집가', '히든 코드 10개 입력', 'code_count', 10, '💎'],
    ['레벨 5 달성', '레벨 5에 도달', 'level', 5, '⭐'],
    ['레벨 10 달성', '레벨 10에 도달', 'level', 10, '🌟'],
    ['레벨 20 달성', '레벨 20에 도달', 'level', 20, '💫'],
    ['레벨 30 달성', '레벨 30에 도달', 'level', 30, '👑'],
    ['첫 구매', '상점에서 첫 구매', 'manual', 0, '🛒'],
    ['VIP', '관리자가 직접 부여', 'manual', 0, '💖'],
  ];
  for (const [name, desc, condType, condVal, icon] of titles) {
    await runInsert(
      'INSERT INTO titles (name, description, condition_type, condition_value, icon, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, desc, condType, condVal, icon, academyId]
    );
  }
}

// ─────────────────────────────────────────────
// 백업 & 보안 관리 (SuperAdmin)
// ─────────────────────────────────────────────

// GET /backups — 플랫폼 전체 백업 목록
router.get('/backups', async (req, res) => {
  try {
    // db_backups 테이블이 있으면 사용, 없으면 빈 배열
    try {
      const rows = await getAll(
        `SELECT id, backup_name, backup_type, file_size, created_at
         FROM db_backups ORDER BY created_at DESC LIMIT 50`,
        []
      );
      res.json(rows || []);
    } catch {
      res.json([]);
    }
  } catch (err) {
    console.error('[superadmin/backups GET]', err);
    res.status(500).json({ error: '백업 목록 조회 실패' });
  }
});

// GET /security — 보안 대시보드 (차단 사용자, 정지 학원)
router.get('/security', async (req, res) => {
  try {
    const [blockedUsers, suspendedAcademies] = await Promise.all([
      getAll(
        `SELECT u.id, u.username, u.name, u.role, u.phone, u.academy_id, a.name as academy_name
         FROM users u LEFT JOIN academies a ON a.id = u.academy_id
         WHERE u.approved = false
         ORDER BY u.id DESC LIMIT 100`,
        []
      ).catch(() => []),
      getAll(
        `SELECT id, name, slug, subscription_tier, is_active
         FROM academies WHERE is_active = false
         ORDER BY id DESC LIMIT 100`,
        []
      ).catch(() => []),
    ]);
    res.json({
      blockedUsers: blockedUsers || [],
      suspendedAcademies: suspendedAcademies || [],
    });
  } catch (err) {
    console.error('[superadmin/security GET]', err);
    res.status(500).json({ error: '보안 정보 조회 실패' });
  }
});

// POST /backup — 수동 플랫폼 전체 백업 실행
router.post('/backup', async (req, res) => {
  try {
    // db_backups 테이블에 레코드 추가 (실제 백업은 외부 스크립트 또는 Supabase 자동 백업)
    const backupName = `manual_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    try {
      await runInsert(
        `INSERT INTO db_backups (backup_name, backup_type, file_size, created_at)
         VALUES (?, 'manual', 0, NOW())`,
        [backupName]
      );
    } catch {}

    // 주요 테이블의 현재 행 수 수집
    const tables = ['academies', 'users', 'students', 'classes', 'tuition_records', 'attendance'];
    const rowCounts = {};
    for (const t of tables) {
      try {
        const r = await getOne(`SELECT COUNT(*)::int as n FROM ${t}`, []);
        rowCounts[t] = r?.n || 0;
      } catch {
        rowCounts[t] = 0;
      }
    }

    res.json({
      ok: true,
      backupName,
      tableCount: tables.length,
      rowCounts,
      note: '실제 데이터 백업은 Supabase 자동 백업으로 보관됩니다.',
    });
  } catch (err) {
    console.error('[superadmin/backup POST]', err);
    res.status(500).json({ error: '백업 실행 실패' });
  }
});

// DELETE /backups/:id — 백업 삭제
router.delete('/backups/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM db_backups WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[superadmin/backups DELETE]', err);
    res.status(500).json({ error: '백업 삭제 실패' });
  }
});

// GET /backups/:id/download — 백업 다운로드 (메타데이터 JSON)
router.get('/backups/:id/download', async (req, res) => {
  try {
    const row = await getOne('SELECT * FROM db_backups WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: '백업을 찾을 수 없습니다.' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="backup-${row.id}.json"`);
    res.send(JSON.stringify(row, null, 2));
  } catch (err) {
    console.error('[superadmin/backups download]', err);
    res.status(500).json({ error: '다운로드 실패' });
  }
});

// PUT /users/:id/block — 사용자 차단/해제
router.put('/users/:id/block', async (req, res) => {
  try {
    const { blocked } = req.body || {};
    // approved 플래그를 토글 (차단 = approved=false)
    await runQuery(
      'UPDATE users SET approved = ? WHERE id = ?',
      [!blocked, req.params.id]
    );
    res.json({ ok: true, blocked: !!blocked });
  } catch (err) {
    console.error('[superadmin/users block]', err);
    res.status(500).json({ error: '사용자 차단 처리 실패' });
  }
});

// POST /tenants/:id/suspend — 학원 정지
router.post('/tenants/:id/suspend', async (req, res) => {
  try {
    await runQuery('UPDATE academies SET is_active = false WHERE id = ?', [req.params.id]);
    res.json({ ok: true, suspended: true });
  } catch (err) {
    console.error('[superadmin/tenants suspend]', err);
    res.status(500).json({ error: '학원 정지 실패' });
  }
});

// POST /tenants/:id/unsuspend — 학원 정지 해제
router.post('/tenants/:id/unsuspend', async (req, res) => {
  try {
    await runQuery('UPDATE academies SET is_active = true WHERE id = ?', [req.params.id]);
    res.json({ ok: true, suspended: false });
  } catch (err) {
    console.error('[superadmin/tenants unsuspend]', err);
    res.status(500).json({ error: '학원 정지 해제 실패' });
  }
});

// ======================== 사용 현황 분석 ========================

// 전체 학원 사용 현황 요약
router.get('/analytics/overview', async (req, res) => {
  try {
    const academyStats = await getAll(`
      SELECT
        a.id, a.name, a.slug, a.subscription_tier, a.is_active,
        (SELECT COUNT(DISTINCT pv.user_id) FROM page_views pv
         WHERE pv.academy_id = a.id AND pv.created_at >= NOW() - INTERVAL '7 days') as active_users_7d,
        (SELECT COUNT(*) FROM page_views pv
         WHERE pv.academy_id = a.id AND pv.created_at >= NOW() - INTERVAL '30 days') as page_views_30d,
        (SELECT COUNT(*) FROM users WHERE academy_id = a.id AND role = 'student') as total_students,
        (SELECT COUNT(*) FROM users WHERE academy_id = a.id) as total_users,
        (SELECT COALESCE(AVG(pv.duration_seconds), 0)::int FROM page_views pv
         WHERE pv.academy_id = a.id AND pv.created_at >= NOW() - INTERVAL '30 days' AND pv.duration_seconds > 0) as avg_duration_30d
      FROM academies a
      ORDER BY page_views_30d DESC
    `, []);

    res.json(academyStats || []);
  } catch (err) {
    console.error('[analytics overview]', err);
    res.status(500).json({ error: '분석 데이터 조회 실패' });
  }
});

// 특정 학원 상세 분석
router.get('/analytics/academy/:id', async (req, res) => {
  try {
    const aid = parseInt(req.params.id);

    // 1. 일별 접속 추이 (최근 30일)
    const dailyTrend = await getAll(`
      SELECT DATE(created_at) as date,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as page_views
      FROM page_views
      WHERE academy_id = ? AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [aid]);

    // 2. 기능별 사용 현황 (Top 10)
    const featureUsage = await getAll(`
      SELECT feature_name,
        COUNT(*) as view_count,
        COUNT(DISTINCT user_id) as unique_users,
        COALESCE(AVG(duration_seconds), 0)::int as avg_duration
      FROM page_views
      WHERE academy_id = ? AND feature_name IS NOT NULL
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY feature_name
      ORDER BY view_count DESC
      LIMIT 10
    `, [aid]);

    // 3. 사용자별 활동 (Top 10)
    const userActivity = await getAll(`
      SELECT u.name, u.role,
        COUNT(*) as page_views,
        MAX(pv.created_at) as last_active,
        COALESCE(AVG(pv.duration_seconds), 0)::int as avg_duration
      FROM page_views pv
      JOIN users u ON u.id = pv.user_id
      WHERE pv.academy_id = ? AND pv.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY u.id, u.name, u.role
      ORDER BY page_views DESC
      LIMIT 10
    `, [aid]);

    // 4. 접속률 (최근 7일 내 로그인 사용자 / 전체 사용자)
    const totalUsers = await getOne(
      'SELECT COUNT(*)::int as n FROM users WHERE academy_id = ?', [aid]
    );
    const activeUsers = await getOne(`
      SELECT COUNT(DISTINCT user_id)::int as n FROM page_views
      WHERE academy_id = ? AND created_at >= NOW() - INTERVAL '7 days'
    `, [aid]);

    const accessRate = totalUsers?.n > 0
      ? Math.round((activeUsers?.n || 0) / totalUsers.n * 100)
      : 0;

    // 5. 총 접속 누계
    const totalLogins = await getOne(`
      SELECT COUNT(DISTINCT (user_id || '-' || DATE(created_at)))::int as n
      FROM page_views WHERE academy_id = ?
    `, [aid]);

    res.json({
      daily_trend: dailyTrend || [],
      feature_usage: featureUsage || [],
      user_activity: userActivity || [],
      access_rate: accessRate,
      total_logins: totalLogins?.n || 0,
      total_users: totalUsers?.n || 0,
      active_users_7d: activeUsers?.n || 0,
    });
  } catch (err) {
    console.error('[analytics academy]', err);
    res.status(500).json({ error: '분석 데이터 조회 실패' });
  }
});

module.exports = router;
