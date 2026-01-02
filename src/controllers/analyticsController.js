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
    let finalCategory = category || 'Uncategorized';
    let matchedCategory = null;

    console.log(`[Affiliate] Processing click for product: ${productName}, Category: ${category}`);

    // 1. First priority: Try to match by explicit category name or search queries (exact/regex)
    if (finalCategory && finalCategory !== 'Uncategorized' && finalCategory !== 'Unknown') {
        const escapedCategory = finalCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(`^${escapedCategory}$`, 'i');

        matchedCategory = await Category.findOne({
            $or: [
                { name: { $regex: searchRegex } },
                { searchQueries: { $elemMatch: { $regex: searchRegex } } }
            ]
        });

        if (matchedCategory) {
            console.log(`[Affiliate] Matched explicit category by name/query: ${matchedCategory.name} (${matchedCategory.percentage}%)`);
        }
    }

    // 2. Second priority: If no direct match, try matching via Smart Map / Amazon Search Index
    if (!matchedCategory && finalCategory && finalCategory !== 'Uncategorized' && finalCategory !== 'Unknown') {
        const resolvedIndex = amazonApiService.resolveSearchIndex(finalCategory);
        if (resolvedIndex !== 'All') {
            matchedCategory = await Category.findOne({ amazonSearchIndex: resolvedIndex });
            if (matchedCategory) {
                console.log(`[Affiliate] Matched category via Smart Map resolution ('${finalCategory}' -> '${resolvedIndex}'): ${matchedCategory.name} (${matchedCategory.percentage}%)`);
            }
        }
    }

    // 3. Update commission if matched
    if (matchedCategory) {
        if (matchedCategory.percentage > 0) {
            commissionPercentage = matchedCategory.percentage / 100;
        }
        finalCategory = matchedCategory.name;
    }

    // 4. Fallback: Auto-detect from Product Name if still at default or no match
    if (!matchedCategory || commissionPercentage === 0.02) {
        console.log(`[Affiliate] Attempting auto-detection for '${productName}' (Current Category: ${finalCategory})`);

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

    console.log(`[Affiliate] Saved click with rate: ${commissionPercentage} (${(commissionPercentage * 100).toFixed(2)}%)`);

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
                description: `Pending Commission (${(commissionPercentage * 100).toFixed(2)}%): ${productName}`,
                referenceId: productClick._id,
                referenceModel: 'ProductClick'
            });
            console.log(`[Commission] Created pending transaction for agent: ${agentId} at ${(commissionPercentage * 100).toFixed(2)}% (Amount: ${commissionAmount})`);
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
    let clicksWithStatus = await Promise.all(clicks.map(async (click) => {
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

    // Filter by status if provided (since status is in Transaction, not ProductClick)
    if (req.query.status) {
        const status = req.query.status;
        clicksWithStatus = clicksWithStatus.filter(click => {
            if (status === 'none' || status === 'ineligible') {
                return click.commissionStatus === 'none';
            }
            return click.commissionStatus === status;
        });
    }

    return sendSuccess(res, {
        clicks: clicksWithStatus,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total: req.query.status ? clicksWithStatus.length : total,
            totalPages: req.query.status ? Math.ceil(clicksWithStatus.length / limitNum) : Math.ceil(total / limitNum),
        },
    }, 'Click data retrieved successfully');
});

// @desc    Update product click commission rate (Admin)
// @route   PUT /api/admin/analytics/clicks/:id
// @access  Private/Admin
exports.updateClickCommission = asyncHandler(async (req, res) => {
    const { id } = req.params;
    let { commissionRate } = req.body; // Expects a percentage value (e.g., 5 for 5%, 0.2 for 0.2%)

    // Always treat the input from the Admin UI as a percentage and convert to decimal for storage
    // Example: user enters 0.2 (0.2%) -> we save 0.002
    let decimalRate = 0;
    const sanitizedRate = String(req.body.commissionRate).replace(/[^0-9.]/g, '');
    
    if (sanitizedRate && !isNaN(parseFloat(sanitizedRate))) {
        decimalRate = parseFloat(sanitizedRate) / 100;
    } else {
        return sendError(res, 'Invalid commission rate provided', 400);
    }

    const click = await ProductClick.findById(id);
    if (!click) {
        return sendError(res, 'Product click not found', 404);
    }

    // Update click record
    const oldRate = click.commissionRate;
    click.commissionRate = decimalRate;
    await click.save();

    console.log(`[Admin] Updated rate for click ${id}: ${oldRate} -> ${decimalRate} (from input: ${req.body.commissionRate})`);

    // Update associated Transaction if exists
    const transaction = await Transaction.findOne({
        referenceId: click._id,
        referenceModel: 'ProductClick'
    });

    const newAmount = click.price * decimalRate;

    if (transaction) {
        if (newAmount > 0) {
            transaction.amount = newAmount;
            // Optionally update description to reflect new rate
            transaction.description = `Commission (${(decimalRate * 100).toFixed(2)}%): ${click.productName} [Updated]`;
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
            description: `Commission (${(decimalRate * 100).toFixed(2)}%): ${click.productName} [Manual Update]`,
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
    const {
        page = 1,
        limit = 20,
        startDate,
        endDate,
        status,
        category
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = { agent: userId };

    // Date filters
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
            query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
            // Set end date to end of day
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.createdAt.$lte = end;
        }
    }

    // Category filter
    if (category && category !== 'All') {
        query.category = category;
    }

    // Find clicks with query
    const clicks = await ProductClick.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

    const total = await ProductClick.countDocuments(query);

    // For each click, find the associated transaction status
    let clicksWithStatus = await Promise.all(clicks.map(async (click) => {
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

    // Filter by status if provided (since status is in Transaction, not ProductClick)
    if (status) {
        clicksWithStatus = clicksWithStatus.filter(click => {
            if (status === 'none') {
                return click.commissionStatus === 'none';
            }
            return click.commissionStatus === status;
        });
    }

    return sendSuccess(res, {
        clicks: clicksWithStatus,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total: status ? clicksWithStatus.length : total,
            totalPages: status ? Math.ceil(clicksWithStatus.length / limitNum) : Math.ceil(total / limitNum)
        }
    }, 'Agent clicks retrieved successfully');
});
