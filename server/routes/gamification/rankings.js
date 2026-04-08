const express = require('express');
const router = express.Router();
const { runQuery, runInsert, getOne, getAll, runBatch } = require('../../db/database');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');
const { getLevelInfo, checkAndGrantTitles, rankingCache, getLastFridayMidnight, getMonthStartMidnight, parseRankingRow, getPeriodRankings, getMyPeriodInfo, getPeriodKey } = require('./utils');

// === Student Rankings ===

router.get('/rankings', authenticateToken, async (req, res) => {
  try {
    const type = req.query.type || 'all';
    const requestedSchool = req.query.school || null;

    let student = null;
    try {
      student = await getOne('SELECT id, school FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
    } catch(e) { console.error('랭킹: 학생 조회 오류', e.message); }

    const isAdmin = req.user.role === 'admin';
    const isStaff = isAdmin || ['조교', '선생님'].includes(req.user.school);
    // 관리자/조교/선생님은 "내 순위" 표시하지 않음
    const showMyRank = student && !isAdmin && !['조교', '선생님'].includes(student.school);

    if (type === 'weekly' || type === 'monthly') {
      const since = type === 'weekly' ? getLastFridayMidnight() : getMonthStartMidnight();

      const cacheKey = `${req.academyId}_${type}`;
      let rankings = rankingCache.get(cacheKey);
      if (!rankings) {
        try {
          rankings = await getPeriodRankings(req.academyId, since);
        } catch(e) { console.error(`랭킹(${type}) 목록 오류:`, e.message); rankings = []; }
        rankingCache.set(cacheKey, rankings);
      }

      let myRank = null, myInfo = null;
      if (showMyRank) {
        try {
          const my = await getMyPeriodInfo(req.academyId, student.id, student.school, since);
          myRank = my.myRank;
          myInfo = my.myInfo;
        } catch(e) { console.error(`랭킹(${type}) 내 순위 오류:`, e.message); }
      }

      return res.json({ rankings, myRank, myInfo, type, since });

    } else if (type === 'school') {
      const mySchool = requestedSchool || (student && !isStaff ? student.school : null);

      let allSchools = [];
      try {
        const allSchoolRows = await getAll(
          "SELECT DISTINCT s.school FROM students s JOIN users u ON s.user_id = u.id WHERE u.approved = 1 AND u.role != 'admin' AND s.school NOT IN ('조교', '선생님') AND s.academy_id = ? ORDER BY s.school",
          [req.academyId]
        );
        allSchools = allSchoolRows.map(s => s.school);
      } catch(e) { console.error('랭킹(school) 학교목록 오류:', e.message); }

      if (!mySchool) {
        return res.json({ rankings: [], myRank: null, myInfo: null, type, school: null, schools: isStaff ? allSchools : undefined });
      }

      const schoolMonthSince = getMonthStartMidnight();
      const schoolCacheKey = `${req.academyId}_school_${mySchool}`;
      let rankings = rankingCache.get(schoolCacheKey);
      if (!rankings) {
        try {
          rankings = await getPeriodRankings(req.academyId, schoolMonthSince, 'AND s.school = ?', [mySchool]);
        } catch(e) { console.error('랭킹(school) 목록 오류:', e.message); rankings = []; }
        rankingCache.set(schoolCacheKey, rankings);
      }

      let myRank = null, myInfo = null;
      if (showMyRank) {
        try {
          const my = await getMyPeriodInfo(req.academyId, student.id, student.school, schoolMonthSince);
          myRank = my.myRank;
          myInfo = my.myInfo;
        } catch(e) { console.error('랭킹(school) 내 순위 오류:', e.message); }
      }

      return res.json({ rankings, myRank, myInfo, type, school: mySchool, schools: isStaff ? allSchools : undefined });

    } else {
      // all - 전체 랭킹 (누적 XP)
      const allCacheKey = `${req.academyId}_all`;
      let rankings = rankingCache.get(allCacheKey);
      if (!rankings) {
        try {
          const rows = await getAll(
            `SELECT sc.student_id, sc.xp, sc.avatar_config, sc.nickname, sc.selected_title_id, sc.character_id, sc.ranking_badge,
                    u.name, s.school, s.grade, c.emoji, c.name as char_name, t.name as title_name, t.icon as title_icon
             FROM student_characters sc
             JOIN students s ON sc.student_id = s.id
             JOIN users u ON s.user_id = u.id
             LEFT JOIN characters c ON sc.character_id = c.id
             LEFT JOIN titles t ON sc.selected_title_id = t.id
             WHERE u.role != 'admin' AND u.approved = 1 AND s.school NOT IN ('조교', '선생님') AND sc.xp > 0 AND sc.academy_id = ?
             ORDER BY sc.xp DESC LIMIT 100`,
          [req.academyId]);
          rankings = rows.map((r, idx) => {
            const parsed = parseRankingRow(r);
            parsed.xp = Number(r.xp) || 0;
            parsed.rank = idx + 1;
            return parsed;
          });
        } catch(e) { console.error('랭킹(all) 목록 오류:', e.message); rankings = []; }
        rankingCache.set(allCacheKey, rankings);
      }

      let myRank = null, myInfo = null;
      if (showMyRank) {
        try {
          const myChar = await getOne(
            `SELECT sc.student_id, sc.xp, sc.avatar_config, sc.nickname, sc.selected_title_id, sc.character_id, sc.ranking_badge,
                    u.name, s.school, s.grade, c.emoji, c.name as char_name, t.name as title_name, t.icon as title_icon
             FROM student_characters sc JOIN students s ON sc.student_id = s.id JOIN users u ON s.user_id = u.id
             LEFT JOIN characters c ON sc.character_id = c.id LEFT JOIN titles t ON sc.selected_title_id = t.id
             WHERE sc.student_id = ? AND sc.academy_id = ?`, [student.id, req.academyId]
          );
          if (myChar) {
            const rankResult = await getOne(
              `SELECT COUNT(*) as cnt FROM student_characters sc
               JOIN students s ON sc.student_id = s.id JOIN users u ON s.user_id = u.id
               WHERE sc.xp > ? AND sc.xp > 0 AND u.role != 'admin' AND u.approved = 1 AND s.school NOT IN ('조교', '선생님') AND sc.academy_id = ?`,
              [Number(myChar.xp) || 0, req.academyId]
            );
            myRank = (rankResult ? Number(rankResult.cnt) : 0) + 1;
            const parsed = parseRankingRow(myChar);
            parsed.xp = Number(myChar.xp) || 0;
            parsed.school = student.school;
            parsed.rank = myRank;
            myInfo = parsed;
          }
        } catch(e) { console.error('랭킹(all) 내 순위 오류:', e.message); }
      }

      return res.json({ rankings, myRank, myInfo, type });
    }
  } catch (err) {
    console.error('랭킹 조회 오류:', err);
    res.status(500).json({ error: '랭킹 조회 중 오류 발생', rankings: [], myRank: null, myInfo: null });
  }
});

// === Student Rewards ===

// 내 보상 현황 (이번 주/월 랭킹 순위 + 보상 내역)
router.get('/my-rewards', authenticateToken, async (req, res) => {
  try {
    const student = await getOne('SELECT id, school FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
    if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

    const weeklyKey = getPeriodKey('weekly');
    const monthlyKey = getPeriodKey('monthly');
    const weeklySince = getLastFridayMidnight();
    const monthlySince = getMonthStartMidnight();

    // 현재 주간/월간 순위 조회
    const [weeklyInfo, monthlyInfo] = await Promise.all([
      getMyPeriodInfo(req.academyId, student.id, student.school, weeklySince),
      getMyPeriodInfo(req.academyId, student.id, student.school, monthlySince),
    ]);

    // 이번 기간 보상 수령 여부
    const [weeklyReward, monthlyReward] = await Promise.all([
      getOne('SELECT rank_num, xp_reward, created_at FROM ranking_reward_logs WHERE student_id = ? AND period_type = ? AND period_key = ? AND academy_id = ?',
        [student.id, 'weekly', weeklyKey, req.academyId]),
      getOne('SELECT rank_num, xp_reward, created_at FROM ranking_reward_logs WHERE student_id = ? AND period_type = ? AND period_key = ? AND academy_id = ?',
        [student.id, 'monthly', monthlyKey, req.academyId]),
    ]);

    // 과거 보상 내역 (최근 20건)
    const rewardHistory = await getAll(
      'SELECT period_type, period_key, rank_num, xp_reward, created_at FROM ranking_reward_logs WHERE student_id = ? AND academy_id = ? ORDER BY created_at DESC LIMIT 20',
      [student.id, req.academyId]
    );

    res.json({
      weekly: {
        periodKey: weeklyKey,
        rank: weeklyInfo.myRank,
        info: weeklyInfo.myInfo,
        reward: weeklyReward || null,
      },
      monthly: {
        periodKey: monthlyKey,
        rank: monthlyInfo.myRank,
        info: monthlyInfo.myInfo,
        reward: monthlyReward || null,
      },
      history: rewardHistory,
    });
  } catch (err) {
    console.error('내 보상 조회 오류:', err);
    res.status(500).json({ error: '보상 조회 중 오류 발생' });
  }
});

// === Admin Rankings ===

// 랭킹 관리 - 전체 학생 캐릭터 목록 (랭킹순)
router.get('/admin/rankings', authenticateToken, requireAdmin, async (req, res) => {
  const type = req.query.type || 'all'; // all, weekly, monthly

  if (type === 'weekly' || type === 'monthly') {
    const since = type === 'weekly' ? getLastFridayMidnight() : getMonthStartMidnight();
    const rankings = await getAll(
      `SELECT sc.*, u.name, s.school, s.grade, s.id as student_id, c.emoji, c.name as char_name,
              t.name as title_name, t.icon as title_icon,
              COALESCE((SELECT SUM(xl.amount) FROM xp_logs xl WHERE xl.student_id = sc.student_id AND xl.created_at >= ? AND xl.amount > 0 AND xl.source NOT IN ('admin_ranking_reward', 'admin_adjust', 'admin_ranking', 'admin_edit')), 0) as period_xp
       FROM student_characters sc
       JOIN students s ON sc.student_id = s.id
       JOIN users u ON s.user_id = u.id
       LEFT JOIN characters c ON sc.character_id = c.id
       LEFT JOIN titles t ON sc.selected_title_id = t.id
       WHERE u.role != 'admin' AND sc.academy_id = ?
       ORDER BY period_xp DESC`,
      [since, req.academyId]
    );
    // period_xp가 총 XP를 초과하지 않도록 cap 후 재정렬
    const ranked = rankings
      .map(r => ({ ...r, period_xp: Math.min(r.period_xp, r.xp) }))
      .sort((a, b) => b.period_xp - a.period_xp)
      .map((r, idx) => ({ ...r, rank: idx + 1 }));
    return res.json({ rankings: ranked, since, type });
  }

  const rankings = await getAll(
    `SELECT sc.*, u.name, s.school, s.grade, s.id as student_id, c.emoji, c.name as char_name,
            t.name as title_name, t.icon as title_icon
     FROM student_characters sc
     JOIN students s ON sc.student_id = s.id
     JOIN users u ON s.user_id = u.id
     LEFT JOIN characters c ON sc.character_id = c.id
     LEFT JOIN titles t ON sc.selected_title_id = t.id
     WHERE sc.academy_id = ?
     ORDER BY sc.xp DESC`,
    [req.academyId]);
  const ranked = rankings.map((r, idx) => ({ ...r, rank: idx + 1 }));
  res.json(ranked);
});

// 랭킹 관리 - 학생 XP/포인트/레벨 직접 수정
router.put('/admin/rankings/:studentId', authenticateToken, requireAdmin, async (req, res) => {
  const { studentId } = req.params;
  const { xp, points } = req.body;

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보를 찾을 수 없습니다.' });

  const newXp = xp !== undefined ? parseInt(xp) : sc.xp;
  const newPoints = points !== undefined ? Math.max(0, parseInt(points)) : sc.points;
  const newLevel = getLevelInfo(Math.max(0, newXp)).level;

  await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
    [Math.max(0, newXp), newPoints, newLevel, studentId, req.academyId]);

  const diff = newXp - sc.xp;
  if (diff !== 0) {
    await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'admin_ranking', ?, ?)",
      [studentId, diff, '관리자 랭킹 수정', req.academyId]);
  }

  rankingCache.invalidate();
  res.json({ message: '수정 완료', xp: Math.max(0, newXp), points: newPoints, level: newLevel });
});

// 랭킹 관리 - 학생 게임 데이터 초기화 (XP, 포인트, 레벨 리셋)
router.delete('/admin/rankings/:studentId/reset', authenticateToken, requireAdmin, async (req, res) => {
  const { studentId } = req.params;

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보를 찾을 수 없습니다.' });

  await runQuery('UPDATE student_characters SET xp = 0, points = 0, level = 1 WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  // xp_logs도 삭제해야 기간별 랭킹(주간/월간)에서도 사라짐
  await runQuery('DELETE FROM xp_logs WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  // 초기화 기록만 남김
  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, 0, 'admin_reset', ?, ?)",
    [studentId, '관리자 데이터 초기화', req.academyId]);

  rankingCache.invalidate();
  res.json({ message: '게임 데이터가 초기화되었습니다. (XP 로그 포함)' });
});

// 랭킹 관리 - 학생 캐릭터 완전 삭제
router.delete('/admin/rankings/:studentId', authenticateToken, requireAdmin, async (req, res) => {
  const { studentId } = req.params;

  await runQuery('DELETE FROM student_characters WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  await runQuery('DELETE FROM student_titles WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  await runQuery('DELETE FROM xp_logs WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  await runQuery('DELETE FROM vocab_game_logs WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  await runQuery('DELETE FROM shop_purchases WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);

  rankingCache.invalidate();
  res.json({ message: '학생의 모든 게임 데이터가 삭제되었습니다.' });
});

// 랭킹 캐시 강제 클리어 (관리자 전용)
router.post('/admin/rankings/clear-cache', authenticateToken, requireAdmin, (req, res) => {
  rankingCache.invalidate();
  res.json({ message: '랭킹 캐시가 초기화되었습니다.' });
});

// 주간/월간 랭킹 보상 지급 (트랜잭션 + 중복방지 + 배치)
router.post('/admin/ranking-rewards', authenticateToken, requireAdmin, async (req, res) => {
  const { type } = req.body; // 'weekly' or 'monthly'
  if (!type || !['weekly', 'monthly'].includes(type)) {
    return res.status(400).json({ error: 'type은 weekly 또는 monthly여야 합니다.' });
  }

  const periodKey = getPeriodKey(type);

  // 이미 이 기간에 보상이 지급되었는지 확인 (#2 중복 방지)
  const existingReward = await getOne(
    'SELECT id FROM ranking_reward_logs WHERE period_type = ? AND period_key = ? AND academy_id = ? LIMIT 1',
    [type, periodKey, req.academyId]
  );
  if (existingReward) {
    return res.status(409).json({ error: `이미 ${type === 'weekly' ? '주간' : '월간'} (${periodKey}) 보상이 지급되었습니다.` });
  }

  // reward_settings 테이블에서 보상 설정 읽기 (없으면 기본값)
  const rewardRows = await getAll('SELECT rank, amount FROM reward_settings WHERE type = ? AND academy_id = ?', [type, req.academyId]);
  let rewards;
  if (rewardRows && rewardRows.length > 0) {
    rewards = {};
    for (const r of rewardRows) { rewards[r.rank] = r.amount; }
  } else {
    rewards = type === 'weekly'
      ? { 1: 500, 2: 300, 3: 200, 4: 100, 5: 100, 6: 100, 7: 100, 8: 100, 9: 100, 10: 100 }
      : { 1: 1000, 2: 600, 3: 400, 4: 200, 5: 200, 6: 200, 7: 200, 8: 200, 9: 200, 10: 200 };
  }

  const since = type === 'weekly' ? getLastFridayMidnight() : getMonthStartMidnight();

  // 랭킹 + 학생 캐릭터 정보를 한 번에 가져오기 (#14 N+1 제거)
  const rankings = await getAll(
    `SELECT sc.student_id, COALESCE(xp_agg.total_xp, 0) as period_xp, u.name,
            sc.xp as current_xp, sc.points as current_points, s.user_id
     FROM student_characters sc
     JOIN students s ON sc.student_id = s.id
     JOIN users u ON s.user_id = u.id
     LEFT JOIN (
       SELECT student_id, SUM(amount) as total_xp FROM xp_logs WHERE created_at >= ? AND amount > 0 AND source NOT IN ('admin_ranking_reward', 'admin_adjust', 'admin_ranking', 'admin_edit') GROUP BY student_id
     ) xp_agg ON xp_agg.student_id = sc.student_id
     WHERE u.role != 'admin' AND u.approved = 1 AND s.school NOT IN ('조교', '선생님') AND COALESCE(xp_agg.total_xp, 0) > 0 AND sc.academy_id = ?
     ORDER BY period_xp DESC LIMIT 10`,
    [since, req.academyId]
  );

  const rewarded = [];
  const label = type === 'weekly' ? '주간' : '월간';

  // 트랜잭션으로 모든 보상을 원자적으로 처리 (#3)
  await runBatch(async (tx) => {
    for (let idx = 0; idx < rankings.length; idx++) {
      const r = rankings[idx];
      const rank = idx + 1;
      const amount = rewards[rank];
      if (!amount) continue;

      // 중복 방지 로그 INSERT (#2) — ON CONFLICT DO NOTHING으로 race condition 방지
      const logId = await tx.insert(
        "INSERT INTO ranking_reward_logs (student_id, period_type, period_key, rank_num, xp_reward, academy_id) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (student_id, period_type, period_key) DO NOTHING",
        [r.student_id, type, periodKey, rank, amount, req.academyId]
      );
      if (!logId) continue; // 이미 지급된 학생은 skip

      const newXp = r.current_xp + amount;
      const newPoints = r.current_points + amount;
      const newLevel = getLevelInfo(newXp).level;

      await tx.run('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
        [newXp, newPoints, newLevel, r.student_id, req.academyId]);

      await tx.insert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'admin_ranking_reward', ?, ?)",
        [r.student_id, amount, `${label} 랭킹 ${rank}위 보상 (${periodKey})`, req.academyId]);

      rewarded.push({ rank, name: r.name, amount, xp: r.period_xp });
    }
  });

  // 칭호 부여 (트랜잭션 밖에서 — 실패해도 보상은 유지)
  for (let idx = 0; idx < rankings.length; idx++) {
    const r = rankings[idx];
    const rank = idx + 1;
    const amount = rewards[rank];
    if (!amount) continue;

    try { await checkAndGrantTitles(r.student_id, req.academyId); } catch(e) { console.error('칭호 확인 오류:', e.message); }

    // 1~3위 칭호 자동 부여 (기간별)
    if (rank <= 3) {
      try {
        const kstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
        let periodLabel;
        if (type === 'weekly') {
          const weekNum = Math.ceil(kstNow.getUTCDate() / 7);
          periodLabel = `${kstNow.getUTCMonth() + 1}월 ${weekNum}주차`;
        } else {
          periodLabel = `${kstNow.getUTCMonth() + 1}월`;
        }
        const rankLabel = rank === 1 ? '1짱' : rank === 2 ? '2짱' : '3짱';
        const titleName = type === 'weekly'
          ? `나만의 조교 주간 ${rankLabel} (${periodLabel})`
          : `나만의 조교 월간 ${rankLabel} (${periodLabel})`;

        // 기존 같은 기간 칭호 제거
        const oldTitles = await getAll(
          `SELECT t.id FROM titles t WHERE t.condition_type = ? AND t.name LIKE ? AND (t.academy_id = ? OR t.academy_id = 0)`,
          [`ranking_${type}`, `%${periodLabel}%`, req.academyId]
        );
        for (const t of oldTitles) {
          await runQuery('DELETE FROM student_titles WHERE student_id = ? AND title_id = ? AND academy_id = ?', [r.student_id, t.id, req.academyId]);
        }

        let title = await getOne(`SELECT id FROM titles WHERE name = ? AND condition_type = ? AND (academy_id = ? OR academy_id = 0)`, [titleName, `ranking_${type}`, req.academyId]);
        if (!title) {
          const tid = await runInsert(
            `INSERT INTO titles (name, description, condition_type, condition_value, icon, is_hidden, academy_id) VALUES (?, ?, ?, 0, ?, 0, ?)`,
            [titleName, `${label} 랭킹 ${rankLabel}`, `ranking_${type}`, rank === 1 ? '👑' : rank === 2 ? '🥈' : '🥉', req.academyId]
          );
          title = { id: tid };
        }
        const alreadyHas = await getOne('SELECT id FROM student_titles WHERE student_id = ? AND title_id = ? AND academy_id = ?', [r.student_id, title.id, req.academyId]);
        if (!alreadyHas) {
          await runInsert('INSERT INTO student_titles (student_id, title_id, academy_id) VALUES (?, ?, ?)', [r.student_id, title.id, req.academyId]);
        }

        // 알림
        if (r.user_id) {
          await runInsert('INSERT INTO notifications (user_id, type, title, message, academy_id) VALUES (?, ?, ?, ?, ?)',
            [r.user_id, 'title', `${label} 랭킹 ${rankLabel}!`,
             `${periodLabel} ${label} 랭킹 ${rankLabel}으로 "${titleName}" 칭호를 획득했습니다!`, req.academyId]);
        }
      } catch(e) { console.error('칭호 부여 오류:', e.message); }
    }
  }

  // 월간 보상일 때 학교별 1~3등에게도 칭호 부여
  if (type === 'monthly') {
    try {
      const kstNow2 = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
      const monthLabel = `${kstNow2.getUTCMonth() + 1}월`;
      const monthSince = getMonthStartMidnight();

      const schools = await getAll(
        `SELECT DISTINCT s.school FROM students s JOIN users u ON s.user_id = u.id
         WHERE u.approved = 1 AND u.role != 'admin' AND s.school NOT IN ('조교', '선생님') AND s.academy_id = ?
         ORDER BY s.school`,
        [req.academyId]
      );

      for (const { school } of schools) {
        const schoolRanks = await getAll(
          `SELECT sc.student_id, u.name, COALESCE(xp_agg.total_xp, 0) as pxp, s.user_id
           FROM student_characters sc
           JOIN students s ON sc.student_id = s.id JOIN users u ON s.user_id = u.id
           LEFT JOIN (
             SELECT student_id, SUM(amount) as total_xp FROM xp_logs WHERE created_at >= ? AND amount > 0 AND source NOT IN ('admin_ranking_reward', 'admin_adjust', 'admin_ranking', 'admin_edit') GROUP BY student_id
           ) xp_agg ON xp_agg.student_id = sc.student_id
           WHERE u.role != 'admin' AND s.school = ? AND COALESCE(xp_agg.total_xp, 0) > 0 AND sc.academy_id = ?
           ORDER BY pxp DESC LIMIT 3`,
          [monthSince, school, req.academyId]
        );

        for (let idx = 0; idx < schoolRanks.length; idx++) {
          const sr = schoolRanks[idx];
          const sRank = idx + 1;
          const sLabel = sRank === 1 ? '일진' : sRank === 2 ? '이진' : '삼진';
          const sTitleName = `${school} 월간 ${sLabel} (${monthLabel})`;

          let sTitle = await getOne(`SELECT id FROM titles WHERE name = ? AND condition_type = 'ranking_school' AND (academy_id = ? OR academy_id = 0)`, [sTitleName, req.academyId]);
          if (!sTitle) {
            const stid = await runInsert(
              `INSERT INTO titles (name, description, condition_type, condition_value, icon, is_hidden, academy_id) VALUES (?, ?, 'ranking_school', 0, ?, 0, ?)`,
              [sTitleName, `${school} 월간 ${sLabel}`, sRank === 1 ? '👑' : sRank === 2 ? '🥈' : '🥉', req.academyId]
            );
            sTitle = { id: stid };
          }
          const alr = await getOne('SELECT id FROM student_titles WHERE student_id = ? AND title_id = ? AND academy_id = ?', [sr.student_id, sTitle.id, req.academyId]);
          if (!alr) {
            await runInsert('INSERT INTO student_titles (student_id, title_id, academy_id) VALUES (?, ?, ?)', [sr.student_id, sTitle.id, req.academyId]);
            if (sr.user_id) {
              await runInsert('INSERT INTO notifications (user_id, type, title, message, academy_id) VALUES (?, ?, ?, ?, ?)',
                [sr.user_id, 'title', `${school} 월간 ${sLabel}!`, `${monthLabel} ${school} 월간 ${sLabel}로 "${sTitleName}" 칭호를 획득했습니다!`, req.academyId]);
            }
          }
        }
      }
    } catch(e) { console.error('학교별 칭호 부여 오류:', e.message); }
  }

  rankingCache.invalidate();
  res.json({ message: `${label} 랭킹 보상이 지급되었습니다. (${periodKey})`, rewarded });
});

// ========== 랭킹 보상 설정 관리 ==========

// 보상 설정 조회
router.get('/reward-settings', authenticateToken, async (req, res) => {
  const settings = await getAll('SELECT * FROM reward_settings WHERE academy_id = ? ORDER BY type, rank', [req.academyId]);
  res.json(settings);
});

// 보상 설정 수정
router.post('/reward-settings', authenticateToken, requireAdmin, async (req, res) => {
  const { settings } = req.body; // [{type, rank, amount}, ...]
  if (!settings || !Array.isArray(settings)) {
    return res.status(400).json({ error: '설정 데이터가 필요합니다.' });
  }

  for (const s of settings) {
    const existing = await getOne('SELECT id FROM reward_settings WHERE type = ? AND rank = ? AND academy_id = ?', [s.type, s.rank, req.academyId]);
    if (existing) {
      await runQuery('UPDATE reward_settings SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?',
        [s.amount, existing.id, req.academyId]);
    } else {
      await runInsert('INSERT INTO reward_settings (type, rank, amount, academy_id) VALUES (?, ?, ?, ?)',
        [s.type, s.rank, s.amount, req.academyId]);
    }
  }

  res.json({ message: '보상 설정이 저장되었습니다.' });
});

module.exports = router;
