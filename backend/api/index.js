import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import raffleRoutes from '../routes/raffleRoutes.js';
import * as raffleCtrl from '../controllers/raffleController.js';
import { parse } from 'url';

// Load environment variables first
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['MONGO_URI'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

// Log environment status
console.log('🔧 Environment Configuration:');
console.log('   PORT:', process.env.PORT || 5000);
console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('   MONGO_URI:', process.env.MONGO_URI ? '✅ Set' : '❌ Missing');
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing');
console.log('   PAYSTACK_SECRET:', process.env.PAYSTACK_SECRET ? '✅ Set' : '❌ Missing');

// Initialize Express app
const app = express();

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://raffle-frontend-xi.vercel.app'
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

// MongoDB connection with retry logic
const connectDatabase = async (retries = 5, delay = 5000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔗 Attempting MongoDB connection (${attempt}/${retries})...`);
      
      await mongoose.connect(process.env.MONGO_URI);
      
      console.log('✅ MongoDB Connected successfully');
      
      // MongoDB event listeners
      mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected successfully');
      });

      return true;
      
    } catch (error) {
      console.error(`❌ MongoDB connection attempt ${attempt} failed:`, error.message);
      
      if (attempt === retries) {
        throw error;
      }
      
      console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  try {
    // Close MongoDB connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(false);
      console.log('✅ MongoDB connection closed gracefully');
    }
    
    console.log('💤 Server shutdown complete');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Global error handlers for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 UNCAUGHT EXCEPTION:', error);
  console.log('💀 Shutting down server due to uncaught exception...');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 UNHANDLED REJECTION at:', promise, 'reason:', reason);
  console.log('💀 Shutting down server due to unhandled rejection...');
  process.exit(1);
});

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start the server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    const PORT = process.env.PORT || 5000;
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('\n🚀 Server started successfully!');
      console.log('   Local:    http://localhost:' + PORT);
      console.log('   Network:  http://0.0.0.0:' + PORT);
      console.log('   Health:   http://localhost:' + PORT + '/api/health');
      console.log('   Environment:', process.env.NODE_ENV || 'development');
      console.log('   Process ID:', process.pid);
    });

    // Server error handling
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      }
      console.error('❌ Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();

export default app;