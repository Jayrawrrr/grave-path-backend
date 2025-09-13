// backend/src/utils/generateDummyLots.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Lot from '../models/Lot.js';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/graveyard_db';

// Sample data for generating dummy lots
const statuses = ['available', 'reserved', 'occupied'];
const blocks = ['1ST BLOCK', '2ND BLOCK', '3RD BLOCK', '4TH BLOCK', '5TH BLOCK'];
const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Maria', 'Robert', 'Lisa', 'James', 'Anna'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];

// Generate random coordinates within cemetery bounds
function generateRandomCoordinates() {
  // Garden of Memories bounds (approximate)
  const minLat = 14.5375;
  const maxLat = 14.5385;
  const minLng = 121.0690;
  const maxLng = 121.0715;
  
  const lat = minLat + Math.random() * (maxLat - minLat);
  const lng = minLng + Math.random() * (maxLng - minLng);
  
  // Create bounds (small rectangle around the point)
  const offset = 0.0001; // Small offset for bounds
  return [
    [lat - offset, lng - offset], // Bottom-left
    [lat + offset, lng + offset]  // Top-right
  ];
}

// Generate a single dummy lot
function generateDummyLot(index) {
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const block = blocks[Math.floor(Math.random() * blocks.length)];
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  const lot = {
    id: `LOT-${String(index + 1).padStart(3, '0')}`,
    bounds: generateRandomCoordinates(),
    name: status === 'occupied' ? `${firstName} ${lastName}` : '',
    birth: status === 'occupied' ? `${1920 + Math.floor(Math.random() * 80)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}` : '',
    death: status === 'occupied' ? `${2000 + Math.floor(Math.random() * 24)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}` : '',
    status: status,
    sqm: 12.5 + Math.random() * 5, // Random size between 12.5 and 17.5 sqm
    location: `${block} - Section ${Math.floor(Math.random() * 10) + 1}`,
    landmark: '',
    type: 'lot',
    pricePerSqm: 4000,
    price: String(Math.floor((12.5 + Math.random() * 5) * 4000))
  };
  
  return lot;
}

async function generateDummyLots(count = 100) {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully');

    // Check if lots already exist
    const existingLotsCount = await Lot.countDocuments();
    if (existingLotsCount > 0) {
      console.log(`Warning: ${existingLotsCount} lots already exist in the database.`);
      console.log('Run clearLots.js first if you want to start fresh.');
      return;
    }

    // Generate dummy lots
    console.log(`Generating ${count} dummy lots...`);
    const dummyLots = [];
    
    for (let i = 0; i < count; i++) {
      dummyLots.push(generateDummyLot(i));
    }

    // Insert into database
    console.log('Inserting dummy lots into database...');
    const result = await Lot.insertMany(dummyLots);
    
    console.log(`Successfully created ${result.length} dummy lots`);
    
    // Show statistics
    const statusCounts = await Lot.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    console.log('\nStatus distribution:');
    statusCounts.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} lots`);
    });

  } catch (error) {
    console.error('Error generating dummy lots:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Get count from command line argument or use default
const count = process.argv[2] ? parseInt(process.argv[2]) : 100;

console.log(`Generating ${count} dummy lots...`);
generateDummyLots(count);
