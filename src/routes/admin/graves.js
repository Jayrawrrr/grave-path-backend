// backend/src/routes/admin/graves.js
import express from 'express';
import Lot from '../../models/Lot.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

// Must be admin
router.use(protect(['admin']));

// Garden configuration based on your GeoJSON data
const GARDEN_CONFIG = {
  A: {
    name: 'Garden A',
    bounds: {
      north: 14.53879,
      south: 14.538394,
      east: 121.069888,
      west: 121.069403
    },
    rows: 25,
    columns: 25,
    totalGraves: 625
  },
  B: {
    name: 'Garden B',
    bounds: {
      north: 14.538777,
      south: 14.53839,
      east: 121.070611,
      west: 121.069928
    },
    rows: 29,
    columns: 30,
    totalGraves: 870
  },
  C: {
    name: 'Garden C',
    bounds: {
      north: 14.538362,
      south: 14.538103,
      east: 121.071787,
      west: 121.070769
    },
    rows: 19,
    columns: 45,
    totalGraves: 855
  }
};

// Get garden configuration
router.get('/config', (req, res) => {
  res.json(GARDEN_CONFIG);
});

// Get all graves in a specific garden
router.get('/garden/:garden', async (req, res) => {
  try {
    const { garden } = req.params;
    
    if (!GARDEN_CONFIG[garden]) {
      return res.status(400).json({ msg: 'Invalid garden. Must be A, B, or C' });
    }

    const graves = await Lot.find({ garden }).sort({ row: 1, column: 1 });
    
    // Get status counts
    const statusCounts = await Lot.aggregate([
      { $match: { garden } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const totalGraves = graves.length;
    const availableGraves = statusCounts.find(s => s._id === 'available')?.count || 0;
    const occupiedGraves = statusCounts.find(s => s._id === 'occupied')?.count || 0;
    const reservedGraves = statusCounts.find(s => s._id === 'reserved')?.count || 0;
    const maintenanceGraves = statusCounts.find(s => s._id === 'maintenance')?.count || 0;

    res.json({
      garden: GARDEN_CONFIG[garden],
      graves,
      statistics: {
        total: totalGraves,
        available: availableGraves,
        occupied: occupiedGraves,
        reserved: reservedGraves,
        maintenance: maintenanceGraves,
        capacity: GARDEN_CONFIG[garden].totalGraves
      }
    });
  } catch (err) {
    console.error('Error fetching garden graves:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get specific grave by ID
router.get('/:id', async (req, res) => {
  try {
    const grave = await Lot.findOne({ id: req.params.id });
    
    if (!grave) {
      return res.status(404).json({ msg: 'Grave not found' });
    }
    
    res.json(grave);
  } catch (err) {
    console.error('Error fetching grave:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create a new grave
router.post('/', async (req, res) => {
  try {
    const { garden, row, column, name, birth, death, status = 'available' } = req.body;
    
    // Validate garden
    if (!GARDEN_CONFIG[garden]) {
      return res.status(400).json({ msg: 'Invalid garden. Must be A, B, or C' });
    }
    
    // Validate row and column
    const config = GARDEN_CONFIG[garden];
    if (row < 1 || row > config.rows) {
      return res.status(400).json({ msg: `Row must be between 1 and ${config.rows}` });
    }
    if (column < 1 || column > config.columns) {
      return res.status(400).json({ msg: `Column must be between 1 and ${config.columns}` });
    }
    
    // Generate grave ID
    const id = `${garden}-${row}-${column}`;
    
    // Check if grave already exists
    const existingGrave = await Lot.findOne({ id });
    if (existingGrave) {
      return res.status(400).json({ msg: 'Grave already exists' });
    }
    
    // Calculate coordinates based on grid position
    const coordinates = calculateGraveCoordinates(garden, row, column);
    
    // Create grave
    const grave = new Lot({
      id,
      garden,
      row,
      column,
      coordinates,
      name: name || '',
      birth: birth || '',
      death: death || '',
      status,
      location: `${config.name} - Row ${row}, Column ${column}`,
      price: 8000 // Default price
    });
    
    await grave.save();
    res.status(201).json(grave);
  } catch (err) {
    console.error('Error creating grave:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update grave
router.put('/:id', async (req, res) => {
  try {
    const { name, birth, death, status, family, maintenance } = req.body;
    
    const grave = await Lot.findOneAndUpdate(
      { id: req.params.id },
      { 
        name, 
        birth, 
        death, 
        status,
        family,
        maintenance,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    if (!grave) {
      return res.status(404).json({ msg: 'Grave not found' });
    }
    
    res.json(grave);
  } catch (err) {
    console.error('Error updating grave:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete grave
router.delete('/:id', async (req, res) => {
  try {
    const grave = await Lot.findOneAndDelete({ id: req.params.id });
    
    if (!grave) {
      return res.status(404).json({ msg: 'Grave not found' });
    }
    
    res.json({ msg: 'Grave deleted successfully' });
  } catch (err) {
    console.error('Error deleting grave:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Bulk operations
router.post('/bulk', async (req, res) => {
  try {
    const { operation, garden, data } = req.body;
    
    if (!GARDEN_CONFIG[garden]) {
      return res.status(400).json({ msg: 'Invalid garden' });
    }
    
    let result;
    
    switch (operation) {
      case 'createGrid':
        result = await createGardenGrid(garden);
        break;
      case 'updateStatus':
        result = await bulkUpdateStatus(garden, data);
        break;
      case 'clearGarden':
        result = await clearGarden(garden);
        break;
      default:
        return res.status(400).json({ msg: 'Invalid operation' });
    }
    
    res.json(result);
  } catch (err) {
    console.error('Error in bulk operation:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Helper function to calculate grave coordinates
function calculateGraveCoordinates(garden, row, column) {
  const config = GARDEN_CONFIG[garden];
  const { bounds, rows, columns } = config;
  
  // Calculate spacing
  const latSpacing = (bounds.north - bounds.south) / rows;
  const lngSpacing = (bounds.east - bounds.west) / columns;
  
  // Calculate center point (0-based indexing)
  const centerLat = bounds.south + ((row - 1) * latSpacing) + (latSpacing / 2);
  const centerLng = bounds.west + ((column - 1) * lngSpacing) + (lngSpacing / 2);
  
  return {
    type: 'Point',
    coordinates: [centerLng, centerLat]
  };
}

// Helper function to create entire garden grid
async function createGardenGrid(garden) {
  const config = GARDEN_CONFIG[garden];
  const graves = [];
  
  // Clear existing graves in this garden
  await Lot.deleteMany({ garden });
  
  // Create all graves in the grid
  for (let row = 1; row <= config.rows; row++) {
    for (let column = 1; column <= config.columns; column++) {
      const id = `${garden}-${row}-${column}`;
      const coordinates = calculateGraveCoordinates(garden, row, column);
      
      graves.push({
        id,
        garden,
        row,
        column,
        coordinates,
        status: 'available',
        location: `${config.name} - Row ${row}, Column ${column}`,
        price: 8000
      });
    }
  }
  
  const result = await Lot.insertMany(graves);
  return {
    message: `Created ${result.length} graves in ${config.name}`,
    count: result.length
  };
}

// Helper function for bulk status updates
async function bulkUpdateStatus(garden, data) {
  const { status, graveIds } = data;
  
  const result = await Lot.updateMany(
    { garden, id: { $in: graveIds } },
    { status, updatedAt: new Date() }
  );
  
  return {
    message: `Updated ${result.modifiedCount} graves to ${status}`,
    modifiedCount: result.modifiedCount
  };
}

// Helper function to clear garden
async function clearGarden(garden) {
  const result = await Lot.deleteMany({ garden });
  
  return {
    message: `Cleared ${result.deletedCount} graves from Garden ${garden}`,
    deletedCount: result.deletedCount
  };
}

export default router;








