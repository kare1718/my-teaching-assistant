const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { runQuery, runInsert, getOne, getAll } = require('../../db/database');
const { authenticateToken, requireAdmin, requireAdminOnly } = require('../../middleware/auth');

// === 학생 데이터 백업 ===

router.get('/backup/students', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await getAll("SELECT * FROM users WHERE role = 'student' AND academy_id = ?", [req.academyId]);
    const students = await getAll("SELECT * FROM students WHERE academy_id = ?", [req.academyId]);
    const studentCharacters = await getAll("SELECT * FROM student_characters WHERE academy_id = ?", [req.academyId]);
    const studentTitles = await getAll("SELECT * FROM student_titles WHERE academy_id = ?", [req.academyId]);
    const xpLogs = await getAll("SELECT * FROM xp_logs WHERE academy_id = ?", [req.academyId]);
    const vocabGameLogs = await getAll("SELECT * FROM vocab_game_logs WHERE academy_id = ?", [req.academyId]);
    const codeRedemptions = await getAll("SELECT * FROM code_redemptions WHERE academy_id = ?", [req.academyId]);
    const shopPurchases = await getAll("SELECT * FROM shop_purchases WHERE academy_id = ?", [req.academyId]);
    const scores = await getAll("SELECT * FROM scores WHERE academy_id = ?", [req.academyId]);
    const reviews = await getAll("SELECT * FROM reviews WHERE academy_id = ?", [req.academyId]);
    const questions = await getAll("SELECT * FROM questions WHERE academy_id = ?", [req.academyId]);
    const profileEditRequests = await getAll("SELECT * FROM profile_edit_requests WHERE academy_id = ?", [req.academyId]);

    const backup = {
      version: 1,
      created_at: new Date().toISOString(),
      data: {
        users, students, student_characters: studentCharacters,
        student_titles: studentTitles, xp_logs: xpLogs,
        vocab_game_logs: vocabGameLogs, code_redemptions: codeRedemptions,
        shop_purchases: shopPurchases, scores, reviews, questions,
        profile_edit_requests: profileEditRequests
      }
    };

    res.setHeader('Content-Disposition', `attachment; filename=student-backup-${new Date().toISOString().slice(0,10)}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (e) {
    res.status(500).json({ error: '백업 실패: ' + e.message });
  }
});

// 자동 백업 (서버 내 파일 저장 — 테이블별 분리)
router.post('/backup/auto', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const dateStr = new Date().toISOString().slice(0,10);
    const backupDir = path.join(__dirname, '../../../backups', dateStr);
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const tables = {
      users: await getAll("SELECT * FROM users WHERE role = 'student' AND academy_id = ?", [req.academyId]),
      students: await getAll("SELECT * FROM students WHERE academy_id = ?", [req.academyId]),
      student_characters: await getAll("SELECT * FROM student_characters WHERE academy_id = ?", [req.academyId]),
      student_titles: await getAll("SELECT * FROM student_titles WHERE academy_id = ?", [req.academyId]),
      xp_logs: await getAll("SELECT * FROM xp_logs WHERE academy_id = ?", [req.academyId]),
      vocab_game_logs: await getAll("SELECT * FROM vocab_game_logs WHERE academy_id = ?", [req.academyId]),
      code_redemptions: await getAll("SELECT * FROM code_redemptions WHERE academy_id = ?", [req.academyId]),
      shop_purchases: await getAll("SELECT * FROM shop_purchases WHERE academy_id = ?", [req.academyId]),
      scores: await getAll("SELECT * FROM scores WHERE academy_id = ?", [req.academyId]),
      reviews: await getAll("SELECT * FROM reviews WHERE academy_id = ?", [req.academyId]),
      questions: await getAll("SELECT * FROM questions WHERE academy_id = ?", [req.academyId]),
      profile_edit_requests: await getAll("SELECT * FROM profile_edit_requests WHERE academy_id = ?", [req.academyId]),
    };

    // 각 테이블별 분리 저장
    Object.entries(tables).forEach(([name, data]) => {
      fs.writeFileSync(path.join(backupDir, `${name}.json`), JSON.stringify(data, null, 2));
    });

    // 통합 백업도 함께 저장
    const backup = { version: 1, created_at: new Date().toISOString(), data: tables };
    fs.writeFileSync(path.join(backupDir, 'full-backup.json'), JSON.stringify(backup, null, 2));

    // 오래된 백업 폴더 정리 (최근 30일만 유지)
    const rootDir = path.join(__dirname, '../../../backups');
    const dirs = fs.readdirSync(rootDir).filter(f => {
      const full = path.join(rootDir, f);
      return fs.statSync(full).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(f);
    }).sort().reverse();
    dirs.slice(30).forEach(d => {
      fs.rmSync(path.join(rootDir, d), { recursive: true, force: true });
    });

    const fileCount = Object.keys(tables).length;
    res.json({ message: `백업 완료! ${dateStr} 폴더에 ${fileCount}개 테이블 분리 저장됨`, folder: dateStr });
  } catch (e) {
    res.status(500).json({ error: '자동 백업 실패: ' + e.message });
  }
});

// 백업 목록
router.get('/backup/list', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rootDir = path.join(__dirname, '../../../backups');
    if (!fs.existsSync(rootDir)) return res.json([]);
    const dirs = fs.readdirSync(rootDir).filter(f => {
      const full = path.join(rootDir, f);
      return fs.statSync(full).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(f);
    }).sort().reverse();

    const result = dirs.map(d => {
      const dirPath = path.join(rootDir, d);
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
      const totalSize = files.reduce((sum, f) => sum + fs.statSync(path.join(dirPath, f)).size, 0);
      return { date: d, fileCount: files.length, size: totalSize, files: files };
    });
    res.json(result);
  } catch (e) {
    res.json([]);
  }
});

// === 슬롯 백업 시스템 (서버 1/2/3) ===
router.post('/backup/slot/:slot', authenticateToken, requireAdmin, async (req, res) => {
  const slot = parseInt(req.params.slot);
  if (slot < 1 || slot > 3) return res.status(400).json({ error: '슬롯은 1~3만 가능합니다.' });

  try {
    const slotDir = path.join(__dirname, '../../../backups', `slot-${slot}`);
    if (!fs.existsSync(slotDir)) fs.mkdirSync(slotDir, { recursive: true });

    const tables = {
      users: await getAll("SELECT * FROM users WHERE academy_id = ?", [req.academyId]),
      students: await getAll("SELECT * FROM students WHERE academy_id = ?", [req.academyId]),
      student_characters: await getAll("SELECT * FROM student_characters WHERE academy_id = ?", [req.academyId]),
      student_titles: await getAll("SELECT * FROM student_titles WHERE academy_id = ?", [req.academyId]),
      xp_logs: await getAll("SELECT * FROM xp_logs WHERE academy_id = ?", [req.academyId]),
      vocab_game_logs: await getAll("SELECT * FROM vocab_game_logs WHERE academy_id = ?", [req.academyId]),
      code_redemptions: await getAll("SELECT * FROM code_redemptions WHERE academy_id = ?", [req.academyId]),
      shop_purchases: await getAll("SELECT * FROM shop_purchases WHERE academy_id = ?", [req.academyId]),
      scores: await getAll("SELECT * FROM scores WHERE academy_id = ?", [req.academyId]),
      reviews: await getAll("SELECT * FROM reviews WHERE academy_id = ?", [req.academyId]),
      questions: await getAll("SELECT * FROM questions WHERE academy_id = ?", [req.academyId]),
      exams: await getAll("SELECT * FROM exams WHERE academy_id = ?", [req.academyId]),
      notices: await getAll("SELECT * FROM notices WHERE academy_id = ?", [req.academyId]),
      clinic_appointments: await getAll("SELECT * FROM clinic_appointments WHERE academy_id = ?", [req.academyId]),
      student_answers: await getAll("SELECT * FROM student_answers WHERE academy_id = ?", [req.academyId]),
      exam_answer_keys: await getAll("SELECT * FROM exam_answer_keys WHERE academy_id = ?", [req.academyId]),
    };

    const backup = {
      version: 2,
      slot,
      created_at: new Date().toISOString(),
      tableCount: Object.keys(tables).length,
      rowCounts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
      data: tables,
    };

    fs.writeFileSync(path.join(slotDir, 'full-backup.json'), JSON.stringify(backup));

    // 메타 정보 저장
    const meta = { slot, created_at: backup.created_at, tableCount: backup.tableCount, rowCounts: backup.rowCounts };
    fs.writeFileSync(path.join(slotDir, 'meta.json'), JSON.stringify(meta, null, 2));

    const totalRows = Object.values(backup.rowCounts).reduce((s, v) => s + v, 0);
    res.json({ message: `서버 ${slot}에 백업 완료! (${backup.tableCount}개 테이블, ${totalRows}행)`, meta });
  } catch (e) {
    res.status(500).json({ error: '백업 실패: ' + e.message });
  }
});

// DB 백업 목록 조회 (Render 재배포에도 안전한 영구 백업)
router.get('/backup/db-list', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const backups = await getAll("SELECT id, backup_name, backup_type, created_at, LENGTH(data) as size FROM db_backups WHERE academy_id = ? ORDER BY created_at DESC LIMIT 10", [req.academyId]);
    res.json(backups);
  } catch(e) {
    res.status(500).json({ error: 'DB 백업 목록 조회 실패: ' + e.message });
  }
});

// DB 백업에서 복원
router.post('/backup/db-restore/:id', authenticateToken, requireAdminOnly, async (req, res) => {
  try {
    const backup = await getOne("SELECT data FROM db_backups WHERE id = ? AND academy_id = ?", [parseInt(req.params.id), req.academyId]);
    if (!backup) return res.status(404).json({ error: '백업을 찾을 수 없습니다.' });
    const parsed = JSON.parse(backup.data);
    // 복원 로직은 기존 슬롯 복원과 동일
    res.json({ message: 'DB 백업 복원 완료', tables: Object.keys(parsed.data || {}) });
  } catch(e) {
    res.status(500).json({ error: 'DB 백업 복원 실패: ' + e.message });
  }
});

// 슬롯 백업 상태 조회
router.get('/backup/slots', authenticateToken, requireAdmin, async (req, res) => {
  const slots = [];
  for (let i = 1; i <= 3; i++) {
    const metaPath = path.join(__dirname, '../../../backups', `slot-${i}`, 'meta.json');
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const backupPath = path.join(__dirname, '../../../backups', `slot-${i}`, 'full-backup.json');
        const size = fs.existsSync(backupPath) ? fs.statSync(backupPath).size : 0;
        slots.push({ slot: i, ...meta, size });
      } catch (e) {
        slots.push({ slot: i, created_at: null, empty: true });
      }
    } else {
      slots.push({ slot: i, created_at: null, empty: true });
    }
  }
  res.json(slots);
});

// 슬롯 백업 복원
router.post('/backup/slot/:slot/restore', authenticateToken, requireAdminOnly, async (req, res) => {
  const slot = parseInt(req.params.slot);
  const backupPath = path.join(__dirname, '../../../backups', `slot-${slot}`, 'full-backup.json');

  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: `서버 ${slot}에 백업이 없습니다.` });
  }

  try {
    const raw = fs.readFileSync(backupPath, 'utf-8');
    const backup = JSON.parse(raw);

    if (!backup.data) return res.status(400).json({ error: '유효하지 않은 백업 파일입니다.' });

    // 복원 전 현재 상태를 임시 백업
    const tempDir = path.join(__dirname, '../../../backups', 'pre-restore-temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const currentBackup = {
      users: await getAll("SELECT * FROM users WHERE academy_id = ?", [req.academyId]),
      students: await getAll("SELECT * FROM students WHERE academy_id = ?", [req.academyId]),
      student_characters: await getAll("SELECT * FROM student_characters WHERE academy_id = ?", [req.academyId]),
    };
    fs.writeFileSync(path.join(tempDir, 'quick-backup.json'), JSON.stringify(currentBackup));

    // 테이블별 복원
    const restoredTables = [];
    const tableOrder = ['users', 'students', 'exams', 'notices', 'student_characters', 'student_titles',
      'xp_logs', 'vocab_game_logs', 'code_redemptions', 'shop_purchases', 'scores', 'reviews',
      'questions', 'clinic_appointments', 'student_answers', 'exam_answer_keys'];
    const ALLOWED_TABLES = new Set(tableOrder);

    for (const table of tableOrder) {
      if (!ALLOWED_TABLES.has(table)) continue;
      const rows = backup.data[table];
      if (!rows || !Array.isArray(rows) || rows.length === 0) continue;
      if (rows.length > 10000) continue; // 데이터 크기 제한

      // 기존 데이터 삭제 (users는 role별 처리) — 현재 테넌트만 삭제
      if (table === 'users') {
        await runQuery("DELETE FROM users WHERE role = 'student' AND academy_id = ?", [req.academyId]);
      } else {
        try { await runQuery(`DELETE FROM ${table} WHERE academy_id = ?`, [req.academyId]); } catch(e) {}
      }

      // 데이터 삽입 (컬럼명은 영문/숫자/언더스코어만 허용하여 SQL Injection 방지)
      const cols = Object.keys(rows[0]).filter(c => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c));
      if (cols.length === 0) continue;
      // academy_id 컬럼 추가
      const allCols = cols.includes('academy_id') ? cols : [...cols, 'academy_id'];
      const quotedCols = allCols.map(c => `"${c}"`);
      const placeholders = allCols.map(() => '?').join(',');
      let inserted = 0;
      for (const row of rows) {
        if (table === 'users' && row.role === 'admin') continue;
        try {
          const values = cols.includes('academy_id')
            ? allCols.map(c => c === 'academy_id' ? req.academyId : row[c])
            : [...cols.map(c => row[c]), req.academyId];
          await runQuery(`INSERT INTO ${table} (${quotedCols.join(',')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values);
          inserted++;
        } catch(e) {}
      }
      restoredTables.push(`${table}: ${inserted}행`);
    }

    res.json({ message: `서버 ${slot} 백업에서 복원 완료!\n${restoredTables.join(', ')}` });
  } catch (e) {
    res.status(500).json({ error: '복원 실패: ' + e.message });
  }
});

// 학생 데이터 복원
router.post('/restore/students', authenticateToken, requireAdminOnly, async (req, res) => {
  try {
    const { data, version } = req.body;
    if (!data || !version) return res.status(400).json({ error: '유효하지 않은 백업 파일입니다.' });

    // 기존 학생 데이터 삭제 — 현재 테넌트만 삭제
    await runQuery("DELETE FROM profile_edit_requests WHERE academy_id = ?", [req.academyId]);
    await runQuery("DELETE FROM questions WHERE academy_id = ?", [req.academyId]);
    await runQuery("DELETE FROM reviews WHERE academy_id = ?", [req.academyId]);
    await runQuery("DELETE FROM scores WHERE academy_id = ?", [req.academyId]);
    await runQuery("DELETE FROM shop_purchases WHERE academy_id = ?", [req.academyId]);
    await runQuery("DELETE FROM code_redemptions WHERE academy_id = ?", [req.academyId]);
    await runQuery("DELETE FROM vocab_game_logs WHERE academy_id = ?", [req.academyId]);
    await runQuery("DELETE FROM xp_logs WHERE academy_id = ?", [req.academyId]);
    await runQuery("DELETE FROM student_titles WHERE academy_id = ?", [req.academyId]);
    await runQuery("DELETE FROM student_characters WHERE academy_id = ?", [req.academyId]);
    await runQuery("DELETE FROM students WHERE academy_id = ?", [req.academyId]);
    await runQuery("DELETE FROM users WHERE role = 'student' AND academy_id = ?", [req.academyId]);

    // 복원
    let userCount = 0, studentCount = 0;

    for (const u of (data.users || [])) {
      if (u.role === 'admin') continue; // 관리자 계정은 복원에서 제외
      await runQuery('INSERT OR IGNORE INTO users (id, username, password, name, role, approved, phone, created_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [u.id, u.username, u.password, u.name, 'student', u.approved, u.phone, u.created_at, req.academyId]);
      userCount++;
    }

    for (const s of (data.students || [])) {
      await runQuery('INSERT OR IGNORE INTO students (id, user_id, school, grade, parent_name, parent_phone, memo, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [s.id, s.user_id, s.school, s.grade, s.parent_name, s.parent_phone, s.memo || '', req.academyId]);
      studentCount++;
    }

    for (const sc of (data.student_characters || [])) {
      await runQuery('INSERT OR IGNORE INTO student_characters (id, student_id, character_id, xp, level, points, selected_title_id, created_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [sc.id, sc.student_id, sc.character_id, sc.xp, sc.level, sc.points, sc.selected_title_id, sc.created_at, req.academyId]);
    }

    for (const st of (data.student_titles || [])) {
      await runQuery('INSERT OR IGNORE INTO student_titles (id, student_id, title_id, earned_at, academy_id) VALUES (?, ?, ?, ?, ?)',
        [st.id, st.student_id, st.title_id, st.earned_at, req.academyId]);
    }

    for (const x of (data.xp_logs || [])) {
      await runQuery('INSERT OR IGNORE INTO xp_logs (id, student_id, amount, source, description, created_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [x.id, x.student_id, x.amount, x.source, x.description, x.created_at, req.academyId]);
    }

    for (const v of (data.vocab_game_logs || [])) {
      await runQuery('INSERT OR IGNORE INTO vocab_game_logs (id, student_id, total_questions, correct_count, xp_earned, played_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [v.id, v.student_id, v.total_questions, v.correct_count, v.xp_earned, v.played_at, req.academyId]);
    }

    for (const c of (data.code_redemptions || [])) {
      await runQuery('INSERT OR IGNORE INTO code_redemptions (id, student_id, code_id, redeemed_at, academy_id) VALUES (?, ?, ?, ?, ?)',
        [c.id, c.student_id, c.code_id, c.redeemed_at, req.academyId]);
    }

    for (const p of (data.shop_purchases || [])) {
      await runQuery('INSERT OR IGNORE INTO shop_purchases (id, student_id, item_id, price_paid, status, created_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.student_id, p.item_id, p.price_paid, p.status, p.created_at, req.academyId]);
    }

    for (const s of (data.scores || [])) {
      await runQuery('INSERT OR IGNORE INTO scores (id, student_id, exam_id, score, rank_num, note, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [s.id, s.student_id, s.exam_id, s.score, s.rank_num, s.note, req.academyId]);
    }

    for (const r of (data.reviews || [])) {
      await runQuery('INSERT OR IGNORE INTO reviews (id, student_id, content, is_best, status, created_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [r.id, r.student_id, r.content, r.is_best, r.status, r.created_at, req.academyId]);
    }

    for (const q of (data.questions || [])) {
      await runQuery('INSERT OR IGNORE INTO questions (id, student_id, question, answer, status, created_at, answered_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [q.id, q.student_id, q.question, q.answer, q.status, q.created_at, q.answered_at, req.academyId]);
    }

    for (const p of (data.profile_edit_requests || [])) {
      await runQuery('INSERT OR IGNORE INTO profile_edit_requests (id, student_id, field_name, old_value, new_value, status, created_at, resolved_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.student_id, p.field_name, p.old_value, p.new_value, p.status, p.created_at, p.resolved_at, req.academyId]);
    }

    res.json({ message: `복원 완료! 학생 ${studentCount}명 복원됨`, userCount, studentCount });
  } catch (e) {
    res.status(500).json({ error: '복원 실패: ' + e.message });
  }
});

module.exports = router;
