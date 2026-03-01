require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const amqplib = require('amqplib');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3003;

// Chaos mode
let chaosMode = false;

// Chaos middleware - reject all requests except health and chaos endpoints
app.use((req, res, next) => {
  if (chaosMode && !req.path.startsWith('/health') && !req.path.startsWith('/chaos') && !req.path.startsWith('/metrics')) {
    return res.status(503).json({ error: 'Service temporarily unavailable (chaos mode)' });
  }
  next();
});
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/cafeteria';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';

// Metrics
const metrics = { totalProcessed: 0, failureCount: 0, latencies: [] };

function recordRequest(latency, failed = false) {
  metrics.totalProcessed++;
  if (failed) metrics.failureCount++;
  metrics.latencies.push(latency);
  if (metrics.latencies.length > 1000) metrics.latencies.shift();
}

function avgLatency() {
  if (metrics.latencies.length === 0) return 0;
  return metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
}

// Item schema with optimistic locking via __v (versionKey)
const itemSchema = new mongoose.Schema({
  itemId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  stock: { type: Number, required: true, default: 0 },
});
// Mongoose uses __v as the version key by default
const Item = mongoose.model('Item', itemSchema);

// Redis client
const redis = new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });
redis.connect().catch(() => {});

// RabbitMQ
let rabbitConn = null;
let rabbitChannel = null;
let statusChannel = null;

async function connectRabbit() {
  if (chaosMode) {
    setTimeout(connectRabbit, 5000);
    return;
  }
  try {
    rabbitConn = await amqplib.connect(RABBITMQ_URL);
    rabbitConn.on('error', () => { rabbitChannel = null; statusChannel = null; stockConsumerTag = null; setTimeout(connectRabbit, 5000); });
    rabbitConn.on('close', () => { rabbitChannel = null; statusChannel = null; stockConsumerTag = null; setTimeout(connectRabbit, 5000); });

    rabbitChannel = await rabbitConn.createChannel();
    await rabbitChannel.assertQueue('orders', { durable: true });
    rabbitChannel.prefetch(1);

    statusChannel = await rabbitConn.createChannel();
    await statusChannel.assertQueue('order-status', { durable: true });
    
    // Also assert order-updates for UI feedback
    await statusChannel.assertQueue('order-updates', { durable: true });

    console.log('Connected to RabbitMQ');
    consumeOrders();
  } catch (err) {
    console.error('RabbitMQ connection error:', err.message);
    rabbitChannel = null;
    statusChannel = null;
    stockConsumerTag = null;
    setTimeout(connectRabbit, 5000);
  }
}

async function processOrderWithRetry(order, maxRetries = 3) {
  const { orderId, itemId, quantity = 1 } = order;

  // Idempotency check
  const alreadyProcessed = await redis.get(`processed:${orderId}`).catch(() => null);
  if (alreadyProcessed) {
    console.log(`Order ${orderId} already processed, skipping`);
    return { skipped: true };
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const item = await Item.findOne({ itemId });
    if (!item) throw new Error(`Item ${itemId} not found`);

    const currentVersion = item.__v;
    if (item.stock < quantity) throw new Error('Insufficient stock');

    // Optimistic lock: update only if __v hasn't changed
    const updated = await Item.findOneAndUpdate(
      { itemId, __v: currentVersion },
      { $inc: { stock: -quantity, __v: 1 } },
      { new: true }
    );

    if (!updated) {
      // Version conflict - retry
      console.log(`Version conflict for ${itemId}, attempt ${attempt + 1}`);
      continue;
    }

    // Update Redis cache
    await redis.set(`stock:${itemId}`, updated.stock).catch(() => {});

    // Publish to order-status queue
    const statusMsg = { orderId, status: 'stock_verified', itemId, timestamp: new Date().toISOString() };
    const ORDER_STATUS_EXPIRY = 3600;
    await redis.set(`order_status:${orderId}`, 'stock_verified', 'EX', ORDER_STATUS_EXPIRY).catch(() => {});
    statusChannel.sendToQueue('order-status', Buffer.from(JSON.stringify(statusMsg)), { persistent: true });
    
    // Also publish to order-updates for UI
    statusChannel.sendToQueue('order-updates', Buffer.from(JSON.stringify(statusMsg)), { persistent: true });

    // Mark as processed (idempotency)
    await redis.set(`processed:${orderId}`, '1', 'EX', 86400).catch(() => {});

    return { success: true, updatedItem: updated };
  }

  throw new Error(`Failed to update stock for ${itemId} after ${maxRetries} retries (optimistic lock)`);
}

let stockConsumerTag = null;

async function consumeOrders() {
  if (chaosMode) return;
  if (!rabbitChannel || stockConsumerTag) return;
  console.log('Starting stock-service consumer...');
  try {
    const result = await rabbitChannel.consume('orders', async (msg) => {
      if (!msg) return;
      const start = Date.now();
      try {
        const order = JSON.parse(msg.content.toString());
        await processOrderWithRetry(order);
        if (rabbitChannel) rabbitChannel.ack(msg);
        recordRequest(Date.now() - start);
      } catch (err) {
        console.error('Error processing order:', err.message);
        recordRequest(Date.now() - start, true);
        if (rabbitChannel) rabbitChannel.nack(msg, false, false); // Dead-letter, don't requeue
      }
    });
    stockConsumerTag = result.consumerTag;
  } catch (err) {
    console.error('Failed to start consumer:', err.message);
    stockConsumerTag = null;
  }
}

async function stopConsuming() {
  if (rabbitConn) {
    console.log('Closing RabbitMQ connection (Chaos Mode)...');
    const conn = rabbitConn;
    rabbitConn = null;
    await conn.close().catch(() => {});
    rabbitChannel = null;
    statusChannel = null;
    stockConsumerTag = null;
  }
}

// POST /stock
app.post('/stock', async (req, res) => {
  try {
    const { itemId, name, stock } = req.body;
    if (!itemId || !name || stock === undefined) {
      return res.status(400).json({ error: 'itemId, name, and stock are required' });
    }
    const item = await Item.findOneAndUpdate(
      { itemId },
      { name, stock },
      { upsert: true, new: true }
    );
    await redis.set(`stock:${itemId}`, item.stock).catch(() => {});
    return res.status(200).json(item);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /stock/:itemId
app.get('/stock/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    // Try Redis cache first
    const cached = await redis.get(`stock:${itemId}`).catch(() => null);
    if (cached !== null) {
      return res.json({ itemId, stock: parseInt(cached, 10), source: 'cache' });
    }
    const item = await Item.findOne({ itemId });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    return res.json({ itemId: item.itemId, name: item.name, stock: item.stock, source: 'db' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /health
app.get('/health', async (req, res) => {
  if (chaosMode) {
    return res.status(503).json({ status: 'down', service: 'stock-service', reason: 'chaos mode' });
  }
  const mongoUp = mongoose.connection.readyState === 1;
  let redisUp = false;
  try { await redis.ping(); redisUp = true; } catch {}

  const ok = mongoUp && redisUp;
  return res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    service: 'stock-service',
    dependencies: { mongodb: mongoUp ? 'up' : 'down', redis: redisUp ? 'up' : 'down' },
  });
});

// GET /metrics
app.get('/metrics', (req, res) => {
  return res.json({
    service: 'stock-service',
    totalProcessed: metrics.totalProcessed,
    failureCount: metrics.failureCount,
    avgLatency: avgLatency(),
  });
});

// POST /chaos/kill
app.post('/chaos/kill', async (req, res) => {
  chaosMode = true;
  await stopConsuming();
  console.log('Chaos mode ENABLED - service will reject requests and stop processing');
  return res.json({ status: 'killed', chaosMode: true });
});

// POST /chaos/revive
app.post('/chaos/revive', async (req, res) => {
  chaosMode = false;
  await consumeOrders();
  console.log('Chaos mode DISABLED - service operational and processing resumed');
  return res.json({ status: 'alive', chaosMode: false });
});

// Seed items
const SEED_ITEMS = [
  { itemId: 'ITEM001', name: 'Biryani', stock: 100 },
  { itemId: 'ITEM002', name: 'Rice', stock: 50 },
  { itemId: 'ITEM003', name: 'Kebab', stock: 30 },
];

async function connectAndSeed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    for (const item of SEED_ITEMS) {
      const existing = await Item.findOne({ itemId: item.itemId });
      if (!existing) {
        await Item.create(item);
        await redis.set(`stock:${item.itemId}`, item.stock).catch(() => {});
        console.log(`Seeded item ${item.itemId}`);
      }
    }
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    setTimeout(connectAndSeed, 5000);
  }
}

connectAndSeed();
connectRabbit();

const server = app.listen(PORT, () => {
  console.log(`stock-service running on port ${PORT}`);
});

module.exports = { app, server };
