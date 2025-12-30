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
const ProductClick = require('../models/ProductClick');
const Product = require('../models/Product');

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
    itemPage: parseInt(page), // Pass page number (1-10)
    minPrice: minPrice ? parseInt(minPrice) : undefined,
    maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
    brand,
  });

  // Validate API result
  const apiValidation = validateAPIResult(result);
  if (!apiValidation.valid) {
    // Determine appropriate status code based on error details
    // Use the statusCode from errorDetails if available, otherwise infer from error type
    let statusCode = apiValidation.errorDetails?.statusCode;

    if (!statusCode) {
      const errorType = apiValidation.errorDetails?.type;
      const originalError = apiValidation.errorDetails?.originalError;

      // Check type field first (from errorDetails)
      if (errorType === 'ServiceUnavailable') {
        statusCode = 503;
      } else if (errorType === 'BadRequest') {
        statusCode = 400;
      } else if (errorType === 'Unauthorized') {
        statusCode = 401;
      } else if (errorType === 'Forbidden') {
        statusCode = 403;
      } else if (errorType === 'TooManyRequests') {
        statusCode = 429;
      } else if (errorType === 'ServerError') {
        statusCode = 500;
      } else if (originalError) {
        // Fallback to checking originalError Type field
        if (originalError.Type === 'ServiceUnavailable') {
          statusCode = 503;
        } else if (originalError.Type === 'BadRequest' || originalError.Code?.startsWith('HTTP_400')) {
          statusCode = 400;
        } else if (originalError.Type === 'Unauthorized' || originalError.Code?.startsWith('HTTP_401')) {
          statusCode = 401;
        } else if (originalError.Type === 'Forbidden' || originalError.Code?.startsWith('HTTP_403')) {
          statusCode = 403;
        } else if (originalError.Type === 'TooManyRequests' || originalError.Code?.startsWith('HTTP_429')) {
          statusCode = 429;
        } else if (originalError.Type === 'ServerError' || (originalError.Code && /^HTTP_5\d{2}$/.test(originalError.Code))) {
          statusCode = 500;
        }
      }
    }

    // Default to 400 if status code still not determined
    statusCode = statusCode || 400;

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
    // Determine appropriate status code based on error details
    // Use the statusCode from errorDetails if available, otherwise infer from error type
    let statusCode = apiValidation.errorDetails?.statusCode;

    if (!statusCode) {
      const errorType = apiValidation.errorDetails?.type;
      const originalError = apiValidation.errorDetails?.originalError;

      // Check type field first (from errorDetails)
      if (errorType === 'ServiceUnavailable') {
        statusCode = 503;
      } else if (errorType === 'BadRequest') {
        statusCode = 400;
      } else if (errorType === 'Unauthorized') {
        statusCode = 401;
      } else if (errorType === 'Forbidden') {
        statusCode = 403;
      } else if (errorType === 'TooManyRequests') {
        statusCode = 429;
      } else if (errorType === 'ServerError') {
        statusCode = 500;
      } else if (originalError) {
        // Fallback to checking originalError Type field
        if (originalError.Type === 'ServiceUnavailable') {
          statusCode = 503;
        } else if (originalError.Type === 'BadRequest' || originalError.Code?.startsWith('HTTP_400')) {
          statusCode = 400;
        } else if (originalError.Type === 'Unauthorized' || originalError.Code?.startsWith('HTTP_401')) {
          statusCode = 401;
        } else if (originalError.Type === 'Forbidden' || originalError.Code?.startsWith('HTTP_403')) {
          statusCode = 403;
        } else if (originalError.Type === 'TooManyRequests' || originalError.Code?.startsWith('HTTP_429')) {
          statusCode = 429;
        } else if (originalError.Type === 'ServerError' || (originalError.Code && /^HTTP_5\d{2}$/.test(originalError.Code))) {
          statusCode = 500;
        }
      }
    }

    // Default to 400 if status code still not determined
    statusCode = statusCode || 400;

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

// @desc    Update product category/details (Admin)
// @route   PUT /api/products/:asin
// @access  Private/Admin
exports.updateProduct = asyncHandler(async (req, res) => {
  const { asin } = req.params;
  const { category, searchIndex } = req.body;

  let product = await Product.findOne({ asin });

  if (!product) {
    // Create if not exists (upsert logic)
    product = new Product({
      asin,
      category,
      searchIndex: searchIndex || amazonApiService.resolveSearchIndex(category),
      // Set other defaults if needed, or fetch from Amazon to populate
      title: req.body.title || 'Unknown Product',
    });
  } else {
    if (category) {
      product.category = category;
      // Auto-update searchIndex if not provided explicitly, based on SMART_MAP
      if (!searchIndex) {
        product.searchIndex = amazonApiService.resolveSearchIndex(category);
      }
    }
    if (searchIndex) product.searchIndex = searchIndex;
  }

  await product.save();

  return sendSuccess(res, product, 'Product updated successfully');
});

// @desc    Get detailed product info including local DB state and Smart Map resolution
// @route   GET /api/products/:asin/details
// @access  Private
exports.getProductDetails = asyncHandler(async (req, res) => {
  const { asin } = req.params;

  // 1. Local Lookup
  const localProduct = await Product.findOne({ asin });

  // 2. Resolve Smart Category
  let smartCategory = 'All';
  if (localProduct && localProduct.category) {
    smartCategory = amazonApiService.resolveSearchIndex(localProduct.category);
  }

  // 3. Amazon Lookup (optional here, but useful for verifying)
  // const amazonResult = await amazonApiService.getItems(asin);

  return sendSuccess(res, {
    localProduct,
    smartCategory,
    // amazonData: amazonResult.data
  }, 'Product details retrieved');
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
    page = 1,
  } = req.query;

  if (!q) {
    return sendValidationError(res, 'Search query (q) is required');
  }

  const result = await amazonApiService.searchItems(q, {
    searchIndex,
    itemCount: parseInt(itemCount),
    itemPage: parseInt(page),
    minPrice: minPrice ? parseInt(minPrice) : undefined,
    maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
    brand,
  });

  // Validate API result
  const apiValidation = validateAPIResult(result);
  if (!apiValidation.valid) {
    // Determine appropriate status code based on error details
    // Use the statusCode from errorDetails if available, otherwise infer from error type
    let statusCode = apiValidation.errorDetails?.statusCode;

    if (!statusCode) {
      const errorType = apiValidation.errorDetails?.type;
      const originalError = apiValidation.errorDetails?.originalError;

      // Check type field first (from errorDetails)
      if (errorType === 'ServiceUnavailable') {
        statusCode = 503;
      } else if (errorType === 'BadRequest') {
        statusCode = 400;
      } else if (errorType === 'Unauthorized') {
        statusCode = 401;
      } else if (errorType === 'Forbidden') {
        statusCode = 403;
      } else if (errorType === 'TooManyRequests') {
        statusCode = 429;
      } else if (errorType === 'ServerError') {
        statusCode = 500;
      } else if (originalError) {
        // Fallback to checking originalError Type field
        if (originalError.Type === 'ServiceUnavailable') {
          statusCode = 503;
        } else if (originalError.Type === 'BadRequest' || originalError.Code?.startsWith('HTTP_400')) {
          statusCode = 400;
        } else if (originalError.Type === 'Unauthorized' || originalError.Code?.startsWith('HTTP_401')) {
          statusCode = 401;
        } else if (originalError.Type === 'Forbidden' || originalError.Code?.startsWith('HTTP_403')) {
          statusCode = 403;
        } else if (originalError.Type === 'TooManyRequests' || originalError.Code?.startsWith('HTTP_429')) {
          statusCode = 429;
        } else if (originalError.Type === 'ServerError' || (originalError.Code && /^HTTP_5\d{2}$/.test(originalError.Code))) {
          statusCode = 500;
        }
      }
    }

    // Default to 400 if status code still not determined
    statusCode = statusCode || 400;

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
    // Determine appropriate status code based on error details
    // Use the statusCode from errorDetails if available, otherwise infer from error type
    let statusCode = apiValidation.errorDetails?.statusCode;

    if (!statusCode) {
      const errorType = apiValidation.errorDetails?.type;
      const originalError = apiValidation.errorDetails?.originalError;

      // Check type field first (from errorDetails)
      if (errorType === 'ServiceUnavailable') {
        statusCode = 503;
      } else if (errorType === 'BadRequest') {
        statusCode = 400;
      } else if (errorType === 'Unauthorized') {
        statusCode = 401;
      } else if (errorType === 'Forbidden') {
        statusCode = 403;
      } else if (errorType === 'TooManyRequests') {
        statusCode = 429;
      } else if (errorType === 'ServerError') {
        statusCode = 500;
      } else if (originalError) {
        // Fallback to checking originalError Type field
        if (originalError.Type === 'ServiceUnavailable') {
          statusCode = 503;
        } else if (originalError.Type === 'BadRequest' || originalError.Code?.startsWith('HTTP_400')) {
          statusCode = 400;
        } else if (originalError.Type === 'Unauthorized' || originalError.Code?.startsWith('HTTP_401')) {
          statusCode = 401;
        } else if (originalError.Type === 'Forbidden' || originalError.Code?.startsWith('HTTP_403')) {
          statusCode = 403;
        } else if (originalError.Type === 'TooManyRequests' || originalError.Code?.startsWith('HTTP_429')) {
          statusCode = 429;
        } else if (originalError.Type === 'ServerError' || (originalError.Code && /^HTTP_5\d{2}$/.test(originalError.Code))) {
          statusCode = 500;
        }
      }
    }

    // Default to 400 if status code still not determined
    statusCode = statusCode || 400;

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
// @desc    Get multiple products by ASINs
// @route   POST /api/products/items
// @access  Public
exports.getProductsByAsins = asyncHandler(async (req, res) => {
  // Validate AWS credentials first
  const credentialsCheck = validateAWSCredentials();
  if (!credentialsCheck.valid) {
    return sendError(
      res,
      `AWS API credentials not configured. Missing: ${credentialsCheck.missing.join(', ')}`,
      500
    );
  }

  const { itemIds } = req.body;

  if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
    return sendValidationError(res, 'itemIds (array of ASINs) is required');
  }

  // Validate ASIN formats
  const invalidAsins = itemIds.filter((asin) => !/^[A-Z0-9]{10}$/i.test(asin));
  if (invalidAsins.length > 0) {
    return sendValidationError(
      res,
      `Invalid ASIN format(s): ${invalidAsins.join(', ')}. ASIN must be 10 alphanumeric characters`
    );
  }

  const result = await amazonApiService.getItems(itemIds);

  // Validate API result
  const apiValidation = validateAPIResult(result);
  if (!apiValidation.valid) {
    return sendError(
      res,
      apiValidation.error,
      apiValidation.errorDetails?.statusCode || 400,
      apiValidation.errorDetails || null
    );
  }

  return sendSuccess(res, { ...result.data, validated: true }, 'Items retrieved successfully');
});

// @desc    Get personalized products based on user click history
// @route   GET /api/products/personalized
// @access  Private
exports.getPersonalizedProducts = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    return sendUnauthorized(res, 'User identity not found');
  }

  // 1. Get recent clicks for this user
  const recentClicks = await ProductClick.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(5);

  let keywords = 'Recommended';
  let searchIndex = 'All';

  // 2. Determine search criteria from history
  if (recentClicks.length > 0) {
    // Pick the most common category or most recent product name
    const categories = recentClicks.map(c => c.category);
    searchIndex = categories[0] || 'All';
    keywords = recentClicks[0].productName.split(' ').slice(0, 3).join(' ') || 'Recommended';
  }

  // 3. Fetch from Amazon
  const result = await amazonApiService.searchItems(keywords, {
    searchIndex,
    itemCount: 10,
  });

  return sendSuccess(res, result.data, 'Personalized products retrieved successfully');
});
