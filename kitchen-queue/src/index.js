require('dotenv').config();
const express = require('express');
const cors = require('cors');
const amqplib = require('amqplib');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3004;

// Chaos mode
let chaosMode = false;

// Chaos middleware - reject all requests except health and chaos endpoints
app.use((req, res, next) => {
  if (chaosMode && !req.path.startsWith('/health') && !req.path.startsWith('/chaos') && !req.path.startsWith('/metrics')) {
    return res.status(503).json({ error: 'Service temporarily unavailable (chaos mode)' });
  }
  next();
});
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const Redis = require('ioredis');
const redis = new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });
redis.connect().catch(() => {});

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

let rabbitConn = null;
let consumeChannel = null;
let publishChannel = null;

async function connectRabbit() {
  if (chaosMode) {
    setTimeout(connectRabbit, 5000);
    return;
  }
  try {
    rabbitConn = await amqplib.connect(RABBITMQ_URL);
    rabbitConn.on('error', () => {
      consumeChannel = null; publishChannel = null; kitchenConsumerTag = null;
      setTimeout(connectRabbit, 5000);
    });
    rabbitConn.on('close', () => {
      consumeChannel = null; publishChannel = null; kitchenConsumerTag = null;
      setTimeout(connectRabbit, 5000);
    });

    consumeChannel = await rabbitConn.createChannel();
    await consumeChannel.assertQueue('order-status', { durable: true });
    consumeChannel.prefetch(10);

    publishChannel = await rabbitConn.createChannel();
    await publishChannel.assertQueue('order-updates', { durable: true });

    console.log('Connected to RabbitMQ');
    consumeOrderStatus();
  } catch (err) {
    console.error('RabbitMQ connection error:', err.message);
    consumeChannel = null; publishChannel = null; kitchenConsumerTag = null;
    setTimeout(connectRabbit, 5000);
  }
}

let kitchenConsumerTag = null;

async function consumeOrderStatus() {
  if (chaosMode) return;
  if (!consumeChannel || kitchenConsumerTag) return;
  console.log('Starting kitchen-queue consumer...');
  try {
    const result = await consumeChannel.consume('order-status', async (msg) => {
      if (!msg) return;
      const start = Date.now();
      try {
        const data = JSON.parse(msg.content.toString());

        if (data.status !== 'stock_verified') {
          // Not for us, ack and skip
          if (consumeChannel) consumeChannel.ack(msg);
          return;
        }

        const { orderId, itemId } = data;

        // ACK immediately (< 2s requirement)
        if (consumeChannel) consumeChannel.ack(msg);

        // Publish in_kitchen status
        const inKitchenMsg = { orderId, status: 'in_kitchen', timestamp: new Date().toISOString() };
        const ORDER_STATUS_EXPIRY = 3600;
        await redis.set(`order_status:${orderId}`, 'in_kitchen', 'EX', ORDER_STATUS_EXPIRY).catch(() => {});
        if (publishChannel) publishChannel.sendToQueue('order-updates', Buffer.from(JSON.stringify(inKitchenMsg)), { persistent: true });

        recordRequest(Date.now() - start);

        // Simulate cooking: random 3000-7000ms
        const cookTime = Math.floor(Math.random() * 4000) + 3000;
        setTimeout(async () => {
          try {
            const readyMsg = { orderId, status: 'ready', timestamp: new Date().toISOString() };
            if (publishChannel) {
              await redis.set(`order_status:${orderId}`, 'ready', 'EX', ORDER_STATUS_EXPIRY).catch(() => {});
              publishChannel.sendToQueue('order-updates', Buffer.from(JSON.stringify(readyMsg)), { persistent: true });
            }
          } catch (err) {
            console.error('Error publishing ready status:', err.message);
          }
        }, cookTime);
      } catch (err) {
        console.error('Error processing order-status message:', err.message);
        recordRequest(Date.now() - start, true);
        if (consumeChannel) consumeChannel.nack(msg, false, false);
      }
    });
    kitchenConsumerTag = result.consumerTag;
  } catch (err) {
    console.error('Failed to start consumer:', err.message);
    kitchenConsumerTag = null;
  }
}

async function stopConsuming() {
  if (rabbitConn) {
    console.log('Closing RabbitMQ connection (Chaos Mode)...');
    const conn = rabbitConn;
    rabbitConn = null;
    await conn.close().catch(() => {});
    consumeChannel = null;
    publishChannel = null;
    kitchenConsumerTag = null;
  }
}

// GET /health
app.get('/health', async (req, res) => {
  if (chaosMode) {
    return res.status(503).json({ status: 'down', service: 'kitchen-queue', reason: 'chaos mode' });
  }
  const rabbitUp = consumeChannel !== null;
  return res.status(rabbitUp ? 200 : 503).json({
    status: rabbitUp ? 'ok' : 'degraded',
    service: 'kitchen-queue',
    dependencies: { rabbitmq: rabbitUp ? 'up' : 'down' },
  });
});

// GET /metrics
app.get('/metrics', (req, res) => {
  return res.json({
    service: 'kitchen-queue',
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
  await consumeOrderStatus();
  console.log('Chaos mode DISABLED - service operational and processing resumed');
  return res.json({ status: 'alive', chaosMode: false });
});

connectRabbit();

const server = app.listen(PORT, () => {
  console.log(`kitchen-queue running on port ${PORT}`);
});

module.exports = { app, server };
