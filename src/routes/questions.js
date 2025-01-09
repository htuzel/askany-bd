const express = require('express');
const router = express.Router();
const redis = require('../config/redis');
const { v4: uuidv4 } = require('uuid');

// Create a new question
router.post('/', async (req, res) => {
  try {
    const { sessionSlug, content, nickname, is_anonymous } = req.body;

    // Validate session exists
    const session = await redis.hgetall(`session:${sessionSlug}`);
    if (!session || Object.keys(session).length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Create question object
    const question = {
      id: uuidv4(),
      content,
      nickname: is_anonymous ? null : nickname,
      is_anonymous,
      is_answered: false,
      upvote_count: 0,
      created_at: new Date().toISOString()
    };

    // Add question to the session's question list
    await redis.lpush(`session:${sessionSlug}:questions`, JSON.stringify(question));

    res.status(201).json(question);
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({ error: 'Error creating question' });
  }
});

// Upvote a question
router.post('/:questionId/upvote', async (req, res) => {
  try {
    const { questionId } = req.params;
    const { clientId, sessionSlug } = req.body;

    // Get all questions for the session
    const questionsData = await redis.lrange(`session:${sessionSlug}:questions`, 0, -1);
    const questions = questionsData.map(q => JSON.parse(q));
    
    // Find the target question
    const questionIndex = questions.findIndex(q => q.id === questionId);
    if (questionIndex === -1) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Check if user has already upvoted
    const upvoteKey = `upvote:${questionId}:${clientId}`;
    const hasUpvoted = await redis.exists(upvoteKey);

    if (hasUpvoted) {
      // Remove upvote
      await redis.del(upvoteKey);
      questions[questionIndex].upvote_count--;
    } else {
      // Add upvote
      await redis.set(upvoteKey, '1');
      questions[questionIndex].upvote_count++;
    }

    // Update question in Redis
    await redis.lset(
      `session:${sessionSlug}:questions`,
      questionIndex,
      JSON.stringify(questions[questionIndex])
    );

    // Return updated question with hasUpvoted status
    res.json({
      ...questions[questionIndex],
      hasUpvoted: !hasUpvoted
    });
  } catch (error) {
    console.error('Error upvoting question:', error);
    res.status(500).json({ error: 'Error upvoting question' });
  }
});

// Mark question as answered
router.patch('/:questionId/answer', async (req, res) => {
  try {
    const { questionId } = req.params;
    const { sessionSlug } = req.body;

    // Get all questions for the session
    const questionsData = await redis.lrange(`session:${sessionSlug}:questions`, 0, -1);
    const questions = questionsData.map(q => JSON.parse(q));
    
    // Find the target question
    const questionIndex = questions.findIndex(q => q.id === questionId);
    if (questionIndex === -1) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Update question
    questions[questionIndex].is_answered = true;

    // Update in Redis
    await redis.lset(
      `session:${sessionSlug}:questions`,
      questionIndex,
      JSON.stringify(questions[questionIndex])
    );

    res.json(questions[questionIndex]);
  } catch (error) {
    console.error('Error marking question as answered:', error);
    res.status(500).json({ error: 'Error marking question as answered' });
  }
});

module.exports = router; 