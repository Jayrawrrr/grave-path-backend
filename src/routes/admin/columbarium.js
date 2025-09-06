import express from 'express';
import ColumbariumSlot from '../../models/ColumbariumSlot.js';
import ColumbariumReservation from '../../models/ColumbariumReservation.js';
import ActivityLog from '../../models/ActivityLogs.js';
import { protect } from '../../middleware/auth.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/columbarium/');
  },
  filename: function (req, file, cb) {
    cb(null, `columbarium-${Date.now()}-${file.originalname}`);
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

// Apply admin protection to all routes
router.use(protect(['admin', 'staff']));

// ============= SLOT MANAGEMENT ROUTES =============

// GET /api/admin/columbarium/slots - Get all slots with filtering
router.get('/slots', async (req, res) => {
  try {
    const {
      section,
      status,
      level,
      slotType,
      wall,
      floor,
      minPrice,
      maxPrice,
      page = 1,
      limit = 50,
      sortBy = 'slotId',
      sortOrder = 'asc'
    } = req.query;

    // Build filter object
    const filter = {};
    if (section) filter.section = section;
    if (status) filter.status = status;
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

    // Sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const slots = await ColumbariumSlot.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email');

    const total = await ColumbariumSlot.countDocuments(filter);

    res.json({
      slots,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalSlots: total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ 
      message: 'Server error fetching slots', 
      error: error.message 
    });
  }
});

// GET /api/admin/columbarium/slots/:id - Get specific slot
router.get('/slots/:id', async (req, res) => {
  try {
    const slot = await ColumbariumSlot.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email');

    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }

    // Get any active reservations for this slot
    const reservation = await ColumbariumReservation.findOne({ 
      slotId: slot.slotId,
      status: { $in: ['pending', 'approved', 'active'] }
    }).populate('clientId', 'name email');

    res.json({
      slot,
      reservation,
      totalPrice: slot.totalPrice
    });

  } catch (error) {
    console.error('Error fetching slot:', error);
    res.status(500).json({ 
      message: 'Server error fetching slot', 
      error: error.message 
    });
  }
});

// POST /api/admin/columbarium/slots - Create new slot
router.post('/slots', async (req, res) => {
  try {
    const {
      section,
      row,
      column,
      level,
      slotType,
      basePrice,
      wall,
      floor,
      features,
      notes
    } = req.body;

    // Generate slot ID
    const slotId = ColumbariumSlot.generateSlotId(section, row, column);

    // Check if slot already exists
    const existingSlot = await ColumbariumSlot.findOne({ slotId });
    if (existingSlot) {
      return res.status(400).json({ message: 'Slot already exists at this location' });
    }

    const slotData = {
      slotId,
      section,
      row: parseInt(row),
      column: parseInt(column),
      level,
      slotType,
      pricing: {
        basePrice: parseFloat(basePrice)
      },
      location: {
        wall,
        floor: parseInt(floor)
      },
      features: features || {},
      notes,
      createdBy: req.user.id,
      lastModifiedBy: req.user.id
    };

    const slot = new ColumbariumSlot(slotData);
    await slot.save();

    // Log activity
    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'create',
      details: `Created columbarium slot ${slotId}`
    });

    res.status(201).json({
      message: 'Slot created successfully',
      slot
    });

  } catch (error) {
    console.error('Error creating slot:', error);
    res.status(500).json({ 
      message: 'Server error creating slot', 
      error: error.message 
    });
  }
});

// PUT /api/admin/columbarium/slots/:id - Update slot
router.put('/slots/:id', async (req, res) => {
  try {
    const slot = await ColumbariumSlot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }

    // Check if slot is occupied and prevent certain changes
    if (slot.status === 'occupied') {
      const restrictedFields = ['section', 'row', 'column', 'slotType'];
      const hasRestrictedChanges = restrictedFields.some(field => 
        req.body[field] && req.body[field] !== slot[field]
      );
      
      if (hasRestrictedChanges) {
        return res.status(400).json({ 
          message: 'Cannot modify location or type of occupied slot' 
        });
      }
    }

    // Update allowed fields
    const allowedUpdates = [
      'level', 'status', 'pricing', 'features', 'location', 'notes'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'pricing' || field === 'features' || field === 'location') {
          slot[field] = { ...slot[field], ...req.body[field] };
        } else {
          slot[field] = req.body[field];
        }
      }
    });

    slot.lastModifiedBy = req.user.id;
    await slot.save();

    // Log activity
    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'update',
      details: `Updated columbarium slot ${slot.slotId}`
    });

    res.json({
      message: 'Slot updated successfully',
      slot
    });

  } catch (error) {
    console.error('Error updating slot:', error);
    res.status(500).json({ 
      message: 'Server error updating slot', 
      error: error.message 
    });
  }
});

// DELETE /api/admin/columbarium/slots/:id - Delete slot
router.delete('/slots/:id', async (req, res) => {
  try {
    const slot = await ColumbariumSlot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }

    // Check if slot has active reservations
    const activeReservation = await ColumbariumReservation.findOne({
      slotId: slot.slotId,
      status: { $in: ['pending', 'approved', 'active'] }
    });

    if (activeReservation) {
      return res.status(400).json({ 
        message: 'Cannot delete slot with active reservations' 
      });
    }

    await ColumbariumSlot.findByIdAndDelete(req.params.id);

    // Log activity
    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'delete',
      details: `Deleted columbarium slot ${slot.slotId}`
    });

    res.json({ message: 'Slot deleted successfully' });

  } catch (error) {
    console.error('Error deleting slot:', error);
    res.status(500).json({ 
      message: 'Server error deleting slot', 
      error: error.message 
    });
  }
});

// POST /api/admin/columbarium/slots/bulk-create - Create multiple slots
router.post('/slots/bulk-create', async (req, res) => {
  try {
    const { 
      section,
      startRow,
      endRow,
      startColumn,
      endColumn,
      level,
      slotType,
      basePrice,
      wall,
      floor,
      features
    } = req.body;

    const slotsToCreate = [];
    const errors = [];

    for (let row = parseInt(startRow); row <= parseInt(endRow); row++) {
      for (let col = parseInt(startColumn); col <= parseInt(endColumn); col++) {
        const slotId = ColumbariumSlot.generateSlotId(section, row, col);
        
        // Check if slot already exists
        const existing = await ColumbariumSlot.findOne({ slotId });
        if (existing) {
          errors.push(`Slot ${slotId} already exists`);
          continue;
        }

        slotsToCreate.push({
          slotId,
          section,
          row,
          column: col,
          level,
          slotType,
          pricing: { basePrice: parseFloat(basePrice) },
          location: { wall, floor: parseInt(floor) },
          features: features || {},
          createdBy: req.user.id,
          lastModifiedBy: req.user.id
        });
      }
    }

    if (slotsToCreate.length === 0) {
      return res.status(400).json({ 
        message: 'No slots to create',
        errors 
      });
    }

    const createdSlots = await ColumbariumSlot.insertMany(slotsToCreate);

    // Log activity
    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'bulk_create',
      details: `Created ${createdSlots.length} columbarium slots in section ${section}`
    });

    res.status(201).json({
      message: `Successfully created ${createdSlots.length} slots`,
      createdCount: createdSlots.length,
      errors: errors.length > 0 ? errors : null,
      slots: createdSlots
    });

  } catch (error) {
    console.error('Error bulk creating slots:', error);
    res.status(500).json({ 
      message: 'Server error bulk creating slots', 
      error: error.message 
    });
  }
});

// ============= LAYOUT AND VISUALIZATION ROUTES =============

// GET /api/admin/columbarium/layout - Get columbarium layout
router.get('/layout', async (req, res) => {
  try {
    const { section, floor } = req.query;

    const filter = {};
    if (section) filter.section = section;
    if (floor) filter['location.floor'] = parseInt(floor);

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
      layout[slot.section][slot.row][slot.column] = slot;
    });

    // Get summary statistics
    const stats = await ColumbariumSlot.aggregate([
      ...(section ? [{ $match: { section } }] : []),
      ...(floor ? [{ $match: { 'location.floor': parseInt(floor) } }] : []),
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$pricing.basePrice' }
        }
      }
    ]);

    res.json({
      layout,
      stats,
      metadata: {
        sections: await ColumbariumSlot.distinct('section', filter),
        levels: await ColumbariumSlot.distinct('level', filter),
        walls: await ColumbariumSlot.distinct('location.wall', filter),
        floors: await ColumbariumSlot.distinct('location.floor', filter)
      }
    });

  } catch (error) {
    console.error('Error fetching layout:', error);
    res.status(500).json({ 
      message: 'Server error fetching layout', 
      error: error.message 
    });
  }
});

// ============= RESERVATION MANAGEMENT ROUTES =============

// GET /api/admin/columbarium/reservations - Get all reservations
router.get('/reservations', async (req, res) => {
  try {
    const {
      status,
      section,
      clientName,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (clientName) {
      filter.$or = [
        { 'clientInfo.fullName': { $regex: clientName, $options: 'i' } },
        { 'deceasedInfo.fullName': { $regex: clientName, $options: 'i' } }
      ];
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reservations = await ColumbariumReservation.find(filter)
      .populate('clientId', 'name email')
      .populate('staffId', 'name email')
      .populate('approvedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ColumbariumReservation.countDocuments(filter);

    res.json({
      reservations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalReservations: total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ 
      message: 'Server error fetching reservations', 
      error: error.message 
    });
  }
});

// GET /api/admin/columbarium/reservations/:id - Get specific reservation
router.get('/reservations/:id', async (req, res) => {
  try {
    const reservation = await ColumbariumReservation.findById(req.params.id)
      .populate('clientId', 'name email')
      .populate('staffId', 'name email')
      .populate('approvedBy', 'name email')
      .populate('statusHistory.changedBy', 'name email');

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
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

// PATCH /api/admin/columbarium/reservations/:id/status - Update reservation status
router.patch('/reservations/:id/status', async (req, res) => {
  try {
    const { status, reason } = req.body;
    
    const reservation = await ColumbariumReservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    const oldStatus = reservation.status;
    reservation.updateStatus(status, req.user.id, reason);

    // Update slot status based on reservation status
    const slot = await ColumbariumSlot.findOne({ slotId: reservation.slotId });
    if (slot) {
      if (status === 'approved') {
        slot.status = 'reserved';
      } else if (status === 'active') {
        slot.status = 'occupied';
      } else if (status === 'cancelled' || status === 'expired') {
        slot.status = 'available';
      }
      await slot.save();
    }

    await reservation.save();

    // Log activity
    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'status_update',
      details: `Updated reservation ${reservation.reservationId} status from ${oldStatus} to ${status}`
    });

    res.json({
      message: 'Reservation status updated successfully',
      reservation
    });

  } catch (error) {
    console.error('Error updating reservation status:', error);
    res.status(500).json({ 
      message: 'Server error updating reservation status', 
      error: error.message 
    });
  }
});

// POST /api/admin/columbarium/reservations/:id/payment - Process payment
router.post('/reservations/:id/payment', upload.single('proofImage'), async (req, res) => {
  try {
    const { amount, paymentMethod, referenceNumber } = req.body;
    
    const reservation = await ColumbariumReservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    const paymentData = {
      amount: parseFloat(amount),
      paymentMethod,
      referenceNumber,
      processedBy: req.user.id,
      status: 'verified' // Admin payments are auto-verified
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
      action: 'payment_processed',
      details: `Processed payment of ₱${amount} for reservation ${reservation.reservationId}`
    });

    res.json({
      message: 'Payment processed successfully',
      reservation,
      balanceRemaining: reservation.pricing.balanceRemaining
    });

  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ 
      message: 'Server error processing payment', 
      error: error.message 
    });
  }
});

// ============= STATISTICS AND REPORTS =============

// GET /api/admin/columbarium/statistics - Get columbarium statistics
router.get('/statistics', async (req, res) => {
  try {
    const { period = 'month', section } = req.query;

    const filter = {};
    if (section) filter.section = section;

    // Slot statistics
    const slotStats = await ColumbariumSlot.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$pricing.basePrice' }
        }
      }
    ]);

    // Reservation statistics
    const reservationStats = await ColumbariumReservation.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.totalPrice' }
        }
      }
    ]);

    // Revenue by period
    const periodMatch = {};
    const now = new Date();
    if (period === 'month') {
      periodMatch.createdAt = {
        $gte: new Date(now.getFullYear(), now.getMonth(), 1)
      };
    } else if (period === 'year') {
      periodMatch.createdAt = {
        $gte: new Date(now.getFullYear(), 0, 1)
      };
    }

    const revenueStats = await ColumbariumReservation.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pricing.totalPrice' },
          paidAmount: { 
            $sum: { 
              $reduce: {
                input: '$paymentInfo.payments',
                initialValue: 0,
                in: { 
                  $add: [
                    '$$value', 
                    { $cond: [{ $eq: ['$$this.status', 'verified'] }, '$$this.amount', 0] }
                  ]
                }
              }
            }
          },
          reservationCount: { $sum: 1 }
        }
      }
    ]);

    res.json({
      slotStatistics: slotStats,
      reservationStatistics: reservationStats,
      revenueStatistics: revenueStats[0] || { totalRevenue: 0, paidAmount: 0, reservationCount: 0 },
      period
    });

  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ 
      message: 'Server error fetching statistics', 
      error: error.message 
    });
  }
});

export default router;
