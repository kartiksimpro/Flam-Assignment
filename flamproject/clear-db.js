const mongoose = require('mongoose');
const Job = require('./models/job');
const Config = require('./models/config');

// Use the same connection string from db.js
const MONGO_URI = 'mongodb+srv://jnvkartiksingh_db_user:oT6fXcpgpDuWpQFr@cluster0.78jll24.mongodb.net/?appName=Cluster0';

// Connection options for better reliability
const connectionOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 5000,
  ...(MONGO_URI.startsWith('mongodb+srv://') ? {
    retryWrites: true,
    w: 'majority',
  } : {})
};

async function clearDatabase() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGO_URI, connectionOptions);
    console.log('✅ MongoDB connected successfully.');

    // Clear jobs collection
    const jobResult = await Job.deleteMany({});
    console.log(`Cleared ${jobResult.deletedCount} documents from 'jobs'`);

    // Clear configs collection
    const configResult = await Config.deleteMany({});
    console.log(`Cleared ${configResult.deletedCount} documents from 'configs'`);

    console.log('Database cleared successfully.');

  } catch (err) {
    console.error('Error clearing database:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

clearDatabase();