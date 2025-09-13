// backend/src/utils/generateGridLots.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Lot from '../models/Lot.js';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/graveyard_db';

// Define polygon areas for different gardens/sections
// These are approximate coordinates for Garden of Memories - you can adjust these
const GARDEN_AREAS = {
  'Garden A': {
    bounds: {
      north: 14.5382,
      south: 14.5378,
      east: 121.0705,
      west: 121.0695
    },
    rows: 8,
    cols: 12,
    lotWidth: 0.00008,  // Width of each lot in degrees
    lotHeight: 0.00005  // Height of each lot in degrees
  },
  'Garden B': {
    bounds: {
      north: 14.5380,
      south: 14.5376,
      east: 121.0710,
      west: 121.0700
    },
    rows: 6,
    cols: 10,
    lotWidth: 0.00008,
    lotHeight: 0.00005
  },
  'Garden C': {
    bounds: {
      north: 14.5378,
      south: 14.5374,
      east: 121.0708,
      west: 121.0698
    },
    rows: 7,
    cols: 11,
    lotWidth: 0.00008,
    lotHeight: 0.00005
  }
};

// Sample data for generating realistic lots
const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Maria', 'Robert', 'Lisa', 'James', 'Anna', 'William', 'Emily', 'Christopher', 'Jessica', 'Daniel', 'Ashley', 'Matthew', 'Amanda', 'Anthony', 'Jennifer'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];

// Generate coordinates for a grid within a polygon
function generateGridCoordinates(gardenConfig) {
  const { bounds, rows, cols, lotWidth, lotHeight } = gardenConfig;
  
  // Calculate spacing between lots
  const latSpacing = (bounds.north - bounds.south) / rows;
  const lngSpacing = (bounds.east - bounds.west) / cols;
  
  const coordinates = [];
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Calculate center point of the lot
      const centerLat = bounds.south + (row * latSpacing) + (latSpacing / 2);
      const centerLng = bounds.west + (col * lngSpacing) + (lngSpacing / 2);
      
      // Create bounds for the lot (small rectangle around center point)
      const lotBounds = [
        [centerLat - (lotHeight / 2), centerLng - (lotWidth / 2)], // Bottom-left
        [centerLat + (lotHeight / 2), centerLng + (lotWidth / 2)]  // Top-right
      ];
      
      coordinates.push({
        bounds: lotBounds,
        center: [centerLat, centerLng],
        row: row + 1,
        col: col + 1,
        position: `${row + 1}-${col + 1}`
      });
    }
  }
  
  return coordinates;
}

// Generate a single lot with realistic data
function generateLot(gardenName, lotData, index) {
  const statuses = ['available', 'reserved', 'occupied'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  const lot = {
    id: `${gardenName.replace(' ', '')}-${String(lotData.row).padStart(2, '0')}-${String(lotData.col).padStart(2, '0')}`,
    bounds: lotData.bounds,
    name: status === 'occupied' ? `${firstName} ${lastName}` : '',
    birth: status === 'occupied' ? `${1920 + Math.floor(Math.random() * 80)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}` : '',
    death: status === 'occupied' ? `${2000 + Math.floor(Math.random() * 24)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}` : '',
    status: status,
    sqm: 12.5,
    location: `${gardenName} - Row ${lotData.row}, Col ${lotData.col}`,
    landmark: '',
    type: 'lot',
    pricePerSqm: 4000,
    price: '50000'
  };
  
  return lot;
}

async function generateGridLots() {
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

    let allLots = [];
    let totalLots = 0;

    // Generate lots for each garden
    for (const [gardenName, gardenConfig] of Object.entries(GARDEN_AREAS)) {
      console.log(`\nGenerating lots for ${gardenName}...`);
      console.log(`Grid: ${gardenConfig.rows} rows × ${gardenConfig.cols} columns`);
      
      const gridCoordinates = generateGridCoordinates(gardenConfig);
      const gardenLots = [];
      
      gridCoordinates.forEach((lotData, index) => {
        const lot = generateLot(gardenName, lotData, index);
        gardenLots.push(lot);
      });
      
      allLots.push(...gardenLots);
      totalLots += gardenLots.length;
      
      console.log(`Generated ${gardenLots.length} lots for ${gardenName}`);
    }

    // Insert all lots into database
    console.log(`\nInserting ${totalLots} lots into database...`);
    const result = await Lot.insertMany(allLots);
    
    console.log(`Successfully created ${result.length} lots`);
    
    // Show statistics by garden
    console.log('\nGarden Statistics:');
    for (const gardenName of Object.keys(GARDEN_AREAS)) {
      const gardenLots = await Lot.find({ 
        location: { $regex: `^${gardenName}` } 
      });
      
      const statusCounts = {};
      gardenLots.forEach(lot => {
        statusCounts[lot.status] = (statusCounts[lot.status] || 0) + 1;
      });
      
      console.log(`\n${gardenName}: ${gardenLots.length} lots`);
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count} lots`);
      });
    }

    // Show overall statistics
    const overallStatusCounts = await Lot.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    console.log('\nOverall Status Distribution:');
    overallStatusCounts.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} lots`);
    });

  } catch (error) {
    console.error('Error generating grid lots:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
generateGridLots();
