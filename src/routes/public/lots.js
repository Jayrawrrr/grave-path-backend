import express from 'express';
import Lot from '../../models/Lot.js';

const router = express.Router();

// Public endpoint to get lots without authentication
// Used by guest users to view plot availability and map data
router.get('/', async (req, res) => {
  try {
    const lots = await Lot.find();
    res.json(lots);
  } catch (err) {
    console.error('Error fetching lots for public access:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Public endpoint to get lot availability without authentication
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
    console.error('Error fetching lot availability for public access:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router; 