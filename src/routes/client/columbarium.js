import express from 'express';
import { protect } from '../../middleware/auth.js';
import { ColumbariumSlot, ColumbariumReservation } from '../../models/ColumbariumReservation.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/columbarium-proofs/';
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'columbarium-proof-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'), false);
    }
  }
});

// GET /api/client/columbarium/slots - Get available slots for clients
router.get('/slots', protect(['client']), async (req, res) => {
  try {
    const { 
      floor, 
      section, 
      size, 
      minPrice, 
      maxPrice, 
      page = 1, 
      limit = 20 
    } = req.query;

    const filter = { status: 'available' }; // Clients can only see available slots
    
    if (floor) filter.floor = parseInt(floor);
    if (section) filter.section = section;
    if (size) filter.size = size;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const slots = await ColumbariumSlot.find(filter)
      .sort({ floor: 1, section: 1, row: 1, column: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-position'); // Don't expose internal positioning data

    const total = await ColumbariumSlot.countDocuments(filter);

    res.json({
      slots,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalSlots: total,
        hasNext: skip + slots.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching available columbarium slots:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/client/columbarium/slots/:slotId - Get specific slot details
router.get('/slots/:slotId', protect(['client']), async (req, res) => {
  try {
    const { slotId } = req.params;
    
    const slot = await ColumbariumSlot.findOne({ 
      slotId, 
      status: 'available' 
    }).select('-position');

    if (!slot) {
      return res.status(404).json({ message: 'Slot not found or not available' });
    }

    res.json(slot);
  } catch (error) {
    console.error('Error fetching slot details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/client/columbarium/reservations - Create reservation (client)
router.post('/reservations', protect(['client']), upload.single('proofImage'), async (req, res) => {
  try {
    const {
      slotId,
      clientName,
      clientContact,
      clientEmail,
      deceasedName,
      deceasedDateOfBirth,
      deceasedDateOfDeath,
      deceasedRelationship,
      paymentMethod,
      paymentAmount,
      duration,
      specialRequirements
    } = req.body;

    // Validate required payment proof
    if (!req.file) {
      return res.status(400).json({ message: 'Payment proof is required for client reservations' });
    }

    // Verify slot exists and is available
    const slot = await ColumbariumSlot.findOne({ slotId });
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    
    if (slot.status !== 'available') {
      return res.status(400).json({ message: 'Slot is not available' });
    }

    // Validate payment amount (should match or exceed slot price)
    const paymentAmountNum = parseFloat(paymentAmount);
    if (paymentAmountNum < slot.price) {
      return res.status(400).json({ 
        message: `Payment amount (₱${paymentAmountNum}) is insufficient. Slot price is ₱${slot.price}` 
      });
    }

    // Create reservation
    const reservation = new ColumbariumReservation({
      slotId,
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
      totalPrice: slot.price,
      duration: parseInt(duration) || 5,
      specialRequirements,
      proofImage: req.file.path.replace(/\\/g, '/'),
      status: 'pending' // Client reservations need approval
    });

    await reservation.save();

    // Update slot status to reserved (temporarily while pending approval)
    slot.status = 'reserved';
    await slot.save();

    res.status(201).json({
      message: 'Reservation submitted successfully. It will be reviewed by our staff.',
      reservation: {
        _id: reservation._id,
        slotId: reservation.slotId,
        status: reservation.status,
        clientName: reservation.clientName,
        deceasedInfo: reservation.deceasedInfo,
        createdAt: reservation.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating columbarium reservation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/client/columbarium/reservations - Get client's reservations
router.get('/reservations', protect(['client']), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reservations = await ColumbariumReservation.find({ 
      clientId: req.user.id 
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('approvedBy', 'firstName lastName')
    .lean();

    // Add slot details to each reservation
    const reservationsWithSlots = await Promise.all(
      reservations.map(async (reservation) => {
        const slot = await ColumbariumSlot.findOne({ 
          slotId: reservation.slotId 
        }).select('building floor section row column size price');
        
        return {
          ...reservation,
          slotDetails: slot
        };
      })
    );

    const total = await ColumbariumReservation.countDocuments({ 
      clientId: req.user.id 
    });

    res.json({
      reservations: reservationsWithSlots,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalReservations: total,
        hasNext: skip + reservations.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching client reservations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/client/columbarium/reservations/:id - Get specific reservation
router.get('/reservations/:id', protect(['client']), async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await ColumbariumReservation.findOne({
      _id: id,
      clientId: req.user.id
    }).populate('approvedBy', 'firstName lastName');

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    // Get slot details
    const slot = await ColumbariumSlot.findOne({ 
      slotId: reservation.slotId 
    });

    res.json({
      ...reservation.toObject(),
      slotDetails: slot
    });
  } catch (error) {
    console.error('Error fetching reservation details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/client/columbarium/building-layout - Get building layout for visualization
router.get('/building-layout', protect(['client']), async (req, res) => {
  try {
    const { floor } = req.query;
    
    const filter = { status: 'available' };
    if (floor) filter.floor = parseInt(floor);

    // Get available slots organized by floor and section
    const slots = await ColumbariumSlot.find(filter)
      .select('slotId floor section row column size price')
      .sort({ floor: 1, section: 1, row: 1, column: 1 });

    // Organize slots by floor and section
    const layout = {};
    slots.forEach(slot => {
      if (!layout[slot.floor]) layout[slot.floor] = {};
      if (!layout[slot.floor][slot.section]) layout[slot.floor][slot.section] = [];
      layout[slot.floor][slot.section].push(slot);
    });

    // Get floor information
    const floors = await ColumbariumSlot.distinct('floor');
    const sections = await ColumbariumSlot.distinct('section');

    res.json({
      layout,
      metadata: {
        floors: floors.sort(),
        sections: sections.sort(),
        totalAvailable: slots.length
      }
    });
  } catch (error) {
    console.error('Error fetching building layout:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;