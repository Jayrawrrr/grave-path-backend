// backend/src/routes/public/gardenC.js
import express from 'express';
import GardenC from '../../models/GardenC.js';
import { gardenCData } from '../../data/gardenC.js';

const router = express.Router();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Garden C API is working!' });
});

// Public endpoint to get Garden C features with real status from database
// Used by guest users to view Garden C 3D map data
router.get('/', async (req, res) => {
  try {
    // Get the base GeoJSON data
    const geoJsonData = JSON.parse(JSON.stringify(gardenCData)); // Deep clone
    
    // Fetch real status from database for graves
    const dbGraves = await GardenC.find({ type: 'grave' }).lean();
    
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
    console.error('Error fetching Garden C GeoJSON file:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get Garden C statistics from GeoJSON file
router.get('/stats', async (req, res) => {
  try {
    const geoJsonData = gardenCData;
    
    if (!geoJsonData || !geoJsonData.features) {
      return res.json({
        total: 0,
        graves: 0,
        niches: 0
      });
    }
    
    const graves = geoJsonData.features.filter(f => f.properties.type === 'grave').length;
    const niches = geoJsonData.features.filter(f => f.properties.type === 'niche').length;
    const total = graves + niches;
    
    res.json({
      total,
      graves,
      niches
    });
  } catch (err) {
    console.error('Error fetching Garden C statistics:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;



