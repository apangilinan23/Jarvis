const PROXY_CONFIG = {
  '/gemini': {
    target: 'https://jarvis-server-416803853374.asia-southeast1.run.app',
    secure: true,
    changeOrigin: true
  }
};

module.exports = PROXY_CONFIG;
