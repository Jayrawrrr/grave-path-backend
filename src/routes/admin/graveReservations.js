// backend/src/routes/admin/graveReservations.js
import express from 'express';
import GraveReservation from '../../models/GraveReservation.js';
import GardenA from '../../models/GardenA.js';
import Lot from '../../models/Lot.js';
import { protect } from '../../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/proof-payments/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'proof-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// GET /api/admin/grave-reservations - Get all grave reservations
router.get('/', protect(['admin', 'staff']), async (req, res) => {
  try {
    const { status, garden, page = 1, limit = 50 } = req.query;
    
    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (garden) filter.garden = garden;
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    const reservations = await GraveReservation.find(filter)
      .populate('clientId', 'firstName lastName email phone')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await GraveReservation.countDocuments(filter);
    
    res.json({
      reservations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching grave reservations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/admin/grave-reservations/statistics - Get reservation statistics
router.get('/statistics', protect(['admin', 'staff']), async (req, res) => {
  try {
    const stats = await GraveReservation.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
        }
      }
    ]);
    
    const result = stats[0] || {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0
    };
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching grave reservation statistics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/admin/grave-reservations/:id - Get specific reservation
router.get('/:id', protect(['admin', 'staff']), async (req, res) => {
  try {
    const reservation = await GraveReservation.findById(req.params.id)
      .populate('clientId', 'firstName lastName email phone')
      .populate('approvedBy', 'firstName lastName');
    
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    res.json(reservation);
  } catch (error) {
    console.error('Error fetching grave reservation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/admin/grave-reservations - Create grave reservation (admin/staff)
router.post('/', protect(['admin', 'staff']), upload.single('proofImage'), async (req, res) => {
  try {
    const {
      graveId,
      garden,
      row,
      column,
      clientName,
      clientContact,
      clientEmail,
      deceasedName,
      deceasedDateOfBirth,
      deceasedDateOfDeath,
      deceasedRelationship,
      paymentMethod,
      paymentAmount,
      specialRequirements,
      staffNotes
    } = req.body;

    // Verify grave exists and is available
    let grave;
    if (garden === 'A') {
      grave = await GardenA.findOne({ 
        type: 'grave',
        row: parseInt(row),
        column: parseInt(column)
      });
    } else {
      grave = await Lot.findOne({ id: graveId });
    }
    
    if (!grave) {
      return res.status(404).json({ message: 'Grave not found' });
    }
    
    if (grave.status !== 'available') {
      return res.status(400).json({ message: 'Grave is not available' });
    }

    // Create reservation
    const reservation = new GraveReservation({
      graveId,
      garden,
      row: parseInt(row),
      column: parseInt(column),
      clientId: req.user.id,
      staffId: req.user.id,
      reservationType: req.user.role,
      clientName,
      clientContact,
      clientEmail,
      deceasedInfo: {
        name: deceasedName,
        dateOfBirth: new Date(deceasedDateOfBirth),
        dateOfDeath: new Date(deceasedDateOfDeath),
        relationship: deceasedRelationship
      },
      paymentMethod,
      paymentAmount: parseFloat(paymentAmount),
      totalPrice: grave.price || 8000,
      specialRequirements,
      staffNotes,
      proofImage: req.file ? req.file.path.replace(/\\/g, '/') : null
    });

    await reservation.save();

    // Update grave status (auto-approved for staff/admin)
    grave.status = 'reserved';
    await grave.save();

    res.status(201).json({
      message: 'Reservation created successfully',
      reservation
    });
  } catch (error) {
    console.error('Error creating grave reservation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT /api/admin/grave-reservations/:id/status - Update reservation status
router.put('/:id/status', protect(['admin', 'staff']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    
    const reservation = await GraveReservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    const oldStatus = reservation.status;
    reservation.status = status;
    
    if (status === 'approved') {
      reservation.approvedBy = req.user.id;
      reservation.approvedAt = new Date();
    } else if (status === 'rejected') {
      reservation.rejectionReason = rejectionReason;
    }
    
    await reservation.save();
    
    // Update grave status based on reservation status
    let grave;
    if (reservation.garden === 'A') {
      grave = await GardenA.findOne({ 
        type: 'grave',
        row: reservation.row,
        column: reservation.column
      });
    } else {
      grave = await Lot.findOne({ id: reservation.graveId });
    }
    
    if (grave) {
      if (status === 'approved') {
        grave.status = 'reserved';
      } else if (status === 'rejected' || status === 'cancelled') {
        // Revert grave to available only if no other approved reservations exist
        const otherApprovedReservations = await GraveReservation.findOne({
          graveId: reservation.graveId,
          _id: { $ne: reservation._id },
          status: 'approved'
        });
        
        if (!otherApprovedReservations) {
          grave.status = 'available';
        }
      }
      await grave.save();
    }
    
    res.json({
      message: `Reservation ${status} successfully`,
      reservation,
      graveStatusUpdated: grave ? grave.status : null
    });
  } catch (error) {
    console.error('Error updating reservation status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /api/admin/grave-reservations/:id - Delete reservation
router.delete('/:id', protect(['admin']), async (req, res) => {
  try {
    const reservation = await GraveReservation.findById(req.params.id);
    
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    // Revert grave status to available
    let grave;
    if (reservation.garden === 'A') {
      grave = await GardenA.findOne({ 
        type: 'grave',
        row: reservation.row,
        column: reservation.column
      });
    } else {
      grave = await Lot.findOne({ id: reservation.graveId });
    }
    
    if (grave) {
      // Only revert if no other approved reservations exist
      const otherApprovedReservations = await GraveReservation.findOne({
        graveId: reservation.graveId,
        _id: { $ne: reservation._id },
        status: 'approved'
      });
      
      if (!otherApprovedReservations) {
        grave.status = 'available';
        await grave.save();
      }
    }
    
    await GraveReservation.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Reservation deleted successfully' });
  } catch (error) {
    console.error('Error deleting grave reservation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
