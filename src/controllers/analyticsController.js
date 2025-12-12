const ProductClick = require('../models/ProductClick');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError, sendValidationError } = require('../utils/responseHandler');

// @desc    Track product click (View on Amazon)
// @route   POST /api/analytics/track-click
// @access  Private
exports.trackProductClick = asyncHandler(async (req, res) => {
    const { asin, productName, category, price, imageUrl, productUrl } = req.body;
    const userId = req.user.id; // From auth middleware

    if (!asin || !productName) {
        return sendValidationError(res, 'ASIN and Product Name are required');
    }

    // Find user to get referrer info
    const user = await User.findById(userId);

    if (!user) {
        return sendError(res, 'User not found', 404);
    }

    const productClick = await ProductClick.create({
        user: userId,
        asin,
        productName,
        category: category || 'Uncategorized',
        price: price || 0,
        imageUrl,
        productUrl,
        agent: user.referredBy || null,
    });

    return sendSuccess(res, productClick, 'Click tracked successfully', 201);
});

// @desc    Get all product clicks (Admin Dashboard)
// @route   GET /api/admin/analytics/clicks
// @access  Private/Admin
exports.getProductClicks = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        category,
        agentId,
        startDate,
        endDate
    } = req.query;

    const query = {};

    // Filters
    if (category && category !== 'All') {
        query.category = category;
    }

    if (agentId) {
        query.agent = agentId;
    }

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
            query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
            // Set end date to end of day if it's just a date string
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.createdAt.$lte = end;
        }
    }

    // Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const total = await ProductClick.countDocuments(query);

    const clicks = await ProductClick.find(query)
        .populate('user', 'name email mobile')
        .populate('agent', 'name email referralCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

    return sendSuccess(res, {
        clicks,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
        },
    }, 'Click data retrieved successfully');
});
