const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const User = require('../models/User');
const Chat = require('../models/Chat');

// All admin routes require authentication + admin privileges
router.use(protect, adminOnly);

// @route   GET /api/admin/users
// @desc    Get all users with stats
// @access  Admin
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password -loginHistory').sort({ createdAt: -1 });

    const usersData = users.map((u) => {
      u.checkAndResetLimit();
      return {
        id: u._id,
        username: u.username,
        email: u.email,
        plan: u.plan,
        isAdmin: u.isAdmin,
        messageCount: u.messageCount,
        messageLimit: u.getMessageLimit(),
        remaining: u.getRemainingMessages(),
        lastReset: u.lastReset,
        createdAt: u.createdAt,
      };
    });

    console.log(`[ADMIN] User list accessed | Count: ${users.length} | ${new Date().toISOString()}`);

    res.json({ success: true, count: users.length, users: usersData });
  } catch (err) {
    console.error('[ADMIN USERS ERROR]', err);
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
});

// @route   GET /api/admin/users/:userId
// @desc    Get single user details
// @access  Admin
router.get('/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const chatCount = await Chat.countDocuments({ user: user._id, isActive: true });

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
        chatCount,
        loginHistory: user.loginHistory.slice(-5),
        lastReset: user.lastReset,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch user.' });
  }
});

// @route   PUT /api/admin/users/:userId/plan
// @desc    Change user's plan
// @access  Admin
router.put('/users/:userId/plan', async (req, res) => {
  try {
    const { plan } = req.body;
    const validPlans = ['free', 'dirt', 'stone', 'obsidian', 'bedrock'];

    if (!validPlans.includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan. Valid: free, dirt, stone, obsidian, bedrock' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const oldPlan = user.plan;
    user.plan = plan;
    await user.save({ validateBeforeSave: false });

    console.log(`[ADMIN] Plan changed: ${user.username} | ${oldPlan} → ${plan} | By: ${req.user.username} | ${new Date().toISOString()}`);

    res.json({
      success: true,
      message: `Plan updated: ${user.username} → ${plan.toUpperCase()}`,
      user: { id: user._id, username: user.username, plan: user.plan, messageLimit: user.getMessageLimit() },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update plan.' });
  }
});

// @route   PUT /api/admin/users/:userId/reset
// @desc    Reset user's daily message count
// @access  Admin
router.put('/users/:userId/reset', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.messageCount = 0;
    user.lastReset = new Date();
    await user.save({ validateBeforeSave: false });

    console.log(`[ADMIN] Limit reset: ${user.username} | By: ${req.user.username} | ${new Date().toISOString()}`);

    res.json({ success: true, message: `Message limit reset for ${user.username}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reset limit.' });
  }
});

// @route   GET /api/admin/stats
// @desc    Get overall platform stats
// @access  Admin
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalChats = await Chat.countDocuments({ isActive: true });

    const planCounts = await User.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]);

    const planStats = {};
    planCounts.forEach((p) => (planStats[p._id] = p.count));

    // Recent logins (last 24h) - check loginHistory
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogins = await User.countDocuments({
      'loginHistory.timestamp': { $gte: oneDayAgo },
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalChats,
        planBreakdown: planStats,
        recentLogins,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

// @route   DELETE /api/admin/users/:userId
// @desc    Delete a user (soft delete chats)
// @access  Admin
router.delete('/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.email === process.env.ADMIN_EMAIL) {
      return res.status(403).json({ success: false, message: 'Cannot delete admin account.' });
    }

    await Chat.updateMany({ user: user._id }, { isActive: false });
    await User.findByIdAndDelete(req.params.userId);

    console.log(`[ADMIN] User deleted: ${user.username} | ${user.email} | By: ${req.user.username}`);
    res.json({ success: true, message: `User ${user.username} deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete user.' });
  }
});

module.exports = router;
