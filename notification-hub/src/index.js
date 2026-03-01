require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const amqplib = require('amqplib');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3005;

// Chaos mode
let chaosMode = false;

// Chaos middleware
app.use((req, res, next) => {
  if (chaosMode && !req.path.startsWith('/health') && !req.path.startsWith('/chaos') && !req.path.startsWith('/metrics')) {
    return res.status(503).json({ error: 'Service temporarily unavailable (chaos mode)' });
  }
  next();
});

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/cafeteria';

const Redis = require('ioredis');
const redis = new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });
redis.connect().catch(() => {});

// Sync status to DB for history/admin
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  status: { type: String, required: true },
});
const Order = mongoose.model('Order', orderSchema);

mongoose.connect(MONGO_URI).catch(err => console.error('MongoDB error:', err));

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const metrics = { totalNotifications: 0, failureCount: 0, latencies: [] };
function recordNotification(latency, failed = false) {
  metrics.totalNotifications++;
  if (failed) metrics.failureCount++;
  metrics.latencies.push(latency);
  if (metrics.latencies.length > 1000) metrics.latencies.shift();
}

io.on('connection', (socket) => {
  socket.on('subscribe', async (orderId) => {
    if (orderId) {
      socket.join(`order-${orderId}`);
      const status = await redis.get(`order_status:${orderId}`).catch(() => null);
      if (status) socket.emit('order-update', { orderId, status, timestamp: new Date().toISOString() });
    }
  });
});

let rabbitConn = null;
let consumeChannel = null;
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
    rabbitConn.on('error', () => { consumeChannel = null; if (!reconnectTimeout) reconnectTimeout = setTimeout(connectRabbit, 5000); });
    rabbitConn.on('close', () => { consumeChannel = null; if (!reconnectTimeout) reconnectTimeout = setTimeout(connectRabbit, 5000); });

    consumeChannel = await rabbitConn.createChannel();
    await consumeChannel.assertQueue('order-updates', { durable: true });
    consumeChannel.prefetch(10);
    consumeOrderUpdates();
  } catch (err) {
    console.error('RabbitMQ error:', err.message);
    if (!reconnectTimeout) reconnectTimeout = setTimeout(connectRabbit, 5000);
  }
}

let notificationConsumerTag = null;
async function consumeOrderUpdates() {
  if (chaosMode || !consumeChannel || notificationConsumerTag) return;
  const result = await consumeChannel.consume('order-updates', async (msg) => {
    if (!msg) return;
    const start = Date.now();
    try {
      const { orderId, status, timestamp } = JSON.parse(msg.content.toString());
      io.to(`order-${orderId}`).emit('order-update', { orderId, status, timestamp });
      await Order.updateOne({ orderId }, { status }).catch(() => {});
      await redis.set(`order_status:${orderId}`, status, 'EX', 3600).catch(() => {});
      consumeChannel.ack(msg);
      recordNotification(Date.now() - start);
    } catch (err) {
      recordNotification(Date.now() - start, true);
      if (consumeChannel) consumeChannel.nack(msg, false, false);
    }
  });
  notificationConsumerTag = result.consumerTag;
}

async function stopConsuming() {
  if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
  if (rabbitConn) {
    const conn = rabbitConn; rabbitConn = null;
    await conn.close().catch(() => {});
    consumeChannel = null; notificationConsumerTag = null;
  }
}

app.get('/health', (req, res) => {
  if (chaosMode) return res.status(503).json({ status: 'down' });
  return res.status(consumeChannel ? 200 : 503).json({ status: consumeChannel ? 'ok' : 'degraded' });
});

app.get('/metrics', (req, res) => res.json({ service: 'notification-hub', totalNotifications: metrics.totalNotifications, failureCount: metrics.failureCount }));
app.get('/chaos/status', (req, res) => res.json({ chaosMode }));
app.post('/chaos/kill', async (req, res) => { chaosMode = true; await stopConsuming(); io.disconnectSockets(true); return res.json({ status: 'killed', chaosMode: true }); });
app.post('/chaos/revive', async (req, res) => { chaosMode = false; await connectRabbit(); return res.json({ status: 'alive', chaosMode: false }); });

connectRabbit();
httpServer.listen(PORT, () => console.log(`notification-hub running on port ${PORT}`));
module.exports = { app, server: httpServer };
