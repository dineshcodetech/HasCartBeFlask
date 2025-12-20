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
  const users = await User.find().select('-password');
  return sendSuccess(res, users, 'Users retrieved successfully');
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
  const { userId, type, status } = req.query;
  const query = {};
  if (userId) query.user = userId;
  if (type) query.type = type;
  if (status) query.status = status;

  const transactions = await Transaction.find(query)
    .populate('user', 'name email referralCode')
    .sort({ createdAt: -1 });

  return sendSuccess(res, transactions, 'Transactions retrieved successfully');
});

// @desc    Get all withdrawal requests (Admin only)
// @route   GET /api/admin/withdrawals
// @access  Private/Admin
exports.getAllWithdrawals = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = {};
  if (status) query.status = status;

  const withdrawals = await Withdrawal.find(query)
    .populate('user', 'name email mobile balance')
    .sort({ createdAt: -1 });

  return sendSuccess(res, withdrawals, 'Withdrawal requests retrieved successfully');
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

// @desc    Get Agent Referral Tree (Admin only)
// @route   GET /api/admin/referral-tree
// @access  Private/Admin
exports.getReferralTree = asyncHandler(async (req, res) => {
  const agents = await User.find({ role: 'agent' }).select('name email referralCode referredBy');

  // Build tree structure
  const agentMap = {};
  agents.forEach(agent => {
    agentMap[agent._id] = { ...agent.toObject(), children: [] };
  });

  const tree = [];
  agents.forEach(agent => {
    if (agent.referredBy && agentMap[agent.referredBy]) {
      agentMap[agent.referredBy].children.push(agentMap[agent._id]);
    } else {
      tree.push(agentMap[agent._id]);
    }
  });

  return sendSuccess(res, tree, 'Referral tree retrieved successfully');
});

// @desc    Get Agent-wise Click & Earnings Report (Admin only)
// @route   GET /api/admin/reports/agent-clicks
// @access  Private/Admin
exports.getAgentClickReport = asyncHandler(async (req, res) => {
  const report = await ProductClick.aggregate([
    { $match: { agent: { $ne: null } } },
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
      $project: {
        agentName: '$agentDetails.name',
        agentEmail: '$agentDetails.email',
        referralCode: '$agentDetails.referralCode',
        totalClicks: 1,
        totalSalesVolume: 1,
        estimatedEarnings: { $multiply: ['$totalSalesVolume', 0.02] },
        productCount: { $size: '$products' }
      }
    },
    { $sort: { totalClicks: -1 } }
  ]);

  return sendSuccess(res, report, 'Agent click report retrieved successfully');
});

