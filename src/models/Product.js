const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    asin: {
      type: String,
      required: [true, 'ASIN is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    searchIndex: {
      type: String,
      trim: true,
    },
    price: {
      amount: {
        type: Number,
        default: 0,
      },
      currency: {
        type: String,
        default: 'INR',
      },
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    productUrl: {
      type: String,
      trim: true,
    },
    features: [String],
    condition: {
      type: String,
      enum: ['New', 'Used', 'Refurbished', 'Collectible'],
      default: 'New',
    },
    isPrimeEligible: {
      type: Boolean,
      default: false,
    },
    availability: {
      type: String,
      default: 'In Stock',
    },
    rating: {
      value: {
        type: Number,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'archived'],
      default: 'active',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
productSchema.index({ asin: 1 });
productSchema.index({ title: 'text', description: 'text', brand: 'text' });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ 'price.amount': 1 });
productSchema.index({ createdAt: -1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;


