const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: [1, 'Minimum withdrawal amount is 1'],
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'failed'],
            default: 'pending',
        },
        paymentMethod: {
            type: String,
            required: true,
        },
        paymentDetails: {
            type: String,
            required: true,
        },
        adminNotes: {
            type: String,
            trim: true,
        },
        processedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
withdrawalSchema.index({ user: 1 });
withdrawalSchema.index({ status: 1 });
withdrawalSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
