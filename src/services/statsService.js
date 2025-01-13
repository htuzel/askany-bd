const fs = require('fs').promises;
const path = require('path');
const redis = require('../config/redis');

const STATS_FILE_PATH = path.join(__dirname, '../../data/stats.json');

class StatsService {
  async initializeStats() {
    try {
      // Check if stats exist in Redis
      const redisStats = await redis.hgetall('app:stats');
      
      if (!Object.keys(redisStats).length) {
        // If not in Redis, read from file and initialize Redis
        const fileStats = await this.readStatsFile();
        await this.updateRedisStats(fileStats);
      }
    } catch (error) {
      console.error('Error initializing stats:', error);
      throw error;
    }
  }

  async readStatsFile() {
    try {
      const data = await fs.readFile(STATS_FILE_PATH, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading stats file:', error);
      // Return default stats if file doesn't exist
      return {
        totalSessions: 0,
        totalParticipants: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  async updateRedisStats(stats) {
    await redis.hmset('app:stats', {
      totalSessions: stats.totalSessions.toString(),
      totalParticipants: stats.totalParticipants.toString(),
      lastUpdated: stats.lastUpdated
    });
  }

  async saveStatsFile(stats) {
    try {
      // Read current file stats
      const currentFileStats = await this.readStatsFile();
      
      // Ensure new stats are higher than file stats
      const newStats = {
        totalSessions: Math.max(stats.totalSessions, currentFileStats.totalSessions),
        totalParticipants: Math.max(stats.totalParticipants, currentFileStats.totalParticipants),
        lastUpdated: new Date().toISOString()
      };

      // Save to file only if numbers have increased
      if (newStats.totalSessions > currentFileStats.totalSessions || 
          newStats.totalParticipants > currentFileStats.totalParticipants) {
        await fs.writeFile(STATS_FILE_PATH, JSON.stringify(newStats, null, 2));
        console.log('[STATS] File updated with new numbers:', newStats);
      } else {
        console.log('[STATS] No update needed, current numbers are not higher');
      }

      return newStats;
    } catch (error) {
      console.error('Error saving stats file:', error);
      throw error;
    }
  }

  async getStats() {
    try {
      // Get stats from Redis
      const redisStats = await redis.hgetall('app:stats');
      const stars = await redis.get('github:stars');
      
      if (Object.keys(redisStats).length) {
        return {
          totalSessions: parseInt(redisStats.totalSessions),
          totalParticipants: parseInt(redisStats.totalParticipants),
          lastUpdated: redisStats.lastUpdated,
          stars: parseInt(stars)
        };
      }

      // Fallback to file if Redis is empty
      return await this.readStatsFile();
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }

  async incrementStats(type) {
    try {
      // Increment in Redis
      const field = type === 'session' ? 'totalSessions' : 'totalParticipants';
      await redis.hincrby('app:stats', field, 1);
      await redis.hset('app:stats', 'lastUpdated', new Date().toISOString());

      // Get updated stats from Redis
      const stats = await this.getStats();
      
      // Save to file as backup (will only update if numbers are higher)
      await this.saveStatsFile(stats);

      return stats;
    } catch (error) {
      console.error('Error incrementing stats:', error);
      throw error;
    }
  }

  async syncStatsToFile() {
    try {
      // Get current stats from Redis
      const stats = await this.getStats();
      
      // Save to file (will only update if numbers are higher)
      await this.saveStatsFile(stats);
      
      return stats;
    } catch (error) {
      console.error('Error syncing stats to file:', error);
      throw error;
    }
  }
}

module.exports = new StatsService(); 