// backend/src/routes/public/gardenB.js
import express from 'express';
import { gardenBData } from '../../data/gardenB.js';

const router = express.Router();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Garden B API is working!' });
});

// Public endpoint to get Garden B features directly from GeoJSON file
// Used by guest users to view Garden B 3D map data
router.get('/', async (req, res) => {
  try {
    // Use the data directly from the imported file
    const geoJsonData = gardenBData;
    
    // Filter by type if specified
    const { type } = req.query;
    if (type) {
      geoJsonData.features = geoJsonData.features.filter(feature => feature.properties.type === type);
    }
    
    res.json(geoJsonData);
  } catch (err) {
    console.error('Error fetching Garden B GeoJSON file:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get Garden B statistics from GeoJSON file
router.get('/stats', async (req, res) => {
  try {
    const geoJsonData = gardenBData;
    
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
    console.error('Error fetching Garden B statistics:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;



