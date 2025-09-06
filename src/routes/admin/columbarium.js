import express from 'express';
import ColumbariumSlot from '../../models/ColumbariumSlot.js';
import ColumbariumReservation from '../../models/ColumbariumReservation.js';
import auth from '../../middleware/auth.js';

const router = express.Router();

// Get all columbarium slots with filters
router.get('/slots', auth, async (req, res) => {
  try {
    const { section, level, status, slotType } = req.query;
    const filter = {};
    
    if (section) filter.section = section;
    if (level) filter.level = level;
    if (status) filter.status = status;
    if (slotType) filter.slotType = slotType;

    const slots = await ColumbariumSlot.find(filter).sort({ section: 1, row: 1, column: 1 });
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

// Create new slot
router.post('/slots', auth, async (req, res) => {
  try {
    const slot = new ColumbariumSlot(req.body);
    await slot.save();
    res.status(201).json(slot);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Create multiple slots (bulk creation)
router.post('/slots/bulk', auth, async (req, res) => {
  try {
    const { slots } = req.body;
    const createdSlots = await ColumbariumSlot.insertMany(slots);
    res.status(201).json(createdSlots);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update slot
router.put('/slots/:id', auth, async (req, res) => {
  try {
    const slot = await ColumbariumSlot.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    res.json(slot);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete slot
router.delete('/slots/:id', auth, async (req, res) => {
  try {
    const slot = await ColumbariumSlot.findByIdAndDelete(req.params.id);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    res.json({ message: 'Slot deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all reservations
router.get('/reservations', auth, async (req, res) => {
  try {
    const { status, slotId } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (slotId) filter.slotId = slotId;

    const reservations = await ColumbariumReservation.find(filter)
      .populate('clientId', 'firstName lastName email')
      .sort({ createdAt: -1 });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single reservation
router.get('/reservations/:id', auth, async (req, res) => {
  try {
    const reservation = await ColumbariumReservation.findById(req.params.id)
      .populate('clientId', 'firstName lastName email phone');
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update reservation status
router.put('/reservations/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const reservation = await ColumbariumReservation.findByIdAndUpdate(
      req.params.id,
      { status },
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

// Get columbarium statistics
router.get('/statistics', auth, async (req, res) => {
  try {
    const totalSlots = await ColumbariumSlot.countDocuments();
    const availableSlots = await ColumbariumSlot.countDocuments({ status: 'available' });
    const reservedSlots = await ColumbariumSlot.countDocuments({ status: 'reserved' });
    const occupiedSlots = await ColumbariumSlot.countDocuments({ status: 'occupied' });
    
    const totalReservations = await ColumbariumReservation.countDocuments();
    const pendingReservations = await ColumbariumReservation.countDocuments({ status: 'pending' });
    const activeReservations = await ColumbariumReservation.countDocuments({ status: 'active' });

    res.json({
      slots: {
        total: totalSlots,
        available: availableSlots,
        reserved: reservedSlots,
        occupied: occupiedSlots
      },
      reservations: {
        total: totalReservations,
        pending: pendingReservations,
        active: activeReservations
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
