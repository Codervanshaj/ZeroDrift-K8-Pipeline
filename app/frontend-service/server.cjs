const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const pino = require('pino');
const promClient = require('prom-client');

// Initialize Prometheus registry and default metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
const Registry = promClient.Registry;
const register = new Registry();
collectDefaultMetrics({ register });

// Define custom Prometheus metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['app', 'method', 'status', 'rollouts_pod_template_hash'],
});

const httpRequestDurationSeconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['app', 'method', 'status', 'rollouts_pod_template_hash'],
  buckets: [0.1, 0.3, 0.5, 1, 3, 5],
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDurationSeconds);

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
    const durationSeconds = duration / 1000;
    
    // Labels matching our ServiceMonitor rollouts targetLabels and app config
    const labels = {
      app: process.env.SERVICE_NAME || 'frontend-service',
      method: req.method,
      status: res.statusCode,
      rollouts_pod_template_hash: process.env.ROLLOUTS_POD_TEMPLATE_HASH || '',
    };
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);

    // Do not log static asset requests
    if (!req.originalUrl.startsWith('/assets')) {
      logger.info({
        service: labels.app,
        commit: process.env.GIT_COMMIT || 'unknown',
        msg: `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
      });
    }
  });
  next();
});

app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/readyz', (req, res) => res.status(200).send('OK'));

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
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
app.get('(.*)', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  logger.info(`Frontend proxy listening on port ${port}, routing /api to ${backendUrl}`);
});
