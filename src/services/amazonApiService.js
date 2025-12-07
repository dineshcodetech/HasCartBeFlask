const axios = require('axios');
const crypto = require('crypto');

class AmazonAPIService {
  constructor() {
    this.accessKey = process.env.AWS_ACCESS_KEY;
    this.secretKey = process.env.AWS_SECRET_KEY;
    this.partnerTag = process.env.AWS_PARTNER_TAG;
    this.region = process.env.AWS_REGION || 'eu-west-1';
    this.marketplace = process.env.AWS_MARKETPLACE || 'www.amazon.in';
    this.baseUrl = 'https://webservices.amazon.com/paapi5';
  }

  // Generate AWS Signature Version 4
  generateSignature(method, path, headers, payload) {
    const algorithm = 'AWS4-HMAC-SHA256';
    const service = 'ProductAdvertisingAPI';
    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = timestamp.substr(0, 8);

    // Create canonical request
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((key) => `${key.toLowerCase()}:${headers[key]}\n`)
      .join('');

    const signedHeaders = Object.keys(headers)
      .sort()
      .map((key) => key.toLowerCase())
      .join(';');

    const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

    const canonicalRequest = [
      method,
      path,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    // Create string to sign
    const credentialScope = `${date}/${this.region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      timestamp,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    // Calculate signature
    const kDate = crypto.createHmac('sha256', `AWS4${this.secretKey}`).update(date).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    // Create authorization header
    const authorization = `${algorithm} Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      authorization,
      timestamp,
      date,
    };
  }

  // Make authenticated request to Amazon API
  async makeRequest(operation, payload) {
    try {
      // Validate credentials before making request
      if (!this.accessKey || !this.secretKey || !this.partnerTag) {
        return {
          success: false,
          error: {
            Message: 'AWS API credentials not configured',
            Code: 'MissingCredentials',
          },
        };
      }

      const path = `/paapi5/${operation.toLowerCase()}`;
      const method = 'POST';
      const payloadString = JSON.stringify(payload);

      const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Encoding': 'amz-1.0',
        'X-Amz-Target': `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`,
      };

      const { authorization, timestamp } = this.generateSignature(
        method,
        path,
        headers,
        payloadString
      );

      headers['Authorization'] = authorization;
      headers['X-Amz-Date'] = timestamp;

      const response = await axios.post(`${this.baseUrl}${path}`, payloadString, { headers });

      // Check if response is HTML (error page) even with status 200
      const responseData = response.data;
      if (typeof responseData === 'string' && responseData.trim().startsWith('<!DOCTYPE')) {
        let errorMessage = 'Amazon API service temporarily unavailable';
        
        // Try to extract title from HTML
        const titleMatch = responseData.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) {
          errorMessage = titleMatch[1].trim();
        }
        
        return {
          success: false,
          error: {
            Message: errorMessage,
            Code: 'ServiceUnavailable',
            StatusCode: response.status || 503,
            Type: 'HTMLResponse',
          },
          statusCode: response.status || 503,
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
      // Handle different types of errors
      if (error.response) {
        const statusCode = error.response.status;
        let errorData = error.response.data;
        
        // Check if response is HTML (like 503 error pages)
        if (typeof errorData === 'string' && errorData.trim().startsWith('<!DOCTYPE')) {
          // Extract meaningful error message from HTML or use status code
          let errorMessage = 'Amazon API service temporarily unavailable';
          
          // Try to extract title from HTML
          const titleMatch = errorData.match(/<title>(.*?)<\/title>/i);
          if (titleMatch) {
            errorMessage = titleMatch[1].trim();
          }
          
          return {
            success: false,
            error: {
              Message: errorMessage,
              Code: `HTTP_${statusCode}`,
              StatusCode: statusCode,
              Type: 'ServiceUnavailable',
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
        return {
          success: false,
          error: {
            Message: 'Unable to reach Amazon API. Please check your network connection.',
            Code: 'NetworkError',
            Type: 'ConnectionError',
          },
        };
      }

      return {
        success: false,
        error: {
          Message: error.message || 'Unknown error occurred',
          Code: 'RequestError',
          Type: 'UnknownError',
        },
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
      Resources: options.resources || [
        'Images.Primary.Medium',
        'ItemInfo.Title',
        'ItemInfo.Features',
        'ItemInfo.ProductInfo',
        'Offers.Listings.Price',
        'Offers.Listings.Condition',
      ],
    };

    // Add optional filters
    if (options.minPrice) payload.MinPrice = options.minPrice;
    if (options.maxPrice) payload.MaxPrice = options.maxPrice;
    if (options.brand) payload.Brand = options.brand;

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
      Resources: options.resources || [
        'Images.Primary.Large',
        'ItemInfo.Title',
        'ItemInfo.Features',
        'ItemInfo.ContentInfo',
        'ItemInfo.TechnicalInfo',
        'ItemInfo.ProductInfo',
        'Offers.Listings.Price',
        'Offers.Listings.Condition',
        'Offers.Listings.DeliveryInfo.IsPrimeEligible',
      ],
    };

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


