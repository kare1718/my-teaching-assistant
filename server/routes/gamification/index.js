const express = require('express');
const router = express.Router();

// Each sub-router applies authenticateToken per-route
// Mount sub-routers
router.use('/', require('./student'));
router.use('/', require('./rankings'));
router.use('/', require('./quizzes'));
router.use('/', require('./shop'));
router.use('/admin', require('./admin'));
router.use('/admin', require('./backup'));

module.exports = router;
