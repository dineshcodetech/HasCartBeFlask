const express = require('express');
const router = express.Router();
const { getBanners, createBanner, updateBanner, deleteBanner } = require('../controllers/bannerController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getBanners);
router.post('/', protect, authorize('admin', 'agent'), createBanner); // Allowing agents/admins to add banners
router.put('/:id', protect, authorize('admin', 'agent'), updateBanner);
router.delete('/:id', protect, authorize('admin'), deleteBanner);

module.exports = router;
