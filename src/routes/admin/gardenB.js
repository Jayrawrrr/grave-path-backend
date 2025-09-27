// backend/src/routes/admin/gardenB.js
import express from 'express';
import { protect } from '../../middleware/auth.js';
import GardenB from '../../models/GardenB.js';
import { gardenBData } from '../../data/gardenB.js';

const router = express.Router();

// Must be admin
router.use(protect(['admin']));

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Garden B API is working!' });
});

// Get all Garden B features
router.get('/', async (req, res) => {
  try {
    const { type, status, page = 1, limit = 100 } = req.query;
    
    // Build filter
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    const features = await GardenB.find(filter)
      .sort({ row: 1, column: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await GardenB.countDocuments(filter);
    
    res.json({
      features,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching Garden B features:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get Garden B statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await GardenB.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          graves: { $sum: { $cond: [{ $eq: ['$type', 'grave'] }, 1, 0] } },
          niches: { $sum: { $cond: [{ $eq: ['$type', 'niche'] }, 1, 0] } },
          available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
          occupied: { $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] } },
          reserved: { $sum: { $cond: [{ $eq: ['$status', 'reserved'] }, 1, 0] } },
          maintenance: { $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] } },
          unavailable: { $sum: { $cond: [{ $eq: ['$status', 'unavailable'] }, 1, 0] } }
        }
      }
    ]);
    
    res.json(stats[0] || {
      total: 0,
      graves: 0,
      niches: 0,
      available: 0,
      occupied: 0,
      reserved: 0,
      maintenance: 0,
      unavailable: 0
    });
  } catch (err) {
    console.error('Error fetching Garden B statistics:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get specific Garden B feature by ID
router.get('/:id', async (req, res) => {
  try {
    const feature = await GardenB.findById(req.params.id);
    
    if (!feature) {
      return res.status(404).json({ msg: 'Garden B feature not found' });
    }
    
    res.json(feature);
  } catch (err) {
    console.error('Error fetching Garden B feature:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update Garden B feature
router.put('/:id', async (req, res) => {
  try {
    const { status, name, birth, death } = req.body;
    
    const feature = await GardenB.findById(req.params.id);
    
    if (!feature) {
      return res.status(404).json({ msg: 'Garden B feature not found' });
    }
    
    // Update fields
    if (status) feature.status = status;
    if (name !== undefined) feature.name = name;
    if (birth !== undefined) feature.birth = birth;
    if (death !== undefined) feature.death = death;
    
    await feature.save();
    
    res.json(feature);
  } catch (err) {
    console.error('Error updating Garden B feature:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Import Garden B data from embedded GeoJSON
router.post('/import', async (req, res) => {
  try {
    // Use the data directly from the imported file
    const geoJsonData = gardenBData;
    
    console.log('Importing Garden B data:', geoJsonData?.features?.length || 0, 'features');
    
    if (!geoJsonData || !geoJsonData.features) {
      return res.status(400).json({ msg: 'Invalid GeoJSON data' });
    }
    
    // Clear existing Garden B data
    await GardenB.deleteMany({});
    console.log('Cleared existing Garden B data');
    
    const features = [];
    
    // Process each feature from GeoJSON
    for (const feature of geoJsonData.features) {
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
        
        const gardenBFeature = {
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
          source: 'Garden_B.geojson'
        };
        
        features.push(gardenBFeature);
      }
    }
    
    console.log(`Processing ${features.length} Garden B features...`);
    
    // Insert in batches
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < features.length; i += batchSize) {
      const batch = features.slice(i, i + batchSize);
      await GardenB.insertMany(batch);
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${features.length} Garden B features`);
    }
    
    res.json({
      msg: 'Garden B data imported successfully',
      imported: inserted,
      total: features.length
    });
    
  } catch (err) {
    console.error('Error importing Garden B data:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Clear all Garden B data
router.delete('/clear', async (req, res) => {
  try {
    const result = await GardenB.deleteMany({});
    
    res.json({
      msg: 'Garden B data cleared successfully',
      deleted: result.deletedCount
    });
  } catch (err) {
    console.error('Error clearing Garden B data:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;

