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
  try {
    rabbitConn = await amqplib.connect(RABBITMQ_URL);
    rabbitConn.on('error', () => {
      consumeChannel = null; publishChannel = null;
      setTimeout(connectRabbit, 5000);
    });
    rabbitConn.on('close', () => {
      consumeChannel = null; publishChannel = null;
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
    consumeChannel = null; publishChannel = null;
    setTimeout(connectRabbit, 5000);
  }
}

function consumeOrderStatus() {
  if (!consumeChannel) return;
  consumeChannel.consume('order-status', async (msg) => {
    if (!msg) return;
    const start = Date.now();
    try {
      const data = JSON.parse(msg.content.toString());

      if (data.status !== 'stock_verified') {
        // Not for us, ack and skip
        consumeChannel.ack(msg);
        return;
      }

      const { orderId, itemId } = data;

      // ACK immediately (< 2s requirement)
      consumeChannel.ack(msg);

      // Publish in_kitchen status
      const inKitchenMsg = { orderId, status: 'in_kitchen', timestamp: new Date().toISOString() };
      publishChannel.sendToQueue('order-updates', Buffer.from(JSON.stringify(inKitchenMsg)), { persistent: true });

      recordRequest(Date.now() - start);

      // Simulate cooking: random 3000-7000ms
      const cookTime = Math.floor(Math.random() * 4000) + 3000;
      setTimeout(() => {
        try {
          const readyMsg = { orderId, status: 'ready', timestamp: new Date().toISOString() };
          if (publishChannel) {
            publishChannel.sendToQueue('order-updates', Buffer.from(JSON.stringify(readyMsg)), { persistent: true });
          }
        } catch (err) {
          console.error('Error publishing ready status:', err.message);
        }
      }, cookTime);
    } catch (err) {
      console.error('Error processing order-status message:', err.message);
      recordRequest(Date.now() - start, true);
      consumeChannel.nack(msg, false, false);
    }
  });
}

// GET /health
app.get('/health', async (req, res) => {
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

connectRabbit();

const server = app.listen(PORT, () => {
  console.log(`kitchen-queue running on port ${PORT}`);
});

module.exports = { app, server };
