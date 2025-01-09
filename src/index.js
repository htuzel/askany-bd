const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const redis = require('./config/redis');
const statsService = require('./services/statsService');
const app = require('./app');

// Initialize stats when app starts
statsService.initializeStats().catch(console.error);

// Daily cron job for stats sync and cleanup (runs at 04:00 AM)
cron.schedule('0 4 * * *', async () => {
  try {
    console.log('[CRON] Starting daily maintenance...');

    // 1. Sync stats from Redis to JSON file
    await statsService.syncStatsToFile();
    console.log('[CRON] Stats synced to file');

    // 2. Clean up old sessions (7 days)
    const oldSessions = await redis.keys('session:*');
    for (const sessionKey of oldSessions) {
      if (!sessionKey.includes(':participants') && !sessionKey.includes(':questions')) {
        const session = await redis.hgetall(sessionKey);
        if (session.createdAt) {
          const createdAt = new Date(session.createdAt);
          const now = new Date();
          const diffDays = (now - createdAt) / (1000 * 60 * 60 * 24);
          
          if (diffDays > 7) {
            const sessionId = sessionKey.split(':')[1];
            
            // Delete session and related data
            await redis.del(sessionKey);
            await redis.del(`session:${sessionId}:questions`);
            await redis.del(`session:${sessionId}:participants`);
            
            // Delete upvotes for this session's questions
            const upvoteKeys = await redis.keys(`upvote:*:*`);
            for (const upvoteKey of upvoteKeys) {
              if (upvoteKey.includes(sessionId)) {
                await redis.del(upvoteKey);
              }
            }
          }
        }
      }
    }
    
    console.log('[CRON] Old sessions cleaned up');
    console.log('[CRON] Daily maintenance completed successfully');
  } catch (error) {
    console.error('[CRON] Error in daily maintenance:', error);
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 