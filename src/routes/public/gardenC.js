// backend/src/routes/public/gardenC.js
import express from 'express';
import { gardenCData } from '../../data/gardenC.js';

const router = express.Router();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Garden C API is working!' });
});

// Public endpoint to get Garden C features directly from GeoJSON file
// Used by guest users to view Garden C 3D map data
router.get('/', async (req, res) => {
  try {
    // Use the data directly from the imported file
    const geoJsonData = gardenCData;
    
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

