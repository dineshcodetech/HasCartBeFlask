const express = require('express');
const router = express.Router();
const { login, signup, getMe, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.post('/signup', signup);

// Password recovery
router.post('/forgot-password', forgotPassword);
router.post('/forgotpassword', forgotPassword); // Alias for convenience
router.post('/reset-password', resetPassword);
router.post('/resetpassword', resetPassword); // Alias for convenience

router.get('/me', protect, getMe);

module.exports = router;
