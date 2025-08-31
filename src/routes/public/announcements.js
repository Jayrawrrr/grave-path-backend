import express from 'express';
import Announcement from '../../models/Announcement.js';

const router = express.Router();

// Public endpoint to get announcements without authentication
// Used by guest users to view announcements and visitor info
router.get('/', async (req, res) => {
  try {
    // Get all announcements since there's no isActive field in the schema
    const announcements = await Announcement.find()
      .sort({ pinned: -1, createdAt: -1 })
      .limit(10); // Limit to 10 most recent announcements
    
    res.json(announcements);
  } catch (err) {
    console.error('Error fetching announcements for public access:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router; 