// backend/src/utils/initializeGardensWithRandomStatus.js
// This script initializes Garden A, B, C, D databases with randomized statuses
// matching the same distribution used in MapboxMap.jsx (60% available, 25% occupied, 10% reserved, 5% unavailable)

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import GardenA from '../models/GardenA.js';
import GardenB from '../models/GardenB.js';
import GardenC from '../models/GardenC.js';
import GardenD from '../models/GardenD.js';
import { gardenAData } from '../data/gardenA.js';
import { gardenBData } from '../data/gardenB.js';
import { gardenCData } from '../data/gardenC.js';
import { gardenDData } from '../data/gardenD.js';

dotenv.config();

// Same status generation function as MapboxMap.jsx
const getRealisticStatus = (name, row, column) => {
  // Create a consistent hash from the coordinates
  const hash = (name + row + column).split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  // Use percentage-based distribution
  const random = Math.abs(hash) % 100;
  
  if (random < 60) return 'available';      // 60% available
  if (random < 85) return 'occupied';       // 25% occupied  
  if (random < 95) return 'reserved';       // 10% reserved
  return 'unavailable';                      // 5% unavailable
};

async function initializeGarden(gardenData, GardenModel, gardenName) {
  console.log(`\n=== Initializing Garden ${gardenName} ===`);
  
  // Clear existing data
  const deleteResult = await GardenModel.deleteMany({});
  console.log(`Cleared ${deleteResult.deletedCount} existing ${gardenName} features`);
  
  const features = [];
  let statusCounts = {
    available: 0,
    occupied: 0,
    reserved: 0,
    unavailable: 0
  };
  
  // Process each feature from GeoJSON
  for (const feature of gardenData.features) {
    if (feature.properties && (feature.properties.type === 'grave' || feature.properties.type === 'niche')) {
      const props = feature.properties;
      const coords = feature.geometry.coordinates[0]; // First ring of polygon
      
      // Calculate bounds
      const lngs = coords.map(coord => coord[0]);
      const lats = coords.map(coord => coord[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      
      // Calculate center point
      const centerLng = (minLng + maxLng) / 2;
      const centerLat = (minLat + maxLat) / 2;
      
      const row = props.row || props.grave_row;
      const column = props.column || props.grave_column;
      const name = props.name || `${props.type}_${row}_${column}`;
      
      // Generate realistic status using the same function as MapboxMap
      const status = getRealisticStatus(name, row, column);
      
      // Count status distribution
      if (props.type === 'grave') {
        statusCounts[status]++;
      }
      
      const gardenFeature = {
        featureId: feature.id || `${props.type}_${name}`,
        type: props.type,
        name: name,
        row: row,
        column: column,
        graveRow: props.grave_row,
        graveColumn: props.grave_column,
        geometry: feature.geometry,
        centerCoordinates: {
          type: 'Point',
          coordinates: [centerLng, centerLat]
        },
        bounds: {
          southwest: [minLat, minLng],
          northeast: [maxLat, maxLng]
        },
        status: status, // Real randomized status
        sqm: props.type === 'grave' ? 2.0 : 1.0,
        price: props.type === 'grave' ? 8000 : 4000,
        source: `Garden_${gardenName}.geojson`
      };
      
      features.push(gardenFeature);
    }
  }
  
  // Insert in batches
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < features.length; i += batchSize) {
    const batch = features.slice(i, i + batchSize);
    await GardenModel.insertMany(batch);
    inserted += batch.length;
    console.log(`Inserted ${inserted}/${features.length} features`);
  }
  
  // Calculate percentages
  const totalGraves = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  console.log(`\n✅ Garden ${gardenName} initialized with ${features.length} features`);
  console.log(`   Graves: ${features.filter(f => f.type === 'grave').length}`);
  console.log(`   Niches: ${features.filter(f => f.type === 'niche').length}`);
  console.log(`\n📊 Grave Status Distribution (${totalGraves} total):`);
  console.log(`   Available:   ${statusCounts.available} (${((statusCounts.available/totalGraves)*100).toFixed(1)}%)`);
  console.log(`   Occupied:    ${statusCounts.occupied} (${((statusCounts.occupied/totalGraves)*100).toFixed(1)}%)`);
  console.log(`   Reserved:    ${statusCounts.reserved} (${((statusCounts.reserved/totalGraves)*100).toFixed(1)}%)`);
  console.log(`   Unavailable: ${statusCounts.unavailable} (${((statusCounts.unavailable/totalGraves)*100).toFixed(1)}%)`);
  
  return {
    total: features.length,
    graves: features.filter(f => f.type === 'grave').length,
    niches: features.filter(f => f.type === 'niche').length,
    statusCounts
  };
}

async function main() {
  try {
    console.log('🚀 Starting Garden Initialization with Randomized Status...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✔️  Connected to MongoDB\n');
    
    // Initialize each garden
    const results = {
      A: await initializeGarden(gardenAData, GardenA, 'A'),
      B: await initializeGarden(gardenBData, GardenB, 'B'),
      C: await initializeGarden(gardenCData, GardenC, 'C'),
      D: await initializeGarden(gardenDData, GardenD, 'D')
    };
    
    // Print summary
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('🎉 ALL GARDENS INITIALIZED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════\n');
    
    let totalGraves = 0;
    let totalAvailable = 0;
    let totalOccupied = 0;
    let totalReserved = 0;
    let totalUnavailable = 0;
    
    Object.entries(results).forEach(([garden, data]) => {
      totalGraves += data.graves;
      totalAvailable += data.statusCounts.available;
      totalOccupied += data.statusCounts.occupied;
      totalReserved += data.statusCounts.reserved;
      totalUnavailable += data.statusCounts.unavailable;
    });
    
    console.log(`📈 OVERALL STATISTICS:`);
    console.log(`   Total Graves: ${totalGraves}`);
    console.log(`   Available:    ${totalAvailable} (${((totalAvailable/totalGraves)*100).toFixed(1)}%)`);
    console.log(`   Occupied:     ${totalOccupied} (${((totalOccupied/totalGraves)*100).toFixed(1)}%)`);
    console.log(`   Reserved:     ${totalReserved} (${((totalReserved/totalGraves)*100).toFixed(1)}%)`);
    console.log(`   Unavailable:  ${totalUnavailable} (${((totalUnavailable/totalGraves)*100).toFixed(1)}%)`);
    
    console.log('\n✨ The randomized statuses are now REAL and stored in the database!');
    console.log('📍 These statuses will be displayed in both MapboxMap and PlotAvailability.');
    console.log('🔄 Reservations will update these statuses in real-time.\n');
    
  } catch (error) {
    console.error('❌ Error initializing gardens:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✔️  Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
main();
