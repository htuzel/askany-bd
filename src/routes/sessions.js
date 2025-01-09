const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const redis = require('../config/redis');

// Create a new session
router.post('/', async (req, res) => {
  try {
    const sessionId = uuidv4();
    const slug = uuidv4().slice(0, 8);
    const session = {
      id: sessionId,
      slug,
      title: req.body.title || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store session in Redis
    await redis.hset(`session:${slug}`, session);
    // Store session slug in a set for cleanup
    await redis.zadd('sessions', Date.now(), slug);

    res.json(session);
  } catch (err) {
    console.error('Error creating session:', err);
    res.status(500).json({ error: 'Error creating session' });
  }
});

// Get session by slug
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Get session from Redis
    const session = await redis.hgetall(`session:${slug}`);
    if (!session || Object.keys(session).length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get all questions for this session
    const questionKeys = await redis.smembers(`session:${slug}:questions`);
    const questions = [];

    for (const questionId of questionKeys) {
      const question = await redis.hgetall(`question:${questionId}`);
      if (question && Object.keys(question).length > 0) {
        // Get upvotes for this question
        const upvotes = await redis.smembers(`question:${questionId}:upvotes`);
        questions.push({
          ...question,
          upvoteCount: parseInt(question.upvoteCount || '0'),
          isAnswered: question.isAnswered === 'true',
          isAnonymous: question.isAnonymous === 'true',
          upvotes: upvotes.map(clientId => ({ questionId, clientId }))
        });
      }
    }

    // Sort questions by upvotes and creation time
    questions.sort((a, b) => {
      if (b.upvoteCount !== a.upvoteCount) {
        return b.upvoteCount - a.upvoteCount;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({
      session: {
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt)
      },
      questions
    });
  } catch (err) {
    console.error('Error fetching session:', err);
    res.status(500).json({ error: 'Error fetching session' });
  }
});

module.exports = router; 