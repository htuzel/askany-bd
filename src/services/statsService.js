const fs = require('fs').promises;
const path = require('path');

const statsFilePath = path.join(__dirname, '../../data/stats.json');
const sessionsFilePath = path.join(__dirname, '../../data/sessions.json');

class StatsService {
  async updateStats(sessions) {
    try {
      // Read current stats
      const statsData = await fs.readFile(statsFilePath, 'utf8');
      const stats = JSON.parse(statsData);

      // Update total sessions
      stats.totalSessions += sessions.length;
      stats.lastUpdated = new Date().toISOString();

      // Save updated stats
      await fs.writeFile(statsFilePath, JSON.stringify(stats, null, 2));

      // Read current sessions history
      const sessionsData = await fs.readFile(sessionsFilePath, 'utf8');
      const sessionsHistory = JSON.parse(sessionsData);

      // Add new sessions with timestamp
      const timestamp = new Date().toISOString();
      const newSessions = sessions.map(session => ({
        ...session,
        archivedAt: timestamp
      }));

      sessionsHistory.sessions.push(...newSessions);

      // Save updated sessions history
      await fs.writeFile(sessionsFilePath, JSON.stringify(sessionsHistory, null, 2));

      return stats;
    } catch (error) {
      console.error('Error updating stats:', error);
      throw error;
    }
  }

  async getStats() {
    try {
      const statsData = await fs.readFile(statsFilePath, 'utf8');
      return JSON.parse(statsData);
    } catch (error) {
      console.error('Error reading stats:', error);
      throw error;
    }
  }
}

module.exports = new StatsService(); 