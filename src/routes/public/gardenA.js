// backend/src/routes/public/gardenA.js
import express from 'express';
import GardenA from '../../models/GardenA.js';
import { gardenAData } from '../../data/gardenA.js';

const router = express.Router();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Garden A API is working!' });
});

// Public endpoint to get Garden A features with real status from database
// Used by guest users to view Garden A 3D map data
router.get('/', async (req, res) => {
  try {
    // Get the base GeoJSON data
    const geoJsonData = JSON.parse(JSON.stringify(gardenAData)); // Deep clone
    
    // Fetch real status from database for graves
    const dbGraves = await GardenA.find({ type: 'grave' }).lean();
    
    // Create a map of database graves for quick lookup
    const graveStatusMap = {};
    dbGraves.forEach(grave => {
      const key = `${grave.row}-${grave.column}`;
      graveStatusMap[key] = grave.status;
    });
    
    // Update features with real status from database
    geoJsonData.features = geoJsonData.features.map(feature => {
      if (feature.properties && feature.properties.type === 'grave') {
        const row = feature.properties.row || feature.properties.grave_row;
        const column = feature.properties.column || feature.properties.grave_column;
        const key = `${row}-${column}`;
        
        // Use database status if available, otherwise default to 'available'
        if (graveStatusMap[key]) {
          feature.properties.status = graveStatusMap[key];
        } else {
          feature.properties.status = 'available';
        }
      }
      return feature;
    });
    
    // Filter by type if specified
    const { type } = req.query;
    if (type) {
      geoJsonData.features = geoJsonData.features.filter(feature => feature.properties.type === type);
    }
    
    res.json(geoJsonData);
  } catch (err) {
    console.error('Error fetching Garden A GeoJSON file:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get Garden A statistics from GeoJSON file
router.get('/statistics', async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const geoJsonPath = path.join(__dirname, '../../../data/Garden_A.geojson');
    
    if (!fs.existsSync(geoJsonPath)) {
      return res.status(404).json({ msg: 'Garden A GeoJSON file not found' });
    }
    
    const geoJsonData = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));
    
    const features = geoJsonData.features.filter(f => f.properties.type === 'grave' || f.properties.type === 'niche');
    
    const result = {
      total: features.length,
      graves: features.filter(f => f.properties.type === 'grave').length,
      niches: features.filter(f => f.properties.type === 'niche').length,
      available: features.length, // All are available by default from GeoJSON
      occupied: 0,
      reserved: 0
    };
    
    res.json(result);
  } catch (err) {
    console.error('Error fetching Garden A statistics from GeoJSON:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get specific Garden A feature by ID from GeoJSON file
router.get('/:id', async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const geoJsonPath = path.join(__dirname, '../../../data/Garden_A.geojson');
    
    if (!fs.existsSync(geoJsonPath)) {
      return res.status(404).json({ msg: 'Garden A GeoJSON file not found' });
    }
    
    const geoJsonData = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));
    
    const feature = geoJsonData.features.find(f => f.id === req.params.id);
    
    if (!feature) {
      return res.status(404).json({ msg: 'Feature not found' });
    }
    
    res.json(feature);
  } catch (err) {
    console.error('Error fetching Garden A feature from GeoJSON:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
