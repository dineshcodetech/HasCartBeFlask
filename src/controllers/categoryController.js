const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const {
    sendSuccess,
    sendError,
    sendValidationError,
    sendNotFound,
} = require('../utils/responseHandler');

// @desc    Get all categories
// @route   GET /api/admin/categories
// @access  Private/Admin
exports.getAllCategories = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 50, sort = '-createdAt' } = req.query;

    // Build query
    const query = {};
    if (status) {
        query.status = status;
    }

    // Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await Category.countDocuments(query);

    // Get categories
    const categories = await Category.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum);

    return sendSuccess(res, {
        categories,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
        },
    }, 'Categories retrieved successfully');
});

// @desc    Get single category by ID
// @route   GET /api/admin/categories/:id
// @access  Private/Admin
exports.getCategoryById = asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);

    if (!category) {
        return sendNotFound(res, 'Category not found');
    }

    return sendSuccess(res, category, 'Category retrieved successfully');
});

// @desc    Create new category
// @route   POST /api/admin/categories
// @access  Private/Admin
exports.createCategory = asyncHandler(async (req, res) => {
    const { name, description, percentage, status, amazonSearchIndex, icon, searchQuery, searchQueries, selectedProducts } = req.body;

    // Validate required fields
    if (!name) {
        return sendValidationError(res, 'Category name is required');
    }

    if (percentage === undefined || percentage === null) {
        return sendValidationError(res, 'Percentage is required');
    }

    // Validate percentage range
    const percentageNum = parseFloat(percentage);
    if (isNaN(percentageNum) || percentageNum < 0 || percentageNum > 100) {
        return sendValidationError(res, 'Percentage must be between 0 and 100');
    }

    // Check if category already exists
    const existingCategory = await Category.findOne({ name: name.trim() });
    if (existingCategory) {
        return sendError(res, 'Category with this name already exists', 409);
    }

    // Create category
    const category = await Category.create({
        name: name.trim(),
        description: description?.trim() || '',
        percentage: percentageNum,
        status: status || 'active',
        amazonSearchIndex: amazonSearchIndex || 'All',
        icon: icon || 'grid_view',
        searchQueries: searchQueries || (searchQuery ? [searchQuery.trim()] : []),
        selectedProducts: selectedProducts || [],
    });

    return sendSuccess(res, category, 'Category created successfully', 201);
});

// @desc    Update category
// @route   PUT /api/admin/categories/:id
// @access  Private/Admin
exports.updateCategory = asyncHandler(async (req, res) => {
    const { name, description, percentage, status, amazonSearchIndex, icon, searchQuery, searchQueries, selectedProducts } = req.body;

    const category = await Category.findById(req.params.id);

    if (!category) {
        return sendNotFound(res, 'Category not found');
    }

    // Validate percentage if provided
    if (percentage !== undefined && percentage !== null) {
        const percentageNum = parseFloat(percentage);
        if (isNaN(percentageNum) || percentageNum < 0 || percentageNum > 100) {
            return sendValidationError(res, 'Percentage must be between 0 and 100');
        }
        category.percentage = percentageNum;
    }

    // Update fields if provided
    if (name) {
        // Check for duplicate name (excluding current category)
        const existingCategory = await Category.findOne({
            name: name.trim(),
            _id: { $ne: req.params.id },
        });
        if (existingCategory) {
            return sendError(res, 'Category with this name already exists', 409);
        }
        category.name = name.trim();
    }

    if (description !== undefined) {
        category.description = description?.trim() || '';
    }

    if (status) {
        if (!['active', 'inactive'].includes(status)) {
            return sendValidationError(res, 'Status must be either active or inactive');
        }
        category.status = status;
    }

    if (icon !== undefined) {
        category.icon = icon;
    }

    // Update Amazon integration fields if provided
    if (amazonSearchIndex !== undefined) {
        category.amazonSearchIndex = amazonSearchIndex;
    }

    if (searchQueries !== undefined) {
        category.searchQueries = searchQueries;
    } else if (searchQuery !== undefined) {
        category.searchQueries = [searchQuery.trim()];
    }

    if (selectedProducts !== undefined) {
        category.selectedProducts = selectedProducts;
    }

    await category.save();

    return sendSuccess(res, category, 'Category updated successfully');
});

// @desc    Delete category
// @route   DELETE /api/admin/categories/:id
// @access  Private/Admin
exports.deleteCategory = asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);

    if (!category) {
        return sendNotFound(res, 'Category not found');
    }

    await Category.findByIdAndDelete(req.params.id);

    return sendSuccess(res, null, 'Category deleted successfully');
});
