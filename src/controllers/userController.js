const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
} = require('../utils/responseHandler');
const {
  isValidEmail,
  validateAndFormatMobile,
  isValidPassword,
  validateRequiredFields,
} = require('../utils/validationUtils');

// Get all users
exports.getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('-password');
  return sendSuccess(res, users, 'Users retrieved successfully');
});

// Get single user
exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) {
    return sendNotFound(res, 'User not found');
  }
  return sendSuccess(res, user, 'User retrieved successfully');
});

// Create user
exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, mobile, role, referralCode } = req.body;

  // Validate required fields
  const requiredValidation = validateRequiredFields(
    { name, email, password, mobile },
    ['name', 'email', 'password', 'mobile']
  );
  if (!requiredValidation.valid) {
    return sendValidationError(
      res,
      `Please provide: ${requiredValidation.missing.join(', ')}`
    );
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return sendValidationError(res, 'Please provide a valid email address');
  }

  // Validate password length
  if (!isValidPassword(password, 6)) {
    return sendValidationError(res, 'Password must be at least 6 characters long');
  }

  // Validate and format mobile number
  const mobileValidation = validateAndFormatMobile(mobile);
  if (!mobileValidation.valid) {
    return sendValidationError(res, 'Mobile number must be 10 digits');
  }

  const formattedMobile = mobileValidation.cleaned;

  // Check if user already exists by email
  const existingUserByEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingUserByEmail) {
    return sendError(res, 'User with this email already exists', 409);
  }

  // Check if user already exists by mobile
  const existingUserByMobile = await User.findOne({ mobile: formattedMobile });
  if (existingUserByMobile) {
    return sendError(res, 'User with this mobile number already exists', 409);
  }

  // Handle referral code if provided
  let referredBy = null;
  if (referralCode) {
    const referringAgent = await User.findOne({ referralCode: referralCode.toUpperCase() });
    if (referringAgent) {
      referredBy = referringAgent._id;
    } else {
      return sendValidationError(res, 'Invalid referral code');
    }
  }

  // Create user
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: password,
    mobile: formattedMobile,
    role: role || 'user',
    referredBy: referredBy,
  });

  return sendSuccess(
    res,
    {
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      createdAt: user.createdAt,
    },
    'User created successfully',
    201
  );
});

// Update user
exports.updateUser = asyncHandler(async (req, res) => {
  const { mobile, email } = req.body;
  const updateData = { ...req.body };

  // If mobile is being updated, format it with +91
  if (mobile) {
    const mobileValidation = validateAndFormatMobile(mobile);
    if (!mobileValidation.valid) {
      return sendValidationError(res, 'Mobile number must be 10 digits');
    }
    updateData.mobile = mobileValidation.cleaned;

    // Check if mobile already exists for another user
    const existingUserByMobile = await User.findOne({
      mobile: updateData.mobile,
      _id: { $ne: req.params.id },
    });
    if (existingUserByMobile) {
      return sendError(res, 'User with this mobile number already exists', 409);
    }
  }

  // If email is being updated, validate and check for duplicates
  if (email) {
    if (!isValidEmail(email)) {
      return sendValidationError(res, 'Please provide a valid email address');
    }
    const existingUserByEmail = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: req.params.id },
    });
    if (existingUserByEmail) {
      return sendError(res, 'User with this email already exists', 409);
    }
    updateData.email = email.toLowerCase().trim();
  }

  const user = await User.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  }).select('-password');

  if (!user) {
    return sendNotFound(res, 'User not found');
  }

  return sendSuccess(res, user, 'User updated successfully');
});

// Delete user
exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    return sendNotFound(res, 'User not found');
  }

  return sendSuccess(res, null, 'User deleted successfully');
});

