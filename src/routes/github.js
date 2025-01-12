const express = require('express');
const router = express.Router();
const axios = require('axios');
const redis = require('../config/redis');

// Cache duration in seconds (6 hours)
const CACHE_DURATION = 6 * 60 * 60;

// Get GitHub stars with caching
router.get('/stars', async (req, res) => {
  try {
    // Try to get from cache first
    const cachedStars = await redis.get('github:stars');
    if (cachedStars) {
      return res.json({ stars: parseInt(cachedStars) });
    }

    // If not in cache, fetch from GitHub API
    const response = await axios.get('https://api.github.com/repos/htuzel/ama-flalingo', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'askany-app'
      }
    });

    const stars = response.data.stargazers_count;

    // Cache the result
    await redis.setex('github:stars', CACHE_DURATION, stars.toString());

    res.json({ stars });
  } catch (error) {
    console.error('Error fetching GitHub stars:', error);
    
    // If there's an error, try to return cached value if it exists
    const cachedStars = await redis.get('github:stars');
    if (cachedStars) {
      return res.json({ stars: parseInt(cachedStars) });
    }

    // If no cached value exists, return 0
    res.status(200).json({ stars: 0 });
  }
});

module.exports = router; 