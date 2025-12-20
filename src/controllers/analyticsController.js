const ProductClick = require('../models/ProductClick');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError, sendValidationError } = require('../utils/responseHandler');

// @desc    Track product click (View on Amazon)
// @route   POST /api/analytics/track-click
// @access  Public/Private
exports.trackProductClick = asyncHandler(async (req, res) => {
    const { asin, productName, category, price, imageUrl, productUrl, referralCode, agentId: providedAgentId } = req.body;
    const userId = req.user ? req.user.id : null; // User may or may not be logged in

    if (!asin || !productName) {
        return sendValidationError(res, 'ASIN and Product Name are required');
    }

    let agentId = providedAgentId || null;

    // First priority: Referral code from the share link (if agentId not already provided)
    // IMPORTANT: This works even for guest/unknown users
    if (!agentId && referralCode) {
        const agent = await User.findOne({ referralCode: referralCode.trim().toUpperCase() });
        if (agent) {
            agentId = agent._id;
            console.log(`[Affiliate] Attributing click to agent from code: ${referralCode.toUpperCase()} (User: ${userId ? userId : 'Guest'})`);
        }
    }

    // Second priority: Permanent referrer of the logged-in user (if not already attributed by link)
    if (!agentId && userId) {
        const user = await User.findById(userId);
        if (user && user.referredBy) {
            agentId = user.referredBy;
            console.log(`[Affiliate] Attributing click to user's permanent referrer: ${agentId}`);
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

    // Create pending commission transaction (requires admin approval)
    if (agentId && price > 0) {
        // Determine commission percentage based on category
        let commissionPercentage = 0.02; // Default 2%
        if (category && category !== 'Uncategorized') {
            const categoryData = await Category.findOne({
                $or: [
                    { name: category },
                    { amazonSearchIndex: category }
                ]
            });
            if (categoryData && categoryData.percentage > 0) {
                commissionPercentage = categoryData.percentage / 100;
                console.log(`[Affiliate] Using category percentage: ${categoryData.percentage}% for ${category}`);
            }
        }

        const commissionAmount = price * commissionPercentage;
        if (commissionAmount > 0) {
            // Create transaction record in PENDING state
            await Transaction.create({
                user: agentId,
                type: 'earnings',
                amount: commissionAmount,
                status: 'pending', // Requires manual approval now
                description: `Pending Commission (${(commissionPercentage * 100).toFixed(1)}%): ${productName}`,
                referenceId: productClick._id,
                referenceModel: 'ProductClick'
            });
            console.log(`[Commission] Created pending transaction for agent: ${agentId} at ${commissionPercentage * 100}%`);
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

    // For each click, find the associated transaction status
    const clicksWithStatus = await Promise.all(clicks.map(async (click) => {
        const transaction = await Transaction.findOne({
            referenceId: click._id,
            referenceModel: 'ProductClick'
        });

        return {
            ...click.toObject(),
            commissionStatus: transaction ? transaction.status : 'none',
            commissionAmount: transaction ? transaction.amount : 0,
            transactionId: transaction ? transaction._id : null
        };
    }));

    return sendSuccess(res, {
        clicks: clicksWithStatus,
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
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Find clicks
    const clicks = await ProductClick.find({ agent: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

    const total = await ProductClick.countDocuments({ agent: userId });

    // For each click, find the associated transaction status
    const clicksWithStatus = await Promise.all(clicks.map(async (click) => {
        const transaction = await Transaction.findOne({
            referenceId: click._id,
            referenceModel: 'ProductClick'
        });

        return {
            ...click.toObject(),
            commissionStatus: transaction ? transaction.status : 'none',
            commissionAmount: transaction ? transaction.amount : 0
        };
    }));

    return sendSuccess(res, {
        clicks: clicksWithStatus,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
        }
    }, 'Agent clicks retrieved successfully');
});
