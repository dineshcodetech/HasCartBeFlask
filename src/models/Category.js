const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    amazonSearchIndex: {
      type: String,
      trim: true,
      default: 'All',
      enum: [
        'All', 'Electronics', 'Books', 'Clothing', 'HomeGarden', 'SportsOutdoors',
        'Automotive', 'Beauty', 'HealthPersonalCare', 'ToysGames', 'Computers',
        'Music', 'MoviesTV', 'VideoGames', 'PetSupplies', 'OfficeProducts',
        'ToolsHomeImprovement', 'Baby', 'GroceryGourmetFood', 'Jewelry', 'Watches',
        'Shoes', 'Handmade', 'Industrial'
      ],
    },
    searchQuery: {
      type: String,
      trim: true,
      default: '',
    },
    percentage: {
      type: Number,
      required: [true, 'Percentage is required'],
      min: [0, 'Percentage cannot be less than 0'],
      max: [100, 'Percentage cannot exceed 100'],
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
categorySchema.index({ name: 1 });
categorySchema.index({ status: 1 });
categorySchema.index({ createdAt: -1 });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
