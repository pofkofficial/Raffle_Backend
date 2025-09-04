import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './app.js';

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

// MongoDB connection with retry logic
const connectDatabase = async (retries = 5, delay = 5000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔗 Attempting MongoDB connection (${attempt}/${retries})...`);
      
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 1000000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000
      });

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