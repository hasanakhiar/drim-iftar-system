require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const amqplib = require('amqplib');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3005;

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

// Create HTTP + Socket.io server
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Metrics
const metrics = { totalNotifications: 0, failureCount: 0, latencies: [] };

function recordNotification(latency, failed = false) {
  metrics.totalNotifications++;
  if (failed) metrics.failureCount++;
  metrics.latencies.push(latency);
  if (metrics.latencies.length > 1000) metrics.latencies.shift();
}

function avgLatency() {
  if (metrics.latencies.length === 0) return 0;
  return metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
}

// Socket.io: client subscribes to order room
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('subscribe', async (orderId) => {
    if (orderId) {
      socket.join(`order-${orderId}`);
      console.log(`Socket ${socket.id} subscribed to order-${orderId}`);
      
      // Send current status from Redis immediately
      const status = await redis.get(`order_status:${orderId}`).catch(() => null);
      if (status) {
        socket.emit('order-update', { orderId, status, timestamp: new Date().toISOString() });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// RabbitMQ
let rabbitConn = null;
let consumeChannel = null;

async function connectRabbit() {
  if (chaosMode) {
    setTimeout(connectRabbit, 5000);
    return;
  }
  try {
    rabbitConn = await amqplib.connect(RABBITMQ_URL);
    rabbitConn.on('error', () => { consumeChannel = null; notificationConsumerTag = null; setTimeout(connectRabbit, 5000); });
    rabbitConn.on('close', () => { consumeChannel = null; notificationConsumerTag = null; setTimeout(connectRabbit, 5000); });

    consumeChannel = await rabbitConn.createChannel();
    await consumeChannel.assertQueue('order-updates', { durable: true });
    consumeChannel.prefetch(10);

    console.log('Connected to RabbitMQ');
    consumeOrderUpdates();
  } catch (err) {
    console.error('RabbitMQ connection error:', err.message);
    consumeChannel = null;
    notificationConsumerTag = null;
    setTimeout(connectRabbit, 5000);
  }
}

let notificationConsumerTag = null;

async function consumeOrderUpdates() {
  if (chaosMode) return;
  if (!consumeChannel || notificationConsumerTag) return;
  console.log('Starting notification-hub consumer...');
  try {
    const result = await consumeChannel.consume('order-updates', async (msg) => {
      if (!msg) return;
      const start = Date.now();
      try {
        const data = JSON.parse(msg.content.toString());
        const { orderId, status, timestamp } = data;

        // Emit to the order's room via Socket.io
        io.to(`order-${orderId}`).emit('order-update', { orderId, status, timestamp });

        if (consumeChannel) consumeChannel.ack(msg);
        recordNotification(Date.now() - start);
      } catch (err) {
        console.error('Error processing order-update message:', err.message);
        recordNotification(Date.now() - start, true);
        if (consumeChannel) consumeChannel.nack(msg, false, false);
      }
    });
    notificationConsumerTag = result.consumerTag;
  } catch (err) {
    console.error('Failed to start consumer:', err.message);
    notificationConsumerTag = null;
  }
}

async function stopConsuming() {
  if (rabbitConn) {
    console.log('Closing RabbitMQ connection (Chaos Mode)...');
    const conn = rabbitConn;
    rabbitConn = null;
    await conn.close().catch(() => {});
    consumeChannel = null;
    notificationConsumerTag = null;
  }
}

// GET /health
app.get('/health', async (req, res) => {
  if (chaosMode) {
    return res.status(503).json({ status: 'down', service: 'notification-hub', reason: 'chaos mode' });
  }
  const rabbitUp = consumeChannel !== null;
  return res.status(rabbitUp ? 200 : 503).json({
    status: rabbitUp ? 'ok' : 'degraded',
    service: 'notification-hub',
    dependencies: { rabbitmq: rabbitUp ? 'up' : 'down' },
  });
});

// GET /metrics
app.get('/metrics', (req, res) => {
  return res.json({
    service: 'notification-hub',
    totalNotifications: metrics.totalNotifications,
    failureCount: metrics.failureCount,
    avgLatency: avgLatency(),
  });
});

// POST /chaos/kill
app.post('/chaos/kill', async (req, res) => {
  chaosMode = true;
  await stopConsuming();
  // Disconnect all clients for realism
  io.disconnectSockets(true);
  console.log('Chaos mode ENABLED - service will reject requests, stop processing, and disconnect clients');
  return res.json({ status: 'killed', chaosMode: true });
});

// POST /chaos/revive
app.post('/chaos/revive', async (req, res) => {
  chaosMode = false;
  await consumeOrderUpdates();
  console.log('Chaos mode DISABLED - service operational and processing resumed');
  return res.json({ status: 'alive', chaosMode: false });
});

connectRabbit();

httpServer.listen(PORT, () => {
  console.log(`notification-hub running on port ${PORT}`);
});

module.exports = { app, server: httpServer };
