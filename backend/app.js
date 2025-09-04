import express from 'express';
import cors from 'cors';
import raffleRoutes from './routes/raffleRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';

// ES modules path handling
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://raffle-frontend-xi.vercel.app',
  'https://raffle-frontend-.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed or matches pattern
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
app.use('/api', raffleRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    service: 'RaffleHub Backend'
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

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../frontend/build'), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
    availableEndpoints: ['/api/health', '/api/raffles', '/api/admin']
  });
});

// SPA fallback - serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
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