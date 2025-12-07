const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  getProductByAsin,
  getProductStats,
} = require('../controllers/adminProductController');

// All routes require authentication and admin role
// This will be handled by the parent adminRoutes

// Product statistics
router.get('/stats', getProductStats);

// Get product by ASIN from Amazon API
router.get('/asin/:asin', getProductByAsin);

// Search products from Amazon API
router.get('/', getAllProducts);

module.exports = router;

