require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');

// Import routes
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const referralRoutes = require('./routes/referralRoutes');
const amazonRoutes = require('./routes/amazonRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const bannerRoutes = require('./routes/bannerRoutes');

// Connect to database
connectDB();

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to HasCart API - Affiliate Marketing Platform',
    version: '1.0.0',
    description: 'Products are fetched from Amazon Product Advertising API',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      products: '/api/products (Amazon API)',
      amazon: '/api/amazon',
      referral: '/api/referral',
      admin: '/api/admin',
      categories: '/api/admin/categories',
      analytics: '/api/analytics',
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin/categories', categoryRoutes); // Moved up to bypass adminRoutes auth
app.use('/api/admin', adminRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/amazon', amazonRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/banners', bannerRoutes);

const { sendNotFound, sendError, sendValidationError } = require('./utils/responseHandler');

// 404 handler
app.use((req, res) => {
  sendNotFound(res, 'Route not found');
});

// Error handler
app.use((err, req, res, next) => {
  // Handle MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return sendError(res, `This ${field} is already in use. Please use a different ${field}.`, 409);
  }

  // Handle MongoDB validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((error) => error.message);
    return sendValidationError(res, messages.join(', '));
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired', 401);
  }

  // Default error
  sendError(res, err.message || 'Internal Server Error', err.status || 500);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
