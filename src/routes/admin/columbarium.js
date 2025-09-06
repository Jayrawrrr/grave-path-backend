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

// GET /api/admin/columbarium/slots - Get all slots with filtering
router.get('/slots', protect(['admin', 'staff']), async (req, res) => {
  try {
    const { 
      status, 
      floor, 
      section, 
      size, 
      minPrice, 
      maxPrice, 
      page = 1, 
      limit = 50 
    } = req.query;

    const filter = {};
    
    if (status) filter.status = status;
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
      .limit(parseInt(limit));

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
    console.error('Error fetching columbarium slots:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/admin/columbarium/slots - Create new slot
router.post('/slots', protect(['admin']), async (req, res) => {
  try {
    const slotData = req.body;
    
    // Generate slot ID
    const slotId = `${slotData.building.substring(0, 1)}${slotData.floor}${slotData.section}${String(slotData.row).padStart(2, '0')}${String(slotData.column).padStart(2, '0')}`;
    
    const slot = new ColumbariumSlot({
      ...slotData,
      slotId
    });

    await slot.save();
    res.status(201).json(slot);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Slot already exists at this position' });
    }
    console.error('Error creating columbarium slot:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/admin/columbarium/reservations - Create reservation (admin/staff)
router.post('/reservations', protect(['admin', 'staff']), upload.single('proofImage'), async (req, res) => {
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
      specialRequirements,
      staffNotes
    } = req.body;

    // Verify slot exists and is available
    const slot = await ColumbariumSlot.findOne({ slotId });
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
      totalPrice: slot.price,
      duration: parseInt(duration) || 5,
      specialRequirements,
      staffNotes,
      proofImage: req.file ? req.file.path.replace(/\\/g, '/') : null
    });

    await reservation.save();

    // Update slot status
    slot.status = 'reserved';
    await slot.save();

    res.status(201).json(reservation);
  } catch (error) {
    console.error('Error creating columbarium reservation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;