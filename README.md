# HasCart Backend - Node.js Express API

A simple Node.js Express REST API with MongoDB integration, fully dockerized.

## Features

- Express.js REST API
- MongoDB database connection
- Separate model files for better organization
- Docker and Docker Compose support
- CORS enabled
- Environment variable configuration

## Project Structure

```
HasCartBeFlask/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── controllers/
│   │   ├── userController.js    # User business logic
│   │   └── productController.js # Product business logic
│   ├── models/
│   │   ├── User.js              # User model
│   │   └── Product.js           # Product model
│   ├── routes/
│   │   ├── userRoutes.js        # User routes
│   │   └── productRoutes.js     # Product routes
│   └── server.js                # Main application entry
├── .dockerignore
├── .gitignore
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose (for containerized setup)
- MongoDB Atlas account and cluster

## MongoDB Atlas Setup

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (free tier available)
3. Create a database user with username and password
4. Whitelist your IP address (or use `0.0.0.0/0` for all IPs - not recommended for production)
5. Get your connection string from the "Connect" button
6. Your connection string should look like:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/hascart?retryWrites=true&w=majority
   ```

## Installation

### Option 1: Using Docker (Recommended)

1. Clone the repository
2. Create a `.env` file from `env.example`:
   ```bash
   cp env.example .env
   ```
3. Update `.env` with your MongoDB Atlas connection string:
   ```
   PORT=3000
   NODE_ENV=development
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hascart?retryWrites=true&w=majority
   ```

4. Build and start containers:
   ```bash
   docker-compose up --build
   ```

5. The API will be available at `http://localhost:3000`

### Option 2: Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file from `env.example`:
   ```bash
   cp env.example .env
   ```

3. Update `.env` with your MongoDB Atlas connection string:
   ```
   PORT=3000
   NODE_ENV=development
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hascart?retryWrites=true&w=majority
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login user (returns JWT token)
- `GET /api/auth/me` - Get current logged in user (Protected)

### Users

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get single user
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Products (Amazon API)

**Note:** Products are fetched directly from Amazon Product Advertising API. No products are stored locally.

**Endpoints:**
- `GET /api/products?keywords=searchterm` - Search products from Amazon
- `GET /api/products/search?q=keyword` - Search products by keyword
- `GET /api/products/category/:category?keywords=term` - Get products by category (SearchIndex)
- `GET /api/products/:asin` - Get product details by ASIN

### Admin Routes (Protected - Admin Only)

- `POST /api/admin/login` - Admin login
- `GET /api/admin/dashboard` - Get dashboard statistics
- `GET /api/admin/users` - Get all users (Admin only)

### Referral Routes (Protected - Agent/Admin Only)

- `GET /api/referral/my-code` - Get my referral code
- `GET /api/referral/my-referrals` - Get all users referred by me
- `GET /api/referral/stats` - Get referral statistics

### Amazon Product API Routes

- `POST /api/amazon/search` - Search items on Amazon
- `POST /api/amazon/items` - Get item details by ASIN
- `POST /api/amazon/browse-nodes` - Get browse nodes information

## Authentication

### Login

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "mobile": "+919876543210",
    "role": "user"
  }
}
```

**Using the Token:**
Include the token in the Authorization header for protected routes:
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Admin Routes

All routes under `/api/admin/*` require:
1. Valid JWT token in Authorization header
2. User role must be "admin"

**Example:**
```bash
curl -X GET http://localhost:3000/api/admin/dashboard \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Referral System

The app supports an affiliate marketing system where agents can refer customers:

- **Agents** and **Admins** automatically get a unique referral code when created
- **Customers** can sign up with a referral code to link to an agent
- **Agents** can monitor all their referred users

**Create User with Referral Code:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "mobile": "9876543210",
    "referralCode": "AGENT123"
  }'
```

**Get My Referral Code (Agent/Admin only):**
```bash
curl -X GET http://localhost:3000/api/referral/my-code \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get My Referrals (Agent/Admin only):**
```bash
curl -X GET http://localhost:3000/api/referral/my-referrals \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Amazon Product API

**Search Items:**
```bash
curl -X POST http://localhost:3000/api/amazon/search \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": "laptop",
    "searchIndex": "Electronics",
    "itemCount": 10,
    "minPrice": 50000,
    "maxPrice": 100000,
    "brand": "Apple"
  }'
```

**Get Item Details by ASIN:**
```bash
curl -X POST http://localhost:3000/api/amazon/items \
  -H "Content-Type: application/json" \
  -d '{
    "itemIds": ["B07H65KP63", "B00X4WHP5E"]
  }'
```

**Get Browse Nodes:**
```bash
curl -X POST http://localhost:3000/api/amazon/browse-nodes \
  -H "Content-Type: application/json" \
  -d '{
    "browseNodeIds": ["3040", "3045"]
  }'
```

## Example Requests

### Create User

**Endpoint:** `POST /api/users`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "mobile": "9876543210",
  "role": "user"  // optional, defaults to "user"
}
```

**Note:** Mobile number should be 10 digits without country code. The system automatically adds +91 prefix.

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "mobile": "9876543210",
    "role": "user"
  }'
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "mobile": "+919876543210",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Missing required fields or validation error
- `409` - User with email already exists
- `500` - Server error

### Get Products from Amazon

**Note:** All products are fetched directly from Amazon Product Advertising API. No products are stored in the database.

**Search Products:**
```bash
GET /api/products?keywords=laptop&searchIndex=Electronics&itemCount=10&minPrice=50000&maxPrice=100000
```

**Example:**
```bash
curl "http://localhost:3000/api/products?keywords=laptop&searchIndex=Electronics&itemCount=10"
```

**Query Parameters:**
- `keywords` - Search keywords (required)
- `searchIndex` - Amazon search index/category (default: All)
- `itemCount` - Number of items to return (default: 10)
- `minPrice` - Minimum price filter
- `maxPrice` - Maximum price filter
- `brand` - Brand filter
- `page` - Page number (for pagination)

### Search Products

**Endpoint:** `GET /api/products/search?q=keyword`

**Example:**
```bash
curl "http://localhost:3000/api/products/search?q=laptop&searchIndex=Electronics&itemCount=10"
```

**Query Parameters:**
- `q` - Search query (required)
- `searchIndex` - Amazon search index
- `itemCount` - Number of items
- `minPrice` - Minimum price
- `maxPrice` - Maximum price
- `brand` - Brand filter

### Get Products by Category

**Endpoint:** `GET /api/products/category/:category?keywords=term`

**Example:**
```bash
curl "http://localhost:3000/api/products/category/Electronics?keywords=laptop&itemCount=10"
```

**Parameters:**
- `:category` - Amazon SearchIndex (e.g., Electronics, Books, Clothing)
- `keywords` - Search keywords (required)
- `itemCount` - Number of items
- `minPrice`, `maxPrice`, `brand` - Optional filters

### Get Product Details by ASIN

**Endpoint:** `GET /api/products/:asin`

**Example:**
```bash
curl "http://localhost:3000/api/products/B07H65KP63"
```

**Response:**
Returns detailed product information from Amazon API including:
- Product title, features, description
- Images
- Price and availability
- Customer reviews
- Technical specifications

## Docker Commands

- Start containers: `docker-compose up`
- Start in background: `docker-compose up -d`
- Stop containers: `docker-compose down`
- View logs: `docker-compose logs -f`
- Rebuild containers: `docker-compose up --build`

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `MONGODB_URI` - MongoDB Atlas connection string (format: `mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority`)
- `JWT_SECRET` - Secret key for JWT token signing (use a strong random string)
- `JWT_EXPIRE` - JWT token expiration time (default: 30d)
- `AWS_ACCESS_KEY` - Amazon Product Advertising API access key
- `AWS_SECRET_KEY` - Amazon Product Advertising API secret key
- `AWS_PARTNER_TAG` - Amazon Associates Partner Tag
- `AWS_REGION` - AWS region (default: eu-west-1)
- `AWS_MARKETPLACE` - Amazon marketplace (default: www.amazon.in)

**Important:** Never commit your `.env` file to version control. It contains sensitive credentials.

## User Roles

- **user** - Regular customer (default)
- **agent** - Affiliate agent who can refer customers and monitor them
- **admin** - Administrator with full access

Agents and Admins automatically receive a unique referral code that customers can use when signing up.

## License

ISC

