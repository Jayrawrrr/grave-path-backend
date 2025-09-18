// backend/src/routes/admin/gardenA.js
import express from 'express';
import GardenA from '../../models/GardenA.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

// Must be admin (except for import route)
router.use((req, res, next) => {
  if (req.path === '/import') {
    return next(); // Skip auth for import
  }
  return protect(['admin'])(req, res, next);
});

// Get all Garden A features
router.get('/', async (req, res) => {
  try {
    const { type, status, page = 1, limit = 100 } = req.query;
    
    // Build filter
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    const features = await GardenA.find(filter)
      .sort({ row: 1, column: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await GardenA.countDocuments(filter);
    
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
    console.error('Error fetching Garden A features:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get Garden A statistics
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
          reserved: { $sum: { $cond: [{ $eq: ['$status', 'reserved'] }, 1, 0] } },
          maintenance: { $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] } },
          unavailable: { $sum: { $cond: [{ $eq: ['$status', 'unavailable'] }, 1, 0] } }
        }
      }
    ]);
    
    const result = stats[0] || {
      total: 0,
      graves: 0,
      niches: 0,
      available: 0,
      occupied: 0,
      reserved: 0,
      maintenance: 0,
      unavailable: 0
    };
    
    res.json(result);
  } catch (err) {
    console.error('Error fetching Garden A statistics:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get specific Garden A feature by ID
router.get('/:id', async (req, res) => {
  try {
    const feature = await GardenA.findOne({ featureId: req.params.id });
    
    if (!feature) {
      return res.status(404).json({ msg: 'Feature not found' });
    }
    
    res.json(feature);
  } catch (err) {
    console.error('Error fetching Garden A feature:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update Garden A feature status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['available', 'occupied', 'reserved', 'maintenance', 'unavailable'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }
    
    const feature = await GardenA.findOneAndUpdate(
      { featureId: req.params.id },
      { 
        status,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!feature) {
      return res.status(404).json({ msg: 'Feature not found' });
    }
    
    res.json(feature);
  } catch (err) {
    console.error('Error updating Garden A feature status:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update Garden A feature details
router.patch('/:id', async (req, res) => {
  try {
    const allowedUpdates = ['name', 'birth', 'death', 'status', 'price'];
    const updates = {};
    
    // Only allow specific fields to be updated
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });
    
    updates.updatedAt = new Date();
    
    const feature = await GardenA.findOneAndUpdate(
      { featureId: req.params.id },
      updates,
      { new: true }
    );
    
    if (!feature) {
      return res.status(404).json({ msg: 'Feature not found' });
    }
    
    res.json(feature);
  } catch (err) {
    console.error('Error updating Garden A feature:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Import Garden A data from GeoJSON
router.post('/import', async (req, res) => {
  try {

    // Read the Garden A GeoJSON file directly
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const geoJsonPath = path.join(__dirname, '../../../staff-dashboard/public/data/Garden_A.geojson');
    console.log('Looking for GeoJSON file at:', geoJsonPath);
    
    if (!fs.existsSync(geoJsonPath)) {
      console.error('GeoJSON file not found at:', geoJsonPath);
      return res.status(400).json({ msg: 'Garden A GeoJSON file not found' });
    }
    
    const geoJsonData = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));
    
    if (!geoJsonData || !geoJsonData.features) {
      return res.status(400).json({ msg: 'Invalid GeoJSON data' });
    }
    
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
    
    // Insert in batches
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < features.length; i += batchSize) {
      const batch = features.slice(i, i + batchSize);
      await GardenA.insertMany(batch);
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${features.length} Garden A features`);
    }
    
    res.json({
      message: `Successfully imported ${features.length} Garden A features`,
      count: features.length,
      graves: features.filter(f => f.type === 'grave').length,
      niches: features.filter(f => f.type === 'niche').length
    });
    
  } catch (err) {
    console.error('Error importing Garden A data:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Clear all Garden A data
router.delete('/clear', async (req, res) => {
  try {
    const result = await GardenA.deleteMany({});
    
    res.json({
      message: `Cleared ${result.deletedCount} Garden A features`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('Error clearing Garden A data:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
