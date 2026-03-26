require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// =============================================
// MIDDLEWARE
// =============================================
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Request logger
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} | IP: ${req.ip}`);
  }
  next();
});

// =============================================
// DATABASE CONNECTION
// =============================================
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/infamous_ai')
  .then(() => {
    console.log('✅ MongoDB Connected');
    console.log(`   DB: ${mongoose.connection.name}`);
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  });

// =============================================
// ROUTES
// =============================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Infamous AI v1.1',
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Serve frontend for all non-API routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// =============================================
// ERROR HANDLER
// =============================================
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// =============================================
// START SERVER
// =============================================
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║      INFAMOUS AI v1.1 - SERVER       ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  🚀 Running on: http://localhost:${PORT}  ║`);
  console.log(`║  🌍 Mode: ${(process.env.NODE_ENV || 'development').padEnd(26)}║`);
  console.log(`║  🤖 AI: Google Gemini 1.5 Pro        ║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  WARNING: GEMINI_API_KEY not set in .env file!');
    console.warn('   Get your free key at: https://aistudio.google.com/app/apikey');
  }
});

module.exports = app;
