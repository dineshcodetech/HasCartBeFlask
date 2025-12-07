const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const {
  sendSuccess,
  sendForbidden,
} = require('../utils/responseHandler');

// @desc    Get all referred users by an agent
// @route   GET /api/referral/my-referrals
// @access  Private/Agent
exports.getMyReferrals = asyncHandler(async (req, res) => {
  const agentId = req.user.id;
  const referredUsers = await User.find({ referredBy: agentId }).select('-password');
  return sendSuccess(res, referredUsers, 'Referrals retrieved successfully');
});

// @desc    Get referral statistics for an agent
// @route   GET /api/referral/stats
// @access  Private/Agent
exports.getReferralStats = asyncHandler(async (req, res) => {
  const agentId = req.user.id;
  const totalReferrals = await User.countDocuments({ referredBy: agentId });
  const agent = await User.findById(agentId).select('referralCode name email');

  return sendSuccess(res, {
    agent: {
      id: agent._id,
      name: agent.name,
      email: agent.email,
      referralCode: agent.referralCode,
    },
    totalReferrals,
  }, 'Referral statistics retrieved successfully');
});

// @desc    Get my referral code
// @route   GET /api/referral/my-code
// @access  Private/Agent
exports.getMyReferralCode = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('referralCode name role');

  if (user.role !== 'agent' && user.role !== 'admin') {
    return sendForbidden(res, 'Only agents and admins have referral codes');
  }

  return sendSuccess(res, {
    referralCode: user.referralCode,
    name: user.name,
  }, 'Referral code retrieved successfully');
});

