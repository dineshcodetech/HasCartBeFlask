const express = require('express');
const router = express.Router();
const {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
} = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);

// Protected routes (require auth & admin role)
router.use(protect);
router.use(authorize('admin'));

// CRUD routes (Protected)
router.post('/', createCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

module.exports = router;
