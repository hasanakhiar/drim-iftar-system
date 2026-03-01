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

// Chaos middleware
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

// Item schema with optimistic locking
const itemSchema = new mongoose.Schema({
  itemId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  stock: { type: Number, required: true, default: 0 },
});
const Item = mongoose.model('Item', itemSchema);

// Redis client
const redis = new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });
redis.connect().catch(() => {});

// RabbitMQ
let rabbitConn = null;
let rabbitChannel = null;
let statusChannel = null;
let reconnectTimeout = null;

async function connectRabbit() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (chaosMode) {
    reconnectTimeout = setTimeout(connectRabbit, 5000);
    return;
  }
  try {
    rabbitConn = await amqplib.connect(RABBITMQ_URL);
    rabbitConn.on('error', () => { 
      rabbitChannel = null; statusChannel = null; stockConsumerTag = null; 
      if (!reconnectTimeout) reconnectTimeout = setTimeout(connectRabbit, 5000); 
    });
    rabbitConn.on('close', () => { 
      rabbitChannel = null; statusChannel = null; stockConsumerTag = null; 
      if (!reconnectTimeout) reconnectTimeout = setTimeout(connectRabbit, 5000); 
    });

    rabbitChannel = await rabbitConn.createChannel();
    await rabbitChannel.assertQueue('orders', { durable: true });
    rabbitChannel.prefetch(1);

    statusChannel = await rabbitConn.createChannel();
    await statusChannel.assertQueue('order-status', { durable: true });
    await statusChannel.assertQueue('order-updates', { durable: true });

    console.log('Connected to RabbitMQ');
    consumeOrders();
  } catch (err) {
    console.error('RabbitMQ connection error:', err.message);
    rabbitChannel = null;
    statusChannel = null;
    stockConsumerTag = null;
    if (!reconnectTimeout) reconnectTimeout = setTimeout(connectRabbit, 5000);
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

    if (item.stock < quantity) {
      const failMsg = { orderId, status: 'failed_insufficient_stock', itemId, timestamp: new Date().toISOString() };
      if (statusChannel) {
        statusChannel.sendToQueue('order-updates', Buffer.from(JSON.stringify(failMsg)), { persistent: true });
      }
      throw new Error('Insufficient stock');
    }

    const updated = await Item.findOneAndUpdate(
      { itemId, __v: item.__v },
      { $inc: { stock: -quantity, __v: 1 } },
      { new: true }
    );

    if (!updated) {
      console.log(`Version conflict for ${itemId}, attempt ${attempt + 1}`);
      continue;
    }

    await redis.set(`stock:${itemId}`, updated.stock).catch(() => {});
    
    const statusMsg = { orderId, status: 'stock_verified', itemId, timestamp: new Date().toISOString() };
    await redis.set(`order_status:${orderId}`, 'stock_verified', 'EX', 3600).catch(() => {});
    
    if (statusChannel) {
      statusChannel.sendToQueue('order-status', Buffer.from(JSON.stringify(statusMsg)), { persistent: true });
      statusChannel.sendToQueue('order-updates', Buffer.from(JSON.stringify(statusMsg)), { persistent: true });
    }

    await redis.set(`processed:${orderId}`, '1', 'EX', 86400).catch(() => {});
    return { success: true };
  }
  throw new Error(`Failed to update stock for ${itemId} after retries`);
}

let stockConsumerTag = null;

async function consumeOrders() {
  if (chaosMode) return;
  if (!rabbitChannel || stockConsumerTag) return;
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
        if (rabbitChannel) rabbitChannel.nack(msg, false, true); // Requeue on failure
      }
    });
    stockConsumerTag = result.consumerTag;
  } catch (err) {
    console.error('Failed to start consumer:', err.message);
    stockConsumerTag = null;
  }
}

async function stopConsuming() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
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

// Endpoints
app.get('/stock', async (req, res) => {
  try {
    const items = await Item.find({});
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', async (req, res) => {
  if (chaosMode) return res.status(503).json({ status: 'down' });
  const mongoUp = mongoose.connection.readyState === 1;
  return res.status(mongoUp ? 200 : 503).json({ status: mongoUp ? 'ok' : 'down' });
});

app.get('/metrics', (req, res) => res.json({
  service: 'stock-service',
  totalProcessed: metrics.totalProcessed,
  failureCount: metrics.failureCount,
  avgLatency: avgLatency(),
}));

app.get('/chaos/status', (req, res) => res.json({ chaosMode }));

app.post('/chaos/kill', async (req, res) => {
  chaosMode = true;
  await stopConsuming();
  return res.json({ status: 'killed', chaosMode: true });
});

app.post('/chaos/revive', async (req, res) => {
  chaosMode = false;
  await connectRabbit();
  return res.json({ status: 'alive', chaosMode: false });
});

async function connectAndSeed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    const SEED_ITEMS = [
      { itemId: 'ITEM001', name: 'Biryani', stock: 100 },
      { itemId: 'ITEM002', name: 'Rice', stock: 50 },
      { itemId: 'ITEM003', name: 'Kebab', stock: 30 },
    ];
    for (const item of SEED_ITEMS) {
      await Item.findOneAndUpdate({ itemId: item.itemId }, item, { upsert: true });
      await redis.set(`stock:${item.itemId}`, item.stock).catch(() => {});
    }
  } catch (err) {
    console.error('MongoDB error:', err.message);
    setTimeout(connectAndSeed, 5000);
  }
}

connectAndSeed();
connectRabbit();
const server = app.listen(PORT, () => console.log(`stock-service running on port ${PORT}`));
module.exports = { app, server };
