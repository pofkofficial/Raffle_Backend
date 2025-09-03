import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createRaffle, initPayment, verifyPayment, getTicketByNumber, getRaffle, getAllRaffles, endRaffle, adminLogin } from './controllers/raffleController.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
console.log('Environment variables:', {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  PAYSTACK_SECRET: process.env.PAYSTACK_SECRET,
});

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  exposedHeaders: ['X-Ticket-Number']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, '../frontend/build')));

// Log raw requests for debugging
app.use((req, res, next) => {
  console.log('Raw Request:', req.method, req.url, req.headers, req.body);
  next();
});

// Log registered routes
const routes = [
  { method: 'POST', path: '/api/admin/login' },
  { method: 'POST', path: '/api/raffles/create' },
  { method: 'POST', path: '/api/raffles/init-payment' },
  { method: 'POST', path: '/api/raffles/verify-payment' },
  { method: 'GET', path: '/api/raffles/:raffleId/ticket/:ticketNumber' },
  { method: 'GET', path: '/api/raffles/:id' },
  { method: 'GET', path: '/api/raffles' },
  { method: 'POST', path: '/api/raffles/end/:id/:secret' },
];
console.log('Registered routes:', routes);

// Register routes
app.post('/api/admin/login', adminLogin);
app.post('/api/raffles/create', createRaffle);
app.post('/api/raffles/init-payment', initPayment);
app.post('/api/raffles/verify-payment', verifyPayment);
app.get('/api/raffles/:raffleId/ticket/:ticketNumber', getTicketByNumber);
app.get('/api/raffles/:id', getRaffle);
app.get('/api/raffles', getAllRaffles);
app.post('/api/raffles/end/:id/:secret', endRaffle);

// Fallback for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.listen(process.env.PORT || 5000, () => console.log(`🚀 Server running on port ${process.env.PORT || 5000}`));