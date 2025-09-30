// backend/src/routes/admin/gardenD.js
import express from 'express';
import { protect } from '../../middleware/auth.js';
import GardenD from '../../models/GardenD.js';
import { gardenDData } from '../../data/gardenD.js';

const router = express.Router();

// Must be admin
router.use(protect(['admin']));

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Garden D API is working!' });
});

// Get all Garden D features
router.get('/', async (req, res) => {
  try {
    const { type, status, page = 1, limit = 100 } = req.query;
    
    // Build filter
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    const features = await GardenD.find(filter)
      .sort({ row: 1, column: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await GardenD.countDocuments(filter);
    
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
    console.error('Error fetching Garden D features:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get Garden D statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await GardenD.aggregate([
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
    console.error('Error fetching Garden D statistics:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get specific Garden D feature by ID
router.get('/:id', async (req, res) => {
  try {
    const feature = await GardenD.findOne({ featureId: req.params.id });
    
    if (!feature) {
      return res.status(404).json({ msg: 'Garden D feature not found' });
    }
    
    res.json(feature);
  } catch (err) {
    console.error('Error fetching Garden D feature:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update Garden D feature status (PATCH for status only)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['available', 'occupied', 'reserved', 'maintenance', 'unavailable'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }
    
    const feature = await GardenD.findOneAndUpdate(
      { featureId: req.params.id },
      { 
        status,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!feature) {
      return res.status(404).json({ msg: 'Garden D feature not found' });
    }
    
    res.json(feature);
  } catch (err) {
    console.error('Error updating Garden D feature status:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update Garden D feature
router.put('/:id', async (req, res) => {
  try {
    const { status, name, birth, death } = req.body;
    
    const feature = await GardenD.findById(req.params.id);
    
    if (!feature) {
      return res.status(404).json({ msg: 'Garden D feature not found' });
    }
    
    // Update fields
    if (status) feature.status = status;
    if (name !== undefined) feature.name = name;
    if (birth !== undefined) feature.birth = birth;
    if (death !== undefined) feature.death = death;
    
    await feature.save();
    
    res.json(feature);
  } catch (err) {
    console.error('Error updating Garden D feature:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Import Garden D data from embedded GeoJSON
router.post('/import', async (req, res) => {
  try {
    // Use the data directly from the imported file
    const geoJsonData = gardenDData;
    
    console.log('Importing Garden D data:', geoJsonData?.features?.length || 0, 'features');
    
    if (!geoJsonData || !geoJsonData.features) {
      return res.status(400).json({ msg: 'Invalid GeoJSON data' });
    }
    
    // Clear existing Garden D data
    await GardenD.deleteMany({});
    console.log('Cleared existing Garden D data');
    
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
        
        const gardenDFeature = {
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
          source: 'Garden_D.geojson'
        };
        
        features.push(gardenDFeature);
      }
    }
    
    console.log(`Processing ${features.length} Garden D features...`);
    
    // Insert in batches
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < features.length; i += batchSize) {
      const batch = features.slice(i, i + batchSize);
      await GardenD.insertMany(batch);
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${features.length} Garden D features`);
    }
    
    res.json({
      msg: 'Garden D data imported successfully',
      imported: inserted,
      total: features.length
    });
    
  } catch (err) {
    console.error('Error importing Garden D data:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Clear all Garden D data
router.delete('/clear', async (req, res) => {
  try {
    const result = await GardenD.deleteMany({});
    
    res.json({
      msg: 'Garden D data cleared successfully',
      deleted: result.deletedCount
    });
  } catch (err) {
    console.error('Error clearing Garden D data:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;



