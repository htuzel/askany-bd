const express = require('express');
const cors = require('cors');
const sessionsRouter = require('./routes/sessions');
const questionsRouter = require('./routes/questions');
const githubRouter = require('./routes/github');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
}));

app.use(express.json());

app.use('/api/sessions', sessionsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/github', githubRouter);

module.exports = app; 