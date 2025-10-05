import express from 'express';
import { protect } from '../../middleware/auth.js';
import { ColumbariumSlot, ColumbariumReservation } from '../../models/ColumbariumReservation.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';

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

    // Send confirmation email
    let emailSent = false;
    let emailError = null;
    
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Columbarium Reservation Confirmation - Garden of Memories</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background-color: #ffffff; padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #e9ecef;">
              <h1 style="color: #212529; margin: 0 0 8px 0; font-size: 24px; font-weight: 600; letter-spacing: -0.02em;">Garden of Memories</h1>
              <p style="color: #6c757d; margin: 0; font-size: 14px; font-weight: 400;">Memorial Park</p>
            </div>

            <!-- Main content -->
            <div style="padding: 40px 40px 20px 40px;">
              <h2 style="color: #212529; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Columbarium reservation submitted</h2>
              <p style="color: #6c757d; font-size: 16px; margin: 0 0 32px 0;">Dear <strong>${clientName}</strong>,</p>
              
              <p style="color: #495057; font-size: 16px; margin: 0 0 32px 0;">Your columbarium reservation has been successfully submitted and is now under review.</p>

              <!-- Reservation Details -->
              <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 24px; margin: 32px 0;">
                <h3 style="color: #212529; margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">Reservation Details</h3>
                
                <div style="margin-bottom: 12px;">
                  <strong style="color: #495057; font-size: 14px;">Slot:</strong>
                  <span style="color: #212529; font-size: 14px; margin-left: 8px;">${slotId}</span>
                </div>
                
                <div style="margin-bottom: 12px;">
                  <strong style="color: #495057; font-size: 14px;">Deceased:</strong>
                  <span style="color: #212529; font-size: 14px; margin-left: 8px;">${deceasedName}</span>
                </div>
                
                <div style="margin-bottom: 12px;">
                  <strong style="color: #495057; font-size: 14px;">Duration:</strong>
                  <span style="color: #212529; font-size: 14px; margin-left: 8px;">${duration === 99 ? 'Perpetual' : duration + ' years'}</span>
                </div>
                
                <div style="margin-bottom: 0;">
                  <strong style="color: #495057; font-size: 14px;">Amount:</strong>
                  <span style="color: #212529; font-size: 14px; margin-left: 8px;">₱${paymentAmountNum.toLocaleString()}</span>
                </div>
              </div>

              <!-- Status -->
              <div style="text-align: center; margin: 32px 0;">
                <p style="color: #495057; font-size: 14px; margin: 0 0 12px 0; font-weight: 500;">Status</p>
                <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 0 auto; max-width: 280px;">
                  <span style="font-size: 16px; font-weight: 600; color: #856404;">
                    PENDING REVIEW
                  </span>
                </div>
              </div>

              <!-- Instructions -->
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin: 32px 0; border-left: 3px solid #495057;">
                <h3 style="color: #212529; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">What happens next</h3>
                <ol style="color: #495057; margin: 0; padding-left: 20px; font-size: 14px;">
                  <li style="margin-bottom: 6px;">Our staff will review your reservation within 24 hours</li>
                  <li style="margin-bottom: 6px;">You'll receive a confirmation call once approved</li>
                  <li style="margin-bottom: 6px;">Complete reservation documents will be emailed to you</li>
                  <li>Complete remaining balance within 30 days after approval</li>
                </ol>
              </div>

              <!-- Contact notice -->
              <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <h4 style="color: #856404; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Need assistance?</h4>
                <p style="color: #856404; margin: 0; font-size: 13px;">Contact us at reservations@gardenofmemories.ph or call our office for any questions.</p>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 24px 40px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #6c757d; margin: 0 0 8px 0; font-size: 13px;">© 2024 Garden of Memories Memorial Park</p>
              <p style="color: #adb5bd; margin: 0; font-size: 12px;">Pateros, Philippines</p>
              <div style="margin-top: 16px;">
                <a href="mailto:${process.env.EMAIL_FROM}" style="color: #495057; text-decoration: none; font-size: 13px; font-weight: 500;">Contact Support</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const encodedMessage = Buffer.from(
        `To: ${clientEmail}\r\nFrom: "Garden of Memories Memorial Park" <${process.env.EMAIL_FROM}>\r\nSubject: 🏛️ Columbarium Reservation Submitted - Garden of Memories Memorial Park\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${emailContent}`
      ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
      emailSent = true;
      
    } catch (error) {
      console.error('Email sending error:', error);
      emailError = error.message;
      emailSent = false;
    }

    // If email failed, we still keep the reservation but log the error
    if (!emailSent) {
      console.error('Failed to send confirmation email:', emailError);
      // Note: We don't revert the reservation here since the user has already submitted it
      // The email failure shouldn't prevent the reservation from being created
    }

    res.status(201).json({
      message: 'Reservation submitted successfully. It will be reviewed by our staff.',
      emailSent: emailSent,
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