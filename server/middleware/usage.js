const { runQuery } = require('../db/database');

// 사용량 추적 미들웨어
async function trackUsage(academyId, usageType) {
  if (!academyId) return;
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  try {
    const { getOne } = require('../db/database');
    const existing = await getOne(
      'SELECT id, count FROM usage_logs WHERE academy_id = ? AND usage_type = ? AND month = ?',
      [academyId, usageType, month]
    );
    if (existing) {
      await runQuery('UPDATE usage_logs SET count = count + 1 WHERE id = ?', [existing.id]);
    } else {
      await runQuery(
        'INSERT INTO usage_logs (academy_id, usage_type, count, month) VALUES (?, ?, 1, ?)',
        [academyId, usageType, month]
      );
    }
  } catch (err) {
    console.error('Usage tracking error:', err.message);
  }
}

module.exports = { trackUsage };
