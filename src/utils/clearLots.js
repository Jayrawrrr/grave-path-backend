// backend/src/utils/clearLots.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Lot from '../models/Lot.js';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/graveyard_db';

async function clearAllLots() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully');

    // Count existing lots
    const existingLotsCount = await Lot.countDocuments();
    console.log(`Found ${existingLotsCount} existing lots in the database`);

    if (existingLotsCount === 0) {
      console.log('No lots to delete. Database is already empty.');
      return;
    }

    // Delete all lots
    console.log('Deleting all lots...');
    const deleteResult = await Lot.deleteMany({});
    
    console.log(`Successfully deleted ${deleteResult.deletedCount} lots from the database`);
    console.log('Database is now ready for new dummy data');

  } catch (error) {
    console.error('Error clearing lots:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
clearAllLots();
