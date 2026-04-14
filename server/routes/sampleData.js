const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, requireAdmin);

const SAMPLE_TAG = '#sample';

const KOREAN_NAMES = [
  '김민준', '이서연', '박지후', '최유나', '정하준',
  '강수빈', '조예진', '윤도윤', '임하은', '한지우',
];
const CLASS_NAMES = ['정규반 A', '정규반 B'];

function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// POST /api/sample-data/generate — 샘플 학원 데이터 일괄 생성
router.post('/generate', async (req, res) => {
  try {
    const academyId = req.academyId;
    if (!academyId) return res.status(400).json({ error: '학원 정보가 없습니다.' });

    // 1) 학생 10명 + 사용자 계정 생성
    const studentIds = [];
    for (let i = 0; i < KOREAN_NAMES.length; i++) {
      const name = KOREAN_NAMES[i];
      const username = `__sample_${academyId}_${Date.now()}_${i}`;
      const phone = `010-9${String(1000 + i).padStart(4, '0')}-${String(i * 137 % 10000).padStart(4, '0')}`;
      const userId = await runInsert(
        `INSERT INTO users (username, password, name, role, approved, phone, academy_id)
         VALUES (?, '', ?, 'student', 1, ?, ?)`,
        [username, name, phone, academyId]
      );
      const school = randomPick(['중동고', '서울고', '경기여고']);
      const grade = randomPick(['1학년', '2학년', '3학년']);
      const parentName = `${name.slice(0, 1)}보호자`;
      const parentPhone = `010-8${String(2000 + i).padStart(4, '0')}-${String((i + 3) * 211 % 10000).padStart(4, '0')}`;
      const studentId = await runInsert(
        `INSERT INTO students (user_id, school, grade, parent_name, parent_phone, memo, academy_id)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [userId, school, grade, parentName, parentPhone, SAMPLE_TAG, academyId]
      );
      studentIds.push(studentId);
    }

    // 2) 반 2개 생성
    const classIds = [];
    for (const cname of CLASS_NAMES) {
      try {
        const cid = await runInsert(
          `INSERT INTO classes (academy_id, name, class_type, subject, status, memo)
           VALUES (?, ?, 'regular', '국어', 'active', ?) RETURNING id`,
          [academyId, cname, SAMPLE_TAG]
        );
        classIds.push(cid);
      } catch (e) { /* classes 테이블 없으면 skip */ }
    }

    // 3) 학생을 반에 배정
    if (classIds.length > 0) {
      for (let i = 0; i < studentIds.length; i++) {
        const cid = classIds[i % classIds.length];
        try {
          await runInsert(
            `INSERT INTO class_students (class_id, student_id, status) VALUES (?, ?, 'active')`,
            [cid, studentIds[i]]
          );
        } catch (e) {}
      }
    }

    // 4) 최근 30일 출결 기록 (평일만, 90% 출석)
    for (const sid of studentIds) {
      for (let d = 1; d <= 30; d++) {
        const date = daysAgo(d);
        const dow = new Date(date).getDay();
        if (dow === 0 || dow === 6) continue;
        const status = Math.random() < 0.9 ? 'present' : (Math.random() < 0.5 ? 'absent' : 'late');
        try {
          await runInsert(
            `INSERT INTO attendance (student_id, date, status, memo, academy_id)
             VALUES (?, ?, ?, ?, ?)`,
            [sid, date, status, SAMPLE_TAG, academyId]
          );
        } catch (e) {}
      }
    }

    // 5) 이번달 수강료 청구 (70% 완납 / 20% 미납 / 10% 부분납부)
    const thisMonth = new Date();
    const dueDate = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 15).toISOString().slice(0, 10);
    for (const sid of studentIds) {
      const r = Math.random();
      const amount = 300000;
      let status = 'pending', paidAmount = 0, paidAt = null;
      if (r < 0.7) { status = 'paid'; paidAmount = amount; paidAt = daysAgo(3); }
      else if (r < 0.9) { status = 'pending'; }
      else { status = 'partial'; paidAmount = Math.floor(amount / 2); paidAt = daysAgo(2); }
      try {
        await runInsert(
          `INSERT INTO tuition_records (academy_id, student_id, amount, due_date, status, paid_at, paid_amount, memo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [academyId, sid, amount, dueDate, status, paidAt, paidAmount, SAMPLE_TAG]
        );
      } catch (e) {}
    }

    // 6) 공지 3개 생성
    const notices = [
      ['3월 수업 안내', '이번 달 수업 일정과 준비물을 안내드립니다. (샘플 공지)'],
      ['학부모 상담 주간', '3월 셋째 주는 학부모 상담 주간입니다. (샘플 공지)'],
      ['모의고사 신청', '3월 모의고사 신청을 받습니다. (샘플 공지)'],
    ];
    for (const [title, content] of notices) {
      try {
        await runInsert(
          `INSERT INTO notices (title, content, academy_id) VALUES (?, ?, ?)`,
          [`${title} ${SAMPLE_TAG}`, content, academyId]
        );
      } catch (e) {}
    }

    // 7) 보호자 10명 + student_parents 연결
    for (let i = 0; i < studentIds.length; i++) {
      const sid = studentIds[i];
      const pname = `${KOREAN_NAMES[i].slice(0, 1)}보호자`;
      const pphone = `010-7${String(3000 + i).padStart(4, '0')}-${String((i + 7) * 311 % 10000).padStart(4, '0')}`;
      try {
        const pid = await runInsert(
          `INSERT INTO parents (academy_id, name, phone, relationship, is_payer, memo)
           VALUES (?, ?, ?, '모', true, ?) RETURNING id`,
          [academyId, pname, pphone, SAMPLE_TAG]
        );
        await runInsert(
          `INSERT INTO student_parents (student_id, parent_id, relationship, is_primary, is_payer)
           VALUES (?, ?, '모', true, true)`,
          [sid, pid]
        );
      } catch (e) {}
    }

    // 8) 상담 기록 5개
    for (let i = 0; i < 5; i++) {
      const sid = studentIds[i];
      try {
        await runInsert(
          `INSERT INTO consultation_logs (academy_id, student_id, counselor_name, consultation_type, content, tags)
           VALUES (?, ?, ?, 'general', ?, ?)`,
          [academyId, sid, '원장', `${KOREAN_NAMES[i]} 학생과의 학습 방향 상담 (샘플 데이터)`, SAMPLE_TAG]
        );
      } catch (e) {}
    }

    res.json({
      message: '샘플 데이터가 생성되었습니다.',
      summary: {
        students: studentIds.length,
        classes: classIds.length,
        notices: notices.length,
      },
    });
  } catch (err) {
    console.error('[sample-data/generate]', err);
    res.status(500).json({ error: '샘플 데이터 생성에 실패했습니다.' });
  }
});

// DELETE /api/sample-data — 샘플 데이터 일괄 삭제
router.delete('/', async (req, res) => {
  try {
    const academyId = req.academyId;
    if (!academyId) return res.status(400).json({ error: '학원 정보가 없습니다.' });

    // 샘플 student_ids 먼저 확보
    const sampleStudents = await getAll(
      `SELECT id, user_id FROM students WHERE academy_id = ? AND memo = ?`,
      [academyId, SAMPLE_TAG]
    );
    const sids = sampleStudents.map(s => s.id);
    const uids = sampleStudents.map(s => s.user_id).filter(Boolean);

    const run = async (sql, params) => { try { await runQuery(sql, params); } catch (e) {} };

    if (sids.length > 0) {
      const placeholders = sids.map(() => '?').join(',');
      await run(`DELETE FROM attendance WHERE student_id IN (${placeholders}) AND academy_id = ?`, [...sids, academyId]);
      await run(`DELETE FROM tuition_records WHERE student_id IN (${placeholders}) AND academy_id = ?`, [...sids, academyId]);
      await run(`DELETE FROM consultation_logs WHERE student_id IN (${placeholders}) AND academy_id = ?`, [...sids, academyId]);
      await run(`DELETE FROM class_students WHERE student_id IN (${placeholders})`, sids);
      await run(`DELETE FROM student_parents WHERE student_id IN (${placeholders})`, sids);
    }
    await run(`DELETE FROM parents WHERE academy_id = ? AND memo = ?`, [academyId, SAMPLE_TAG]);
    await run(`DELETE FROM classes WHERE academy_id = ? AND memo = ?`, [academyId, SAMPLE_TAG]);
    await run(`DELETE FROM notices WHERE academy_id = ? AND title LIKE ?`, [academyId, `%${SAMPLE_TAG}`]);
    await run(`DELETE FROM students WHERE academy_id = ? AND memo = ?`, [academyId, SAMPLE_TAG]);
    if (uids.length > 0) {
      const uph = uids.map(() => '?').join(',');
      await run(`DELETE FROM users WHERE id IN (${uph}) AND role = 'student' AND academy_id = ?`, [...uids, academyId]);
    }

    res.json({ message: '샘플 데이터가 삭제되었습니다.', removed: { students: sids.length } });
  } catch (err) {
    console.error('[sample-data/delete]', err);
    res.status(500).json({ error: '샘플 데이터 삭제에 실패했습니다.' });
  }
});

module.exports = router;
