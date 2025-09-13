import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import raffleRoutes from '../routes/raffleRoutes.js';
import * as raffleCtrl from '../controllers/raffleController.js';
import { parse } from 'url';

// Initialize Express app
const app = express();
const FRONTEND = process.env.FRONTEND_LINK;

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000', FRONTEND
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowed => 
      origin === allowed || origin.startsWith(allowed.replace('*', ''))
    );
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn('🚫 CORS blocked origin:', origin);
      callback(new Error(`Not allowed by CORS. Allowed origins: ${allowedOrigins.join(', ')}`));
    }
  },
  credentials: true,
  exposedHeaders: ['X-Ticket-Number']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// API Routes
app.use('/api/raffles', raffleRoutes);
app.post('/api/admin/login', raffleCtrl.adminLogin);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized'
  }[mongoose.connection.readyState] || 'unknown';

  // Parse MONGO_URI safely
  let mongoUriDetails = { uri: 'N/A', host: 'N/A', database: 'N/A', protocol: 'N/A' };
  if (process.env.MONGO_URI) {
    try {
      const parsedUri = parse(process.env.MONGO_URI);
      mongoUriDetails = {
        uri: parsedUri.href ? parsedUri.href.replace(/\/\/[^@]+@/, '//<redacted>@') : 'N/A',
        host: parsedUri.hostname || 'N/A',
        database: parsedUri.pathname ? parsedUri.pathname.replace(/^\//, '') : 'N/A',
        protocol: parsedUri.protocol ? parsedUri.protocol.replace(/:$/, '') : 'N/A'
      };
    } catch (error) {
      console.warn('⚠️ Failed to parse MONGO_URI:', error.message);
    }
  }
  
  res.status(200).json({ 
    status: dbStatus === 'connected' ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    service: 'RaffleHub Backend',
    database: {
      status: dbStatus,
      host: mongoose.connection.host || 'N/A',
      port: mongoose.connection.port || 'N/A',
      name: mongoose.connection.name || 'N/A',
      environment: mongoUriDetails
    }
  });
});
// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: '🎉 RaffleHub Backend Server Running',
    version: '1.0.0',
    documentation: '/api/health',
    endpoints: {
      health: '/api/health',
      raffles: '/api/raffles',
      admin: '/api/admin'
    }
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
    availableEndpoints: ['/api/health', '/api/raffles', '/api/admin']
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('💥 Server Error:', error);
  
  // CORS error handling
  if (error.message.includes('Not allowed by CORS')) {
    return res.status(403).json({ 
      error: 'CORS policy blocked this request',
      message: 'Your origin is not allowed to access this resource',
      allowedOrigins: allowedOrigins,
      yourOrigin: req.headers.origin
    });
  }
  
  // MongoDB errors
  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    return res.status(503).json({ 
      error: 'Database error',
      message: 'Please try again later'
    });
  }
  
  // General server errors
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong. Please try again.'
  });
});

export default app;