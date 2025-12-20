const express = require('express');
const router = express.Router();
const {
  createWithdrawal,
  getUserWithdrawals,
  getWithdrawalById,
} = require('../controllers/withdrawalController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Test route to verify router is working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Withdrawal routes are working' });
});

router.route('/')
  .post((req, res, next) => {
    console.log('POST /api/withdrawals hit');
    next();
  }, createWithdrawal)
  .get((req, res, next) => {
    console.log('GET /api/withdrawals hit');
    next();
  }, getUserWithdrawals);

router.route('/:id')
  .get(getWithdrawalById);

module.exports = router;

