import express from 'express';
import ColumbariumSlot from '../../models/ColumbariumSlot.js';
import ColumbariumReservation from '../../models/ColumbariumReservation.js';
import ActivityLog from '../../models/ActivityLogs.js';
import { protect } from '../../middleware/auth.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/columbarium/documents/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image and document files are allowed'));
    }
  }
});

// Apply client protection to all routes
router.use(protect(['client', 'staff', 'admin']));

// ============= BROWSING AND SEARCH ROUTES =============

// GET /api/client/columbarium/available-slots - Browse available slots
router.get('/available-slots', async (req, res) => {
  try {
    const {
      section,
      level,
      slotType,
      wall,
      floor,
      minPrice,
      maxPrice,
      features,
      page = 1,
      limit = 20,
      sortBy = 'pricing.basePrice',
      sortOrder = 'asc'
    } = req.query;

    // Build filter for available slots
    const filter = { status: 'available' };
    
    if (section) filter.section = section;
    if (level) filter.level = level;
    if (slotType) filter.slotType = slotType;
    if (wall) filter['location.wall'] = wall;
    if (floor) filter['location.floor'] = parseInt(floor);
    
    // Price range filter
    if (minPrice || maxPrice) {
      filter['pricing.basePrice'] = {};
      if (minPrice) filter['pricing.basePrice'].$gte = parseInt(minPrice);
      if (maxPrice) filter['pricing.basePrice'].$lte = parseInt(maxPrice);
    }

    // Features filter
    if (features) {
      const featureArray = features.split(',');
      featureArray.forEach(feature => {
        if (feature === 'lighting') filter['features.hasLighting'] = true;
        if (feature === 'glass') filter['features.hasGlass'] = true;
        if (feature === 'ventilation') filter['features.hasVentilation'] = true;
        if (feature === 'security') filter['features.hasSecurity'] = true;
      });
    }

    // Sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const slots = await ColumbariumSlot.find(filter)
      .select('-createdBy -lastModifiedBy -notes')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ColumbariumSlot.countDocuments(filter);

    // Add calculated total price to each slot
    const slotsWithPrice = slots.map(slot => ({
      ...slot.toObject(),
      totalPrice: slot.totalPrice
    }));

    res.json({
      slots: slotsWithPrice,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalSlots: total,
        limit: parseInt(limit)
      },
      filters: {
        availableSections: await ColumbariumSlot.distinct('section', { status: 'available' }),
        availableLevels: await ColumbariumSlot.distinct('level', { status: 'available' }),
        availableWalls: await ColumbariumSlot.distinct('location.wall', { status: 'available' }),
        priceRange: await ColumbariumSlot.aggregate([
          { $match: { status: 'available' } },
          {
            $group: {
              _id: null,
              minPrice: { $min: '$pricing.basePrice' },
              maxPrice: { $max: '$pricing.basePrice' }
            }
          }
        ])
      }
    });

  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({ 
      message: 'Server error fetching available slots', 
      error: error.message 
    });
  }
});

// GET /api/client/columbarium/slots/:id - Get specific slot details
router.get('/slots/:id', async (req, res) => {
  try {
    const slot = await ColumbariumSlot.findById(req.params.id)
      .select('-createdBy -lastModifiedBy -notes');

    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }

    // Check if slot is available
    if (slot.status !== 'available') {
      return res.status(400).json({ 
        message: 'Slot is not available for viewing',
        status: slot.status 
      });
    }

    // Get nearby slots for comparison
    const nearbySlots = await ColumbariumSlot.find({
      section: slot.section,
      'location.floor': slot.location.floor,
      row: { $gte: slot.row - 2, $lte: slot.row + 2 },
      column: { $gte: slot.column - 2, $lte: slot.column + 2 },
      status: 'available',
      _id: { $ne: slot._id }
    })
    .select('slotId section row column level slotType pricing status')
    .limit(6);

    res.json({
      slot: {
        ...slot.toObject(),
        totalPrice: slot.totalPrice
      },
      nearbySlots: nearbySlots.map(nearbySlot => ({
        ...nearbySlot.toObject(),
        totalPrice: nearbySlot.totalPrice
      }))
    });

  } catch (error) {
    console.error('Error fetching slot details:', error);
    res.status(500).json({ 
      message: 'Server error fetching slot details', 
      error: error.message 
    });
  }
});

// POST /api/client/columbarium/calculate-price - Calculate slot price
router.post('/calculate-price', async (req, res) => {
  try {
    const { slotId, features, leasePeriod } = req.body;

    const slot = await ColumbariumSlot.findOne({ slotId });
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }

    let totalPrice = slot.pricing.basePrice;
    let breakdown = {
      basePrice: slot.pricing.basePrice,
      levelMultiplier: 1,
      sizeMultiplier: 1,
      features: 0,
      leasePeriodAdjustment: 0
    };

    // Level multipliers
    if (slot.level === 'ground') {
      breakdown.levelMultiplier = 0.8;
      totalPrice *= 0.8;
    } else if (slot.level === 'high') {
      breakdown.levelMultiplier = 0.9;
      totalPrice *= 0.9;
    }

    // Size multipliers
    if (slot.slotType === 'double') {
      breakdown.sizeMultiplier = 1.8;
      totalPrice *= 1.8;
    } else if (slot.slotType === 'family') {
      breakdown.sizeMultiplier = 2.5;
      totalPrice *= 2.5;
    }

    // Additional features
    if (features) {
      if (features.lighting && !slot.features.hasLighting) {
        breakdown.features += 15000;
        totalPrice += 15000;
      }
      if (features.premiumGlass && slot.features.glassType !== 'premium') {
        breakdown.features += 10000;
        totalPrice += 10000;
      }
      if (features.security && !slot.features.hasSecurity) {
        breakdown.features += 12000;
        totalPrice += 12000;
      }
    }

    // Lease period adjustment (discount for longer leases)
    if (leasePeriod && leasePeriod > 25) {
      const discount = Math.min((leasePeriod - 25) * 0.01, 0.15); // Max 15% discount
      breakdown.leasePeriodAdjustment = -Math.round(totalPrice * discount);
      totalPrice += breakdown.leasePeriodAdjustment;
    }

    // Calculate payment options
    const paymentOptions = {
      fullPayment: Math.round(totalPrice),
      downPayment: Math.round(totalPrice * 0.3), // 30% down payment
      installment12: Math.round(totalPrice / 12),
      installment24: Math.round(totalPrice / 24),
      installment36: Math.round(totalPrice / 36)
    };

    res.json({
      slotId,
      totalPrice: Math.round(totalPrice),
      breakdown,
      paymentOptions,
      maintenanceFee: slot.pricing.maintenanceFee,
      leasePeriod: leasePeriod || slot.pricing.leasePeriod
    });

  } catch (error) {
    console.error('Error calculating price:', error);
    res.status(500).json({ 
      message: 'Server error calculating price', 
      error: error.message 
    });
  }
});

// ============= RESERVATION ROUTES =============

// POST /api/client/columbarium/reserve - Create reservation
router.post('/reserve', upload.fields([
  { name: 'deathCertificate', maxCount: 1 },
  { name: 'cremationCertificate', maxCount: 1 },
  { name: 'clientId', maxCount: 1 },
  { name: 'paymentProof', maxCount: 1 }
]), async (req, res) => {
  try {
    const {
      slotId,
      deceasedInfo,
      clientInfo,
      urnDetails,
      leaseInfo,
      paymentInfo,
      memorialServices
    } = req.body;

    // Parse JSON strings if they come as strings
    const parsedDeceasedInfo = typeof deceasedInfo === 'string' ? JSON.parse(deceasedInfo) : deceasedInfo;
    const parsedClientInfo = typeof clientInfo === 'string' ? JSON.parse(clientInfo) : clientInfo;
    const parsedUrnDetails = typeof urnDetails === 'string' ? JSON.parse(urnDetails) : urnDetails;
    const parsedLeaseInfo = typeof leaseInfo === 'string' ? JSON.parse(leaseInfo) : leaseInfo;
    const parsedPaymentInfo = typeof paymentInfo === 'string' ? JSON.parse(paymentInfo) : paymentInfo;

    // Check if slot exists and is available
    const slot = await ColumbariumSlot.findOne({ slotId });
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }

    if (!slot.isAvailable()) {
      return res.status(400).json({ message: 'Slot is not available for reservation' });
    }

    // Generate reservation ID
    const reservationId = await ColumbariumReservation.generateReservationId();

    // Prepare reservation data
    const reservationData = {
      reservationId,
      slotId,
      clientId: req.user.id,
      reservationType: req.user.role === 'staff' ? 'staff' : 'client',
      deceasedInfo: parsedDeceasedInfo,
      clientInfo: parsedClientInfo,
      urnDetails: parsedUrnDetails,
      leaseInfo: {
        ...parsedLeaseInfo,
        startDate: new Date(parsedLeaseInfo.startDate),
        leasePeriodYears: parsedLeaseInfo.leasePeriodYears || 25
      },
      pricing: {
        slotBasePrice: slot.pricing.basePrice,
        totalPrice: slot.totalPrice,
        downPayment: parsedPaymentInfo.downPayment || 0
      },
      paymentInfo: {
        paymentMethod: parsedPaymentInfo.paymentMethod,
        paymentStatus: 'pending',
        payments: []
      },
      status: req.user.role === 'staff' ? 'approved' : 'pending'
    };

    // Add staff ID if staff is making the reservation
    if (req.user.role === 'staff') {
      reservationData.staffId = req.user.id;
    }

    // Handle document uploads
    if (req.files) {
      reservationData.documents = {};
      
      if (req.files.deathCertificate) {
        reservationData.documents.deathCertificate = {
          uploaded: true,
          filePath: req.files.deathCertificate[0].path
        };
      }
      
      if (req.files.cremationCertificate) {
        reservationData.documents.cremationCertificate = {
          uploaded: true,
          filePath: req.files.cremationCertificate[0].path
        };
      }
      
      if (req.files.clientId) {
        reservationData.documents.clientId = {
          uploaded: true,
          filePath: req.files.clientId[0].path
        };
      }

      // Handle payment proof
      if (req.files.paymentProof && parsedPaymentInfo.downPayment > 0) {
        reservationData.paymentInfo.payments.push({
          amount: parsedPaymentInfo.downPayment,
          paymentMethod: parsedPaymentInfo.paymentMethod,
          referenceNumber: parsedPaymentInfo.referenceNumber,
          proofImage: req.files.paymentProof[0].path,
          status: req.user.role === 'staff' ? 'verified' : 'pending'
        });

        if (req.user.role === 'staff') {
          reservationData.paymentInfo.paymentStatus = 'partial';
        }
      }
    }

    // Create reservation
    const reservation = new ColumbariumReservation(reservationData);
    await reservation.save();

    // Reserve the slot
    slot.reserve();
    await slot.save();

    // Log activity
    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'reservation',
      details: `Created columbarium reservation ${reservationId} for slot ${slotId}`
    });

    res.status(201).json({
      message: 'Reservation created successfully',
      reservation: {
        reservationId: reservation.reservationId,
        slotId: reservation.slotId,
        status: reservation.status,
        totalPrice: reservation.pricing.totalPrice,
        balanceRemaining: reservation.pricing.balanceRemaining
      }
    });

  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ 
      message: 'Server error creating reservation', 
      error: error.message 
    });
  }
});

// GET /api/client/columbarium/my-reservations - Get client's reservations
router.get('/my-reservations', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { clientId: req.user.id };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reservations = await ColumbariumReservation.find(filter)
      .populate('staffId', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ColumbariumReservation.countDocuments(filter);

    // Get slot information for each reservation
    const reservationsWithSlots = await Promise.all(
      reservations.map(async (reservation) => {
        const slot = await ColumbariumSlot.findOne({ slotId: reservation.slotId })
          .select('section row column level slotType location');
        
        return {
          ...reservation.toObject(),
          slot,
          leaseStatus: reservation.leaseStatus
        };
      })
    );

    res.json({
      reservations: reservationsWithSlots,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalReservations: total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching client reservations:', error);
    res.status(500).json({ 
      message: 'Server error fetching reservations', 
      error: error.message 
    });
  }
});

// GET /api/client/columbarium/reservations/:id - Get specific reservation
router.get('/reservations/:id', async (req, res) => {
  try {
    const reservation = await ColumbariumReservation.findById(req.params.id)
      .populate('staffId', 'name email')
      .populate('approvedBy', 'name email');

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    // Check if user owns this reservation or is staff/admin
    if (reservation.clientId.toString() !== req.user.id && 
        !['staff', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get slot information
    const slot = await ColumbariumSlot.findOne({ slotId: reservation.slotId });

    res.json({
      reservation,
      slot,
      leaseStatus: reservation.leaseStatus
    });

  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({ 
      message: 'Server error fetching reservation', 
      error: error.message 
    });
  }
});

// POST /api/client/columbarium/reservations/:id/payment - Submit payment
router.post('/reservations/:id/payment', upload.single('proofImage'), async (req, res) => {
  try {
    const { amount, paymentMethod, referenceNumber } = req.body;
    
    const reservation = await ColumbariumReservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    // Check if user owns this reservation
    if (reservation.clientId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if reservation allows payments
    if (!['pending', 'approved', 'active'].includes(reservation.status)) {
      return res.status(400).json({ 
        message: 'Cannot add payment to reservation with current status' 
      });
    }

    const paymentData = {
      amount: parseFloat(amount),
      paymentMethod,
      referenceNumber,
      status: 'pending' // Client payments need verification
    };

    if (req.file) {
      paymentData.proofImage = req.file.path;
    }

    reservation.addPayment(paymentData);
    await reservation.save();

    // Log activity
    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'payment_submitted',
      details: `Submitted payment of ₱${amount} for reservation ${reservation.reservationId}`
    });

    res.json({
      message: 'Payment submitted successfully',
      balanceRemaining: reservation.pricing.balanceRemaining,
      paymentStatus: reservation.paymentInfo.paymentStatus
    });

  } catch (error) {
    console.error('Error submitting payment:', error);
    res.status(500).json({ 
      message: 'Server error submitting payment', 
      error: error.message 
    });
  }
});

// ============= LAYOUT BROWSING =============

// GET /api/client/columbarium/layout - Get public layout view
router.get('/layout', async (req, res) => {
  try {
    const { section, floor } = req.query;

    const filter = {};
    if (section) filter.section = section;
    if (floor) filter['location.floor'] = parseInt(floor);

    // Only show available and occupied slots (hide maintenance, etc.)
    const publicStatuses = ['available', 'reserved', 'occupied'];
    filter.status = { $in: publicStatuses };

    const slots = await ColumbariumSlot.find(filter)
      .select('slotId section row column level status slotType pricing location')
      .sort({ section: 1, row: 1, column: 1 });

    // Group slots by section for easier frontend handling
    const layout = {};
    slots.forEach(slot => {
      if (!layout[slot.section]) {
        layout[slot.section] = {};
      }
      if (!layout[slot.section][slot.row]) {
        layout[slot.section][slot.row] = {};
      }
      
      // Only include essential information for public view
      layout[slot.section][slot.row][slot.column] = {
        slotId: slot.slotId,
        level: slot.level,
        status: slot.status,
        slotType: slot.slotType,
        basePrice: slot.pricing.basePrice,
        totalPrice: slot.totalPrice
      };
    });

    res.json({
      layout,
      metadata: {
        sections: await ColumbariumSlot.distinct('section', filter),
        levels: await ColumbariumSlot.distinct('level', filter),
        walls: await ColumbariumSlot.distinct('location.wall', filter),
        floors: await ColumbariumSlot.distinct('location.floor', filter)
      }
    });

  } catch (error) {
    console.error('Error fetching public layout:', error);
    res.status(500).json({ 
      message: 'Server error fetching layout', 
      error: error.message 
    });
  }
});

export default router;
