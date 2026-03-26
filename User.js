const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PLAN_LIMITS = {
  free: 10,
  dirt: 25,
  stone: 50,
  obsidian: 80,
  bedrock: 150,
};

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username cannot exceed 20 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    plan: {
      type: String,
      enum: ['free', 'dirt', 'stone', 'obsidian', 'bedrock'],
      default: 'free',
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    lastReset: {
      type: Date,
      default: Date.now,
    },
    loginHistory: [
      {
        timestamp: { type: Date, default: Date.now },
        ip: String,
        userAgent: String,
      },
    ],
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get message limit for current plan
userSchema.methods.getMessageLimit = function () {
  return PLAN_LIMITS[this.plan] || 10;
};

// Check and reset daily limit
userSchema.methods.checkAndResetLimit = function () {
  const now = new Date();
  const lastReset = new Date(this.lastReset);
  const hoursSinceReset = (now - lastReset) / (1000 * 60 * 60);

  if (hoursSinceReset >= 24) {
    this.messageCount = 0;
    this.lastReset = now;
    return true; // was reset
  }
  return false;
};

// Check if user can send message
userSchema.methods.canSendMessage = function () {
  this.checkAndResetLimit();
  return this.messageCount < this.getMessageLimit();
};

// Get remaining messages
userSchema.methods.getRemainingMessages = function () {
  this.checkAndResetLimit();
  return Math.max(0, this.getMessageLimit() - this.messageCount);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.PLAN_LIMITS = PLAN_LIMITS;
