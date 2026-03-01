require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const Redis = require('ioredis');
const amqplib = require('amqplib');
// Use crypto.randomUUID (Node 14.17+), else fallback
function generateId() {
  try { return require('crypto').randomUUID(); } catch { return Math.random().toString(36).slice(2); }
}

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3002;

// Chaos mode
let chaosMode = false;

// Chaos middleware - reject all requests except health and chaos endpoints
app.use((req, res, next) => {
  if (chaosMode && !req.path.startsWith('/health') && !req.path.startsWith('/chaos') && !req.path.startsWith('/metrics')) {
    return res.status(503).json({ error: 'Service temporarily unavailable (chaos mode)' });
  }
  next();
});
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';
const IDENTITY_PROVIDER_URL = process.env.IDENTITY_PROVIDER_URL || 'http://identity-provider:3001';

// Metrics
const metrics = { totalRequests: 0, failureCount: 0, latencies: [], windowLatencies: [], alert: false };
const WINDOW_MS = 30000;

function recordRequest(latency, failed = false) {
  metrics.totalRequests++;
  if (failed) metrics.failureCount++;
  metrics.latencies.push(latency);
  if (metrics.latencies.length > 1000) metrics.latencies.shift();

  const now = Date.now();
  metrics.windowLatencies.push({ latency, time: now });
  // Prune entries outside 30s window
  metrics.windowLatencies = metrics.windowLatencies.filter(e => now - e.time <= WINDOW_MS);
  const windowAvg = metrics.windowLatencies.length
    ? metrics.windowLatencies.reduce((a, b) => a + b.latency, 0) / metrics.windowLatencies.length
    : 0;
  metrics.alert = windowAvg > 1000;
}

function avgLatency() {
  if (metrics.latencies.length === 0) return 0;
  return metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
}

// In-memory order store
const orderStore = {};

// Redis client
const redis = new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });
redis.connect().catch(() => {});

// RabbitMQ
let rabbitChannel = null;
let notificationChannel = null;

async function connectRabbit() {
  try {
    const conn = await amqplib.connect(RABBITMQ_URL);
    conn.on('error', () => { rabbitChannel = null; notificationChannel = null; setTimeout(connectRabbit, 5000); });
    conn.on('close', () => { rabbitChannel = null; notificationChannel = null; setTimeout(connectRabbit, 5000); });
    rabbitChannel = await conn.createChannel();
    await rabbitChannel.assertQueue('orders', { durable: true });
    
    notificationChannel = await conn.createChannel();
    await notificationChannel.assertQueue('order-updates', { durable: true });
    
    console.log('Connected to RabbitMQ');
  } catch (err) {
    console.error('RabbitMQ connection error:', err.message);
    rabbitChannel = null;
    notificationChannel = null;
    setTimeout(connectRabbit, 5000);
  }
}
connectRabbit();

// Auth middleware
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  try {
    // First try local verification for speed
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch {
    // Fall back to identity-provider verification
    try {
      const resp = await axios.post(`${IDENTITY_PROVIDER_URL}/auth/verify`, { token }, { timeout: 3000 });
      if (resp.data && resp.data.valid) {
        req.user = resp.data.decoded;
        return next();
      }
      return res.status(401).json({ error: 'Invalid or expired token' });
    } catch {
      return res.status(401).json({ error: 'Token verification failed' });
    }
  }
}

// POST /orders
app.post('/orders', authMiddleware, async (req, res) => {
  const start = Date.now();
  try {
    const { itemId, quantity = 1 } = req.body;
    if (!itemId) {
      recordRequest(Date.now() - start, true);
      return res.status(400).json({ error: 'itemId is required' });
    }

    // Check stock in Redis cache
    const stockKey = `stock:${itemId}`;
    const cachedStock = await redis.get(stockKey).catch(() => null);
    if (cachedStock !== null && parseInt(cachedStock, 10) <= 0) {
      recordRequest(Date.now() - start, true);
      return res.status(409).json({ error: 'Out of stock' });
    }

    if (!rabbitChannel) {
      recordRequest(Date.now() - start, true);
      return res.status(503).json({ error: 'Message queue unavailable' });
    }

    const orderId = generateId();
    const order = {
      orderId,
      itemId,
      quantity,
      studentId: req.user.studentId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    orderStore[orderId] = order;
    const ORDER_STATUS_EXPIRY = 3600;
    await redis.set(`order_status:${orderId}`, 'pending', 'EX', ORDER_STATUS_EXPIRY).catch(() => {});

    rabbitChannel.sendToQueue('orders', Buffer.from(JSON.stringify(order)), { persistent: true });
    
    // Publish confirmed status to notification hub for real-time feedback
    if (notificationChannel) {
      const confirmedMsg = { orderId, status: 'confirmed', timestamp: new Date().toISOString() };
      await redis.set(`order_status:${orderId}`, 'confirmed', 'EX', ORDER_STATUS_EXPIRY).catch(() => {});
      notificationChannel.sendToQueue('order-updates', Buffer.from(JSON.stringify(confirmedMsg)), { persistent: true });
    }

    recordRequest(Date.now() - start);
    return res.status(202).json({ orderId, status: 'pending', message: 'Order accepted' });
  } catch (err) {
    recordRequest(Date.now() - start, true);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /orders/:orderId
app.get('/orders/:orderId', authMiddleware, async (req, res) => {
  const start = Date.now();
  try {
    const { orderId } = req.params;
    // Check Redis first
    const cached = await redis.get(`order:${orderId}`).catch(() => null);
    if (cached) {
      recordRequest(Date.now() - start);
      return res.json(JSON.parse(cached));
    }
    const order = orderStore[orderId];
    if (!order) {
      recordRequest(Date.now() - start, true);
      return res.status(404).json({ error: 'Order not found' });
    }
    recordRequest(Date.now() - start);
    return res.json(order);
  } catch (err) {
    recordRequest(Date.now() - start, true);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /health
app.get('/health', async (req, res) => {
  let redisUp = false;
  let rabbitUp = false;

  try { await redis.ping(); redisUp = true; } catch {}
  rabbitUp = rabbitChannel !== null;

  const ok = redisUp && rabbitUp;
  return res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    service: 'order-gateway',
    dependencies: { redis: redisUp ? 'up' : 'down', rabbitmq: rabbitUp ? 'up' : 'down' },
  });
});

// GET /metrics
app.get('/metrics', (req, res) => {
  return res.json({
    service: 'order-gateway',
    totalRequests: metrics.totalRequests,
    failureCount: metrics.failureCount,
    avgLatency: avgLatency(),
    alert: metrics.alert,
  });
});

// POST /chaos/kill
app.post('/chaos/kill', (req, res) => {
  chaosMode = true;
  console.log('Chaos mode ENABLED - service will reject requests');
  return res.json({ status: 'killed', chaosMode: true });
});

// POST /chaos/revive
app.post('/chaos/revive', (req, res) => {
  chaosMode = false;
  console.log('Chaos mode DISABLED - service operational');
  return res.json({ status: 'alive', chaosMode: false });
});

const server = app.listen(PORT, () => {
  console.log(`order-gateway running on port ${PORT}`);
});

module.exports = { app, server };
