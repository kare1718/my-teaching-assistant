/**
 * KPI API 라우트 (SuperAdmin 전용)
 *
 * GET /api/kpi/north-star?from=&to=
 * GET /api/kpi/funnel?from=&to=
 * GET /api/kpi/feature-usage
 * GET /api/kpi/warnings
 * GET /api/kpi/plans
 * GET /api/kpi/cohort?month=YYYY-MM
 * GET /api/kpi/recent
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');
const kpi = require('../services/kpi');

router.use(authenticateToken, requireSuperAdmin);

router.get('/north-star', async (req, res) => {
  try { res.json(await kpi.getNorthStarMetrics(req.query.from, req.query.to)); }
  catch (e) { console.error('[kpi/north-star]', e.message); res.status(500).json({ error: e.message }); }
});

router.get('/funnel', async (req, res) => {
  try { res.json(await kpi.getFunnel(req.query.from, req.query.to)); }
  catch (e) { console.error('[kpi/funnel]', e.message); res.status(500).json({ error: e.message }); }
});

router.get('/feature-usage', async (req, res) => {
  try { res.json(await kpi.getFeatureUsage()); }
  catch (e) { console.error('[kpi/feature]', e.message); res.status(500).json({ error: e.message }); }
});

router.get('/warnings', async (req, res) => {
  try { res.json(await kpi.getWarnings()); }
  catch (e) { console.error('[kpi/warnings]', e.message); res.status(500).json({ error: e.message }); }
});

router.get('/plans', async (req, res) => {
  try { res.json(await kpi.getPlansDistribution()); }
  catch (e) { console.error('[kpi/plans]', e.message); res.status(500).json({ error: e.message }); }
});

router.get('/cohort', async (req, res) => {
  try { res.json(await kpi.getCohort(req.query.month)); }
  catch (e) { console.error('[kpi/cohort]', e.message); res.status(500).json({ error: e.message }); }
});

router.get('/recent', async (req, res) => {
  try { res.json(await kpi.getRecentEvents(Number(req.query.limit) || 10)); }
  catch (e) { console.error('[kpi/recent]', e.message); res.status(500).json({ error: e.message }); }
});

module.exports = router;
