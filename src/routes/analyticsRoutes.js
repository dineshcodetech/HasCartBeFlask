const express = require('express');
const router = express.Router();
const { trackProductClick, getMyProductClicks } = require('../controllers/analyticsController');
const { protect, optionalProtect } = require('../middleware/auth');

// Track click is optional protect (supports guest tracking)
router.post('/track-click', optionalProtect, trackProductClick);

// My clicks requires protection
router.get('/my-clicks', protect, getMyProductClicks);

module.exports = router;
