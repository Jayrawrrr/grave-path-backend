// src/app.js (or wherever you configure Express)

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profileRoutes.js';
import staffLots from './routes/staff/lots.js';
import staffReservations from './routes/staff/reservations.js';
import staffAnnouncements from './routes/staff/announcement.js';
import clientLots from './routes/client/lots.js';
import clientReservations from './routes/client/reservations.js';
import clientAnnouncements from './routes/client/announcement.js';
import adminUsers from './routes/admin/users.js';
import burialsRouter from './routes/admin/burials.js';
import intermentsRouter from './routes/admin/interments.js';
import paymentRouter from './routes/payment.js';
import financialRouter from './routes/admin/financial.js';
import statisticsRouter from './routes/admin/statistics.js';
import activityLogsRouter from './routes/admin/activityLogs.js';
import reservationRoutes from './routes/reservationRoutes.js';
import chatbotRouter from './routes/chatbot.js';
import publicLots from './routes/public/lots.js';
import publicAnnouncements from './routes/public/announcements.js';
import publicInfo from './routes/public/info.js';
import adminColumbarium from './routes/admin/columbarium.js';
import clientColumbarium from './routes/client/columbarium.js';
import adminChatbot from './routes/admin/chatbot.js';

dotenv.config();
const app = express();

const allowedOrigins = [
  'https://grave-path.com',
  'https://www.grave-path.com',
  'https://api.grave-path.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  process.env.FRONTEND_URL
].filter(Boolean); // Remove undefined values

// Enhanced CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // For development, allow localhost with any port
    if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    callback(new Error("Not allowed by CORS"));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Handle preflight requests
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  
  // Check if origin is allowed
  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Accept, Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    res.sendStatus(204);
  } else {
    res.status(403).json({ error: 'CORS policy violation' });
  }
});

app.use(express.json());

// Add CORS headers to all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Set CORS headers for allowed origins
  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  next();
});

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Create uploads directories if they don't exist
const uploadsDir = path.join(__dirname, '../uploads');
const proofsDir = path.join(__dirname, '../uploads/proofs');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(proofsDir)) {
  fs.mkdirSync(proofsDir, { recursive: true });
}

// Health-check
app.get('/', (_req, res) => res.send('API is up!'));

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.json({
    message: 'CORS is working!',
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    allowedOrigins: allowedOrigins
  });
});

// Auth
app.use('/api/auth', authRoutes);

// Profile routes
app.use('/api/profile', profileRoutes);

// Staff routes
app.use('/api/staff/lots', staffLots);
app.use('/api/staff/reservations', staffReservations);
app.use('/api/staff/announcements', staffAnnouncements);

// Client routes
app.use('/api/client/lots', clientLots);
app.use('/api/client/reservations', clientReservations);
app.use('/api/client/announcements', clientAnnouncements);
app.use('/api/client/columbarium', clientColumbarium);

// Admin routes
app.use('/api/admin/users', adminUsers);
app.use('/api/admin/logs', activityLogsRouter);
app.use('/api/admin/burials', burialsRouter);
app.use('/api/admin/interments', intermentsRouter);
app.use('/api/admin/reports/financial', financialRouter);
app.use('/api/admin/statistics', statisticsRouter);
app.use('/api/admin/columbarium', adminColumbarium);
app.use('/api/admin/chatbot', adminChatbot);

// Payment
app.use('/api/payment', paymentRouter);

// Reservation routes
app.use('/api/reservations', reservationRoutes);

// Chatbot route
app.use('/api/chatbot', chatbotRouter);

// Public routes (no authentication required)
app.use('/api/public/lots', publicLots);
app.use('/api/public/announcements', publicAnnouncements);
app.use('/api/public-access/info', publicInfo);

// Connect to MongoDB & start server
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI)
  .then(() => console.log('✔️ MongoDB connected'))
  .catch(err => console.error(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
