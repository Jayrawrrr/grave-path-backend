import express from 'express';
import ColumbariumSlot from '../../models/ColumbariumSlot.js';
import ColumbariumReservation from '../../models/ColumbariumReservation.js';
import auth from '../../middleware/auth.js';

const router = express.Router();

// Get available slots for browsing
router.get('/slots', auth, async (req, res) => {
  try {
    const { section, level, slotType, minPrice, maxPrice } = req.query;
    const filter = { status: 'available' };
    
    if (section) filter.section = section;
    if (level) filter.level = level;
    if (slotType) filter.slotType = slotType;
    
    if (minPrice || maxPrice) {
      filter['pricing.basePrice'] = {};
      if (minPrice) filter['pricing.basePrice'].$gte = Number(minPrice);
      if (maxPrice) filter['pricing.basePrice'].$lte = Number(maxPrice);
    }

    const slots = await ColumbariumSlot.find(filter)
      .sort({ section: 1, row: 1, column: 1 });
    res.json(slots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single slot details
router.get('/slots/:id', auth, async (req, res) => {
  try {
    const slot = await ColumbariumSlot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    res.json(slot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new reservation
router.post('/reservations', auth, async (req, res) => {
  try {
    const { slotId, deceasedInfo, urnDetails, leaseInfo, documents } = req.body;
    
    // Check if slot is available
    const slot = await ColumbariumSlot.findById(slotId);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    if (slot.status !== 'available') {
      return res.status(400).json({ message: 'Slot is not available' });
    }

    // Create reservation
    const reservation = new ColumbariumReservation({
      slotId,
      clientId: req.user.id,
      deceasedInfo,
      urnDetails,
      leaseInfo,
      documents: documents || [],
      paymentInfo: {
        totalAmount: slot.pricing.basePrice + slot.pricing.maintenanceFee
      }
    });

    await reservation.save();

    // Update slot status to reserved
    slot.status = 'reserved';
    await slot.save();

    res.status(201).json(reservation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get client's reservations
router.get('/reservations', auth, async (req, res) => {
  try {
    const reservations = await ColumbariumReservation.find({ clientId: req.user.id })
      .populate('slotId', 'slotId section row column level slotType pricing')
      .sort({ createdAt: -1 });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single reservation
router.get('/reservations/:id', auth, async (req, res) => {
  try {
    const reservation = await ColumbariumReservation.findOne({
      _id: req.params.id,
      clientId: req.user.id
    }).populate('slotId', 'slotId section row column level slotType pricing');
    
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update reservation
router.put('/reservations/:id', auth, async (req, res) => {
  try {
    const reservation = await ColumbariumReservation.findOneAndUpdate(
      { _id: req.params.id, clientId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    res.json(reservation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Cancel reservation
router.put('/reservations/:id/cancel', auth, async (req, res) => {
  try {
    const reservation = await ColumbariumReservation.findOne({
      _id: req.params.id,
      clientId: req.user.id
    });
    
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    if (reservation.status === 'active') {
      return res.status(400).json({ message: 'Cannot cancel active reservation' });
    }

    // Update reservation status
    reservation.status = 'cancelled';
    await reservation.save();

    // Update slot status back to available
    const slot = await ColumbariumSlot.findOne({ slotId: reservation.slotId });
    if (slot) {
      slot.status = 'available';
      await slot.save();
    }

    res.json(reservation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get available sections and levels for filtering
router.get('/filters', auth, async (req, res) => {
  try {
    const sections = await ColumbariumSlot.distinct('section');
    const levels = await ColumbariumSlot.distinct('level');
    const slotTypes = await ColumbariumSlot.distinct('slotType');
    
    const priceRange = await ColumbariumSlot.aggregate([
      {
        $group: {
          _id: null,
          minPrice: { $min: '$pricing.basePrice' },
          maxPrice: { $max: '$pricing.basePrice' }
        }
      }
    ]);

    res.json({
      sections,
      levels,
      slotTypes,
      priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
