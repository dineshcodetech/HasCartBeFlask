const express = require('express');
const router = express.Router();
const { getMyReferrals, getReferralStats, getMyReferralCode } = require('../controllers/referralController');
const { protect, authorize } = require('../middleware/auth');

// All referral routes require authentication
router.use(protect);

// Only agents and admins can access referral routes
router.get('/my-code', authorize('agent', 'admin'), getMyReferralCode);
router.get('/my-referrals', authorize('agent', 'admin'), getMyReferrals);
router.get('/stats', authorize('agent', 'admin'), getReferralStats);

module.exports = router;

