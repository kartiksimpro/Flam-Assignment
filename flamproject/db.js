const mongoose = require('mongoose');


const MONGO_URI ='mongodb+srv://jnvkartiksingh_db_user:oT6fXcpgpDuWpQFr@cluster0.78jll24.mongodb.net/?appName=Cluster0'
// Connection options for better reliability
const connectionOptions = {
  serverSelectionTimeoutMS: 5000, // Reduced timeout for faster failure detection
  socketTimeoutMS: 45000,
  connectTimeoutMS: 5000,
  // For local MongoDB, these options may not be needed
  ...(MONGO_URI.startsWith('mongodb+srv://') ? {
    retryWrites: true,
    w: 'majority',
  } : {})
};

/**
 * Connects to the MongoDB database.
 */
async function connectDB() {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is not defined. Please set it as an environment variable or in db.js');
    }

    await mongoose.connect(MONGO_URI, connectionOptions);
    console.log('✅ MongoDB connected successfully.');
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB');
    
    if (err.code === 'ENOTFOUND' || err.name === 'MongoServerSelectionError') {
      console.error('   Network/DNS error: Could not resolve MongoDB hostname.');
      console.error('\n   💡 Solutions:');
      console.error('   1. Use local MongoDB (recommended for development):');
      console.error('      - Install MongoDB: https://www.mongodb.com/try/download/community');
      console.error('      - Start MongoDB service');
      console.error('      - Connection string: mongodb://localhost:27017/queuectl');
      console.error('   2. For MongoDB Atlas:');
      console.error('      - Check if cluster is running (not paused)');
      console.error('      - Verify internet connection');
      console.error('      - Set MONGO_URI environment variable with your Atlas connection string');
      console.error(`\n   Current connection string: ${MONGO_URI.replace(/:[^:@]+@/, ':****@')}`);
    } else if (err.name === 'MongooseServerSelectionError' && MONGO_URI.includes('localhost')) {
      console.error('   Could not connect to local MongoDB.');
      console.error('\n   💡 To fix this:');
      console.error('   1. Install MongoDB: https://www.mongodb.com/try/download/community');
      console.error('   2. Start MongoDB service:');
      console.error('      Windows: net start MongoDB (run as Administrator)');
      console.error('      Or check Services app and start "MongoDB" service');
      console.error('   3. Verify MongoDB is running on port 27017');
      console.error('\n   Alternatively, use MongoDB Atlas by setting MONGO_URI environment variable.');
    } else {
      console.error(`   Error: ${err.message}`);
      console.error(`   Error code: ${err.code || err.name}`);
    }
    
    process.exit(1); // Exit the process with an error
  }
}

/**
 * Disconnects from the MongoDB database.
 */
async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  } catch (err) {
    console.error('Failed to disconnect from MongoDB', err);
  }
}

// Optional: Log connection events
mongoose.connection.on('connected', () => {
  // This log is a bit redundant with the one in connectDB,
  // but good for showing re-connections.
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected.');
});

module.exports = { connectDB, disconnectDB };