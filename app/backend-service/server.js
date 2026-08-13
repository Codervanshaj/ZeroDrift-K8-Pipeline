const express = require('express');
const pino = require('pino');
const cors = require('cors');
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
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const durationSeconds = duration / 1000;
    
    // Labels matching our ServiceMonitor rollouts targetLabels and app config
    const labels = {
      app: process.env.SERVICE_NAME || 'backend-service',
      method: req.method,
      status: res.statusCode,
      // Target rollouts pod template hash, typically injected via env or targetLabels
      rollouts_pod_template_hash: process.env.ROLLOUTS_POD_TEMPLATE_HASH || '',
    };
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);

    logger.info({
      service: labels.app,
      commit: process.env.GIT_COMMIT || 'unknown',
      msg: `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
    });
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

app.get('/api/efficiency', (req, res) => {
  if (process.env.FORCE_ERRORS === 'true') {
    return res.status(500).json({ error: 'simulated failure' });
  }

  // Simulated efficiency data
  res.json([
    { namespace: 'default', cpuWasteCores: 1.2, memWasteMb: 512, savingsUsd: 45 },
    { namespace: 'kube-system', cpuWasteCores: 0.1, memWasteMb: 128, savingsUsd: 5 },
    { namespace: 'zero-drift-prod', cpuWasteCores: 3.5, memWasteMb: 2048, savingsUsd: 120 }
  ]);
});

app.get('/api/fail', (req, res) => {
  res.status(500).json({ error: 'intentional failure' });
});

app.get('/api/slow', (req, res) => {
  setTimeout(() => {
    res.json({ message: 'delayed response' });
  }, 3000);
});

app.listen(port, () => {
  logger.info(`Backend service listening on port ${port}`);
});
