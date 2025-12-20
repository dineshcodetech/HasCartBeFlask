const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        type: {
            type: String,
            enum: ['earnings', 'payout', 'adjustment'],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'completed',
        },
        description: {
            type: String,
            trim: true,
        },
        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'referenceModel',
        },
        referenceModel: {
            type: String,
            enum: ['ProductClick', 'Withdrawal'],
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
transactionSchema.index({ user: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
