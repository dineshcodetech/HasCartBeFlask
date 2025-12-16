const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendUnauthorized, sendForbidden } = require('../utils/responseHandler');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return sendUnauthorized(res, 'Not authorized to access this route');
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      console.error('Auth Middleware: User found in DB is null');
      return sendUnauthorized(res, 'User not found');
    }

    console.log('Auth Middleware Success: User:', req.user.email, 'Role:', req.user.role);

    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);
    return sendUnauthorized(res, 'Not authorized to access this route');
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendForbidden(
        res,
        `User role '${req.user.role}' is not authorized to access this route`
      );
    }
    next();
  };
};

