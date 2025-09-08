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

// PUT /api/admin/columbarium/slots/:id - Update slot
router.put('/slots/:id', protect(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Generate new slot ID if location changed
    if (updateData.building || updateData.floor || updateData.section || updateData.row || updateData.column) {
      const slotId = `${updateData.building.substring(0, 1)}${updateData.floor}${updateData.section}${String(updateData.row).padStart(2, '0')}${String(updateData.column).padStart(2, '0')}`;
      updateData.slotId = slotId;
    }
    
    const slot = await ColumbariumSlot.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    
    res.json(slot);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Slot already exists at this position' });
    }
    console.error('Error updating columbarium slot:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /api/admin/columbarium/slots/:id - Delete slot
router.delete('/slots/:id', protect(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if slot has active reservations
    const reservation = await ColumbariumReservation.findOne({ slotId: id });
    if (reservation) {
      return res.status(400).json({ message: 'Cannot delete slot with active reservations' });
    }
    
    const slot = await ColumbariumSlot.findByIdAndDelete(id);
    
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    
    res.json({ message: 'Slot deleted successfully' });
  } catch (error) {
    console.error('Error deleting columbarium slot:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/admin/columbarium/bulk-create - Bulk create slots
router.post('/bulk-create', protect(['admin']), async (req, res) => {
  try {
    const { slots } = req.body;
    
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ message: 'Slots array is required' });
    }
    
    // Validate all slots
    for (const slot of slots) {
      if (!slot.slotId || !slot.building || !slot.floor || !slot.section || !slot.row || !slot.column) {
        return res.status(400).json({ message: 'All slots must have required fields' });
      }
    }
    
    const createdSlots = await ColumbariumSlot.insertMany(slots);
    
    res.status(201).json({
      message: `${createdSlots.length} slots created successfully`,
      slots: createdSlots
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Some slots already exist' });
    }
    console.error('Error bulk creating columbarium slots:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/admin/columbarium/reservations - Get all reservations
router.get('/reservations', protect(['admin', 'staff']), async (req, res) => {
  try {
    const { 
      status, 
      page = 1, 
      limit = 20 
    } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const reservations = await ColumbariumReservation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('clientId', 'firstName lastName email')
      .populate('staffId', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    const total = await ColumbariumReservation.countDocuments(filter);

    res.json({
      reservations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalReservations: total,
        hasNext: skip + reservations.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching columbarium reservations:', error);
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

// PUT /api/admin/columbarium/reservations/:id/status - Update reservation status
router.put('/reservations/:id/status', protect(['admin', 'staff']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    
    const reservation = await ColumbariumReservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    reservation.status = status;
    if (status === 'approved') {
      reservation.approvedBy = req.user.id;
      reservation.approvedAt = new Date();
    } else if (status === 'rejected') {
      reservation.rejectionReason = rejectionReason;
    }
    
    await reservation.save();
    
    // Update slot status based on reservation status
    const slot = await ColumbariumSlot.findOne({ slotId: reservation.slotId });
    if (slot) {
      if (status === 'approved') {
        slot.status = 'reserved';
      } else if (status === 'rejected' || status === 'cancelled') {
        slot.status = 'available';
      }
      await slot.save();
    }
    
    res.json(reservation);
  } catch (error) {
    console.error('Error updating reservation status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;