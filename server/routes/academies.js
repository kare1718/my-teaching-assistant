const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

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
