const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

const app = express();
const port = process.env.PORT || 8080;
const backendUrl = process.env.BACKEND_URL || 'http://backend-service:3000';

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    // Do not log static asset requests
    if (!req.originalUrl.startsWith('/assets')) {
      logger.info({
        service: process.env.SERVICE_NAME || 'frontend-service',
        commit: process.env.GIT_COMMIT || 'unknown',
        msg: `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
      });
    }
  });
  next();
});

app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/readyz', (req, res) => res.status(200).send('OK'));

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send('# HELP frontend_health Health status\n# TYPE frontend_health gauge\nfrontend_health 1\n');
});

// Proxy API requests to backend
app.use('/api', createProxyMiddleware({
  target: backendUrl,
  changeOrigin: true,
  logProvider: () => logger,
}));

// Serve React static files
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  logger.info(`Frontend proxy listening on port ${port}, routing /api to ${backendUrl}`);
});
