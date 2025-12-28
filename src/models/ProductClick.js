const mongoose = require('mongoose');

const productClickSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false, // Allow guest clicks
        },
        asin: {
            type: String,
            required: true,
            trim: true,
        },
        productName: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            required: true,
            trim: true,
        },
        price: {
            type: Number,
            default: 0,
        },
        imageUrl: {
            type: String,
            trim: true,
        },
        productUrl: {
            type: String,
            required: true,
            trim: true,
        },
        agent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null, // Populated from user.referredBy at creation time
        },
        commissionRate: {
            type: Number,
            default: 0, // Percentage used for calculation (e.g. 0.05 for 5%)
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for faster querying in dashboard
productClickSchema.index({ user: 1 });
productClickSchema.index({ agent: 1 });
productClickSchema.index({ category: 1 });
productClickSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ProductClick', productClickSchema);
