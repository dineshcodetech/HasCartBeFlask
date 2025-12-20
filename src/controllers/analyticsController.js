const ProductClick = require('../models/ProductClick');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError, sendValidationError } = require('../utils/responseHandler');

// @desc    Track product click (View on Amazon)
// @route   POST /api/analytics/track-click
// @access  Public/Private
exports.trackProductClick = asyncHandler(async (req, res) => {
    const { asin, productName, category, price, imageUrl, productUrl, referralCode } = req.body;
    const userId = req.user ? req.user.id : null; // User may or may not be logged in

    if (!asin || !productName) {
        return sendValidationError(res, 'ASIN and Product Name are required');
    }

    let agentId = null;

    if (userId) {
        // Find user to get referrer info
        const user = await User.findById(userId);
        if (user) {
            agentId = user.referredBy || null;
        }
    } else if (referralCode) {
        // Guest user with a referral code from a shared link
        const agent = await User.findOne({ referralCode: referralCode.toUpperCase() });
        if (agent) {
            agentId = agent._id;
        }
    }

    const productClick = await ProductClick.create({
        user: userId || null, // Allow null for guest users
        asin,
        productName,
        category: category || 'Uncategorized',
        price: price || 0,
        imageUrl,
        productUrl,
        agent: agentId,
    });

    // Auto-commission calculation (2% of price)
    if (agentId && price > 0) {
        const commissionAmount = price * 0.02;
        if (commissionAmount > 0) {
            // Update agent balance
            await User.findByIdAndUpdate(agentId, {
                $inc: {
                    balance: commissionAmount,
                    totalEarnings: commissionAmount
                }
            });

            // Create transaction record
            await Transaction.create({
                user: agentId,
                type: 'earnings',
                amount: commissionAmount,
                status: 'completed',
                description: `Commission for product click: ${productName}`,
                referenceId: productClick._id,
                referenceModel: 'ProductClick'
            });
        }
    }

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

// @desc    Get current user's product clicks (Personalized history)
// @route   GET /api/analytics/my-clicks
// @access  Private
exports.getMyProductClicks = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const limitNum = 10;

    const clicks = await ProductClick.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limitNum);

    return sendSuccess(res, clicks, 'Personal history retrieved successfully');
});
