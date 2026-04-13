const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { addEvent, getTimeline } = require('../services/timeline');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// ═══════════════════════════════════════════
// 학생 타임라인 조회
// ═══════════════════════════════════════════

router.get('/student/:id', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const { eventTypes, dateFrom, dateTo, limit: limitStr, offset: offsetStr } = req.query;

    const options = {
      limit: parseInt(limitStr) || 30,
      offset: parseInt(offsetStr) || 0,
    };

    if (eventTypes) {
      options.eventTypes = eventTypes.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (dateFrom) options.dateFrom = dateFrom;
    if (dateTo) options.dateTo = dateTo;

    const events = await getTimeline(req.academyId, studentId, options);
    res.json(events);
  } catch (err) {
    console.error('[타임라인 조회 오류]', err.message);
    res.status(500).json({ error: '타임라인 조회 중 오류가 발생했습니다.' });
  }
});

// ═══════════════════════════════════════════
// 수기 메모 추가
// ═══════════════════════════════════════════

router.post('/student/:id/note', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const { title, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: '메모 제목은 필수입니다.' });
    }

    const id = await addEvent(
      req.academyId, studentId, 'note', title.trim(),
      description || null, {}, req.user?.id
    );

    res.json({ id, message: '메모가 추가되었습니다.' });
  } catch (err) {
    console.error('[메모 추가 오류]', err.message);
    res.status(500).json({ error: '메모 추가 중 오류가 발생했습니다.' });
  }
});

// ═══════════════════════════════════════════
// 중요 표시 토글
// ═══════════════════════════════════════════

router.put('/events/:id/pin', async (req, res) => {
  try {
    const event = await getOne(
      'SELECT id, is_pinned FROM student_events WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!event) return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });

    const newPinned = !event.is_pinned;
    await runQuery(
      'UPDATE student_events SET is_pinned = ? WHERE id = ? AND academy_id = ?',
      [newPinned, req.params.id, req.academyId]
    );

    res.json({ is_pinned: newPinned, message: newPinned ? '중요 표시되었습니다.' : '중요 표시가 해제되었습니다.' });
  } catch (err) {
    console.error('[핀 토글 오류]', err.message);
    res.status(500).json({ error: '중요 표시 변경 중 오류가 발생했습니다.' });
  }
});

// ═══════════════════════════════════════════
// 수기 메모 삭제 (note 타입만)
// ═══════════════════════════════════════════

router.delete('/events/:id', async (req, res) => {
  try {
    const event = await getOne(
      'SELECT id, event_type FROM student_events WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!event) return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });
    if (event.event_type !== 'note') {
      return res.status(400).json({ error: '수기 메모만 삭제할 수 있습니다.' });
    }

    await runQuery(
      'DELETE FROM student_events WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );

    res.json({ message: '메모가 삭제되었습니다.' });
  } catch (err) {
    console.error('[메모 삭제 오류]', err.message);
    res.status(500).json({ error: '메모 삭제 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
