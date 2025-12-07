# Product APIs Documentation

All product APIs fetch data from Amazon Product Advertising API.

**Base URL:** `http://localhost:3000` (or your server host)

---

## Public Product APIs

### 1. Get All Products
**Endpoint:** `GET /api/products`

**Description:** Search and get products from Amazon API (requires keywords)

**URL:** `http://localhost:3000/api/products`

**Query Parameters:**
- `keywords` (required) - Search keywords
- `search` (optional) - Alternative to keywords
- `searchIndex` (optional) - Amazon search index/category (default: "All")
- `itemCount` (optional) - Number of items to return (default: 10)
- `limit` (optional) - Alternative to itemCount
- `minPrice` (optional) - Minimum price filter
- `maxPrice` (optional) - Maximum price filter
- `brand` (optional) - Brand filter
- `page` (optional) - Page number for pagination (default: 1)

**Example:**
```bash
GET http://localhost:3000/api/products?keywords=laptop&searchIndex=Electronics&itemCount=10&minPrice=50000&maxPrice=100000
```

**Access:** Public

---

### 2. Search Products
**Endpoint:** `GET /api/products/search`

**Description:** Search products by keyword query

**URL:** `http://localhost:3000/api/products/search`

**Query Parameters:**
- `q` (required) - Search query
- `searchIndex` (optional) - Amazon search index (default: "All")
- `itemCount` (optional) - Number of items (default: 10)
- `minPrice` (optional) - Minimum price filter
- `maxPrice` (optional) - Maximum price filter
- `brand` (optional) - Brand filter

**Example:**
```bash
GET http://localhost:3000/api/products/search?q=laptop&searchIndex=Electronics&itemCount=10
```

**Access:** Public

---

### 3. Get Products by Category
**Endpoint:** `GET /api/products/category/:category`

**Description:** Get products filtered by Amazon category (SearchIndex)

**URL:** `http://localhost:3000/api/products/category/:category`

**Path Parameters:**
- `category` (required) - Amazon SearchIndex (e.g., "Electronics", "Books", "Clothing", "All")

**Query Parameters:**
- `keywords` (required) - Search keywords
- `itemCount` (optional) - Number of items (default: 10)
- `minPrice` (optional) - Minimum price filter
- `maxPrice` (optional) - Maximum price filter
- `brand` (optional) - Brand filter

**Example:**
```bash
GET http://localhost:3000/api/products/category/Electronics?keywords=laptop&itemCount=10
```

**Access:** Public

---

### 4. Get Product by ASIN
**Endpoint:** `GET /api/products/:asin`

**Description:** Get detailed product information by Amazon ASIN (10-character alphanumeric code)

**URL:** `http://localhost:3000/api/products/:asin`

**Path Parameters:**
- `asin` (required) - Amazon ASIN (10 alphanumeric characters, e.g., "B07H65KP63")

**Example:**
```bash
GET http://localhost:3000/api/products/B07H65KP63
```

**Response includes:**
- Product title, features, description
- Images
- Price and availability
- Customer reviews
- Technical specifications

**Access:** Public

---

## Admin Product APIs

**Note:** All admin APIs require authentication token and admin role.

**Authentication:** Include `Authorization: Bearer <token>` header

### 5. Get All Products (Admin)
**Endpoint:** `GET /api/admin/products`

**Description:** Admin endpoint to search and get products from Amazon API

**URL:** `http://localhost:3000/api/admin/products`

**Query Parameters:**
- `keywords` (optional) - Search keywords (default: "all")
- `search` (optional) - Alternative to keywords
- `searchIndex` (optional) - Amazon search index (default: "All")
- `itemCount` (optional) - Number of items (default: 10)
- `limit` (optional) - Alternative to itemCount
- `minPrice` (optional) - Minimum price filter
- `maxPrice` (optional) - Maximum price filter
- `brand` (optional) - Brand filter
- `page` (optional) - Page number (default: 1)

**Example:**
```bash
GET http://localhost:3000/api/admin/products?keywords=laptop&searchIndex=Electronics&itemCount=10
Authorization: Bearer <admin_token>
```

**Access:** Private/Admin

---

### 6. Get Product by ASIN (Admin)
**Endpoint:** `GET /api/admin/products/asin/:asin`

**Description:** Admin endpoint to get product details by ASIN

**URL:** `http://localhost:3000/api/admin/products/asin/:asin`

**Path Parameters:**
- `asin` (required) - Amazon ASIN (10 alphanumeric characters)

**Example:**
```bash
GET http://localhost:3000/api/admin/products/asin/B07H65KP63
Authorization: Bearer <admin_token>
```

**Access:** Private/Admin

---

### 7. Get Product Statistics (Admin)
**Endpoint:** `GET /api/admin/products/stats`

**Description:** Get product statistics information

**URL:** `http://localhost:3000/api/admin/products/stats`

**Example:**
```bash
GET http://localhost:3000/api/admin/products/stats
Authorization: Bearer <admin_token>
```

**Response:** Returns note that products are fetched from Amazon API

**Access:** Private/Admin

---

## Summary

### Public APIs (No Authentication Required)
1. `GET /api/products` - Get all products (requires keywords)
2. `GET /api/products/search` - Search products
3. `GET /api/products/category/:category` - Get products by category
4. `GET /api/products/:asin` - Get product by ASIN

### Admin APIs (Authentication Required)
1. `GET /api/admin/products` - Get all products (admin)
2. `GET /api/admin/products/asin/:asin` - Get product by ASIN (admin)
3. `GET /api/admin/products/stats` - Get product statistics

---

## Notes

- All products are fetched from **Amazon Product Advertising API**
- Default server port: **3000**
- Replace `localhost:3000` with your actual server host/domain in production
- Admin APIs require valid JWT token with admin role
- All APIs return validated responses from Amazon API
