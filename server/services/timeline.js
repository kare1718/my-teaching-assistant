const { getAll, getOne, runQuery, runInsert } = require('../db/database');

/**
 * 학생 타임라인에 이벤트 추가
 * @param {number} academyId
 * @param {number} studentId
 * @param {string} eventType - attendance, absence, late, consultation, tuition_billed, tuition_paid, tuition_overdue, exam_score, note, status_change, class_enrolled, class_dropped
 * @param {string} title - 이벤트 제목 (최대 200자)
 * @param {string|null} description - 상세 설명
 * @param {object} metadata - 추가 메타데이터 (JSON)
 * @param {number|null} createdBy - 생성자 user ID
 */
async function addEvent(academyId, studentId, eventType, title, description = null, metadata = {}, createdBy = null) {
  try {
    await runInsert(
      `INSERT INTO student_events (academy_id, student_id, event_type, title, description, metadata, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [academyId, studentId, eventType, title, description, JSON.stringify(metadata), createdBy]
    );
  } catch (e) {
    console.error('[timeline] addEvent 실패:', e.message);
  }
}

/**
 * 학생 타임라인 조회
 * @param {number} academyId
 * @param {number} studentId
 * @param {object} options - { limit, offset, eventTypes, dateFrom, dateTo }
 */
async function getTimeline(academyId, studentId, options = {}) {
  const { limit = 30, offset = 0, eventTypes, dateFrom, dateTo } = options;

  let conditions = ['se.academy_id = ?', 'se.student_id = ?'];
  const params = [academyId, studentId];

  if (eventTypes && eventTypes.length > 0) {
    const placeholders = eventTypes.map(() => '?').join(',');
    conditions.push(`se.event_type IN (${placeholders})`);
    params.push(...eventTypes);
  }

  if (dateFrom) {
    conditions.push('se.event_date >= ?');
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push('se.event_date <= ?');
    params.push(dateTo);
  }

  const whereClause = conditions.join(' AND ');
  params.push(limit, offset);

  const rows = await getAll(
    `SELECT se.*, u.name as created_by_name
     FROM student_events se
     LEFT JOIN users u ON u.id = se.created_by
     WHERE ${whereClause}
     ORDER BY se.is_pinned DESC, se.event_date DESC, se.id DESC
     LIMIT ? OFFSET ?`,
    params
  );
  return rows;
}

module.exports = { addEvent, getTimeline };
