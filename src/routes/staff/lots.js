import express     from 'express';
import Lot         from '../../models/Lot.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

// must be staff or admin
router.use(protect(['staff','admin']));

router.get('/', async (req, res) => {
  try {
    const lots = await Lot.find();
    res.json(lots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.id) {
      return res.status(400).json({ msg: 'Lot ID is required' });
    }
    
    if (!req.body.bounds || !Array.isArray(req.body.bounds) || req.body.bounds.length !== 2) {
      return res.status(400).json({ msg: 'Invalid bounds format' });
    }

    // Create the lot
    const lot = await Lot.create(req.body);
    res.status(201).json(lot);
  } catch (err) {
    console.error('Error creating lot:', {
      error: err.message,
      code: err.code,
      name: err.name,
      stack: err.stack
    });
    
    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({ msg: 'A lot with this ID already exists' });
    }
    
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Update a lot by ID
router.put('/:id', async (req, res) => {
  try {
    const lot = await Lot.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!lot) {
      return res.status(404).json({ msg: 'Lot not found' });
    }
    
    res.json(lot);
  } catch (err) {
    console.error('Error updating lot:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete a lot by ID
router.delete('/:id', async (req, res) => {
  try {
    const lot = await Lot.findByIdAndDelete(req.params.id);
    
    if (!lot) {
      return res.status(404).json({ msg: 'Lot not found' });
    }
    
    res.json({ msg: 'Lot deleted' });
  } catch (err) {
    console.error('Error deleting lot:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Seed initial dummy plots
router.post('/seed', async (req, res) => {
  try {
    const dummyPlots = [
      {
        id: 'A1',
        name: 'Plot A1',
        status: 'available',
        bounds: [[0.4, 0.4], [0.41, 0.41]],
        sqm: 12.5,
        location: 'East, near Main Gate'
      },
      {
        id: 'A2',
        name: 'Plot A2',
        status: 'available',
        bounds: [[0.4, 0.45], [0.41, 0.46]],
        sqm: 12.5,
        location: 'East, near Main Gate'
      },
      {
        id: 'B1',
        name: 'Plot B1',
        status: 'available',
        bounds: [[0.45, 0.4], [0.46, 0.41]],
        sqm: 12.5,
        location: 'West, beside Chapel'
      },
      {
        id: 'B2',
        name: 'Plot B2',
        status: 'available',
        bounds: [[0.45, 0.45], [0.46, 0.46]],
        sqm: 12.5,
        location: 'West, beside Chapel'
      }
    ];

    // Clear existing lots first
    await Lot.deleteMany({});
    
    // Insert the dummy plots
    const created = await Lot.insertMany(dummyPlots);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Failed to seed lots', error: err.message });
  }
});

router.get('/availability', async (req, res) => {
  try {
    // Get all lots from database
    const lots = await Lot.find();
    
    // Get custom lots from request if any
    const customLots = req.query.customLots ? JSON.parse(req.query.customLots) : [];
    
    // Combine database lots with custom lots
    const allLots = [...lots, ...customLots];
    
    res.json(allLots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
