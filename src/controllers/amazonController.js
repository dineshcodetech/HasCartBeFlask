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

// @desc    Search items on Amazon
// @route   POST /api/amazon/search
// @access  Public (or Protected based on your needs)
exports.searchItems = asyncHandler(async (req, res) => {
  // Validate AWS credentials first
  const credentialsCheck = validateAWSCredentials();
  if (!credentialsCheck.valid) {
    return sendError(
      res,
      `AWS API credentials not configured. Missing: ${credentialsCheck.missing.join(', ')}`,
      500
    );
  }

  const { keywords, searchIndex, itemCount, minPrice, maxPrice, brand } = req.body;

  if (!keywords) {
    return sendValidationError(res, 'Keywords are required');
  }

  const result = await amazonApiService.searchItems(keywords, {
    searchIndex: searchIndex || 'All',
    itemCount: itemCount || 10,
    minPrice,
    maxPrice,
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

  return sendSuccess(res, { ...result.data, validated: true }, 'Items retrieved successfully');
});

// @desc    Get item details by ASIN
// @route   POST /api/amazon/items
// @access  Public (or Protected based on your needs)
exports.getItems = asyncHandler(async (req, res) => {
  // Validate AWS credentials first
  const credentialsCheck = validateAWSCredentials();
  if (!credentialsCheck.valid) {
    return sendError(
      res,
      `AWS API credentials not configured. Missing: ${credentialsCheck.missing.join(', ')}`,
      500
    );
  }

  // Accept full payload structure or just itemIds for backward compatibility
  const { ItemIds, itemIds, ItemIdType, PartnerTag, PartnerType, Marketplace, Resources } = req.body;

  // Determine itemIds from either ItemIds (capital) or itemIds (lowercase)
  const finalItemIds = ItemIds || itemIds;

  if (!finalItemIds || (Array.isArray(finalItemIds) && finalItemIds.length === 0)) {
    return sendValidationError(res, 'ItemIds are required');
  }

  // Validate ASIN format if single item
  if (!Array.isArray(finalItemIds)) {
    if (!/^[A-Z0-9]{10}$/i.test(finalItemIds)) {
      return sendValidationError(res, 'Invalid ASIN format. ASIN must be 10 alphanumeric characters');
    }
  } else {
    // Validate all ASINs in array
    const invalidAsins = finalItemIds.filter((asin) => !/^[A-Z0-9]{10}$/i.test(asin));
    if (invalidAsins.length > 0) {
      return sendValidationError(
        res,
        `Invalid ASIN format(s): ${invalidAsins.join(', ')}. ASIN must be 10 alphanumeric characters`
      );
    }
  }

  // If full payload structure is provided, use it; otherwise use defaults
  const options = {};
  if (Resources && Array.isArray(Resources)) {
    options.resources = Resources;
  }
  if (ItemIdType && ItemIdType !== 'ASIN') {
    return sendValidationError(res, 'ItemIdType must be "ASIN"');
  }
  if (PartnerTag || PartnerType || Marketplace) {
    // These are validated by the service, but we can log them
    console.log('[Amazon Controller] Custom payload fields provided:', {
      hasPartnerTag: !!PartnerTag,
      hasPartnerType: !!PartnerType,
      hasMarketplace: !!Marketplace,
    });
  }

  const result = await amazonApiService.getItems(finalItemIds, options);

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
  if (!responseValidation.valid && !result.data?.ItemsResult) {
    return sendError(
      res,
      `Invalid response from Amazon API: ${responseValidation.errors.join(', ')}`,
      400,
      result.data
    );
  }

  return sendSuccess(res, { ...result.data, validated: true }, 'Items retrieved successfully');
});

// @desc    Get browse nodes
// @route   POST /api/amazon/browse-nodes
// @access  Public (or Protected based on your needs)
exports.getBrowseNodes = asyncHandler(async (req, res) => {
  // Validate AWS credentials first
  const credentialsCheck = validateAWSCredentials();
  if (!credentialsCheck.valid) {
    return sendError(
      res,
      `AWS API credentials not configured. Missing: ${credentialsCheck.missing.join(', ')}`,
      500
    );
  }

  const { browseNodeIds } = req.body;

  if (!browseNodeIds || (Array.isArray(browseNodeIds) && browseNodeIds.length === 0)) {
    return sendValidationError(res, 'BrowseNodeIds are required');
  }

  const result = await amazonApiService.getBrowseNodes(browseNodeIds);

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

  // Check for errors in response (AWS sometimes returns errors in response body)
  if (result.data?.Errors && Array.isArray(result.data.Errors) && result.data.Errors.length > 0) {
    return sendError(
      res,
      `Error from Amazon API: ${result.data.Errors.map((e) => e.Message || e.Code).join(', ')}`,
      400,
      result.data.Errors
    );
  }

  return sendSuccess(res, { ...result.data, validated: true }, 'Browse nodes retrieved successfully');
});

