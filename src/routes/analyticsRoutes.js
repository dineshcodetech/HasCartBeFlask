const express = require('express');
const router = express.Router();
const { trackProductClick } = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.post('/track-click', trackProductClick);

module.exports = router;
