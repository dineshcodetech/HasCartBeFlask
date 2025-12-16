const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            trim: true,
        },
        imageUrl: {
            type: String,
            required: [true, 'Please provide an image URL'],
            trim: true,
        },
        link: {
            type: String, // Internal screen path or external URL
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        order: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Banner', bannerSchema);
