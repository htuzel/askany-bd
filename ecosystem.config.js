module.exports = {
  apps: [{
    name: 'ama-flalingo-api',
    script: 'src/index.js',
    instances: 2,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 5001,
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: null
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5001,
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: null
    }
  }]
}; 