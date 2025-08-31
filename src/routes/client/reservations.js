// routes/client/reservations.js
import express from 'express';
import Reservation from '../../models/Reservation.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

// Protect all routes - must be logged in as client
router.use(protect(['client']));

// Get all reservations for the current client
router.get('/', async (req, res) => {
  try {
    // Filter reservations by the current client's ID
    const reservations = await Reservation.find({ clientId: req.user.id });
    res.json(reservations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router; 