import express from 'express';
import VisitorInfo from '../../models/VisitorInfo.js';

const router = express.Router();

// Public endpoint to get visitor information without authentication
// Used by guest users to view visitor info (hours, rules, amenities)
router.get('/', async (req, res) => {
  try {
    // Get visitor information from database
    const visitorInfo = await VisitorInfo.getVisitorInfo();
    
    res.json({
      visitingHours: visitorInfo.visitingHours,
      rules: visitorInfo.rules,
      amenities: visitorInfo.amenities
    });
  } catch (err) {
    console.error('Error fetching visitor info for public access:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router; 