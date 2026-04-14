const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

function genGroupId() {
  return 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// 수업 일정 목록
router.get('/', async (req, res) => {
  const { month, year } = req.query;
  let where = '';
  const params = [];

  if (year && month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = parseInt(month) + 1;
    const endDate = endMonth > 12
      ? `${parseInt(year) + 1}-01-01`
      : `${year}-${String(endMonth).padStart(2, '0')}-01`;
    where = 'WHERE schedule_date >= ? AND schedule_date < ? AND academy_id = ?';
    params.push(startDate, endDate, req.academyId);
  } else {
    where = 'WHERE academy_id = ?';
    params.push(req.academyId);
  }

  const schedules = await getAll(
    `SELECT * FROM class_schedules /* academy_id 필터는 where 변수에 포함됨 */ ${where} ORDER BY schedule_date ASC, time_slot ASC`,
    params
  );
  res.json(schedules);
});

// 다가오는 일정 (대시보드용)
router.get('/upcoming', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const schedules = await getAll(
    `SELECT * FROM class_schedules WHERE schedule_date >= ? AND status = 'active' AND academy_id = ? ORDER BY schedule_date ASC, time_slot ASC LIMIT 10`,
    [today, req.academyId]
  );
  res.json(schedules);
});

// 주간 일정 (대시보드 주간 뷰용)
router.get('/week', async (req, res) => {
  const { date } = req.query;
  const base = date ? new Date(date + 'T00:00:00') : new Date();
  const day = base.getDay();
  const monday = new Date(base);
  monday.setDate(base.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const schedules = await getAll(
    'SELECT * FROM class_schedules WHERE schedule_date >= ? AND schedule_date <= ? AND academy_id = ? ORDER BY schedule_date ASC, time_slot ASC',
    [fmt(monday), fmt(sunday), req.academyId]
  );
  res.json({ schedules, weekStart: fmt(monday), weekEnd: fmt(sunday) });
});

// 수업 일정 추가
router.post('/', requireAdmin, async (req, res) => {
  const { title, schedule_date, time_slot, target_school, target_grade, detail, color } = req.body;
  if (!title || !schedule_date) {
    return res.status(400).json({ error: '제목과 날짜를 입력해주세요.' });
  }
  const id = await runInsert(
    'INSERT INTO class_schedules (title, schedule_date, time_slot, target_school, target_grade, detail, color, status, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [title, schedule_date, time_slot || null, target_school || null, target_grade || null, (detail || '').trim(), color || '#3b82f6', 'active', req.academyId]
  );
  res.json({ message: '수업 일정이 추가되었습니다.', id });
});

// 수업 일정 수정
router.put('/:id', requireAdmin, async (req, res) => {
  const { title, schedule_date, time_slot, target_school, target_grade, detail, color } = req.body;
  await runQuery(
    'UPDATE class_schedules SET title = ?, schedule_date = ?, time_slot = ?, target_school = ?, target_grade = ?, detail = ?, color = ? WHERE id = ? AND academy_id = ?',
    [title, schedule_date, time_slot || null, target_school || null, target_grade || null, (detail || '').trim(), color || '#3b82f6', req.params.id, req.academyId]
  );
  res.json({ message: '수업 일정이 수정되었습니다.' });
});

// 휴강 토글
router.put('/:id/toggle-cancel', requireAdmin, async (req, res) => {
  const schedule = await getOne('SELECT * FROM class_schedules WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  if (!schedule) return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
  const newStatus = schedule.status === 'cancelled' ? 'active' : 'cancelled';
  await runQuery('UPDATE class_schedules SET status = ? WHERE id = ? AND academy_id = ?', [newStatus, req.params.id, req.academyId]);
  res.json({ message: newStatus === 'cancelled' ? '휴강 처리되었습니다.' : '휴강이 취소되었습니다.', status: newStatus });
});

// 주간 반복 일정 추가 (N주 반복)
router.post('/repeat', requireAdmin, async (req, res) => {
  const { title, schedule_date, time_slot, target_school, target_grade, detail, color, repeat_weeks } = req.body;
  if (!title || !schedule_date || !repeat_weeks || repeat_weeks < 1) {
    return res.status(400).json({ error: '제목, 날짜, 반복 횟수를 입력해주세요.' });
  }
  const groupId = genGroupId();
  const ids = [];
  const startDate = new Date(schedule_date + 'T00:00:00');
  for (let i = 0; i < repeat_weeks; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + (i * 7));
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const id = await runInsert(
      'INSERT INTO class_schedules (title, schedule_date, time_slot, target_school, target_grade, detail, color, group_id, status, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, dateStr, time_slot || null, target_school || null, target_grade || null, (detail || '').trim(), color || '#3b82f6', groupId, 'active', req.academyId]
    );
    ids.push(id);
  }
  res.json({ message: `${repeat_weeks}주 반복 일정이 추가되었습니다.`, ids, groupId });
});

// 매주 무한 반복 (1년 = 52주 생성)
router.post('/repeat-forever', requireAdmin, async (req, res) => {
  const { title, schedule_date, time_slot, target_school, target_grade, detail, color } = req.body;
  if (!title || !schedule_date) {
    return res.status(400).json({ error: '제목과 날짜를 입력해주세요.' });
  }
  const WEEKS = 52;
  const groupId = genGroupId();
  const ids = [];
  const startDate = new Date(schedule_date + 'T00:00:00');
  for (let i = 0; i < WEEKS; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + (i * 7));
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const id = await runInsert(
      'INSERT INTO class_schedules (title, schedule_date, time_slot, target_school, target_grade, detail, color, group_id, status, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, dateStr, time_slot || null, target_school || null, target_grade || null, (detail || '').trim(), color || '#3b82f6', groupId, 'active', req.academyId]
    );
    ids.push(id);
  }
  res.json({ message: `매주 반복 일정이 1년(${WEEKS}주) 추가되었습니다.`, ids, count: WEEKS, groupId });
});

// 기존 일정에 반복 추가 (N주)
router.post('/:id/make-repeat', requireAdmin, async (req, res) => {
  const { repeat_weeks } = req.body;
  const schedule = await getOne('SELECT * FROM class_schedules WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  if (!schedule) return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
  if (!repeat_weeks || repeat_weeks < 1) return res.status(400).json({ error: '반복 횟수를 입력해주세요.' });

  const groupId = schedule.group_id || genGroupId();
  // 원본에 group_id 부여
  if (!schedule.group_id) {
    await runQuery('UPDATE class_schedules SET group_id = ? WHERE id = ? AND academy_id = ?', [groupId, schedule.id, req.academyId]);
  }

  const ids = [];
  const startDate = new Date(schedule.schedule_date + 'T00:00:00');
  for (let i = 1; i <= repeat_weeks; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + (i * 7));
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const id = await runInsert(
      'INSERT INTO class_schedules (title, schedule_date, time_slot, target_school, target_grade, detail, color, group_id, status, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [schedule.title, dateStr, schedule.time_slot, schedule.target_school, schedule.target_grade, schedule.detail || '', schedule.color || '#3b82f6', groupId, 'active', req.academyId]
    );
    ids.push(id);
  }
  res.json({ message: `${repeat_weeks}주 반복이 추가되었습니다.`, ids, groupId });
});

// 기존 일정에 매주 반복 추가 (52주)
router.post('/:id/make-repeat-forever', requireAdmin, async (req, res) => {
  const schedule = await getOne('SELECT * FROM class_schedules WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  if (!schedule) return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });

  const WEEKS = 52;
  const groupId = schedule.group_id || genGroupId();
  if (!schedule.group_id) {
    await runQuery('UPDATE class_schedules SET group_id = ? WHERE id = ? AND academy_id = ?', [groupId, schedule.id, req.academyId]);
  }

  const ids = [];
  const startDate = new Date(schedule.schedule_date + 'T00:00:00');
  for (let i = 1; i <= WEEKS; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + (i * 7));
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const id = await runInsert(
      'INSERT INTO class_schedules (title, schedule_date, time_slot, target_school, target_grade, detail, color, group_id, status, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [schedule.title, dateStr, schedule.time_slot, schedule.target_school, schedule.target_grade, schedule.detail || '', schedule.color || '#3b82f6', groupId, 'active', req.academyId]
    );
    ids.push(id);
  }
  res.json({ message: `매주 반복 ${WEEKS}주가 추가되었습니다.`, ids, count: WEEKS, groupId });
});

// 그룹 일괄 삭제 (반복 일정 전체 삭제)
router.delete('/group/:groupId', requireAdmin, async (req, res) => {
  const { future_only } = req.query;
  const groupId = req.params.groupId;
  if (future_only === 'true') {
    const today = new Date().toISOString().split('T')[0];
    const result = await getAll('SELECT id FROM class_schedules WHERE group_id = ? AND schedule_date >= ? AND academy_id = ?', [groupId, today, req.academyId]);
    await runQuery('DELETE FROM class_schedules WHERE group_id = ? AND schedule_date >= ? AND academy_id = ?', [groupId, today, req.academyId]);
    res.json({ message: `이후 반복 일정 ${result.length}개가 삭제되었습니다.`, count: result.length });
  } else {
    const result = await getAll('SELECT id FROM class_schedules WHERE group_id = ? AND academy_id = ?', [groupId, req.academyId]);
    await runQuery('DELETE FROM class_schedules WHERE group_id = ? AND academy_id = ?', [groupId, req.academyId]);
    res.json({ message: `반복 일정 ${result.length}개가 모두 삭제되었습니다.`, count: result.length });
  }
});

// 수업 일정 삭제
router.delete('/:id', requireAdmin, async (req, res) => {
  await runQuery('DELETE FROM class_schedules WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  res.json({ message: '수업 일정이 삭제되었습니다.' });
});

module.exports = router;
