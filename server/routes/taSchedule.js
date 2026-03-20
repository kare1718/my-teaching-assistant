const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// ========== 조교 명단 ==========

router.get('/members', async (req, res) => {
  const members = await getAll('SELECT * FROM ta_members WHERE academy_id = ? ORDER BY is_active DESC, name ASC', [req.academyId]);
  res.json(members);
});

router.post('/members', async (req, res) => {
  const { name, phone, role_desc } = req.body;
  if (!name) return res.status(400).json({ error: '이름은 필수입니다.' });
  const id = await runInsert(
    'INSERT INTO ta_members (name, phone, role_desc, academy_id) VALUES (?, ?, ?, ?)',
    [name.trim(), (phone || '').trim(), (role_desc || '').trim(), req.academyId]
  );
  res.json({ message: '조교가 등록되었습니다.', id });
});

router.put('/members/:id', async (req, res) => {
  const { name, phone, role_desc, is_active } = req.body;
  await runQuery(
    'UPDATE ta_members SET name = ?, phone = ?, role_desc = ?, is_active = ? WHERE id = ? AND academy_id = ?',
    [name.trim(), (phone || '').trim(), (role_desc || '').trim(), is_active !== undefined ? (is_active ? 1 : 0) : 1, req.params.id, req.academyId]
  );
  res.json({ message: '수정되었습니다.' });
});

router.delete('/members/:id', async (req, res) => {
  await runQuery('DELETE FROM ta_work_logs WHERE ta_member_id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  await runQuery('DELETE FROM ta_members WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  res.json({ message: '삭제되었습니다.' });
});

// ========== 근무 기록 ==========

router.get('/work-logs', async (req, res) => {
  const { year, month } = req.query;
  let where = 'WHERE wl.academy_id = ?';
  const params = [req.academyId];
  if (year && month) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = parseInt(month) + 1;
    const end = endMonth > 12
      ? `${parseInt(year) + 1}-01-01`
      : `${year}-${String(endMonth).padStart(2, '0')}-01`;
    where += ' AND wl.work_date >= ? AND wl.work_date < ?';
    params.push(start, end);
  }
  const logs = await getAll(
    `SELECT wl.*, tm.name as ta_name
     FROM ta_work_logs wl
     JOIN ta_members tm ON wl.ta_member_id = tm.id
     ${where}
     ORDER BY wl.work_date ASC, wl.check_in ASC`,
    params
  );
  res.json(logs);
});

router.post('/work-logs', async (req, res) => {
  const { ta_member_id, work_date, check_in, check_out, hours, is_substitute, substitute_for, memo } = req.body;
  if (!ta_member_id || !work_date) return res.status(400).json({ error: '조교와 날짜는 필수입니다.' });

  // 근무시간 자동 계산
  let calcHours = hours || 0;
  if (check_in && check_out && !hours) {
    const [inH, inM] = check_in.split(':').map(Number);
    const [outH, outM] = check_out.split(':').map(Number);
    calcHours = Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 10) / 10;
  }

  const id = await runInsert(
    `INSERT INTO ta_work_logs (ta_member_id, work_date, check_in, check_out, hours, is_substitute, substitute_for, memo, academy_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ta_member_id, work_date, check_in || '', check_out || '', calcHours,
     is_substitute ? 1 : 0, (substitute_for || '').trim(), (memo || '').trim(), req.academyId]
  );
  res.json({ message: '근무 기록이 추가되었습니다.', id });
});

router.put('/work-logs/:id', async (req, res) => {
  const { ta_member_id, work_date, check_in, check_out, hours, is_substitute, substitute_for, memo } = req.body;

  let calcHours = hours || 0;
  if (check_in && check_out && !hours) {
    const [inH, inM] = check_in.split(':').map(Number);
    const [outH, outM] = check_out.split(':').map(Number);
    calcHours = Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 10) / 10;
  }

  await runQuery(
    `UPDATE ta_work_logs SET ta_member_id = ?, work_date = ?, check_in = ?, check_out = ?,
     hours = ?, is_substitute = ?, substitute_for = ?, memo = ? WHERE id = ? AND academy_id = ?`,
    [ta_member_id, work_date, check_in || '', check_out || '', calcHours,
     is_substitute ? 1 : 0, (substitute_for || '').trim(), (memo || '').trim(), req.params.id, req.academyId]
  );
  res.json({ message: '수정되었습니다.' });
});

router.delete('/work-logs/:id', async (req, res) => {
  await runQuery('DELETE FROM ta_work_logs WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  res.json({ message: '삭제되었습니다.' });
});

// 월간 합산
router.get('/work-logs/summary', async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.json([]);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = parseInt(month) + 1;
  const end = endMonth > 12
    ? `${parseInt(year) + 1}-01-01`
    : `${year}-${String(endMonth).padStart(2, '0')}-01`;

  const summary = await getAll(
    `SELECT tm.id, tm.name, tm.role_desc,
            COALESCE(SUM(wl.hours), 0) as total_hours,
            COUNT(wl.id) as work_days
     FROM ta_members tm
     LEFT JOIN ta_work_logs wl ON wl.ta_member_id = tm.id AND wl.work_date >= ? AND wl.work_date < ? AND wl.academy_id = ?
     WHERE tm.is_active = 1 AND tm.academy_id = ?
     GROUP BY tm.id
     ORDER BY total_hours DESC`,
    [start, end, req.academyId, req.academyId]
  );
  res.json(summary);
});

// ========== 일괄 근무 생성 (월간 근무표 기반) ==========

router.post('/work-logs/bulk-generate', async (req, res) => {
  const { year, month } = req.body;
  if (!year || !month) return res.status(400).json({ error: '연도와 월을 입력해주세요.' });

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

  // 해당 월 근무표 로드
  const scheduleRows = await getAll(
    'SELECT * FROM ta_regular_schedule WHERE year_month = ? AND academy_id = ?',
    [yearMonth, req.academyId]
  );
  if (scheduleRows.length === 0) return res.status(400).json({ error: '해당 월의 근무표가 비어있습니다. 먼저 근무표를 설정해주세요.' });

  const scheduleMap = {};
  scheduleRows.forEach(s => {
    const key = `${s.day_of_week}_${s.time_slot}`;
    scheduleMap[key] = JSON.parse(s.ta_member_ids || '[]');
  });

  // 해당 월의 모든 날짜 순회
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  let insertedCount = 0;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const jsDay = d.getDay();
    const dbDay = jsDay === 0 ? 6 : jsDay - 1;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // 해당 요일에 배정된 조교 찾기
    const memberSlots = {};
    for (const slot of Object.keys(scheduleMap)) {
      const [slotDay, slotTime] = slot.split('_');
      if (parseInt(slotDay) === dbDay) {
        const memberIds = scheduleMap[slot];
        memberIds.forEach(id => {
          if (!memberSlots[id]) memberSlots[id] = [];
          memberSlots[id].push(slotTime);
        });
      }
    }

    // 각 조교별 근무 기록 생성 (중복 체크)
    for (const [memberIdStr, slots] of Object.entries(memberSlots)) {
      const memberId = parseInt(memberIdStr);
      slots.sort();
      const checkIn = slots[0];
      const lastSlot = slots[slots.length - 1];
      // 마지막 시간대 +30분 = 퇴근
      const [lastH, lastM] = lastSlot.split(':').map(Number);
      const endMin = lastH * 60 + lastM + 30;
      const checkOut = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      const [inH, inM] = checkIn.split(':').map(Number);
      const hours = Math.round((endMin - (inH * 60 + inM)) / 60 * 10) / 10;

      const existing = await getOne(
        'SELECT id FROM ta_work_logs WHERE ta_member_id = ? AND work_date = ? AND academy_id = ?',
        [memberId, dateStr, req.academyId]
      );
      if (!existing) {
        await runInsert(
          'INSERT INTO ta_work_logs (ta_member_id, work_date, check_in, check_out, hours, is_substitute, substitute_for, memo, academy_id) VALUES (?, ?, ?, ?, ?, 0, \'\', \'자동생성\', ?)',
          [memberId, dateStr, checkIn, checkOut, hours, req.academyId]
        );
        insertedCount++;
      }
    }
  }

  res.json({ message: `${insertedCount}건의 근무 기록이 생성되었습니다.`, count: insertedCount });
});

// ========== CSV 내보내기 ==========

router.get('/work-logs/export-csv', async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: '연도와 월을 입력해주세요.' });

  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = parseInt(month) + 1;
  const end = endMonth > 12
    ? `${parseInt(year) + 1}-01-01`
    : `${year}-${String(endMonth).padStart(2, '0')}-01`;

  const logs = await getAll(
    `SELECT wl.*, tm.name as ta_name
     FROM ta_work_logs wl
     JOIN ta_members tm ON wl.ta_member_id = tm.id
     WHERE wl.work_date >= ? AND wl.work_date < ? AND wl.academy_id = ?
     ORDER BY wl.work_date ASC, tm.name ASC`,
    [start, end, req.academyId]
  );

  const summary = await getAll(
    `SELECT tm.name, tm.role_desc,
            COALESCE(SUM(wl.hours), 0) as total_hours,
            COUNT(wl.id) as work_days
     FROM ta_members tm
     LEFT JOIN ta_work_logs wl ON wl.ta_member_id = tm.id AND wl.work_date >= ? AND wl.work_date < ? AND wl.academy_id = ?
     WHERE tm.is_active = 1 AND tm.academy_id = ?
     GROUP BY tm.id
     ORDER BY total_hours DESC`,
    [start, end, req.academyId, req.academyId]
  );

  let csv = '\uFEFF';
  csv += `${year}년 ${month}월 조교 근무 기록\n\n`;
  csv += '=== 월간 합산 ===\n';
  csv += '이름,업무,총 근무시간,근무일수\n';
  summary.forEach(s => {
    csv += `${s.name},${s.role_desc || ''},${s.total_hours},${s.work_days}\n`;
  });
  csv += '\n=== 상세 근무 기록 ===\n';
  csv += '날짜,이름,출근,퇴근,시간,대타여부,대타대상,메모\n';
  logs.forEach(l => {
    csv += `${l.work_date},${l.ta_name},${l.check_in || ''},${l.check_out || ''},${l.hours || 0},${l.is_substitute ? 'O' : ''},${l.substitute_for || ''},${(l.memo || '').replace(/,/g, ' ')}\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=ta-work-${year}-${String(month).padStart(2, '0')}.csv`);
  res.send(csv);
});

// ========== 월간 정규 근무표 ==========

router.get('/regular-schedule', async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) {
    // year_month 없이 요청 시 전체 반환 (하위호환)
    const schedule = await getAll('SELECT * FROM ta_regular_schedule WHERE academy_id = ? ORDER BY year_month DESC, time_slot ASC, day_of_week ASC', [req.academyId]);
    return res.json(schedule);
  }
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const schedule = await getAll(
    'SELECT * FROM ta_regular_schedule WHERE year_month = ? AND academy_id = ? ORDER BY time_slot ASC, day_of_week ASC',
    [yearMonth, req.academyId]
  );
  res.json(schedule);
});

router.put('/regular-schedule', async (req, res) => {
  const { schedule, year, month } = req.body;
  if (!Array.isArray(schedule) || !year || !month) return res.status(400).json({ error: '잘못된 데이터입니다.' });

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

  // 해당 월 삭제 후 재삽입
  await runQuery('DELETE FROM ta_regular_schedule WHERE year_month = ? AND academy_id = ?', [yearMonth, req.academyId]);
  for (const s of schedule) {
    if (s.ta_member_ids && s.ta_member_ids.length > 0) {
      await runInsert(
        'INSERT INTO ta_regular_schedule (year_month, day_of_week, time_slot, ta_member_ids, academy_id) VALUES (?, ?, ?, ?, ?)',
        [yearMonth, s.day_of_week, s.time_slot, JSON.stringify(s.ta_member_ids), req.academyId]
      );
    }
  }
  res.json({ message: `${year}년 ${month}월 근무표가 저장되었습니다.` });
});

// 이전 달 근무표 복사
router.post('/regular-schedule/copy', async (req, res) => {
  const { fromYear, fromMonth, toYear, toMonth } = req.body;
  if (!fromYear || !fromMonth || !toYear || !toMonth) return res.status(400).json({ error: '잘못된 데이터입니다.' });

  const fromYM = `${fromYear}-${String(fromMonth).padStart(2, '0')}`;
  const toYM = `${toYear}-${String(toMonth).padStart(2, '0')}`;

  const source = await getAll('SELECT * FROM ta_regular_schedule WHERE year_month = ? AND academy_id = ?', [fromYM, req.academyId]);
  if (source.length === 0) return res.status(400).json({ error: '복사할 원본 근무표가 없습니다.' });

  // 대상 월 기존 데이터 삭제
  await runQuery('DELETE FROM ta_regular_schedule WHERE year_month = ? AND academy_id = ?', [toYM, req.academyId]);
  for (const s of source) {
    await runInsert(
      'INSERT INTO ta_regular_schedule (year_month, day_of_week, time_slot, ta_member_ids, academy_id) VALUES (?, ?, ?, ?, ?)',
      [toYM, s.day_of_week, s.time_slot, s.ta_member_ids, req.academyId]
    );
  }
  res.json({ message: `${fromYear}년 ${fromMonth}월 → ${toYear}년 ${toMonth}월 근무표가 복사되었습니다.` });
});

module.exports = router;
