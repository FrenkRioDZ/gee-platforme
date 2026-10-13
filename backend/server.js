require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');

// Routes
const authRoutes = require('./routes/auth');
const bureauRoutes = require('./routes/bureaus');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const weeklyReportRoutes = require('./routes/weeklyReports');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const { initScheduler } = require('./utils/scheduler');
const reportCanvasRoutes = require('./routes/reportCanvasRoutes');

const app = express();
const server = http.createServer(app);

// Socket.io for real-time in-app notifications
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
  }
});

['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'MONGO_URI'].forEach((k) => {
  if (!process.env[k]) {
    console.error(`FATAL: ${k} manquant dans .env`);
    process.exit(1);
  }
});
if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
  console.error('FATAL: JWT_ACCESS_SECRET et JWT_REFRESH_SECRET doivent être différents');
  process.exit(1);
}
// Make io accessible in controllers
app.set('io', io);

// Nginx sits in front — trust its X-Forwarded-For for real client IPs
app.set('trust proxy', 1);

// ─── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/bureaus', bureauRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/reports/weekly', weeklyReportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/report-canvas', reportCanvasRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', platform: 'GEE Plateforme' }));

// ─── Socket.io ────────────────────────────────────────────────
const connectedUsers = new Map(); // userId -> socketId

// Authenticate the handshake — the userId comes from the verified token, never from the client
io.use((socket, next) => {
  try {
    const decoded = jwt.verify(socket.handshake.auth?.token, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256']
    });
    if (decoded.type && decoded.type !== 'access') return next(new Error('Token invalide'));
    socket.data.userId = String(decoded.id);
    next();
  } catch {
    next(new Error('Non authentifié'));
  }
});

io.on('connection', (socket) => {
  const { userId } = socket.data;
  connectedUsers.set(userId, socket.id);
  console.log(`User ${userId} connected via socket`);

  socket.on('disconnect', () => {
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        break;
      }
    }
  });
});

// Helper to send real-time notification to a user
app.set('sendNotification', (userId, notification) => {
  const socketId = connectedUsers.get(userId.toString());
  if (socketId) {
    io.to(socketId).emit('notification', notification);
  }
});

// Emitter for live screen refresh
app.set('emitToUser', (userId, eventName, payload) => {
  const socketId = connectedUsers.get(userId.toString());
  if (socketId) {
    io.to(socketId).emit(eventName, payload);
  }
});

// ─── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  // Start cron jobs after DB is connected
  initScheduler(app);

  server.listen(PORT, () => {
    console.log(`GEE Plateforme backend running on port ${PORT}`);
  });
});
