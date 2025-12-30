const axios = require('axios');
const crypto = require('crypto');

const SMART_MAP = {
  // Electronics & Gadgets
  'Electronics': 'Electronics',
  'Mobiles': 'Electronics',
  'Tablets': 'Electronics',
  'Laptops': 'Computers',
  'Computers': 'Computers',
  'Cameras': 'Electronics',
  'Headphones': 'Electronics',
  'Accessories': 'Electronics',
  'Smart Home': 'Electronics',
  'Wearables': 'Electronics',
  'TV': 'Electronics',
  'Television': 'Electronics',
  'Televisions': 'Electronics',
  'Smart Televisions': 'Electronics',
  'LED TV': 'Electronics',
  'Smart LED TV': 'Electronics',

  // Fashion
  'Fashion': 'Fashion',
  'Men': 'Apparel',
  'Women': 'Apparel',
  'Kids': 'Apparel',
  'Clothing': 'Apparel',
  'Shoes': 'Shoes',
  'Watches': 'Watches',
  'Jewelry': 'Jewelry',
  'Bags': 'Apparel',

  // Home & Living
  'Home': 'HomeAndKitchen',
  'Kitchen': 'HomeAndKitchen',
  'Furniture': 'Furniture',
  'Decor': 'HomeAndKitchen',
  'Appliances': 'Appliances',
  'Garden': 'GardenAndOutdoor',
  'Tools': 'ToolsAndHomeImprovement',

  // Essentials
  'Beauty': 'Beauty',
  'Health': 'HealthPersonalCare',
  'Personal Care': 'HealthPersonalCare',
  'Groceries': 'GroceryAndGourmetFood',
  'Baby': 'Baby',
  'Pet Supplies': 'PetSupplies',

  // Entertainment
  'Books': 'Books',
  'Toys': 'ToysAndGames',
  'Games': 'VideoGames',
  'Video Games': 'VideoGames',
  'Music': 'Music',
  'Movies': 'MoviesAndTV',
  'Sports': 'SportsAndOutdoors',
  'Fitness': 'SportsAndOutdoors',

  // Auto
  'Automotive': 'Automotive',
  'Car Accessories': 'Automotive',

  // Others
  'Gift Cards': 'GiftCards',
  'Office': 'OfficeProducts',
  'Industrial': 'Industrial'
};

class AmazonAPIService {
  constructor() {
    this.accessKey = process.env.AWS_ACCESS_KEY;
    this.secretKey = process.env.AWS_SECRET_KEY;
    this.partnerTag = process.env.AWS_PARTNER_TAG;
    this.marketplace = process.env.AWS_MARKETPLACE || 'www.amazon.in';

    // Set region based on marketplace if not explicitly provided
    // According to Amazon PA-API 5.0 documentation, each marketplace has a specific AWS region
    // This is used for AWS signature generation
    this.region = process.env.AWS_REGION || this.getRegionFromMarketplace(this.marketplace);

    // Get marketplace-specific base URL
    // e.g., https://webservices.amazon.in/paapi5 for India
    // e.g., https://webservices.amazon.com/paapi5 for US
    this.baseUrl = this.getBaseUrlFromMarketplace(this.marketplace);

    // Default resources to request from Amazon API (can be overridden in options)
    this.defaultSearchResources = process.env.AWS_SEARCH_RESOURCES
      ? JSON.parse(process.env.AWS_SEARCH_RESOURCES)
      : [
        'Images.Primary.Large',
        'ItemInfo.Title',
        'ItemInfo.Features',
        'ItemInfo.TechnicalInfo',
        'Offers.Listings.Price',
        'Offers.Listings.Condition',
        'Offers.Listings.DeliveryInfo.IsPrimeEligible',
        'CustomerReviews.StarRating',
        'CustomerReviews.Count',
        'BrowseNodeInfo.BrowseNodes',
        'ItemInfo.Classifications'
      ];

    this.defaultGetItemsResources = process.env.AWS_GETITEMS_RESOURCES
      ? JSON.parse(process.env.AWS_GETITEMS_RESOURCES)
      : [
        'Images.Primary.Large',
        'ItemInfo.Title',
        'ItemInfo.Features',
        'ItemInfo.ContentInfo',
        'ItemInfo.TechnicalInfo',
        'ItemInfo.ProductInfo',
        'Offers.Listings.Price',
        'Offers.Listings.Condition',
        'Offers.Listings.DeliveryInfo.IsPrimeEligible',
        'CustomerReviews.StarRating',
        'CustomerReviews.Count',
        'BrowseNodeInfo.BrowseNodes',
        'ItemInfo.Classifications'
      ];

    console.log('[Amazon API] Initialized:', {
      marketplace: this.marketplace,
      region: this.region,
      baseUrl: this.baseUrl,
      hasCredentials: !!(this.accessKey && this.secretKey && this.partnerTag),
    });
  }

  /**
   * Get the correct base URL based on marketplace
   * Each marketplace has a specific endpoint
   * @param {string} marketplace - The marketplace domain (e.g., www.amazon.in, www.amazon.com)
   * @returns {string} The base URL for the API endpoint
   */
  getBaseUrlFromMarketplace(marketplace) {
    const marketplaceMap = {
      'www.amazon.com': 'https://webservices.amazon.com/paapi5',
      'www.amazon.co.uk': 'https://webservices.amazon.co.uk/paapi5',
      'www.amazon.de': 'https://webservices.amazon.de/paapi5',
      'www.amazon.fr': 'https://webservices.amazon.fr/paapi5',
      'www.amazon.it': 'https://webservices.amazon.it/paapi5',
      'www.amazon.es': 'https://webservices.amazon.es/paapi5',
      'www.amazon.in': 'https://webservices.amazon.in/paapi5',
      'www.amazon.ca': 'https://webservices.amazon.ca/paapi5',
      'www.amazon.com.au': 'https://webservices.amazon.com.au/paapi5',
      'www.amazon.co.jp': 'https://webservices.amazon.co.jp/paapi5',
      'www.amazon.com.br': 'https://webservices.amazon.com.br/paapi5',
      'www.amazon.com.mx': 'https://webservices.amazon.com.mx/paapi5',
      'www.amazon.nl': 'https://webservices.amazon.nl/paapi5',
      'www.amazon.sg': 'https://webservices.amazon.sg/paapi5',
      'www.amazon.ae': 'https://webservices.amazon.ae/paapi5',
      'www.amazon.sa': 'https://webservices.amazon.sa/paapi5',
      'www.amazon.se': 'https://webservices.amazon.se/paapi5',
      'www.amazon.com.tr': 'https://webservices.amazon.com.tr/paapi5',
      'www.amazon.pl': 'https://webservices.amazon.pl/paapi5',
      'www.amazon.eg': 'https://webservices.amazon.eg/paapi5',
      'www.amazon.be': 'https://webservices.amazon.be/paapi5',
      'www.amazon.ie': 'https://webservices.amazon.ie/paapi5',
    };

    const baseUrl = marketplaceMap[marketplace] || 'https://webservices.amazon.com/paapi5';
    console.log('[Amazon API] Using base URL:', baseUrl, 'for marketplace:', marketplace);
    return baseUrl;
  }

  /**
   * Get the correct AWS region based on marketplace
   * This is used for AWS signature generation (not for the endpoint URL)
   * @param {string} marketplace - The marketplace domain (e.g., www.amazon.in, www.amazon.com)
   * @returns {string} The AWS region for the marketplace
   */
  getRegionFromMarketplace(marketplace) {
    const regionMap = {
      'www.amazon.com': 'us-east-1',
      'www.amazon.co.uk': 'eu-west-1',
      'www.amazon.de': 'eu-west-1',
      'www.amazon.fr': 'eu-west-1',
      'www.amazon.it': 'eu-west-1',
      'www.amazon.es': 'eu-west-1',
      'www.amazon.in': 'eu-west-1',
      'www.amazon.ca': 'us-east-1',
      'www.amazon.com.au': 'us-west-2',
      'www.amazon.co.jp': 'us-west-2',
      'www.amazon.com.br': 'us-east-1',
      'www.amazon.com.mx': 'us-east-1',
      'www.amazon.nl': 'eu-west-1',
      'www.amazon.sg': 'us-west-2',
      'www.amazon.ae': 'eu-west-1',
      'www.amazon.sa': 'eu-west-1',
      'www.amazon.se': 'eu-west-1',
      'www.amazon.com.tr': 'eu-west-1',
      'www.amazon.pl': 'eu-west-1',
      'www.amazon.eg': 'eu-west-1',
      'www.amazon.be': 'eu-west-1',
      'www.amazon.ie': 'eu-west-1',
    };

    return regionMap[marketplace] || 'us-east-1';
  }

  // Generate AWS Signature Version 4
  generateSignature(method, path, headers, payload, host) {
    const algorithm = 'AWS4-HMAC-SHA256';
    const service = 'ProductAdvertisingAPI';

    // Extract timestamp from X-Amz-Date header (must already be set)
    const timestamp = headers['X-Amz-Date'] || headers['x-amz-date'];
    if (!timestamp) {
      throw new Error('X-Amz-Date header must be set before generating signature');
    }
    const date = timestamp.substr(0, 8);

    // Add host header (required for signature)
    const headersWithHost = {
      ...headers,
      'host': host,
    };

    // Sort headers by key (lowercase) and create canonical headers
    // Headers must be sorted alphabetically by lowercase key name
    const sortedHeaderKeys = Object.keys(headersWithHost)
      .map(key => key.toLowerCase())
      .sort();

    const canonicalHeaders = sortedHeaderKeys
      .map((key) => {
        // Find the original key (case-insensitive) and get its value
        const originalKey = Object.keys(headersWithHost).find(k => k.toLowerCase() === key);
        const value = headersWithHost[originalKey];
        // Trim header values and ensure proper formatting
        return `${key}:${String(value).trim()}\n`;
      })
      .join('');

    const signedHeaders = sortedHeaderKeys.join(';');

    // Hash the payload
    const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

    // Create canonical request
    // Format: METHOD\nURI\nQUERY_STRING\nCANONICAL_HEADERS\n\nSIGNED_HEADERS\nPAYLOAD_HASH
    const canonicalRequest = [
      method,
      path,
      '', // Query string (empty for PA-API)
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    // Create string to sign
    const credentialScope = `${date}/${this.region}/${service}/aws4_request`;
    const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    const stringToSign = [
      algorithm,
      timestamp,
      credentialScope,
      hashedCanonicalRequest,
    ].join('\n');

    // Calculate signature using signing key
    const kDate = crypto.createHmac('sha256', `AWS4${this.secretKey}`).update(date).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    // Create authorization header
    const authorization = `${algorithm} Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      authorization,
    };
  }

  /**
   * Resolve Amazon SearchIndex from a generic category name
   * @param {string} category - The category name (e.g., "Mobiles", "Men's Fashion")
   * @returns {string} The corresponding Amazon SearchIndex (e.g., "Electronics", "Apparel")
   */
  resolveSearchIndex(category) {
    if (!category) return 'All';

    // 1. Check exact match
    if (SMART_MAP[category]) {
      return SMART_MAP[category];
    }

    // 2. Check case-insensitive match
    const lowerCategory = category.toLowerCase();
    const mapKey = Object.keys(SMART_MAP).find(k => k.toLowerCase() === lowerCategory);
    if (mapKey) {
      return SMART_MAP[mapKey];
    }

    // 3. Check if category contains a keyword from map
    // Sort keys by length (descending) to match specific terms first (e.g., "Video Games" before "Games")
    const sortedKeys = Object.keys(SMART_MAP).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (lowerCategory.includes(key.toLowerCase())) {
        return SMART_MAP[key];
      }
    }

    // 4. Fallback to 'All'
    return 'All';
  }

  // Make authenticated request to Amazon API
  async makeRequest(operation, payload) {
    try {
      // Validate credentials before making request
      if (!this.accessKey || !this.secretKey || !this.partnerTag) {
        console.error('[Amazon API] Missing credentials:', {
          hasAccessKey: !!this.accessKey,
          hasSecretKey: !!this.secretKey,
          hasPartnerTag: !!this.partnerTag,
        });
        return {
          success: false,
          error: {
            Message: 'AWS API credentials not configured',
            Code: 'MissingCredentials',
          },
        };
      }

      // Construct the full path for the request
      // baseUrl already includes /paapi5 (e.g., https://webservices.amazon.in/paapi5)
      // operation = GetItems -> getitems
      // operationPath = /getitems
      // full URL = https://webservices.amazon.in/paapi5/getitems
      const operationPath = `/${operation.toLowerCase()}`;
      const method = 'POST';
      const payloadString = JSON.stringify(payload);
      const url = `${this.baseUrl}${operationPath}`;

      // Extract host and path for signature
      const urlObj = new URL(this.baseUrl);
      const host = urlObj.host; // e.g., webservices.amazon.in
      const signaturePath = `${urlObj.pathname}${operationPath}`; // e.g., /paapi5/getitems

      // Generate timestamp first (needed for signature)
      const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');

      // Prepare headers for signing (X-Amz-Date must be included in signature)
      const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Encoding': 'amz-1.0',
        'X-Amz-Target': `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`,
        'X-Amz-Date': timestamp,
      };

      // Generate signature (includes host header and X-Amz-Date)
      const { authorization } = this.generateSignature(
        method,
        signaturePath,
        headers,
        payloadString,
        host
      );

      // Add Authorization header to request (X-Amz-Date already added above)
      headers['Authorization'] = authorization;

      // Log request details (without sensitive data)
      console.log('[Amazon API] Making request:', {
        operation,
        url,
        method,
        hasPayload: !!payload,
        marketplace: this.marketplace,
        region: this.region,
      });

      // Add timeout and better error handling
      const response = await axios.post(url, payloadString, {
        headers,
        timeout: 30000, // 30 second timeout
        validateStatus: (status) => status < 600, // Accept all status codes to handle them manually
      });

      console.log('[Amazon API] Response received:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers['content-type'],
        isHTML: typeof response.data === 'string' && response.data.trim().startsWith('<!DOCTYPE'),
      });

      // Check if response is HTML (error page) even with status 200
      const responseData = response.data;
      if (typeof responseData === 'string' && responseData.trim().startsWith('<!DOCTYPE')) {
        let errorMessage = 'Amazon API returned an unexpected HTML response';
        let errorType = 'InvalidResponse';
        const statusCode = response.status || 503;

        // Try to extract title from HTML
        const titleMatch = responseData.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) {
          errorMessage = titleMatch[1].trim();
        }

        // Determine error type based on status code
        if (statusCode === 503) {
          errorType = 'ServiceUnavailable';
          errorMessage = errorMessage || 'Amazon API service temporarily unavailable';
        } else if (statusCode === 400) {
          errorType = 'BadRequest';
          errorMessage = errorMessage || 'Invalid request to Amazon API';
        }

        return {
          success: false,
          error: {
            Message: errorMessage,
            Code: `HTTP_${statusCode}`,
            StatusCode: statusCode,
            Type: errorType,
          },
          statusCode,
        };
      }

      // Check if response contains errors even with status 200
      if (responseData?.Errors && Array.isArray(responseData.Errors) && responseData.Errors.length > 0) {
        return {
          success: false,
          error: responseData.Errors[0],
          data: responseData,
        };
      }

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      // Log error details for debugging
      console.error('[Amazon API] Request failed:', {
        message: error.message,
        code: error.code,
        hasResponse: !!error.response,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseType: typeof error.response?.data,
        isHTML: typeof error.response?.data === 'string' && error.response?.data?.trim().startsWith('<!DOCTYPE'),
      });

      // Handle different types of errors
      if (error.response) {
        const statusCode = error.response.status;
        let errorData = error.response.data;

        // Check if response is HTML (error pages)
        if (typeof errorData === 'string' && errorData.trim().startsWith('<!DOCTYPE')) {
          // Extract meaningful error message from HTML
          let errorMessage = 'Amazon API request failed';
          let errorType = 'RequestError';

          // Try to extract title from HTML
          const titleMatch = errorData.match(/<title>(.*?)<\/title>/i);
          if (titleMatch) {
            errorMessage = titleMatch[1].trim();
          }

          // Set appropriate error type based on status code
          // According to Amazon PA-API 5.0 documentation:
          // - 400 = Bad Request (invalid parameters, credentials, etc.)
          // - 401 = Unauthorized (invalid credentials)
          // - 403 = Forbidden (access denied)
          // - 429 = Too Many Requests (rate limit exceeded)
          // - 500 = Internal Server Error
          // - 503 = Service Unavailable
          if (statusCode === 503) {
            errorType = 'ServiceUnavailable';
            errorMessage = errorMessage || 'Amazon API service temporarily unavailable';
          } else if (statusCode === 400) {
            errorType = 'BadRequest';
            errorMessage = errorMessage || 'Invalid request to Amazon API. Please check your credentials and request parameters.';
          } else if (statusCode === 401) {
            errorType = 'Unauthorized';
            errorMessage = errorMessage || 'Invalid Amazon API credentials';
          } else if (statusCode === 403) {
            errorType = 'Forbidden';
            errorMessage = errorMessage || 'Access denied to Amazon API';
          } else if (statusCode === 429) {
            errorType = 'TooManyRequests';
            errorMessage = errorMessage || 'Rate limit exceeded for Amazon API';
          } else if (statusCode >= 500) {
            errorType = 'ServerError';
            errorMessage = errorMessage || 'Amazon API server error';
          }

          return {
            success: false,
            error: {
              Message: errorMessage,
              Code: `HTTP_${statusCode}`,
              StatusCode: statusCode,
              Type: errorType,
            },
            statusCode,
          };
        }

        // Handle JSON error responses
        if (typeof errorData === 'object' && errorData !== null) {
          return {
            success: false,
            error: errorData,
            statusCode,
          };
        }

        // Handle string error responses
        return {
          success: false,
          error: {
            Message: typeof errorData === 'string' ? errorData : 'Unknown error from Amazon API',
            Code: `HTTP_${statusCode}`,
            StatusCode: statusCode,
          },
          statusCode,
        };
      }

      // Handle network errors or other axios errors
      if (error.request) {
        console.error('[Amazon API] Network error - no response received:', {
          code: error.code,
          message: error.message,
        });
        return {
          success: false,
          error: {
            Message: `Unable to reach Amazon API. ${error.code === 'ECONNABORTED' ? 'Request timed out.' : 'Please check your network connection.'}`,
            Code: error.code === 'ECONNABORTED' ? 'TimeoutError' : 'NetworkError',
            Type: 'ConnectionError',
            StatusCode: 503,
          },
          statusCode: 503,
        };
      }

      // Handle timeout errors
      if (error.code === 'ECONNABORTED') {
        console.error('[Amazon API] Request timeout');
        return {
          success: false,
          error: {
            Message: 'Request to Amazon API timed out. Please try again later.',
            Code: 'TimeoutError',
            Type: 'TimeoutError',
            StatusCode: 504,
          },
          statusCode: 504,
        };
      }

      console.error('[Amazon API] Unknown error:', error.message);
      return {
        success: false,
        error: {
          Message: error.message || 'Unknown error occurred while calling Amazon API',
          Code: 'RequestError',
          Type: 'UnknownError',
          StatusCode: 500,
        },
        statusCode: 500,
      };
    }
  }

  // Search items
  async searchItems(keywords, options = {}) {
    const payload = {
      Keywords: keywords,
      SearchIndex: options.searchIndex || 'All',
      ItemCount: options.itemCount || 10,
      PartnerTag: this.partnerTag,
      PartnerType: 'Associates',
      Marketplace: this.marketplace,
      Marketplace: this.marketplace,
      Resources: options.resources || this.defaultSearchResources,
    };

    // Add pagination (1-10)
    if (options.itemPage) {
      payload.ItemPage = parseInt(options.itemPage);
    }

    // Add optional filters (only include if provided)
    if (options.minPrice !== undefined && options.minPrice !== null) {
      payload.MinPrice = parseInt(options.minPrice);
    }
    if (options.maxPrice !== undefined && options.maxPrice !== null) {
      payload.MaxPrice = parseInt(options.maxPrice);
    }
    if (options.brand) {
      payload.Brand = options.brand;
    }

    console.log('[Amazon API] SearchItems payload:', JSON.stringify(payload, null, 2));
    return await this.makeRequest('SearchItems', payload);
  }

  // Get items by ASIN
  async getItems(itemIds, options = {}) {
    const payload = {
      ItemIds: Array.isArray(itemIds) ? itemIds : [itemIds],
      ItemIdType: 'ASIN',
      PartnerTag: this.partnerTag,
      PartnerType: 'Associates',
      Marketplace: this.marketplace,
      Resources: options.resources || this.defaultGetItemsResources,
    };

    console.log('[Amazon API] GetItems payload:', JSON.stringify(payload, null, 2));
    return await this.makeRequest('GetItems', payload);
  }

  // Get browse nodes
  async getBrowseNodes(browseNodeIds, options = {}) {
    const payload = {
      BrowseNodeIds: Array.isArray(browseNodeIds) ? browseNodeIds : [browseNodeIds],
      PartnerTag: this.partnerTag,
      PartnerType: 'Associates',
      Marketplace: this.marketplace,
      Resources: options.resources || ['BrowseNodes.Ancestor', 'BrowseNodes.Children'],
    };

    return await this.makeRequest('GetBrowseNodes', payload);
  }
}

module.exports = new AmazonAPIService();


