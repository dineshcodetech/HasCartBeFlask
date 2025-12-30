const ProductClick = require('../models/ProductClick');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const amazonApiService = require('../services/amazonApiService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendError, sendValidationError } = require('../utils/responseHandler');

// @desc    Track product click (View on Amazon)
// @route   POST /api/analytics/track-click
// @access  Public/Private
exports.trackProductClick = asyncHandler(async (req, res) => {
    let { asin, productName, category, price, imageUrl, productUrl, referralCode, agentId: providedAgentId } = req.body;
    const userId = req.user ? req.user.id : null; // User may or may not be logged in

    // Sanitize price if it's a string (remove currency symbols like $, ₹, commas)
    if (typeof price === 'string') {
        const cleanPrice = price.replace(/[^0-9.]/g, '');
        price = parseFloat(cleanPrice) || 0;
    } else if (typeof price === 'number') {
        // already a number
    } else {
        price = 0;
    }

    if (!asin || !productName) {
        return sendValidationError(res, 'ASIN and Product Name are required');
    }

    let agentId = providedAgentId || null;

    // Priority 0: Self-attribution if the user is an agent/admin
    // If the logged-in user is an agent, they get the attribution regardless of other factors
    if (req.user && (req.user.role === 'agent' || req.user.role === 'admin')) {
        agentId = req.user._id;
        console.log(`[Affiliate] Self-attributing click to agent/admin: ${agentId}`);
    }

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

    // Determine commission percentage based on category
    let commissionPercentage = 0.02; // Default 2%
    let finalCategory = category;

    // 0. Normalize category using Smart Map before looking up in DB
    const resolvedIndex = amazonApiService.resolveSearchIndex(finalCategory);
    if (resolvedIndex !== 'All') {
        finalCategory = resolvedIndex;
        console.log(`[Affiliate] Resolved input category '${category}' to '${finalCategory}' via Smart Map`);
    }

    // 1. Try to match by explicit category if provided and valid
    if (finalCategory && finalCategory !== 'Uncategorized' && finalCategory !== 'Unknown') {
        const escapedCategory = finalCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(`^${escapedCategory}$`, 'i');

        const categoryData = await Category.findOne({
            $or: [
                { name: { $regex: searchRegex } },
                { amazonSearchIndex: finalCategory },
                { searchQueries: { $elemMatch: { $regex: searchRegex } } }
            ]
        });

        if (categoryData) {
            if (categoryData.percentage > 0) {
                commissionPercentage = categoryData.percentage / 100;
            }
            // Normalize category name to the official one for consistency
            finalCategory = categoryData.name;
            console.log(`[Affiliate] Matched explicit category: ${finalCategory} (${categoryData.percentage}%)`);
        }
    }

    // 2. Fallback: Auto-detect from Product Name if category is missing/unknown/not matched yet
    // OR if we are still at default percentage (meaning explicit match failed to find a high-value category)
    if ((!finalCategory || finalCategory === 'Uncategorized' || finalCategory === 'Unknown') || commissionPercentage === 0.02) {
        console.log(`[Affiliate] Attempting auto-detection for '${productName}' (Input Category: ${category})`);

        // Fetch all potential categories to match against product name
        const categories = await Category.find({ status: 'active' });

        // A weak helper map for common uncategorized terms -> Likely Category Name partial
        const SMART_MAP = {
            // Electronics & TV
            'tv': 'Electronics',
            'television': 'Electronics',
            'televisions': 'Electronics',
            'smart televisions': 'Electronics',
            'led tv': 'Electronics',
            'smart led tv': 'Electronics',
            'led': 'Electronics',
            'lcd': 'Electronics',
            'monitor': 'Electronics',
            'phone': 'Electronics',
            'mobile': 'Electronics',
            'tablet': 'Electronics',
            'camera': 'Electronics',
            'headphone': 'Electronics',
            'earphone': 'Electronics',
            'speaker': 'Electronics',
            'laptop': 'Computers',
            'computer': 'Computers',
            'macbook': 'Computers',
            'keyboard': 'Computers',
            'mouse': 'Computers',
            // Watches
            'watch': 'Watches',
            'clock': 'Watches',
            'timepiece': 'Watches',
            // Home & Appliances
            'fridge': 'Appliances',
            'refrigerator': 'Appliances',
            'washing machine': 'Appliances',
            'ac': 'Appliances',
            'air conditioner': 'Appliances',
            'microwave': 'Appliances',
            'kitchen': 'HomeAndKitchen',
            'home': 'HomeAndKitchen',
            'furniture': 'Furniture',
            // Beauty & Personal Care
            'soap': 'Beauty',
            'shampoo': 'Beauty',
            'cream': 'Beauty',
            'makeup': 'Beauty',
            'perfume': 'Beauty',
            'hair': 'Beauty',
            // Fashion
            'shirt': 'Fashion',
            'pant': 'Fashion',
            'jeans': 'Fashion',
            'shoe': 'Shoes',
            'sandal': 'Shoes',
            'sneaker': 'Shoes',
            'bag': 'Luggage',
            'luggage': 'Luggage',
            'wallet': 'Luggage',
            // Grocery
            'fresh': 'GroceryAndGourmetFood',
            'vegetable': 'GroceryAndGourmetFood',
            'fruit': 'GroceryAndGourmetFood',
            'food': 'GroceryAndGourmetFood',
            'snack': 'GroceryAndGourmetFood',
            'chocolate': 'GroceryAndGourmetFood',
            'oil': 'GroceryAndGourmetFood',
            'rice': 'GroceryAndGourmetFood',
            'tea': 'GroceryAndGourmetFood',
            'coffee': 'GroceryAndGourmetFood'
        };

        // Check Smart Map first
        for (const [term, targetCatPartial] of Object.entries(SMART_MAP)) {
            // Use word boundary check to avoid false positives (e.g. 'led' in 'sealed')
            // Escape special chars in term just in case
            const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');

            if (regex.test(productName)) {
                // Find the actual category object that matches our target partial
                const smartMatch = categories.find(c =>
                    c.name.toLowerCase().includes(targetCatPartial.toLowerCase()) ||
                    c.amazonSearchIndex === targetCatPartial
                );
                if (smartMatch) {
                    if (smartMatch.percentage > 0) {
                        commissionPercentage = smartMatch.percentage / 100;
                    }
                    finalCategory = smartMatch.name;
                    console.log(`[Affiliate] Smart-detected category via term '${term}': ${finalCategory} (${smartMatch.percentage}%)`);
                    break;
                }
            }
        }

        // specific keywords to match first (priority) - ONLY if smart match didn't find anything
        if (finalCategory === 'Uncategorized' || finalCategory === 'Unknown') {
            for (const cat of categories) {
                let matched = false;

                // Check if product name contains the category name (e.g. "Automotive" in "Automotive Parts")
                // or if any search query keyword exists in product name
                const keywords = [cat.name, ...(cat.searchQueries || [])];

                for (const keyword of keywords) {
                    if (!keyword || keyword.length < 3) continue; // Skip very short keywords

                    // Use word boundary for better accuracy
                    // Escape special characters in keyword for regex
                    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const keywordRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');

                    if (keywordRegex.test(productName)) {
                        matched = true;
                        // console.log(`Matched keyword: ${keyword}`);
                        break;
                    }
                }

                if (matched) {
                    if (cat.percentage > 0) {
                        commissionPercentage = cat.percentage / 100;
                    }
                    finalCategory = cat.name;
                    console.log(`[Affiliate] Auto-detected category: ${finalCategory} (${cat.percentage}%)`);
                    break; // Use the first strong match
                }
            }
        }
    }

    const productClick = await ProductClick.create({
        user: userId || null, // Allow null for guest users
        asin,
        productName,
        category: finalCategory || 'Uncategorized',
        price: price || 0,
        imageUrl,
        productUrl,
        agent: agentId,
        commissionRate: commissionPercentage,
    });

    // Create pending commission transaction (requires admin approval)
    if (agentId && price > 0) {
        const commissionAmount = price * commissionPercentage;
        if (commissionAmount > 0) {
            // Create transaction record in PENDING state
            await Transaction.create({
                user: agentId,
                type: 'earnings',
                amount: commissionAmount,
                status: 'pending', // Requires manual approval now
                description: `Pending Commission : ${productName}`,
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

// @desc    Update product click commission rate (Admin)
// @route   PUT /api/admin/analytics/clicks/:id
// @access  Private/Admin
exports.updateClickCommission = asyncHandler(async (req, res) => {
    const { id } = req.params;
    let { commissionRate } = req.body; // Expects percentage like 0.05 or 5

    // Normalize rate: if input is like 5, treat as 5% (0.05). If < 1, treat as decimal.
    // If user explicitly sends 5 (for 5%), we convert.
    // Standardizing on decimal: e.g. 0.05
    if (commissionRate > 1) {
        commissionRate = commissionRate / 100;
    }

    const click = await ProductClick.findById(id);
    if (!click) {
        return sendError(res, 'Product click not found', 404);
    }

    // Update click record (versioning logic can be separate or simple boolean 'isOverridden')
    const oldRate = click.commissionRate;
    click.commissionRate = commissionRate;
    await click.save();

    console.log(`[Admin] Updated rate for click ${id}: ${oldRate} -> ${commissionRate}`);

    // Update associated Transaction if exists
    // OR create one if it didn't exist (e.g. was 0 rate before)
    const transaction = await Transaction.findOne({
        referenceId: click._id,
        referenceModel: 'ProductClick'
    });

    const newAmount = click.price * commissionRate;

    if (transaction) {
        if (newAmount > 0) {
            transaction.amount = newAmount;
            // Optionally update description to reflect new rate
            // But let's keep it simple or append 'Updated'
            transaction.description = `Commission (${(commissionRate * 100).toFixed(1)}%): ${click.productName} [Updated]`;
            await transaction.save();
        } else {
            // New amount is 0, maybe delete transaction? Or set to 0?
            transaction.amount = 0;
            transaction.status = 'failed'; // effectively cancelled
            await transaction.save();
        }
    } else if (newAmount > 0 && click.agent) {
        // Create new if missing and we have an agent + valid amount
        await Transaction.create({
            user: click.agent,
            type: 'earnings',
            amount: newAmount,
            status: 'pending',
            description: `Commission (${(commissionRate * 100).toFixed(1)}%): ${click.productName} [Manual Update]`,
            referenceId: click._id,
            referenceModel: 'ProductClick'
        });
    }

    return sendSuccess(res, { click, newAmount }, 'Commission rate updated successfully');
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
