const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Multer 설정
const uploadDir = path.join(__dirname, '../../uploads/portfolio');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, uniqueName + ext);
  }
});

const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|mp4|mov/;
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  if (allowedTypes.test(ext) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('지원하지 않는 파일 형식입니다.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter
});

// 관리자 전용 라우트
router.use(authenticateToken);

// 작품 업로드
router.post('/upload', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일을 업로드해주세요.' });

  const { student_id, title, description } = req.body;
  if (!student_id || !title) return res.status(400).json({ error: '학생과 제목은 필수입니다.' });

  const filePath = `/uploads/portfolio/${req.file.filename}`;
  const fileType = path.extname(req.file.originalname).toLowerCase().slice(1);

  const id = await runInsert(
    'INSERT INTO portfolios (academy_id, student_id, title, description, file_path, file_type) VALUES (?, ?, ?, ?, ?, ?)',
    [req.academyId, student_id, title, description || '', filePath, fileType]
  );
  res.json({ id, filePath, message: '포트폴리오가 업로드되었습니다.' });
});

// 학생 포트폴리오 목록
router.get('/student/:id', requireAdmin, async (req, res) => {
  const rows = await getAll(
    'SELECT * FROM portfolios WHERE academy_id = ? AND student_id = ? ORDER BY created_at DESC',
    [req.academyId, req.params.id]
  );
  res.json(rows);
});

// 포트폴리오 상세
router.get('/:id', requireAdmin, async (req, res) => {
  const row = await getOne('SELECT * FROM portfolios WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  if (!row) return res.status(404).json({ error: '포트폴리오를 찾을 수 없습니다.' });
  res.json(row);
});

// 포트폴리오 삭제
router.delete('/:id', requireAdmin, async (req, res) => {
  const row = await getOne('SELECT id, file_path FROM portfolios WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  if (!row) return res.status(404).json({ error: '포트폴리오를 찾을 수 없습니다.' });

  // 파일 삭제
  const fullPath = path.join(__dirname, '../..', row.file_path);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  await runQuery('DELETE FROM portfolios WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  res.json({ message: '포트폴리오가 삭제되었습니다.' });
});

// 학부모 열람용 (requireAdmin 없이 authenticateToken만)
router.get('/parent-view/:studentId', async (req, res) => {
  const rows = await getAll(
    'SELECT id, title, description, file_path, file_type, created_at FROM portfolios WHERE academy_id = ? AND student_id = ? ORDER BY created_at DESC',
    [req.academyId, req.params.studentId]
  );
  res.json(rows);
});

module.exports = router;
