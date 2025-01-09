const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const redis = require('./config/redis');
const statsService = require('./services/statsService');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/questions', require('./routes/questions'));

// Stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await statsService.getStats();
    const redisStats = await redis.get('app:stats');
    res.json({
      ...stats,
      ...(redisStats ? JSON.parse(redisStats) : {})
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Error fetching stats' });
  }
});

// Cron job for cleaning old sessions (7 days)
cron.schedule('0 4 * * *', async () => {
  try {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    // Get old sessions
    const oldSessions = await redis.zrangebyscore('sessions', 0, sevenDaysAgo);
    
    // Get session details before deletion
    const sessionDetails = [];
    for (const slug of oldSessions) {
      const session = await redis.hgetall(`session:${slug}`);
      if (session && Object.keys(session).length > 0) {
        const questionIds = await redis.smembers(`session:${slug}:questions`);
        const questions = [];
        
        for (const questionId of questionIds) {
          const question = await redis.hgetall(`question:${questionId}`);
          if (question && Object.keys(question).length > 0) {
            const upvotes = await redis.smembers(`question:${questionId}:upvotes`);
            questions.push({
              ...question,
              upvoteCount: parseInt(question.upvoteCount || '0'),
              upvotes: upvotes.length
            });
          }
        }
        
        sessionDetails.push({
          ...session,
          questionCount: questions.length,
          totalUpvotes: questions.reduce((sum, q) => sum + q.upvoteCount, 0),
          questions
        });
      }
    }

    // Update stats before deletion
    if (sessionDetails.length > 0) {
      await statsService.updateStats(sessionDetails);
    }
    
    // Delete sessions from Redis
    for (const slug of oldSessions) {
      const questionIds = await redis.smembers(`session:${slug}:questions`);
      for (const questionId of questionIds) {
        await redis.del(`question:${questionId}:upvotes`);
        await redis.del(`question:${questionId}`);
      }
      await redis.del(`session:${slug}:questions`);
      await redis.del(`session:${slug}`);
    }
    
    // Remove old sessions from the sorted set
    await redis.zremrangebyscore('sessions', 0, sevenDaysAgo);
    
    console.log(`[CRON] Cleaned up ${oldSessions.length} old sessions`);
  } catch (err) {
    console.error('[CRON] Error cleaning old sessions:', err);
  }
});

// Daily stats update cron job
cron.schedule('0 0 * * *', async () => {
  try {
    const stats = await statsService.getStats();
    await redis.set('app:stats', JSON.stringify({
      dailyStats: {
        totalSessions: stats.totalSessions,
        lastUpdated: new Date().toISOString()
      }
    }));
    console.log('[CRON] Daily stats updated');
  } catch (err) {
    console.error('[CRON] Error updating daily stats:', err);
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 