const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const {
  sendSuccess,
  sendError,
  sendValidationError,
} = require('../utils/responseHandler');

// @desc    Create withdrawal request
// @route   POST /api/withdrawals
// @access  Private/Agent
exports.createWithdrawal = asyncHandler(async (req, res) => {
  const { amount, paymentMethod, paymentDetails } = req.body;
  const userId = req.user.id;

  // Validation
  if (!amount || amount <= 0) {
    return sendValidationError(res, 'Valid withdrawal amount is required');
  }

  if (!paymentMethod) {
    return sendValidationError(res, 'Payment method is required');
  }

  if (!paymentDetails) {
    return sendValidationError(res, 'Payment details are required');
  }

  // Check if user is an agent
  const user = await User.findById(userId);
  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  if (user.role !== 'agent') {
    return sendValidationError(res, 'Only agents can request withdrawals');
  }

  // Check if user has sufficient balance
  if (user.balance < amount) {
    return sendValidationError(res, 'Insufficient balance');
  }

  // Check for pending withdrawals
  const pendingWithdrawal = await Withdrawal.findOne({
    user: userId,
    status: 'pending',
  });

  if (pendingWithdrawal) {
    return sendValidationError(res, 'You already have a pending withdrawal request');
  }

  // Create withdrawal request
  const withdrawal = await Withdrawal.create({
    user: userId,
    amount,
    paymentMethod,
    paymentDetails,
    status: 'pending',
  });

  return sendSuccess(res, withdrawal, 'Withdrawal request created successfully', 201);
});

// @desc    Get user's withdrawal requests
// @route   GET /api/withdrawals
// @access  Private/Agent
exports.getUserWithdrawals = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { status } = req.query;

  const query = { user: userId };
  if (status) {
    query.status = status;
  }

  const withdrawals = await Withdrawal.find(query)
    .sort({ createdAt: -1 })
    .limit(50);

  return sendSuccess(res, { withdrawals }, 'Withdrawals retrieved successfully');
});

// @desc    Get single withdrawal request
// @route   GET /api/withdrawals/:id
// @access  Private/Agent
exports.getWithdrawalById = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const withdrawal = await Withdrawal.findOne({
    _id: req.params.id,
    user: userId,
  });

  if (!withdrawal) {
    return sendError(res, 'Withdrawal request not found', 404);
  }

  return sendSuccess(res, withdrawal, 'Withdrawal retrieved successfully');
});

