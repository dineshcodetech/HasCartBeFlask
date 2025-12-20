const express = require('express');
const router = express.Router();
const {
    getAllUsers,
    getDashboard,
    adminLogin,
    getReferralAnalytics,
    getAllTransactions,
    createTransactionForClick,
    updateTransactionStatus,
    getAllWithdrawals,
    updateWithdrawalStatus,
    getReferralTree,
    getAgentClickReport,
    getAgentReferrals
} = require('../controllers/adminController');
const { getProductClicks } = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');
const adminProductRoutes = require('./adminProductRoutes');

// Public admin login route (no authentication required)
router.post('/login', adminLogin);

// All other admin routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/dashboard', getDashboard);
router.get('/users', getAllUsers);
router.get('/analytics/clicks', getProductClicks);
router.get('/referral-stats', getReferralAnalytics);
router.get('/transactions', getAllTransactions);
router.post('/transactions/create-for-click', createTransactionForClick);
router.put('/transactions/:id', updateTransactionStatus);
router.get('/withdrawals', getAllWithdrawals);
router.put('/withdrawals/:id', updateWithdrawalStatus);
router.get('/reports/agent-clicks', getAgentClickReport);
router.get('/agents/:id/referrals', getAgentReferrals);

// Product management routes
router.use('/products', adminProductRoutes);

module.exports = router;

