require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Chaos mode
let chaosMode = false;

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/cafeteria';

// Metrics
const metrics = { totalRequests: 0, failureCount: 0, latencies: [] };

function recordRequest(latency, failed = false) {
  metrics.totalRequests++;
  if (failed) metrics.failureCount++;
  metrics.latencies.push(latency);
  if (metrics.latencies.length > 1000) metrics.latencies.shift();
}

function avgLatency() {
  if (metrics.latencies.length === 0) return 0;
  return metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
}

// Student schema
const studentSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
});
const Student = mongoose.model('Student', studentSchema);

// Chaos middleware
app.use((req, res, next) => {
  if (chaosMode && !req.path.startsWith('/health') && !req.path.startsWith('/chaos') && !req.path.startsWith('/metrics')) {
    return res.status(503).json({ error: 'Service temporarily unavailable (chaos mode)' });
  }
  next();
});

// GET /students - List all students (Admin use)
app.get('/students', async (req, res) => {
  try {
    const students = await Student.find({}, { password: 0 }); // Don't return passwords
    return res.json(students);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /students - Create new student (Admin use)
app.post('/students', async (req, res) => {
  try {
    const { studentId, password, name } = req.body;
    if (!studentId || !password || !name) {
      return res.status(400).json({ error: 'studentId, password, and name are required' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const student = await Student.create({ studentId, password: hashed, name });
    return res.status(201).json({ studentId: student.studentId, name: student.name });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Student ID already exists' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Per-student rate limiter (max 3 login attempts per minute)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.body && req.body.studentId ? req.body.studentId : req.ip,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many login attempts. Try again in a minute.' });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /auth/login
app.post('/auth/login', loginLimiter, async (req, res) => {
  const start = Date.now();
  try {
    const { studentId, password } = req.body;
    if (!studentId || !password) {
      recordRequest(Date.now() - start, true);
      return res.status(400).json({ error: 'studentId and password are required' });
    }
    const student = await Student.findOne({ studentId });
    if (!student) {
      recordRequest(Date.now() - start, true);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, student.password);
    if (!valid) {
      recordRequest(Date.now() - start, true);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { studentId: student.studentId, name: student.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    recordRequest(Date.now() - start);
    return res.json({ token, studentId: student.studentId, name: student.name });
  } catch (err) {
    recordRequest(Date.now() - start, true);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/verify
app.post('/auth/verify', async (req, res) => {
  const start = Date.now();
  try {
    const { token } = req.body;
    if (!token) {
      recordRequest(Date.now() - start, true);
      return res.status(400).json({ error: 'Token is required' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    recordRequest(Date.now() - start);
    return res.json({ valid: true, decoded });
  } catch (err) {
    recordRequest(Date.now() - start, true);
    return res.status(401).json({ valid: false, error: 'Invalid or expired token' });
  }
});

// Standard Endpoints
app.get('/health', async (req, res) => {
  if (chaosMode) return res.status(503).json({ status: 'down' });
  const mongoUp = mongoose.connection.readyState === 1;
  return res.status(mongoUp ? 200 : 503).json({ status: mongoUp ? 'ok' : 'down' });
});

app.get('/metrics', (req, res) => res.json({ service: 'identity-provider', totalRequests: metrics.totalRequests, failureCount: metrics.failureCount, avgLatency: avgLatency() }));
app.get('/chaos/status', (req, res) => res.json({ chaosMode }));
app.post('/chaos/kill', (req, res) => { chaosMode = true; return res.json({ status: 'killed', chaosMode: true }); });
app.post('/chaos/revive', (req, res) => { chaosMode = false; return res.json({ status: 'alive', chaosMode: false }); });

async function connectAndSeed() {
  try {
    await mongoose.connect(MONGO_URI);
    const existing = await Student.findOne({ studentId: 'STU001' });
    if (!existing) {
      const hashed = await bcrypt.hash('password123', 10);
      await Student.create({ studentId: 'STU001', password: hashed, name: 'Test Student' });
    }
  } catch (err) {
    setTimeout(connectAndSeed, 5000);
  }
}

connectAndSeed();
app.listen(PORT, () => console.log(`identity-provider running on port ${PORT}`));
module.exports = { app };
