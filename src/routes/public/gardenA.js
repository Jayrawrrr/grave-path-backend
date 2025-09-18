// backend/src/routes/public/gardenA.js
import express from 'express';
import GardenA from '../../models/GardenA.js';

const router = express.Router();

// Public endpoint to get Garden A features without authentication
// Used by guest users to view Garden A 3D map data
router.get('/', async (req, res) => {
  try {
    const { type, status } = req.query;
    
    // Build filter
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    
    const features = await GardenA.find(filter)
      .select('featureId type name row column graveRow graveColumn centerCoordinates bounds status sqm price')
      .sort({ row: 1, column: 1 });
    
    res.json(features);
  } catch (err) {
    console.error('Error fetching Garden A features for public access:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get Garden A statistics (public)
router.get('/statistics', async (req, res) => {
  try {
    const stats = await GardenA.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          graves: { $sum: { $cond: [{ $eq: ['$type', 'grave'] }, 1, 0] } },
          niches: { $sum: { $cond: [{ $eq: ['$type', 'niche'] }, 1, 0] } },
          available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
          occupied: { $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] } },
          reserved: { $sum: { $cond: [{ $eq: ['$status', 'reserved'] }, 1, 0] } }
        }
      }
    ]);
    
    const result = stats[0] || {
      total: 0,
      graves: 0,
      niches: 0,
      available: 0,
      occupied: 0,
      reserved: 0
    };
    
    res.json(result);
  } catch (err) {
    console.error('Error fetching Garden A statistics for public access:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get specific Garden A feature by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const feature = await GardenA.findOne({ featureId: req.params.id })
      .select('featureId type name row column graveRow graveColumn centerCoordinates bounds status sqm price');
    
    if (!feature) {
      return res.status(404).json({ msg: 'Feature not found' });
    }
    
    res.json(feature);
  } catch (err) {
    console.error('Error fetching Garden A feature for public access:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
