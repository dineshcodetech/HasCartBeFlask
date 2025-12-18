const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  getProduct,
  searchProducts,
  getProductsByCategory,
  getProductsByAsins,
  getPersonalizedProducts,
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');

// Get personalized products based on history
router.get('/personalized', protect, getPersonalizedProducts);

// Search products
router.get('/search', searchProducts);

// Get products by category
router.get('/category/:category', getProductsByCategory);

// Get products by ASINs (curated items)
router.post('/items', getProductsByAsins);

// Get all products (requires keywords query param)
router.get('/', getAllProducts);

// Get product by ASIN
router.get('/:asin', getProduct);

module.exports = router;
