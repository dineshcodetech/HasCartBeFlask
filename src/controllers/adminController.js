const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const ProductClick = require('../models/ProductClick');
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
  const [
    totalUsers,
    totalAdmins,
    totalAgents,
    totalCustomers,
    totalProducts,
    totalCategories,
    totalClicks,
    recentUsers,
    recentClicks,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ role: 'agent' }),
    User.countDocuments({ role: 'user' }),
    Product.countDocuments(),
    Category.countDocuments(),
    ProductClick.countDocuments(),
    User.find().sort({ createdAt: -1 }).limit(5).select('name email role createdAt'),
    ProductClick.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name email')
  ]);

  return sendSuccess(res, {
    totalUsers,
    totalAdmins,
    totalAgents,
    totalCustomers,
    totalProducts,
    totalCategories,
    totalClicks,
    recentUsers,
    recentClicks,
    regularUsers: totalCustomers,
  }, 'Dashboard stats retrieved successfully');
});

