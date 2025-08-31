import express from 'express';
import Reservation from '../../models/Reservation.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    // Only include approved reservations (these are the ones that generate revenue)
    const reservations = await Reservation.find({ status: 'approved' });
    const records = reservations.map(r => ({
      _id: r._id,
      date: r.createdAt || r.date,
      description: `Reservation by ${r.clientName} for Lot ${r.lotId} (${r.paymentMethod})`,
      amount: parseFloat(r.paymentAmount) || 0
    }));
    res.json(records);
  } catch (err) {
    console.error('Financial report error:', err);
    res.status(500).json({ msg: 'Failed to fetch financial report', error: err.message });
  }
});

export default router;



