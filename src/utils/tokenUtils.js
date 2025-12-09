const jwt = require('jsonwebtoken');

/**
 * Generate JWT Token
 * @param {string} id - User ID
 * @returns {string} JWT token
 * @throws {Error} If JWT_SECRET is not configured or token generation fails
 */
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }

  if (!id) {
    throw new Error('User ID is required to generate token');
  }

  try {
    const token = jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '30d',
    });

    if (!token) {
      throw new Error('Token generation returned empty value');
    }

    return token;
  } catch (error) {
    throw new Error(`Failed to generate token: ${error.message}`);
  }
};

module.exports = {
  generateToken,
};


