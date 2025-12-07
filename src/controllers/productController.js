const amazonApiService = require('../services/amazonApiService');
const asyncHandler = require('../utils/asyncHandler');
const {
  sendSuccess,
  sendError,
  sendValidationError,
} = require('../utils/responseHandler');
const {
  validateAWSCredentials,
  validateAPIResult,
  validateSearchResponse,
  validateGetItemsResponse,
} = require('../utils/awsApiValidator');

// @desc    Search products from Amazon
// @route   GET /api/products
// @access  Public
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
    keywords = '',
    searchIndex = 'All',
    itemCount = 10,
    minPrice,
    maxPrice,
    brand,
    page = 1,
  } = req.query;

  if (!keywords) {
    return sendValidationError(res, 'Keywords are required for product search');
  }

  const result = await amazonApiService.searchItems(keywords, {
    searchIndex,
    itemCount: parseInt(itemCount),
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

  // Validate response structure
  const responseValidation = validateSearchResponse(result.data);
  if (!responseValidation.valid) {
    return sendError(
      res,
      `Invalid response from Amazon API: ${responseValidation.errors.join(', ')}`,
      400,
      result.data
    );
  }

  return res.status(200).json({
    success: true,
    page: parseInt(page),
    data: result.data,
    validated: true,
  });
});

// @desc    Get product details by ASIN
// @route   GET /api/products/:asin
// @access  Public
exports.getProduct = asyncHandler(async (req, res) => {
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

  // Validate ASIN format
  if (!/^[A-Z0-9]{10}$/i.test(asin)) {
    return sendValidationError(res, 'Invalid ASIN format. ASIN must be 10 alphanumeric characters');
  }

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
  if (!responseValidation.valid || !responseValidation.hasData) {
    return sendError(
      res,
      `Product not found or invalid response: ${responseValidation.errors.join(', ')}`,
      404
    );
  }

  return sendSuccess(
    res,
    { ...responseValidation.item, validated: true },
    'Product retrieved successfully'
  );
});

// @desc    Search products by keyword
// @route   GET /api/products/search
// @access  Public
exports.searchProducts = asyncHandler(async (req, res) => {
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
    q,
    searchIndex = 'All',
    itemCount = 10,
    minPrice,
    maxPrice,
    brand,
  } = req.query;

  if (!q) {
    return sendValidationError(res, 'Search query (q) is required');
  }

  const result = await amazonApiService.searchItems(q, {
    searchIndex,
    itemCount: parseInt(itemCount),
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

  // Validate response structure
  const responseValidation = validateSearchResponse(result.data);
  if (!responseValidation.valid) {
    return sendError(
      res,
      `Invalid response from Amazon API: ${responseValidation.errors.join(', ')}`,
      400,
      result.data
    );
  }

  return res.status(200).json({
    success: true,
    query: q,
    data: result.data,
    validated: true,
  });
});

// @desc    Get products by category (SearchIndex)
// @route   GET /api/products/category/:category
// @access  Public
exports.getProductsByCategory = asyncHandler(async (req, res) => {
  // Validate AWS credentials first
  const credentialsCheck = validateAWSCredentials();
  if (!credentialsCheck.valid) {
    return sendError(
      res,
      `AWS API credentials not configured. Missing: ${credentialsCheck.missing.join(', ')}`,
      500
    );
  }

  const { category } = req.params;
  const {
    keywords = '',
    itemCount = 10,
    minPrice,
    maxPrice,
    brand,
  } = req.query;

  if (!keywords) {
    return sendValidationError(res, 'Keywords are required');
  }

  const result = await amazonApiService.searchItems(keywords, {
    searchIndex: category,
    itemCount: parseInt(itemCount),
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

  // Validate response structure
  const responseValidation = validateSearchResponse(result.data);
  if (!responseValidation.valid) {
    return sendError(
      res,
      `Invalid response from Amazon API: ${responseValidation.errors.join(', ')}`,
      400,
      result.data
    );
  }

  return res.status(200).json({
    success: true,
    category,
    data: result.data,
    validated: true,
  });
});
