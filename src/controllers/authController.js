const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { generateToken } = require('../utils/tokenUtils');
const sendEmail = require('../utils/sendEmail');
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
      referralCode: user.referralCode,
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
    // Remove strict validation error to follow "remove validation of signup"
    // Just use whatever digits were provided
    formattedMobile = mobileValidation.cleaned;

    // Check if mobile already exists only if we have a numeric string
    if (formattedMobile && formattedMobile.length > 0) {
      const existingByMobile = await User.findOne({ mobile: formattedMobile });
      if (existingByMobile) {
        return sendError(res, 'User with this mobile number already exists', 409);
      }
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
      referralCode: user.referralCode,
    },
  });
});

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res) => {
  console.log('[Auth] Forgot password request for:', req.body.email);
  const { email } = req.body;
  if (!email) {
    return sendValidationError(res, 'Please provide an email address');
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return sendError(res, 'There is no user with that email', 404);
  }

  // Get reset token
  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });

  const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Your reset OTP is: \n\n ${resetToken}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <h2 style="color: #2B3990; text-align: center;">Password Reset Request</h2>
      <p>Hello ${user.name},</p>
      <p>You requested to reset your password. Please use the following OTP to complete the process:</p>
      <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #2B3990; border-radius: 5px; margin: 20px 0;">
        ${resetToken}
      </div>
      <p>This OTP is valid for 10 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
      <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #777; text-align: center;">HasCart Support</p>
    </div>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Password reset OTP',
      message,
      html
    });

    return sendSuccess(res, null, 'OTP sent to email');
  } catch (err) {
    console.error('Email send error:', err);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save({ validateBeforeSave: false });

    return sendError(res, 'Email could not be sent. Please check SMTP configuration.', 500);
  }
});

// @desc    Reset password
// @route   POST /api/auth/resetpassword
// @access  Public
exports.resetPassword = asyncHandler(async (req, res) => {
  const { otp, password } = req.body;

  if (!otp || !password) {
    return sendValidationError(res, 'Please provide OTP and new password');
  }

  const user = await User.findOne({
    resetPasswordToken: otp,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return sendError(res, 'Invalid or expired OTP', 400);
  }

  // Set new password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  // Generate token
  const token = generateToken(user._id.toString());

  return res.status(200).json({
    success: true,
    message: 'Password reset successful',
    token,
  });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('+referralCode');
  return sendSuccess(res, {
    id: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    referralCode: user.referralCode,
    balance: user.balance,
    totalEarnings: user.totalEarnings
  }, 'User retrieved successfully');
});
