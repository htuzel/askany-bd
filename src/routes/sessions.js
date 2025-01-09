const express = require('express');
const router = express.Router();
const redis = require('../config/redis');
const { v4: uuidv4 } = require('uuid');
const statsService = require('../services/statsService');

// Initialize stats when app starts
statsService.initializeStats().catch(console.error);

// Get stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await statsService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Error fetching stats' });
  }
});

// Create a new session
router.post('/', async (req, res) => {
  try {
    const slug = uuidv4().slice(0, 32);
    await redis.hset(`session:${slug}`, {
      title: req.body.title || '',
      createdAt: new Date().toISOString(),
      participantCount: '0'
    });
    
    // Increment total sessions using stats service
    await statsService.incrementStats('session');
    
    res.json({ slug });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Error creating session' });
  }
});

// Get session by slug
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { clientId } = req.query;

    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    const session = await redis.hgetall(`session:${slug}`);

    if (!session || Object.keys(session).length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if this client has visited this session before
    const hasVisited = await redis.sismember(`session:${slug}:participants`, clientId);
    
    if (!hasVisited) {
      // Add client to participants set
      await redis.sadd(`session:${slug}:participants`, clientId);
      
      // Increment participant count
      await redis.hincrby(`session:${slug}`, 'participantCount', 1);
      
      // Increment total participants using stats service
      await statsService.incrementStats('participant');
    }

    // Get questions for this session
    const questions = await redis.lrange(`session:${slug}:questions`, 0, -1);
    const parsedQuestions = questions.map(q => JSON.parse(q));

    // For each question, check if the current client has upvoted it
    const questionsWithUpvoteStatus = await Promise.all(
      parsedQuestions.map(async (question) => {
        const hasUpvoted = await redis.exists(`upvote:${question.id}:${clientId}`);
        return { ...question, hasUpvoted };
      })
    );

    // Sort questions by upvote count (descending)
    const sortedQuestions = questionsWithUpvoteStatus.sort((a, b) => b.upvote_count - a.upvote_count);

    res.json({
      session: {
        ...session,
        slug,
        participantCount: parseInt(session.participantCount || 0)
      },
      questions: sortedQuestions
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Error fetching session' });
  }
});

module.exports = router; 