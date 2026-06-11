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

// 작품 업로드 — 관리자는 임의 학생 지정, 학생은 본인 것만
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일을 업로드해주세요.' });

  const { title, description } = req.body;
  const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
  let studentId = req.body.student_id;
  if (!isAdmin) {
    const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
    if (!student) return res.status(403).json({ error: '학생 계정만 업로드할 수 있습니다.' });
    studentId = student.id;
  }
  if (!studentId || !title) return res.status(400).json({ error: '학생과 제목은 필수입니다.' });

  const filePath = `/uploads/portfolio/${req.file.filename}`;
  const fileType = path.extname(req.file.originalname).toLowerCase().slice(1);

  const id = await runInsert(
    'INSERT INTO portfolios (academy_id, student_id, title, description, file_path, file_type) VALUES (?, ?, ?, ?, ?, ?)',
    [req.academyId, studentId, title, description || '', filePath, fileType]
  );
  res.json({ id, filePath, message: '포트폴리오가 업로드되었습니다.' });
});

// 학생 본인 포트폴리오 목록 — '/student/:id'보다 먼저 선언해야 매칭됨
router.get('/student/me', async (req, res) => {
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.status(403).json({ error: '학생 계정만 조회할 수 있습니다.' });
  const rows = await getAll(
    'SELECT id, title, description, file_path AS file_url, file_type, created_at FROM portfolios WHERE academy_id = ? AND student_id = ? ORDER BY created_at DESC',
    [req.academyId, student.id]
  );
  res.json(rows);
});

// 전체 포트폴리오 목록 (관리자) — '/student/:id'보다 먼저 선언해야 매칭됨
router.get('/student/all', requireAdmin, async (req, res) => {
  const rows = await getAll(
    `SELECT p.id, p.student_id, p.title, p.description, p.file_path AS file_url, p.file_type, p.created_at, u.name AS student_name
     FROM portfolios p
     JOIN students s ON p.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE p.academy_id = ?
     ORDER BY p.created_at DESC
     LIMIT 500`,
    [req.academyId]
  );
  res.json(rows);
});

// 학생 포트폴리오 목록
router.get('/student/:id', requireAdmin, async (req, res) => {
  const rows = await getAll(
    `SELECT p.id, p.student_id, p.title, p.description, p.file_path AS file_url, p.file_type, p.created_at, u.name AS student_name
     FROM portfolios p
     JOIN students s ON p.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE p.academy_id = ? AND p.student_id = ?
     ORDER BY p.created_at DESC`,
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
