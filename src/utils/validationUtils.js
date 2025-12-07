/**
 * Common validation utilities
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate mobile number (10 digits)
 * @param {string|number} mobile - Mobile number to validate
 * @returns {Object} { valid: boolean, cleaned: string }
 */
const validateAndFormatMobile = (mobile) => {
  const cleanMobile = mobile.toString().replace(/\D/g, ''); // Remove non-digits
  
  if (cleanMobile.length !== 10) {
    return { valid: false, cleaned: cleanMobile };
  }

  return { valid: true, cleaned: `+91${cleanMobile}` };
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @param {number} minLength - Minimum length (default: 6)
 * @returns {boolean} True if valid password
 */
const isValidPassword = (password, minLength = 6) => {
  return password && password.length >= minLength;
};

/**
 * Validate required fields
 * @param {Object} data - Data object to validate
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {Object} { valid: boolean, missing: Array<string> }
 */
const validateRequiredFields = (data, requiredFields) => {
  const missing = requiredFields.filter((field) => !data[field]);
  return {
    valid: missing.length === 0,
    missing,
  };
};

module.exports = {
  isValidEmail,
  validateAndFormatMobile,
  isValidPassword,
  validateRequiredFields,
};


