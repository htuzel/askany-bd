const express = require('express');
const cors = require('cors');
const sessionsRouter = require('./routes/sessions');
const questionsRouter = require('./routes/questions');
const githubRouter = require('./routes/github');

const app = express();

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

app.use('/api/sessions', sessionsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/github', githubRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something broke!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app; 