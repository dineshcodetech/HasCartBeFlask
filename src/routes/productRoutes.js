const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  getProduct,
  searchProducts,
  getProductsByCategory,
} = require('../controllers/productController');

// Search products
router.get('/search', searchProducts);

// Get products by category
router.get('/category/:category', getProductsByCategory);

// Get all products (requires keywords query param)
router.get('/', getAllProducts);

// Get product by ASIN
router.get('/:asin', getProduct);

module.exports = router;
