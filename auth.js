const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Check existing
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      const field = existingUser.email === email ? 'Email' : 'Username';
      return res.status(409).json({ success: false, message: `${field} already in use.` });
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'aryan11222567@gmail.com';
    const isAdmin = email === adminEmail;

    const user = await User.create({ username, email, password, isAdmin });

    console.log(`[SIGNUP] New user: ${username} | ${email} | Admin: ${isAdmin} | ${new Date().toISOString()}`);

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        plan: user.plan,
        isAdmin: user.isAdmin,
        messageCount: user.messageCount,
        messageLimit: user.getMessageLimit(),
        remaining: user.getRemainingMessages(),
      },
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    console.error('[SIGNUP ERROR]', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Log login activity
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    user.loginHistory.push({ timestamp: new Date(), ip, userAgent });
    if (user.loginHistory.length > 20) user.loginHistory.shift(); // Keep last 20
    await user.save({ validateBeforeSave: false });

    console.log(`[LOGIN] User: ${user.username} | ${user.email} | IP: ${ip} | Plan: ${user.plan} | ${new Date().toISOString()}`);

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: `Welcome back, ${user.username}!`,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        plan: user.plan,
        isAdmin: user.isAdmin,
        messageCount: user.messageCount,
        messageLimit: user.getMessageLimit(),
        remaining: user.getRemainingMessages(),
      },
    });
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user info
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = req.user;
    user.checkAndResetLimit();
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        plan: user.plan,
        isAdmin: user.isAdmin,
        messageCount: user.messageCount,
        messageLimit: user.getMessageLimit(),
        remaining: user.getRemainingMessages(),
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
