const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const redis = require('../config/redis');

// Add a new question
router.post('/', async (req, res) => {
  try {
    const { session_id, content, nickname, is_anonymous } = req.body;
    const questionId = uuidv4();
    const question = {
      id: questionId,
      sessionId: session_id,
      content,
      nickname: is_anonymous ? null : nickname,
      isAnonymous: is_anonymous,
      isAnswered: false,
      upvoteCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Get session slug from session id
    const sessions = await redis.keys('session:*');
    let sessionSlug;
    for (const sessionKey of sessions) {
      const sessionData = await redis.hgetall(sessionKey);
      if (sessionData.id === session_id) {
        sessionSlug = sessionKey.split(':')[1];
        break;
      }
    }

    if (!sessionSlug) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Store question in Redis
    await redis.hset(`question:${questionId}`, question);
    // Add question to session's question set
    await redis.sadd(`session:${sessionSlug}:questions`, questionId);

    res.json(question);
  } catch (err) {
    console.error('Error creating question:', err);
    res.status(500).json({ error: 'Error creating question' });
  }
});

// Upvote a question
router.post('/:id/upvote', async (req, res) => {
  try {
    const { id } = req.params;
    const { client_id } = req.body;

    // Check if question exists
    const question = await redis.hgetall(`question:${id}`);
    if (!question || Object.keys(question).length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Check if user already voted
    const hasVoted = await redis.sismember(`question:${id}:upvotes`, client_id);
    if (hasVoted) {
      return res.status(400).json({ error: 'Already voted' });
    }

    // Add upvote and increment count
    await redis.sadd(`question:${id}:upvotes`, client_id);
    await redis.hincrby(`question:${id}`, 'upvoteCount', 1);

    // Get updated question
    const updatedQuestion = await redis.hgetall(`question:${id}`);
    const upvotes = await redis.smembers(`question:${id}:upvotes`);

    res.json({
      ...updatedQuestion,
      upvoteCount: parseInt(updatedQuestion.upvoteCount),
      isAnswered: updatedQuestion.isAnswered === 'true',
      isAnonymous: updatedQuestion.isAnonymous === 'true',
      upvotes: upvotes.map(clientId => ({ questionId: id, clientId }))
    });
  } catch (err) {
    console.error('Error upvoting question:', err);
    res.status(500).json({ error: 'Error upvoting question' });
  }
});

// Mark question as answered
router.patch('/:id/answer', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if question exists
    const question = await redis.hgetall(`question:${id}`);
    if (!question || Object.keys(question).length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Update question
    await redis.hset(`question:${id}`, 'isAnswered', 'true');
    await redis.hset(`question:${id}`, 'updatedAt', new Date().toISOString());

    // Get updated question with upvotes
    const updatedQuestion = await redis.hgetall(`question:${id}`);
    const upvotes = await redis.smembers(`question:${id}:upvotes`);

    res.json({
      ...updatedQuestion,
      upvoteCount: parseInt(updatedQuestion.upvoteCount),
      isAnswered: updatedQuestion.isAnswered === 'true',
      isAnonymous: updatedQuestion.isAnonymous === 'true',
      upvotes: upvotes.map(clientId => ({ questionId: id, clientId }))
    });
  } catch (err) {
    console.error('Error marking question as answered:', err);
    res.status(500).json({ error: 'Error marking question as answered' });
  }
});

module.exports = router; 