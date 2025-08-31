import express from 'express';
import Announcement from '../../models/Announcement.js';

const router = express.Router();

// Get all announcements (latest first)
router.get('/', async (_req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

export default router;
