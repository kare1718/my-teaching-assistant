const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logAction } = require('../services/audit');
const { generateUniqueStudentCode, generateUniqueParentCode } = require('../utils/inviteCode');

const router = express.Router();

// ── 초대 코드 관리 ─────────────────────────────────────────
// GET /api/academies/invite-codes — 현재 학원의 학생/학부모 초대 코드 조회
router.get('/invite-codes', authenticateToken, async (req, res) => {
  try {
    if (!req.academyId) return res.status(403).json({ error: '학원 정보가 없습니다.' });
    let academy = await getOne(
      'SELECT student_invite_code, parent_invite_code FROM academies WHERE id = ?',
      [req.academyId]
    );
    if (!academy) return res.status(404).json({ error: '학원을 찾을 수 없습니다.' });

    // 코드가 아직 없으면 lazy 발급 (최초 요청 시 자동 생성)
    const updates = {};
    if (!academy.student_invite_code) {
      updates.student_invite_code = await generateUniqueStudentCode();
    }
    if (!academy.parent_invite_code) {
      updates.parent_invite_code = await generateUniqueParentCode();
    }
    if (Object.keys(updates).length > 0) {
      const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = Object.values(updates);
      await runQuery(
        `UPDATE academies SET ${sets} WHERE id = ?`,
        [...values, req.academyId]
      );
      academy = { ...academy, ...updates };
    }

    res.json({
      student_invite_code: academy.student_invite_code,
      parent_invite_code: academy.parent_invite_code,
    });
  } catch (err) {
    console.error('[invite-codes GET]', err);
    res.status(500).json({ error: '초대 코드 조회 실패' });
  }
});

// POST /api/academies/invite-codes/regenerate — 초대 코드 재발급 (admin 전용)
router.post('/invite-codes/regenerate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!req.academyId) return res.status(403).json({ error: '학원 정보가 없습니다.' });
    const { type } = req.body || {};
    if (!['student', 'parent', 'both'].includes(type)) {
      return res.status(400).json({ error: 'type 은 student, parent, both 중 하나여야 합니다.' });
    }
    const updates = {};
    if (type === 'student' || type === 'both') {
      updates.student_invite_code = await generateUniqueStudentCode();
    }
    if (type === 'parent' || type === 'both') {
      updates.parent_invite_code = await generateUniqueParentCode();
    }

    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    await runQuery(
      `UPDATE academies SET ${sets} WHERE id = ?`,
      [...values, req.academyId]
    );

    try {
      await logAction({
        req, action: 'invite_code_regenerate', resourceType: 'academy',
        resourceId: req.academyId, after: updates,
      });
    } catch (_) { /* ignore audit failure */ }

    res.json(updates);
  } catch (err) {
    console.error('[invite-codes regenerate]', err);
    res.status(500).json({ error: '코드 재발급 실패' });
  }
});

// 공개 API — 학원 설정 조회 (가입 페이지용)
router.get('/config', async (req, res) => {
  try {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: '학원 slug가 필요합니다.' });

    const academy = await getOne(
      'SELECT id, name, slug, settings, subscription_tier FROM academies WHERE slug = ? AND is_active = 1',
      [slug]
    );
    if (!academy) return res.status(404).json({ error: '학원을 찾을 수 없습니다.' });

    const settings = typeof academy.settings === 'string' ? JSON.parse(academy.settings) : (academy.settings || {});

    res.json({
      id: academy.id,
      name: academy.name,
      slug: academy.slug,
      schools: settings.schools || [],
      examTypes: settings.examTypes || [],
      siteTitle: settings.siteTitle || academy.name,
      mainTitle: settings.mainTitle || '',
      branding: settings.branding || {},
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 내 학원 설정 조회 (인증 필요)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    if (!req.academyId) return res.status(400).json({ error: '학원 정보가 없습니다.' });

    const academy = await getOne(
      'SELECT * FROM academies WHERE id = ?',
      [req.academyId]
    );
    if (!academy) return res.status(404).json({ error: '학원을 찾을 수 없습니다.' });

    const settings = typeof academy.settings === 'string' ? JSON.parse(academy.settings) : (academy.settings || {});
    academy.settings = settings;

    res.json(academy);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 학원 설정 수정 (관리자)
router.put('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!req.academyId) return res.status(400).json({ error: '학원 정보가 없습니다.' });

    const { schools, examTypes, siteTitle, mainTitle, branding, academyInfo, rolePermissions, customRoles } = req.body;

    const academy = await getOne('SELECT settings FROM academies WHERE id = ?', [req.academyId]);
    if (!academy) return res.status(404).json({ error: '학원을 찾을 수 없습니다.' });

    const current = typeof academy.settings === 'string' ? JSON.parse(academy.settings) : (academy.settings || {});

    if (schools !== undefined) current.schools = schools;
    if (examTypes !== undefined) current.examTypes = examTypes;
    if (siteTitle !== undefined) current.siteTitle = siteTitle;
    if (mainTitle !== undefined) current.mainTitle = mainTitle;
    if (branding !== undefined) current.branding = { ...current.branding, ...branding };
    if (academyInfo !== undefined) current.academyInfo = academyInfo;
    if (rolePermissions !== undefined) current.rolePermissions = rolePermissions;
    if (customRoles !== undefined) current.customRoles = customRoles;

    await runQuery('UPDATE academies SET settings = ? WHERE id = ?', [JSON.stringify(current), req.academyId]);

    await logAction({
      req, action: 'academy_settings_update', resourceType: 'academy', resourceId: req.academyId,
      before: (typeof academy.settings === 'string' ? JSON.parse(academy.settings) : (academy.settings || {})),
      after: current,
    });
    res.json({ message: '설정이 저장되었습니다.', settings: current });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 학원 이름 수정
router.put('/name', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '학원 이름을 입력해주세요.' });
    await runQuery('UPDATE academies SET name = ? WHERE id = ?', [name, req.academyId]);
    res.json({ message: '학원 이름이 변경되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
