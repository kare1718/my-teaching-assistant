const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { generateReportComment, isConfigured: isGeminiConfigured } = require('../utils/geminiHelper');
const { sendSMS, isConfigured: isSmsConfigured } = require('../utils/smsHelper');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// === 설정 상태 ===
router.get('/status', (req, res) => {
  res.json({ gemini: isGeminiConfigured(), sms: isSmsConfigured() });
});

// === 템플릿 CRUD ===
router.get('/templates', async (req, res) => {
  res.json(await getAll('SELECT * FROM report_templates WHERE academy_id = ? ORDER BY is_default DESC, id ASC', [req.academyId]));
});

router.post('/templates', async (req, res) => {
  const { name, description, fields } = req.body;
  if (!name) return res.status(400).json({ error: '이름을 입력해주세요.' });
  const id = await runInsert('INSERT INTO report_templates (name, description, fields_json, academy_id) VALUES (?, ?, ?, ?)',
    [name, description || '', JSON.stringify(fields || []), req.academyId]);
  res.json({ message: '템플릿 생성됨', id });
});

router.put('/templates/:id', async (req, res) => {
  const { name, description, fields } = req.body;
  await runQuery('UPDATE report_templates SET name = ?, description = ?, fields_json = ? WHERE id = ? AND academy_id = ?',
    [name, description || '', JSON.stringify(fields || []), req.params.id, req.academyId]);
  res.json({ message: '템플릿 수정됨' });
});

router.delete('/templates/:id', async (req, res) => {
  const tmpl = await getOne('SELECT is_default FROM report_templates WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  if (tmpl?.is_default) return res.status(400).json({ error: '기본 템플릿은 삭제할 수 없습니다.' });
  await runQuery('DELETE FROM report_templates WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  res.json({ message: '템플릿 삭제됨' });
});

// === 학생 목록 (레포트 작성용) ===
router.get('/class-students', async (req, res) => {
  const { school, grade } = req.query;
  let query = `SELECT s.id, u.name, s.school, s.grade, s.parent_phone
    FROM students s JOIN users u ON s.user_id = u.id
    WHERE s.status = 'active' AND s.school NOT IN ('조교', '선생님') AND s.academy_id = ?`;
  const params = [req.academyId];
  if (school) { query += ' AND s.school = ?'; params.push(school); }
  if (grade) { query += ' AND s.grade = ?'; params.push(grade); }
  query += ' ORDER BY s.school, s.grade, u.name';
  res.json(await getAll(query, params));
});

// === 학생 시험 성적 자동 로드 ===
router.get('/student-exam-data/:studentId', async (req, res) => {
  const scores = await getAll(
    `SELECT sc.score, sc.rank_num, e.name as exam_name, e.max_score, e.exam_date,
            (SELECT COUNT(*) FROM scores WHERE exam_id = e.id AND academy_id = ?) as total_students
     FROM scores sc JOIN exams e ON sc.exam_id = e.id
     WHERE sc.student_id = ? AND sc.academy_id = ? ORDER BY e.exam_date DESC LIMIT 3`,
    [req.academyId, req.params.studentId, req.academyId]);
  res.json(scores);
});

// === 레포트 CRUD ===
router.post('/', async (req, res) => {
  const { templateId, studentId, reportDate, className, items, aiComment } = req.body;
  if (!templateId || !studentId || !reportDate) return res.status(400).json({ error: '필수 정보가 없습니다.' });
  const id = await runInsert(
    `INSERT INTO student_reports (template_id, student_id, report_date, class_name, items_json, ai_comment, status, created_by, academy_id)
     VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
    [templateId, studentId, reportDate, className || '', JSON.stringify(items || {}), aiComment || '', req.user.id, req.academyId]);
  res.json({ message: '레포트 저장됨', id });
});

router.post('/bulk', async (req, res) => {
  const { templateId, reportDate, className, reports } = req.body;
  if (!templateId || !reportDate || !Array.isArray(reports)) return res.status(400).json({ error: '필수 정보가 없습니다.' });
  let saved = 0;
  for (const r of reports) {
    if (!r.studentId) continue;
    // 기존 레포트 존재하면 업데이트
    const existing = await getOne(
      'SELECT id FROM student_reports WHERE template_id = ? AND student_id = ? AND report_date = ? AND academy_id = ?',
      [templateId, r.studentId, reportDate, req.academyId]);
    if (existing) {
      await runQuery('UPDATE student_reports SET items_json = ?, ai_comment = ?, class_name = ?, status = ? WHERE id = ? AND academy_id = ?',
        [JSON.stringify(r.items || {}), r.aiComment || '', className || '', 'completed', existing.id, req.academyId]);
    } else {
      await runInsert(
        `INSERT INTO student_reports (template_id, student_id, report_date, class_name, items_json, ai_comment, status, created_by, academy_id)
         VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
        [templateId, r.studentId, reportDate, className || '', JSON.stringify(r.items || {}), r.aiComment || '', req.user.id, req.academyId]);
    }
    saved++;
  }
  res.json({ message: `${saved}건 레포트 저장됨`, saved });
});

router.put('/:id', async (req, res) => {
  const { items, aiComment, status } = req.body;
  const updates = [];
  const params = [];
  if (items !== undefined) { updates.push('items_json = ?'); params.push(JSON.stringify(items)); }
  if (aiComment !== undefined) { updates.push('ai_comment = ?'); params.push(aiComment); }
  if (status) { updates.push('status = ?'); params.push(status); }
  if (updates.length === 0) return res.status(400).json({ error: '수정할 내용이 없습니다.' });
  params.push(req.params.id);
  params.push(req.academyId);
  await runQuery(`UPDATE student_reports SET ${updates.join(', ')} WHERE id = ? AND academy_id = ?`, params);
  res.json({ message: '레포트 수정됨' });
});

router.delete('/:id', async (req, res) => {
  await runQuery('DELETE FROM student_reports WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  res.json({ message: '레포트 삭제됨' });
});

// 학생별 레포트 목록
router.get('/student/:studentId', async (req, res) => {
  const reports = await getAll(
    `SELECT sr.*, rt.name as template_name
     FROM student_reports sr JOIN report_templates rt ON sr.template_id = rt.id
     WHERE sr.student_id = ? AND sr.academy_id = ? ORDER BY sr.report_date DESC, sr.id DESC`,
    [req.params.studentId, req.academyId]);
  res.json(reports);
});

// 전체 레포트 목록 (필터)
router.get('/list', async (req, res) => {
  const { school, grade, dateFrom, dateTo } = req.query;
  let query = `SELECT sr.*, rt.name as template_name, u.name as student_name, s.school, s.grade
    FROM student_reports sr
    JOIN report_templates rt ON sr.template_id = rt.id
    JOIN students s ON sr.student_id = s.id
    JOIN users u ON s.user_id = u.id WHERE sr.academy_id = ?`;
  const params = [req.academyId];
  if (school) { query += ' AND s.school = ?'; params.push(school); }
  if (grade) { query += ' AND s.grade = ?'; params.push(grade); }
  if (dateFrom) { query += ' AND sr.report_date >= ?'; params.push(dateFrom); }
  if (dateTo) { query += ' AND sr.report_date <= ?'; params.push(dateTo); }
  query += ' ORDER BY sr.report_date DESC, sr.id DESC LIMIT 200';
  res.json(await getAll(query, params));
});

// === AI 코멘트 생성 ===
router.post('/generate-comment-preview', async (req, res) => {
  const { studentId, items, templateId } = req.body;
  if (!isGeminiConfigured()) return res.status(400).json({ error: 'Gemini API가 설정되지 않았습니다.' });

  const student = await getOne(
    `SELECT u.name, s.school, s.grade FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.academy_id = ?`,
    [studentId, req.academyId]);
  if (!student) return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });

  const template = await getOne('SELECT fields_json FROM report_templates WHERE id = ? AND academy_id = ?', [templateId, req.academyId]);
  const fields = template ? JSON.parse(template.fields_json) : [];

  try {
    const comment = await generateReportComment({
      studentName: student.name,
      school: student.school,
      grade: student.grade,
      items: items || {},
      templateFields: fields,
    });
    res.json({ comment });
  } catch (e) {
    res.status(500).json({ error: 'AI 코멘트 생성 실패: ' + e.message });
  }
});

router.post('/:id/generate-comment', async (req, res) => {
  if (!isGeminiConfigured()) return res.status(400).json({ error: 'Gemini API가 설정되지 않았습니다.' });

  const report = await getOne('SELECT * FROM student_reports WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  if (!report) return res.status(404).json({ error: '레포트를 찾을 수 없습니다.' });

  const student = await getOne(
    `SELECT u.name, s.school, s.grade FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.academy_id = ?`,
    [report.student_id, req.academyId]);

  const template = await getOne('SELECT fields_json FROM report_templates WHERE id = ? AND academy_id = ?', [report.template_id, req.academyId]);
  const fields = template ? JSON.parse(template.fields_json) : [];
  const items = JSON.parse(report.items_json || '{}');

  try {
    const comment = await generateReportComment({
      studentName: student.name, school: student.school, grade: student.grade,
      items, templateFields: fields,
    });
    await runQuery('UPDATE student_reports SET ai_comment = ? WHERE id = ? AND academy_id = ?', [comment, req.params.id, req.academyId]);
    res.json({ comment });
  } catch (e) {
    res.status(500).json({ error: 'AI 코멘트 생성 실패: ' + e.message });
  }
});

// === 레포트 미리보기 HTML ===
router.get('/:id/preview', async (req, res) => {
  const report = await getOne('SELECT * FROM student_reports WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  if (!report) return res.status(404).json({ error: '레포트를 찾을 수 없습니다.' });

  const student = await getOne(
    `SELECT u.name, s.school, s.grade FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.academy_id = ?`,
    [report.student_id, req.academyId]);
  const template = await getOne('SELECT * FROM report_templates WHERE id = ? AND academy_id = ?', [report.template_id, req.academyId]);
  const fields = template ? JSON.parse(template.fields_json) : [];
  const items = JSON.parse(report.items_json || '{}');

  const fieldHtml = fields.map(f => {
    const val = items[f.key];
    if (val === undefined || val === '') return '';
    let displayVal = val;
    if (f.type === 'auto_score' && typeof val === 'object') {
      displayVal = `${val.exam_name}: ${val.score}점/${val.max_score}점 (${val.rank_num}등)`;
    }
    const color = f.type === 'select'
      ? (val === '매우 좋음' || val === '우수' || val === '매우 적극적' ? '#059669'
        : val === '노력 필요' || val === '미제출' || val === '소극적' ? '#dc2626' : '#1e40af')
      : '#1e293b';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9">
      <span style="font-weight:600;color:#475569;font-size:14px">${f.label}</span>
      <span style="font-weight:700;color:${color};font-size:14px">${displayVal}</span>
    </div>`;
  }).filter(Boolean).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>수업 레포트</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Pretendard', -apple-system, sans-serif; margin: 0; padding: 20px; background: white; color: #1e293b; }
  .report { max-width: 600px; margin: 0 auto; }
  .header { text-align: center; padding: 24px 0; border-bottom: 3px solid #1e3a5f; margin-bottom: 20px; }
  .header h1 { font-size: 22px; color: #1e3a5f; margin: 0 0 4px 0; }
  .header p { font-size: 13px; color: #64748b; margin: 0; }
  .student-info { display: flex; justify-content: space-between; background: #f8fafc; padding: 14px 18px; border-radius: 10px; margin-bottom: 20px; font-size: 14px; }
  .section { margin-bottom: 20px; }
  .section h3 { font-size: 15px; color: #1e3a5f; margin: 0 0 10px 0; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
  .comment-box { background: linear-gradient(135deg, #eff6ff, #f0fdf4); padding: 18px; border-radius: 12px; border-left: 4px solid #2563eb; line-height: 1.8; font-size: 14px; }
  .footer { text-align: center; margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }
  @media print { body { padding: 0; } .report { max-width: none; } }
</style></head><body>
<div class="report">
  <div class="header">
    <h1>강인한 국어 연구소</h1>
    <p>수업 레포트</p>
  </div>
  <div class="student-info">
    <span><strong>${student?.name || ''}</strong> 학생</span>
    <span>${student?.school || ''} ${student?.grade || ''}</span>
    <span>${report.report_date}</span>
  </div>
  ${report.class_name ? `<div style="text-align:center;margin-bottom:16px;font-size:14px;color:#64748b">수업: <strong>${report.class_name}</strong></div>` : ''}
  <div class="section">
    <h3>📋 수업 평가</h3>
    ${fieldHtml}
  </div>
  ${report.ai_comment ? `<div class="section">
    <h3>💬 종합 코멘트</h3>
    <div class="comment-box">${report.ai_comment}</div>
  </div>` : ''}
  <div class="footer">
    강인한 국어 연구소 | ${new Date().getFullYear()}
  </div>
</div></body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// === SMS 전송 ===
router.post('/:id/send-sms', async (req, res) => {
  if (!isSmsConfigured()) return res.status(400).json({ error: 'SMS가 설정되지 않았습니다.' });

  const report = await getOne('SELECT * FROM student_reports WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  if (!report) return res.status(404).json({ error: '레포트를 찾을 수 없습니다.' });

  const student = await getOne(
    `SELECT u.name, s.parent_phone, s.school, s.grade FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.academy_id = ?`,
    [report.student_id, req.academyId]);
  if (!student?.parent_phone) return res.status(400).json({ error: '학부모 전화번호가 없습니다.' });

  const { messageOverride } = req.body;
  const template = await getOne('SELECT fields_json FROM report_templates WHERE id = ? AND academy_id = ?', [report.template_id, req.academyId]);
  const fields = template ? JSON.parse(template.fields_json) : [];
  const items = JSON.parse(report.items_json || '{}');

  let smsText = messageOverride;
  if (!smsText) {
    const summary = fields.map(f => {
      const val = items[f.key];
      if (!val || val === '') return null;
      if (f.type === 'auto_score' && typeof val === 'object') return `${f.label}: ${val.score}점`;
      return `${f.label}: ${val}`;
    }).filter(Boolean).join('\n');

    smsText = `[강인한 국어] ${student.name} 학생 수업 레포트 (${report.report_date})\n\n${summary}`;
    if (report.ai_comment) smsText += `\n\n${report.ai_comment}`;
  }

  try {
    await sendSMS(student.parent_phone, smsText);
    await runQuery('UPDATE student_reports SET sms_sent = 1, sms_sent_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    res.json({ message: 'SMS 전송 완료' });
  } catch (e) {
    res.status(500).json({ error: 'SMS 전송 실패: ' + e.message });
  }
});

router.post('/bulk-send-sms', async (req, res) => {
  const { reportIds } = req.body;
  if (!Array.isArray(reportIds) || reportIds.length === 0) return res.status(400).json({ error: '레포트를 선택해주세요.' });

  let success = 0, fail = 0;
  for (const rid of reportIds) {
    try {
      const report = await getOne('SELECT * FROM student_reports WHERE id = ? AND academy_id = ?', [rid, req.academyId]);
      if (!report) continue;
      const student = await getOne(
        `SELECT u.name, s.parent_phone FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.academy_id = ?`,
        [report.student_id, req.academyId]);
      if (!student?.parent_phone) { fail++; continue; }

      const template = await getOne('SELECT fields_json FROM report_templates WHERE id = ? AND academy_id = ?', [report.template_id, req.academyId]);
      const fields = template ? JSON.parse(template.fields_json) : [];
      const items = JSON.parse(report.items_json || '{}');
      const summary = fields.map(f => {
        const val = items[f.key];
        if (!val) return null;
        if (f.type === 'auto_score' && typeof val === 'object') return `${f.label}: ${val.score}점`;
        return `${f.label}: ${val}`;
      }).filter(Boolean).join('\n');

      let msg = `[강인한 국어] ${student.name} 학생 수업 레포트 (${report.report_date})\n\n${summary}`;
      if (report.ai_comment) msg += `\n\n${report.ai_comment}`;

      await sendSMS(student.parent_phone, msg);
      await runQuery('UPDATE student_reports SET sms_sent = 1, sms_sent_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?', [rid, req.academyId]);
      success++;
    } catch (e) { fail++; }
  }
  res.json({ message: `전송 완료: 성공 ${success}건, 실패 ${fail}건` });
});

module.exports = router;
