// backend/src/routes/client/graveReservations.js
import express from 'express';
import GraveReservation from '../../models/GraveReservation.js';
import GardenA from '../../models/GardenA.js';
import Lot from '../../models/Lot.js';
import { protect } from '../../middleware/auth.js';
import { sendReservationConfirmation } from '../../utils/emailService.js';
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG) and PDF are allowed!'));
    }
  }
});

// POST /api/client/grave-reservations - Create grave reservation (client)
router.post('/', protect(['client']), upload.single('proofImage'), async (req, res) => {
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
      specialRequirements
    } = req.body;

    // Validate required payment proof
    if (!req.file) {
      return res.status(400).json({ message: 'Payment proof is required for client reservations' });
    }

    // Verify grave exists and is available
    let grave;
    if (garden === 'A') {
      grave = await GardenA.findOne({ 
        type: 'grave',
        row: parseInt(row),
        column: parseInt(column)
      });
    } else if (garden === 'B') {
      const GardenB = (await import('../../models/GardenB.js')).default;
      grave = await GardenB.findOne({ 
        type: 'grave',
        row: parseInt(row),
        column: parseInt(column)
      });
    } else if (garden === 'C') {
      const GardenC = (await import('../../models/GardenC.js')).default;
      grave = await GardenC.findOne({ 
        type: 'grave',
        row: parseInt(row),
        column: parseInt(column)
      });
    } else if (garden === 'D') {
      const GardenD = (await import('../../models/GardenD.js')).default;
      grave = await GardenD.findOne({ 
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

    // Check if there's already a pending reservation for this grave
    const existingReservation = await GraveReservation.findOne({
      graveId,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingReservation) {
      return res.status(400).json({ message: 'This grave already has a pending or approved reservation' });
    }

    // Validate payment amount (accept reservation fee - 10% of total price)
    const paymentAmountNum = parseFloat(paymentAmount);
    const gravePrice = grave.price || 8000;
    const minimumReservationFee = gravePrice * 0.10; // 10% reservation fee
    
    if (paymentAmountNum < minimumReservationFee) {
      return res.status(400).json({ 
        message: `Payment amount must be at least ₱${minimumReservationFee} (10% reservation fee)` 
      });
    }

    // Create reservation
    const reservation = new GraveReservation({
      graveId,
      garden,
      row: parseInt(row),
      column: parseInt(column),
      clientId: req.user.id,
      reservationType: 'client',
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
      paymentAmount: paymentAmountNum,
      totalPrice: gravePrice,
      specialRequirements,
      proofImage: req.file.path.replace(/\\/g, '/').replace('uploads/', ''),
      status: 'pending' // Client reservations need approval
    });

    await reservation.save();

    // Update grave status to reserved (temporarily while pending approval)
    grave.status = 'reserved';
    await grave.save();

    // Send confirmation email
    try {
      await sendReservationConfirmation(clientEmail, {
        graveId,
        garden,
        row: parseInt(row),
        column: parseInt(column),
        clientName,
        status: 'pending'
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the reservation if email fails
    }

    res.status(201).json({
      message: 'Reservation submitted successfully. A confirmation email has been sent.',
      reservation: {
        _id: reservation._id,
        graveId: reservation.graveId,
        garden: reservation.garden,
        row: reservation.row,
        column: reservation.column,
        status: reservation.status,
        clientName: reservation.clientName,
        deceasedInfo: reservation.deceasedInfo,
        createdAt: reservation.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating grave reservation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/client/grave-reservations - Get client's grave reservations
router.get('/', protect(['client']), async (req, res) => {
  try {
    const reservations = await GraveReservation.find({ clientId: req.user.id })
      .sort({ createdAt: -1 });
    
    res.json(reservations);
  } catch (error) {
    console.error('Error fetching client grave reservations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/client/grave-reservations/:id - Get specific reservation
router.get('/:id', protect(['client']), async (req, res) => {
  try {
    const reservation = await GraveReservation.findOne({
      _id: req.params.id,
      clientId: req.user.id
    });
    
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    res.json(reservation);
  } catch (error) {
    console.error('Error fetching grave reservation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
