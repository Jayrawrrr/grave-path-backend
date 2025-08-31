// routes/staff/reservations.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import Reservation from '../../models/Reservation.js';
import Lot from '../../models/Lot.js';
import { protect } from '../../middleware/auth.js';
import ActivityLog from '../../models/ActivityLogs.js';

const router = express.Router();
router.use(protect(['staff', 'admin', 'client']));

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: './uploads/proofs',
  filename: function(req, file, cb) {
    cb(null, 'proof-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5000000 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    checkFileType(file, cb);
  }
});

// Check file type
function checkFileType(file, cb) {
  // Allowed extensions
  const filetypes = /jpeg|jpg|png|gif/;
  // Check extension
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images Only!');
  }
}

// Get all reservations
router.get('/', async (req, res) => {
  try {
    const reservations = await Reservation.find();
    res.json(reservations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create new reservation with file upload
router.post('/', upload.single('proofImage'), async (req, res) => {
  try {
    const {
      lotId,
      lotName,
      date,
      clientName,
      clientContact,
      paymentMethod,
      paymentAmount,
      totalPrice,
      sqm,
      location
    } = req.body;

    // Create reservation object
    const reservationData = {
      lotId,
      lotName,
      date,
      clientName,
      clientContact,
      clientId: req.user.id, // Use the authenticated user's ID
      staffId: req.user.id, // Add staffId since this is a staff booking
      paymentMethod,
      paymentAmount,
      totalPrice: totalPrice || paymentAmount, // Use totalPrice if provided, fallback to paymentAmount
      status: 'approved', // Staff reservations are automatically approved
      sqm,
      location,
      payment: {
        method: paymentMethod,
        amount: paymentAmount,
        status: 'approved' // Also approve the payment status
      }
    };

    // Add proof if file was uploaded
    if (req.file) {
      reservationData.proofImage = req.file.path;
    }

    const reservation = await Reservation.create(reservationData);

    // Update lot status
    await Lot.findOneAndUpdate(
      { id: lotId },
      { status: 'reserved' }
    );

    // Only write an ActivityLog if we actually have a userId
    if (req.user && req.user._id) {
      await ActivityLog.create({
        userId:   req.user._id,
        userName: req.user.name  || clientName,
        userRole: req.user.role  || 'client',
        action:   'booking',
        details:  `Booked plot ${lotId}`
      });
    }

    res.status(201).json(reservation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Update reservation status
router.patch('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({ msg: 'Reservation not found' });
    }

    reservation.status = status;
    
    // Update lot status based on reservation status
    if (status === 'confirmed') {
      await Lot.findOneAndUpdate(
        { id: reservation.lotId },
        { status: 'unavailable' }
      );
    } else if (status === 'cancelled' || status === 'declined') {
      await Lot.findOneAndUpdate(
        { id: reservation.lotId },
        { status: 'available' }
      );
    }

    await reservation.save();

    if (req.user && req.user._id) {
      await ActivityLog.create({
        userId:   req.user._id,
        userName: req.user.name  || 'Unknown User',
        userRole: req.user.role  || 'client',
        action:   'update',
        details:  `Updated reservation ${req.params.id}`
      });
    }

    res.json(reservation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete reservation
router.delete('/:id', async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({ msg: 'Reservation not found' });
    }

    // Update lot status back to available
    await Lot.findOneAndUpdate(
      { id: reservation.lotId },
      { status: 'available' }
    );

    await reservation.remove();

    if (req.user && req.user._id) {
      await ActivityLog.create({
        userId:   req.user._id,
        userName: req.user.name  || 'Unknown User',
        userRole: req.user.role  || 'client',
        action:   'delete',
        details:  `Deleted reservation ${req.params.id}`
      });
    }

    res.json({ msg: 'Reservation removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get proof image
router.get('/:id/proof', async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation || !reservation.proofImage) {
      return res.status(404).json({ msg: 'Proof not found' });
    }
    res.sendFile(path.resolve(reservation.proofImage));
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
