require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const Redis = require('ioredis');
const amqplib = require('amqplib');
const mongoose = require('mongoose');
const { validateOrder } = require('./validation');

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
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/cafeteria';
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

// Order Schema
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  itemId: { type: String, required: true },
  quantity: { type: Number, required: true },
  status: { type: String, required: true, default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});
const Order = mongoose.model('Order', orderSchema);

// Connect to MongoDB
mongoose.connect(MONGO_URI).then(() => console.log('Connected to MongoDB')).catch(err => console.error('MongoDB connection error:', err));

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
  } catch (err) {
    // Fall back to identity-provider verification if local fails (e.g. signature error)
    try {
      const resp = await axios.post(`${IDENTITY_PROVIDER_URL}/auth/verify`, { token }, { timeout: 5000 });
      if (resp.data && resp.data.valid) {
        req.user = resp.data.decoded;
        return next();
      }
      return res.status(401).json({ error: 'Invalid or expired token' });
    } catch (axiosErr) {
      console.error('Identity provider communication error:', axiosErr.message);
      if (axiosErr.response) {
        return res.status(axiosErr.response.status).json(axiosErr.response.data);
      }
      return res.status(401).json({ error: 'Token verification failed: authentication service unreachable' });
    }
  }
}

// GET /stock - Proxy to stock-service
app.get('/stock', async (req, res) => {
  try {
    const STOCK_SERVICE_URL = process.env.STOCK_SERVICE_URL || 'http://stock-service:3003';
    const resp = await axios.get(`${STOCK_SERVICE_URL}/stock`, { timeout: 8000 });
    return res.json(resp.data);
  } catch (err) {
    return res.status(503).json({ error: 'Stock service unavailable' });
  }
});

// POST /orders
app.post('/orders', authMiddleware, async (req, res) => {
  const start = Date.now();
  try {
    const { itemId, quantity = 1 } = req.body;
    
    // Integrity Validation
    const validation = validateOrder({ itemId, quantity });
    if (!validation.valid) {
      recordRequest(Date.now() - start, true);
      return res.status(400).json({ error: validation.error });
    }

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
    const orderData = {
      orderId,
      itemId,
      quantity,
      studentId: req.user.studentId,
      status: 'pending',
    };

    // Persist to DB
    const dbOrder = await Order.create(orderData);
    
    // Persist status in Redis
    const ORDER_STATUS_EXPIRY = 3600;
    await redis.set(`order_status:${orderId}`, 'pending', 'EX', ORDER_STATUS_EXPIRY).catch(() => {});

    rabbitChannel.sendToQueue('orders', Buffer.from(JSON.stringify(orderData)), { persistent: true });
    
    if (notificationChannel) {
      const confirmedMsg = { orderId, status: 'confirmed', timestamp: new Date().toISOString() };
      await redis.set(`order_status:${orderId}`, 'confirmed', 'EX', ORDER_STATUS_EXPIRY).catch(() => {});
      // Update DB status
      await Order.updateOne({ orderId }, { status: 'confirmed' });
      notificationChannel.sendToQueue('order-updates', Buffer.from(JSON.stringify(confirmedMsg)), { persistent: true });
    }

    recordRequest(Date.now() - start);
    return res.status(202).json({ orderId, status: 'pending', message: 'Order accepted' });
  } catch (err) {
    recordRequest(Date.now() - start, true);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /orders - Fetch history for the authenticated student
app.get('/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ studentId: req.user.studentId }).sort({ createdAt: -1 });
    
    // Fetch item names from stock-service
    let itemMap = {};
    try {
      const STOCK_SERVICE_URL = process.env.STOCK_SERVICE_URL || 'http://stock-service:3003';
      const stockResp = await axios.get(`${STOCK_SERVICE_URL}/stock`, { timeout: 5000 });
      itemMap = stockResp.data.reduce((map, item) => {
        map[item.itemId] = item.name;
        return map;
      }, {});
    } catch (err) {
      console.error('Failed to fetch item names:', err.message);
    }
    
    // Enrich each order status from Redis (live status) and add item name
    const enriched = await Promise.all(orders.map(async (order) => {
      const redisStatus = await redis.get(`order_status:${order.orderId}`).catch(() => null);
      return {
        ...order.toObject(),
        status: redisStatus || order.status,
        itemName: itemMap[order.itemId] || order.itemId
      };
    }));
    
    return res.json(enriched);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/orders - Fetch all orders from DB
app.get('/admin/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(100);
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/student-stats - Aggregate orders per student
app.get('/admin/student-stats', async (req, res) => {
  try {
    const stats = await Order.aggregate([
      { $group: { _id: "$studentId", orderCount: { $sum: 1 } } }
    ]);
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /orders/:orderId
app.get('/orders/:orderId', authMiddleware, async (req, res) => {
  const start = Date.now();
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });
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
  if (chaosMode) {
    return res.status(503).json({ status: 'down', service: 'order-gateway', reason: 'chaos mode' });
  }
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

// GET /chaos/status
app.get('/chaos/status', (req, res) => {
  return res.json({ chaosMode });
});

// POST /chaos/kill
app.post('/chaos/kill', (req, res) => {
  chaosMode = true;
  return res.json({ status: 'killed', chaosMode: true });
});

// POST /chaos/revive
app.post('/chaos/revive', (req, res) => {
  chaosMode = false;
  return res.json({ status: 'alive', chaosMode: false });
});

const server = app.listen(PORT, () => {
  console.log(`order-gateway running on port ${PORT}`);
});

module.exports = { app, server };
