const express = require('express');
const pino = require('pino');
const cors = require('cors');

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
    logger.info({
      service: process.env.SERVICE_NAME || 'backend-service',
      commit: process.env.GIT_COMMIT || 'unknown',
      // The traceId will be automatically injected by Pino if OpenTelemetry auto-instrumentation is active
      msg: `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
    });
  });
  next();
});

app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/readyz', (req, res) => res.status(200).send('OK'));

app.get('/metrics', (req, res) => {
  // Placeholder for Prometheus metrics
  res.set('Content-Type', 'text/plain');
  res.send('# HELP health Health status\n# TYPE health gauge\nhealth 1\n');
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
