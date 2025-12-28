const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { generateToken } = require('../utils/tokenUtils');
const {
  sendSuccess,
  sendValidationError,
  sendUnauthorized,
  sendError,
} = require('../utils/responseHandler');
const {
  isValidEmail,
  validateAndFormatMobile,
  isValidPassword,
} = require('../utils/validationUtils');

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res) => {
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

  // Check if account is deactivated
  if (user.isDeactivated) {
    return sendUnauthorized(res, 'Your account has been deactivated. Please contact support.');
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return sendUnauthorized(res, 'Invalid credentials');
  }

  // Generate token
  const token = generateToken(user._id.toString());

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
    },
  });
});

// @desc    Signup user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = asyncHandler(async (req, res) => {
  const { name, email, password, mobile, referralCode } = req.body;

  // Validate required fields
  if (!name || !email || !password) {
    return sendValidationError(res, 'Please provide name, email and password');
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return sendValidationError(res, 'Please provide a valid email address');
  }

  // Validate password length
  if (!isValidPassword(password, 6)) {
    return sendValidationError(res, 'Password must be at least 6 characters long');
  }

  // Check if user already exists by email
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return sendError(res, 'User with this email already exists', 409);
  }

  // Validate and format mobile if provided
  let formattedMobile = null;
  if (mobile) {
    const mobileValidation = validateAndFormatMobile(mobile);
    if (!mobileValidation.valid) {
      return sendValidationError(res, 'Mobile number must be 10 digits');
    }
    formattedMobile = mobileValidation.cleaned;

    // Check if mobile already exists
    const existingByMobile = await User.findOne({ mobile: formattedMobile });
    if (existingByMobile) {
      return sendError(res, 'User with this mobile number already exists', 409);
    }
  }

  // Handle referral code if provided
  let referredBy = null;
  if (referralCode) {
    const referringAgent = await User.findOne({ referralCode: referralCode.toUpperCase() });
    if (referringAgent) {
      referredBy = referringAgent._id;
    }
  }

  // Create user
  // Build user object - only add mobile if present to avoid unique index issues with null
  const userData = {
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: password,
    role: 'user',
    referredBy: referredBy,
  };

  if (formattedMobile) {
    userData.mobile = formattedMobile;
  }

  // Create user
  const user = await User.create(userData);

  // Generate token for auto-login after signup
  const token = generateToken(user._id.toString());

  return res.status(201).json({
    success: true,
    message: 'Account created successfully',
    token,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
    },
  });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  return sendSuccess(res, user, 'User retrieved successfully');
});
