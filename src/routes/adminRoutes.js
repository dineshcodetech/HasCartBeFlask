const express = require('express');
const router = express.Router();
const {
    getAllUsers,
    getDashboard,
    adminLogin,
    getReferralAnalytics,
    getAllTransactions,
    getAllWithdrawals,
    updateWithdrawalStatus,
    getReferralTree,
    getAgentClickReport
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
router.get('/withdrawals', getAllWithdrawals);
router.put('/withdrawals/:id', updateWithdrawalStatus);
router.get('/referral-tree', getReferralTree);
router.get('/reports/agent-clicks', getAgentClickReport);

// Product management routes
router.use('/products', adminProductRoutes);

module.exports = router;

