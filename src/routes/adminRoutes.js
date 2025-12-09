const express = require('express');
const router = express.Router();
const { getAllUsers, getDashboard, adminLogin } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const adminProductRoutes = require('./adminProductRoutes');

// Public admin login route (no authentication required)
router.post('/login', adminLogin);

// All other admin routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/dashboard', getDashboard);
router.get('/users', getAllUsers);

// Product management routes
router.use('/products', adminProductRoutes);

module.exports = router;

