const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      select: false, // Don't return password by default
    },
    mobile: {
      type: String,
      unique: true,
      sparse: true, // Allow null values but ensure uniqueness when present
      trim: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'agent'],
      default: 'user',
    },
    isDeactivated: {
      type: Boolean,
      default: false,
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true, // Allow null values but ensure uniqueness when present
      trim: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    balance: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Generate unique referral code
userSchema.methods.generateReferralCode = function () {
  const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${this.name.substring(0, 3).toUpperCase()}${randomString}`;
};

// Method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Hash password and generate referral code before saving
userSchema.pre('save', async function (next) {
  // Hash password if modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  // Generate referral code for agents/admins if not already set
  if ((this.role === 'agent' || this.role === 'admin') && !this.referralCode) {
    let code;
    let isUnique = false;
    while (!isUnique) {
      code = this.generateReferralCode();
      const existing = await mongoose.model('User').findOne({ referralCode: code });
      if (!existing) {
        isUnique = true;
      }
    }
    this.referralCode = code;
  }

  next();
});

module.exports = mongoose.model('User', userSchema);

