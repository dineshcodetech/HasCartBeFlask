const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const ProductClick = require('../models/ProductClick');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const asyncHandler = require('../utils/asyncHandler');
const { generateToken } = require('../utils/tokenUtils');
const {
  sendSuccess,
  sendError,
  sendValidationError,
  sendUnauthorized,
  sendForbidden,
} = require('../utils/responseHandler');

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
exports.adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate email and password
  if (!email || !password) {
    return sendValidationError(res, 'Please provide email and password');
  }

  // Check for user and include password field
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user) {
    return sendUnauthorized(res, 'Invalid credentials');
  }

  // Check if user is an admin
  if (user.role !== 'admin') {
    return sendForbidden(res, 'Access denied. Admin privileges required.');
  }

  // Check if password matches
  // const isMatch = await user.matchPassword(password);

  // if (!isMatch) {
  //   return sendUnauthorized(res, 'Invalid credentials');
  // }

  // Generate token with error handling
  let token;
  try {
    token = generateToken(user._id.toString());

    // Validate token was generated
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new Error('Token generation returned invalid value');
    }
  } catch (error) {
    console.error('Token generation error:', error.message);
    return sendError(res, `Authentication error: ${error.message}`, 500);
  }

  // Return response with token
  return res.status(200).json({
    success: true,
    message: 'Admin login successful',
    token: token, // Explicitly set token
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      referralCode: user.referralCode,
    },
  });
});

// @desc    Get all users (Admin only)
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getAllUsers = asyncHandler(async (req, res) => {
  const { role, startDate, endDate, page = 1, limit = 50 } = req.query;
  const query = {};

  if (role) query.role = role;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 50;
  const skip = (pageNum - 1) * limitNum;

  const total = await User.countDocuments(query);
  const users = await User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean();

  // For each agent, count their referred users
  const usersWithReferralCount = await Promise.all(users.map(async (user) => {
    if (user.role === 'agent' || user.role === 'admin') {
      const count = await User.countDocuments({ referredBy: user._id });
      return { ...user, referredUserCount: count };
    }
    return { ...user, referredUserCount: 0 };
  }));

  return sendSuccess(res, {
    users: usersWithReferralCount,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    }
  }, 'Users retrieved successfully');
});

// @desc    Get dashboard stats (Admin only)
// @route   GET /api/admin/dashboard
// @access  Private/Admin
exports.getDashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const weekStart = new Date(new Date().setDate(now.getDate() - 7));
  const monthStart = new Date(new Date().setMonth(now.getMonth() - 1));
  const yearStart = new Date(new Date().setFullYear(now.getFullYear() - 1));

  const [
    totalUsers,
    totalAdmins,
    totalAgents,
    totalCustomers,
    totalProducts,
    totalCategories,
    totalClicks,
    clicksToday,
    clicksThisWeek,
    clicksThisMonth,
    clicksThisYear,
    recentUsers,
    recentClicks,
    topProducts,
    earningsTodayResult
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ role: 'agent' }),
    User.countDocuments({ role: 'user' }),
    Product.countDocuments(),
    Category.countDocuments(),
    ProductClick.countDocuments(),
    ProductClick.countDocuments({ createdAt: { $gte: todayStart } }),
    ProductClick.countDocuments({ createdAt: { $gte: weekStart } }),
    ProductClick.countDocuments({ createdAt: { $gte: monthStart } }),
    ProductClick.countDocuments({ createdAt: { $gte: yearStart } }),
    User.find().sort({ createdAt: -1 }).limit(5).select('name email role createdAt'),
    ProductClick.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name email'),
    ProductClick.aggregate([
      { $group: { _id: '$asin', productName: { $first: '$productName' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]),
    ProductClick.aggregate([
      { $match: { createdAt: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: '$price' } } }
    ])
  ]);

  // Commission is 2% of price for demo purposes
  const earningsToday = earningsTodayResult.length > 0 ? (earningsTodayResult[0].total * 0.02) : 0;

  return sendSuccess(res, {
    totalUsers,
    totalAdmins,
    totalAgents,
    totalCustomers,
    totalProducts,
    totalCategories,
    totalClicks,
    clicksBreakdown: {
      today: clicksToday,
      week: clicksThisWeek,
      month: clicksThisMonth,
      year: clicksThisYear
    },
    earningsToday,
    recentUsers,
    recentClicks,
    topProducts,
    regularUsers: totalCustomers,
  }, 'Dashboard stats retrieved successfully');
});

// @desc    Get referral analytics with filters (Admin only)
// @route   GET /api/admin/referral-stats
// @access  Private/Admin
exports.getReferralAnalytics = asyncHandler(async (req, res) => {
  const { asin, startDate, endDate } = req.query;

  const query = {};
  if (asin) query.asin = asin;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  const [
    totalClicks,
    uniqueUsers,
    uniqueAgents
  ] = await Promise.all([
    ProductClick.countDocuments(query),
    ProductClick.distinct('user', query),
    ProductClick.distinct('agent', query)
  ]);

  return sendSuccess(res, {
    totalClicks,
    userCount: uniqueUsers.length,
    agentCount: uniqueAgents.filter(a => a !== null).length,
  }, 'Referral analytics retrieved successfully');
});

// @desc    Get all transactions (Admin only)
// @route   GET /api/admin/transactions
// @access  Private/Admin
exports.getAllTransactions = asyncHandler(async (req, res) => {
  const { userId, type, status, startDate, endDate, page = 1, limit = 20 } = req.query;
  const query = {};
  if (userId) query.user = userId;
  if (type) query.type = type;
  if (status) query.status = status;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const total = await Transaction.countDocuments(query);
  const transactions = await Transaction.find(query)
    .populate('user', 'name email referralCode')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  return sendSuccess(res, {
    transactions,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    }
  }, 'Transactions retrieved successfully');
});

// @desc    Update transaction status (Admin only)
// @route   PUT /api/admin/transactions/:id
// @access  Private/Admin
exports.updateTransactionStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const transaction = await Transaction.findById(req.params.id);

  if (!transaction) {
    return sendError(res, 'Transaction not found', 404);
  }

  if (transaction.status !== 'pending') {
    return sendValidationError(res, 'Transaction is already processed');
  }

  if (status === 'completed') {
    // If it's earnings, add to user balance
    if (transaction.type === 'earnings') {
      await User.findByIdAndUpdate(transaction.user, {
        $inc: {
          balance: transaction.amount,
          totalEarnings: transaction.amount
        }
      });
    }
    transaction.status = 'completed';
  } else if (status === 'failed') {
    transaction.status = 'failed';
  } else {
    return sendValidationError(res, 'Invalid status update');
  }

  await transaction.save();

  return sendSuccess(res, transaction, 'Transaction updated successfully');
});

// @desc    Get all withdrawal requests (Admin only)
// @route   GET /api/admin/withdrawals
// @access  Private/Admin
exports.getAllWithdrawals = asyncHandler(async (req, res) => {
  const { status, startDate, endDate, page = 1, limit = 20 } = req.query;
  const query = {};
  if (status) query.status = status;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const total = await Withdrawal.countDocuments(query);
  const withdrawals = await Withdrawal.find(query)
    .populate('user', 'name email mobile balance')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  return sendSuccess(res, {
    withdrawals,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    }
  }, 'Withdrawal requests retrieved successfully');
});

// @desc    Update withdrawal status (Admin only)
// @route   PUT /api/admin/withdrawals/:id
// @access  Private/Admin
exports.updateWithdrawalStatus = asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body;
  const withdrawal = await Withdrawal.findById(req.params.id);

  if (!withdrawal) {
    return sendError(res, 'Withdrawal request not found', 404);
  }

  if (withdrawal.status !== 'pending' && status !== 'failed') {
    return sendValidationError(res, 'Withdrawal already processed');
  }

  if (status === 'approved') {
    // Deduct from agent balance if not already done
    const user = await User.findById(withdrawal.user);
    if (user.balance < withdrawal.amount) {
      return sendValidationError(res, 'Insufficient balance in agent account');
    }

    user.balance -= withdrawal.amount;
    await user.save();

    // Create payout transaction
    await Transaction.create({
      user: user._id,
      type: 'payout',
      amount: -withdrawal.amount,
      status: 'completed',
      description: `Payout approved: ${withdrawal.paymentMethod}`,
      referenceId: withdrawal._id,
      referenceModel: 'Withdrawal'
    });

    withdrawal.status = 'approved';
    withdrawal.processedAt = Date.now();
  } else if (status === 'rejected') {
    withdrawal.status = 'rejected';
    withdrawal.processedAt = Date.now();
  }

  if (adminNotes) withdrawal.adminNotes = adminNotes;
  await withdrawal.save();

  return sendSuccess(res, withdrawal, 'Withdrawal status updated successfully');
});

// @desc    Get Agent-wise Click & Earnings Report (Admin only)
// @route   GET /api/admin/reports/agent-clicks
// @access  Private/Admin
exports.getAgentClickReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, page = 1, limit = 20 } = req.query;
  const matchQuery = { agent: { $ne: null } };

  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchQuery.createdAt.$lte = end;
    }
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  // Get total count for pagination
  const countResult = await ProductClick.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$agent' } },
    { $count: 'total' }
  ]);
  const total = countResult.length > 0 ? countResult[0].total : 0;

  const report = await ProductClick.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$agent',
        totalClicks: { $sum: 1 },
        totalSalesVolume: { $sum: '$price' },
        products: { $addToSet: '$productName' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'agentDetails'
      }
    },
    { $unwind: '$agentDetails' },
    {
      $lookup: {
        from: 'transactions',
        let: { agentId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$user', '$$agentId'] },
                  { $eq: ['$type', 'earnings'] },
                  { $eq: ['$status', 'completed'] }
                ]
              }
            }
          },
          { $project: { amount: 1 } }
        ],
        as: 'earnings'
      }
    },
    {
      $project: {
        agentName: '$agentDetails.name',
        agentEmail: '$agentDetails.email',
        referralCode: '$agentDetails.referralCode',
        totalClicks: 1,
        totalSalesVolume: 1,
        estimatedEarnings: { $ifNull: [{ $sum: '$earnings.amount' }, 0] },
        productCount: { $size: '$products' }
      }
    },
    { $sort: { totalClicks: -1 } },
    { $skip: skip },
    { $limit: limitNum }
  ]);

  return sendSuccess(res, {
    report,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    }
  }, 'Agent click report retrieved successfully');
});

// @desc    Get referrals for a specific agent (Admin only)
// @route   GET /api/admin/agents/:id/referrals
// @access  Private/Admin
exports.getAgentReferrals = asyncHandler(async (req, res) => {
  const referrals = await User.find({ referredBy: req.params.id }).select('-password');
  return sendSuccess(res, referrals, 'Agent referrals retrieved successfully');
});

