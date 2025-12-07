const amazonApiService = require('../services/amazonApiService');
const asyncHandler = require('../utils/asyncHandler');
const {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
} = require('../utils/responseHandler');
const {
  validateAWSCredentials,
  validateAPIResult,
  validateSearchResponse,
  validateGetItemsResponse,
} = require('../utils/awsApiValidator');

// @desc    Get products from Amazon API (with optional search)
// @route   GET /api/admin/products
// @access  Private/Admin
exports.getAllProducts = asyncHandler(async (req, res) => {
  // Validate AWS credentials first
  const credentialsCheck = validateAWSCredentials();
  if (!credentialsCheck.valid) {
    return sendError(
      res,
      `AWS API credentials not configured. Missing: ${credentialsCheck.missing.join(', ')}`,
      500
    );
  }

  const {
    keywords,
    search,
    searchIndex = 'All',
    itemCount,
    limit,
    minPrice,
    maxPrice,
    brand,
    page = 1,
  } = req.query;

  // Accept both 'keywords' and 'search' parameters, use default if not provided
  const searchKeywords = keywords || search || 'all';

  // Use limit if provided, otherwise use itemCount, default to 10
  const itemCountNum = parseInt(limit || itemCount || 10);

  // Call AWS API
  const result = await amazonApiService.searchItems(searchKeywords, {
    searchIndex,
    itemCount: itemCountNum,
    minPrice: minPrice ? parseInt(minPrice) : undefined,
    maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
    brand,
  });

  // Validate API result
  const apiValidation = validateAPIResult(result);
  if (!apiValidation.valid) {
    // Determine appropriate status code
    const statusCode = apiValidation.errorDetails?.statusCode || 
                      (apiValidation.errorDetails?.code === 'ServiceUnavailable' ? 503 : 400);
    
    return sendError(
      res,
      apiValidation.error,
      statusCode,
      apiValidation.errorDetails || null
    );
  }

  // Validate response structure and extract data
  const responseValidation = validateSearchResponse(result.data);
  if (!responseValidation.valid) {
    return sendError(
      res,
      `Invalid response from Amazon API: ${responseValidation.errors.join(', ')}`,
      400,
      result.data
    );
  }

  // Check if data was actually received
  if (!responseValidation.hasData) {
    return sendSuccess(
      res,
      {
        pagination: {
          page: parseInt(page),
          limit: itemCountNum,
          total: responseValidation.totalCount,
          pages: Math.ceil(responseValidation.totalCount / itemCountNum),
        },
        data: [],
      },
      'No products found for the given search criteria'
    );
  }

  return res.status(200).json({
    success: true,
    pagination: {
      page: parseInt(page),
      limit: itemCountNum,
      total: responseValidation.totalCount,
      pages: Math.ceil(responseValidation.totalCount / itemCountNum),
    },
    data: responseValidation.items,
    validated: true, // Flag to indicate data was validated
  });
});

// @desc    Get product by ASIN from Amazon API
// @route   GET /api/admin/products/asin/:asin
// @access  Private/Admin
exports.getProductByAsin = asyncHandler(async (req, res) => {
  // Validate AWS credentials first
  const credentialsCheck = validateAWSCredentials();
  if (!credentialsCheck.valid) {
    return sendError(
      res,
      `AWS API credentials not configured. Missing: ${credentialsCheck.missing.join(', ')}`,
      500
    );
  }

  const { asin } = req.params;

  if (!asin) {
    return sendValidationError(res, 'ASIN is required');
  }

  // Validate ASIN format (should be 10 characters, alphanumeric)
  if (!/^[A-Z0-9]{10}$/i.test(asin)) {
    return sendValidationError(res, 'Invalid ASIN format. ASIN must be 10 alphanumeric characters');
  }

  // Call AWS API
  const result = await amazonApiService.getItems(asin);

  // Validate API result
  const apiValidation = validateAPIResult(result);
  if (!apiValidation.valid) {
    // Determine appropriate status code
    const statusCode = apiValidation.errorDetails?.statusCode || 
                      (apiValidation.errorDetails?.code === 'ServiceUnavailable' ? 503 : 400);
    
    return sendError(
      res,
      apiValidation.error,
      statusCode,
      apiValidation.errorDetails || null
    );
  }

  // Validate response structure
  const responseValidation = validateGetItemsResponse(result.data);

  if (!responseValidation.valid) {
    return sendError(
      res,
      `Invalid response from Amazon API: ${responseValidation.errors.join(', ')}`,
      400,
      result.data
    );
  }

  if (!responseValidation.hasData) {
    return sendNotFound(res, 'Product not found on Amazon');
  }

  return sendSuccess(
    res,
    { ...responseValidation.item, validated: true },
    'Product retrieved successfully'
  );
});

// @desc    Get product statistics (from Amazon API)
// @route   GET /api/admin/products/stats
// @access  Private/Admin
exports.getProductStats = asyncHandler(async (req, res) => {
  // Since we're using Amazon API directly, we can't get database stats
  // Return a message indicating that products are fetched from Amazon
  return sendSuccess(
    res,
    {
      note: 'All products are fetched from Amazon Product Advertising API',
      source: 'Amazon API',
    },
    'Products are fetched directly from Amazon API'
  );
});

