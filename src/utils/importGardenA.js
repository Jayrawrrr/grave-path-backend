// backend/src/utils/importGardenA.js
import mongoose from 'mongoose';
import GardenA from '../models/GardenA.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importGardenAData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Read the Garden A GeoJSON file
    const geoJsonPath = path.join(__dirname, '../../../staff-dashboard/public/data/Garden_A.geojson');
    
    if (!fs.existsSync(geoJsonPath)) {
      throw new Error(`Garden A GeoJSON file not found at: ${geoJsonPath}`);
    }
    
    const geoJsonData = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));
    console.log('Loaded Garden A GeoJSON data');

    // Clear existing Garden A data
    await GardenA.deleteMany({});
    console.log('Cleared existing Garden A data');

    const features = [];

    // Process each feature from GeoJSON
    for (const feature of geoJsonData.features) {
      if (feature.properties.type === 'grave' || feature.properties.type === 'niche') {
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

        const gardenAFeature = {
          featureId: feature.id || `${props.type}_${props.name}`,
          type: props.type,
          name: props.name || '',
          row: props.row || props.grave_row,
          column: props.column || props.grave_column,
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
          status: 'available',
          sqm: props.type === 'grave' ? 2.0 : 1.0,
          price: props.type === 'grave' ? 50000 : 25000,
          source: 'Garden_A.geojson'
        };

        features.push(gardenAFeature);
      }
    }

    console.log(`Processing ${features.length} Garden A features...`);

    // Insert in batches
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < features.length; i += batchSize) {
      const batch = features.slice(i, i + batchSize);
      await GardenA.insertMany(batch);
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${features.length} Garden A features`);
    }

    // Get statistics
    const stats = await GardenA.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          graves: { $sum: { $cond: [{ $eq: ['$type', 'grave'] }, 1, 0] } },
          niches: { $sum: { $cond: [{ $eq: ['$type', 'niche'] }, 1, 0] } }
        }
      }
    ]);

    const result = stats[0] || { total: 0, graves: 0, niches: 0 };

    console.log('✅ Garden A data imported successfully!');
    console.log(`
📊 Summary:
- Total features: ${result.total}
- Graves: ${result.graves}
- Niches: ${result.niches}
- Source: Garden_A.geojson
    `);

  } catch (error) {
    console.error('Error importing Garden A data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the import if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  importGardenAData();
}

export default importGardenAData;
