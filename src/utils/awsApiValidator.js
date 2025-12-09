/**
 * AWS API Response Validation Utilities
 */

/**
 * Validate AWS API credentials are configured
 * @returns {Object} { valid: boolean, missing: Array<string> }
 */
const validateAWSCredentials = () => {
  const missing = [];
  const required = ['AWS_ACCESS_KEY', 'AWS_SECRET_KEY', 'AWS_PARTNER_TAG'];

  required.forEach((key) => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });

  return {
    valid: missing.length === 0,
    missing,
  };
};

/**
 * Validate AWS API search response structure
 * @param {Object} data - AWS API response data
 * @returns {Object} { valid: boolean, hasData: boolean, items: Array, totalCount: number, errors: Array }
 */
const validateSearchResponse = (data) => {
  const errors = [];
  let items = [];
  let totalCount = 0;
  let hasData = false;

  // Check if response has Errors (AWS API sometimes returns errors even with status 200)
  if (data?.Errors && Array.isArray(data.Errors) && data.Errors.length > 0) {
    errors.push(...data.Errors.map((err) => err.Message || err.Code || 'Unknown error'));
    return { valid: false, hasData: false, items: [], totalCount: 0, errors };
  }

  // Check for SearchResult structure
  if (data?.SearchResult) {
    items = data.SearchResult.Items || [];
    totalCount = data.SearchResult.TotalResultCount || 0;
    hasData = items.length > 0;
  } else {
    errors.push('Invalid response structure: SearchResult not found');
  }

  return {
    valid: errors.length === 0,
    hasData,
    items,
    totalCount,
    errors,
  };
};

/**
 * Validate AWS API GetItems response structure
 * @param {Object} data - AWS API response data
 * @returns {Object} { valid: boolean, hasData: boolean, item: Object|null, errors: Array }
 */
const validateGetItemsResponse = (data) => {
  const errors = [];
  let item = null;
  let hasData = false;

  // Check if response has Errors
  if (data?.Errors && Array.isArray(data.Errors) && data.Errors.length > 0) {
    errors.push(...data.Errors.map((err) => err.Message || err.Code || 'Unknown error'));
    return { valid: false, hasData: false, item: null, errors };
  }

  // Check for ItemsResult structure
  if (data?.ItemsResult?.Items && Array.isArray(data.ItemsResult.Items)) {
    if (data.ItemsResult.Items.length > 0) {
      item = data.ItemsResult.Items[0];
      hasData = true;
    } else {
      errors.push('No items found in response');
    }
  } else {
    errors.push('Invalid response structure: ItemsResult.Items not found');
  }

  return {
    valid: errors.length === 0,
    hasData,
    item,
    errors,
  };
};

/**
 * Check if AWS API response contains valid data
 * @param {Object} result - Service result object
 * @returns {Object} { valid: boolean, error: string|null, errorDetails: Object|null }
 */
const validateAPIResult = (result) => {
  if (!result || typeof result !== 'object') {
    return { 
      valid: false, 
      error: 'Invalid API response: result is not an object',
      errorDetails: null
    };
  }

  if (!result.success) {
    // Extract error information in a structured way
    let errorMessage = 'Unknown error from AWS API';
    let errorCode = 'UnknownError';
    let statusCode = null;
    
    if (result.error) {
      if (typeof result.error === 'object') {
        errorMessage = result.error.Message || result.error.message || errorMessage;
        errorCode = result.error.Code || result.error.code || errorCode;
        statusCode = result.error.StatusCode || result.statusCode || null;
        // Preserve the Type field if it exists (important for proper error handling)
        const errorType = result.error.Type || result.error.type || null;
        
        return { 
          valid: false, 
          error: errorMessage,
          errorDetails: {
            code: errorCode,
            statusCode: statusCode,
            type: errorType,
            originalError: result.error,
          }
        };
      } else if (typeof result.error === 'string') {
        // Check if it's HTML
        if (result.error.trim().startsWith('<!DOCTYPE')) {
          errorMessage = 'Amazon API service temporarily unavailable';
          errorCode = 'ServiceUnavailable';
          statusCode = result.statusCode || 503;
        } else {
          errorMessage = result.error;
        }
      }
    }
    
    return { 
      valid: false, 
      error: errorMessage,
      errorDetails: {
        code: errorCode,
        statusCode: statusCode,
        originalError: result.error,
      }
    };
  }

  if (!result.data) {
    return { 
      valid: false, 
      error: 'No data received from AWS API',
      errorDetails: null
    };
  }

  return { valid: true, error: null, errorDetails: null };
};

module.exports = {
  validateAWSCredentials,
  validateSearchResponse,
  validateGetItemsResponse,
  validateAPIResult,
};

