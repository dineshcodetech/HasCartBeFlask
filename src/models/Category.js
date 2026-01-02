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
        'All', 'Apparel', 'Appliances', 'Automotive', 'Baby', 'Beauty', 'Books',
        'Collectibles', 'Computers', 'Electronics', 'EverythingElse', 'Fashion',
        'Furniture', 'GardenAndOutdoor', 'GiftCards', 'GroceryAndGourmetFood',
        'HealthPersonalCare', 'HomeAndKitchen', 'Industrial', 'Jewelry', 'KindleStore',
        'Luggage', 'LuxuryBeauty', 'MobileApps', 'MoviesAndTV', 'Music',
        'MusicalInstruments', 'OfficeProducts', 'PetSupplies', 'Shoes', 'Software',
        'SportsAndOutdoors', 'ToolsAndHomeImprovement', 'ToysAndGames',
        'VideoGames', 'Watches'
      ],
    },
    icon: {
      type: String,
      trim: true,
      default: 'grid_view',
    },
    searchQueries: {
      type: [String],
      default: [],
    },
    // Keep for migration/legacy support temporarily
    searchQuery: {
      type: String,
      trim: true,
    },
    percentage: {
      type: Number,
      required: [true, 'Percentage is required'],
      min: [0, 'Percentage cannot be less than 0'],
      max: [100, 'Percentage cannot exceed 100'],
      default: 0,
    },
    selectedProducts: {
      type: [String],
      default: [],
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

// Migration hook: if searchQuery exists but searchQueries is empty, migrate it
categorySchema.pre('save', function (next) {
  if (this.searchQuery && (!this.searchQueries || this.searchQueries.length === 0)) {
    this.searchQueries = [this.searchQuery];
  }
  next();
});

// Indexes for better query performance
categorySchema.index({ name: 1 });
categorySchema.index({ status: 1 });
categorySchema.index({ createdAt: -1 });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
