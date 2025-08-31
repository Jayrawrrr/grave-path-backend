import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { protect } from '../middleware/auth.js';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import Lot from '../models/Lot.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import Reservation from '../models/Reservation.js';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads/proofs/'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'proof-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Setup Gmail API client (reuse from auth.js)
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// Helper function to send emails
const sendReservationEmail = async (to, subject, htmlContent) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const emailLines = [
      `From: ${process.env.EMAIL_FROM}`,
      `To: ${to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
      '',
      htmlContent
    ];
    const email = emailLines.join('\r\n').trim();
    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedEmail } });
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};
console.log('sendReservationEmail type:', typeof sendReservationEmail);

// Create reservation with file upload - allow both client and staff roles
router.post('/create', protect(['client', 'staff']), upload.single('proofImage'), async (req, res) => {
  try {
    console.log('Received reservation request:', req.body);
    console.log('File:', req.file);
    console.log('User from token:', req.user);

    const {
      lotId,
      sqm,
      location,
      clientName,
      clientContact,
      paymentMethod,
      paymentAmount,
      totalPrice,
      sendEmail: shouldSendEmail
    } = req.body;

    // Only require proof for client reservations
    if (req.user.role === 'client' && !req.file) {
      return res.status(400).json({ message: 'Payment proof is required for client reservations' });
    }

    // Fetch lot details for email
    let lot = null;
    try {
      lot = await Lot.findOne({ id: lotId });
    } catch (e) {
      lot = null;
    }

    // Fill location from lot if missing BEFORE creating reservation
    if ((!location || location.trim() === '') && lot && lot.location) {
      reservationData.location = lot.location;
    }

    // Create the reservation object
    const reservationData = {
      lotId,
      clientId: req.user.id,
      sqm,
      location,
      clientName,
      clientContact,
      paymentMethod,
      paymentAmount,
      totalPrice,
      status: req.user.role === 'staff' ? 'approved' : 'pending' // Auto-approve staff reservations
    };

    // Add proof image path if file was uploaded
    if (req.file) {
      reservationData.proofImage = req.file.path.replace(/\\/g, '/');
    }

    // If the user is staff, add their ID as staffId
    if (req.user.role === 'staff') {
      reservationData.staffId = req.user.id;
    }

    const reservation = new Reservation(reservationData);
    await reservation.save();
    console.log('Reservation saved:', reservation);

    // Send confirmation email for client reservations
    if (req.user.role === 'client' && shouldSendEmail !== 'false') {
      const recipientEmail = clientContact;
      if (!recipientEmail || !/^[^@]+@[^@]+\.[^@]+$/.test(recipientEmail)) {
        console.error('Invalid recipient email:', recipientEmail);
      } else {
        const emailContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reservation Pending - Garden of Memories</title>
          </head>
          <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="min-height: 100vh; padding: 40px 20px;">
              <div style="max-width: 700px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 15px 35px rgba(0,0,0,0.1); overflow: hidden;">
                
                <!-- Header with memorial park theme -->
                <div style="background: linear-gradient(135deg, #4a7c59 0%, #388e3c 50%, #2e7d32 100%); padding: 50px 40px; text-align: center; position: relative;">
                  <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><defs><pattern id=\"crosses\" x=\"0\" y=\"0\" width=\"20\" height=\"20\" patternUnits=\"userSpaceOnUse\"><path d=\"M10,5 L10,15 M5,10 L15,10\" stroke=\"rgba(255,255,255,0.1)\" stroke-width=\"1\" fill=\"none\"/></pattern></defs><rect width=\"100\" height=\"100\" fill=\"url(%23crosses)\"/></svg>'); opacity: 0.3;"></div>
                  <div style="position: relative; z-index: 1;">
                    <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 36px; font-weight: 700; letter-spacing: -0.5px;">🏛️ Garden of Memories</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 18px; font-weight: 300;">Memorial Park</p>
                  </div>
                </div>

                <!-- Status indicator -->
                <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); padding: 20px 40px; text-align: center; border-bottom: 1px solid #ffcc02;">
                  <div style="display: inline-flex; align-items: center; gap: 12px; background: #ffffff; padding: 12px 24px; border-radius: 25px; box-shadow: 0 4px 12px rgba(255, 193, 7, 0.2);">
                    <span style="font-size: 24px;">⏳</span>
                    <span style="color: #e65100; font-weight: 600; font-size: 16px;">PENDING APPROVAL</span>
                  </div>
                </div>

                <!-- Main content -->
                <div style="padding: 50px 40px;">
                  <div style="text-align: center; margin-bottom: 40px;">
                    <div style="display: inline-block; background: linear-gradient(135deg, #e8f5e8 0%, #f3f9f3 100%); border-radius: 50%; padding: 20px; margin-bottom: 24px;">
                      <span style="font-size: 56px;">📋</span>
                    </div>
                    <h2 style="color: #2e7d32; margin: 0 0 16px 0; font-size: 32px; font-weight: 600;">Reservation Received</h2>
                    <p style="font-size: 20px; color: #555; line-height: 1.6; margin: 0;">Dear <strong style="color: #2e7d32;">${clientName}</strong>,</p>
                    <p style="font-size: 18px; color: #666; line-height: 1.6; margin: 16px 0 0 0;">Thank you for choosing Garden of Memories Memorial Park. Your reservation has been received and is currently under review.</p>
                  </div>

                  <!-- Reservation details card -->
                  <div style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 2px solid #e8f5e8; border-radius: 16px; padding: 32px; margin: 32px 0; box-shadow: 0 8px 20px rgba(46, 125, 50, 0.1);">
                    <h3 style="color: #2e7d32; margin: 0 0 24px 0; font-size: 24px; font-weight: 600; display: flex; align-items: center; gap: 12px;">
                      <span style="font-size: 28px;">📍</span>
                      Reservation Details
                    </h3>
                    
                    <div style="display: grid; gap: 16px;">
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #ffffff; border-radius: 12px; border-left: 4px solid #4caf50;">
                        <span style="color: #666; font-weight: 500;">Reservation ID:</span>
                        <span style="color: #2e7d32; font-weight: 600; font-family: 'Courier New', monospace;">${reservation._id}</span>
                      </div>
                      
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #ffffff; border-radius: 12px; border-left: 4px solid #4caf50;">
                        <span style="color: #666; font-weight: 500;">Plot:</span>
                        <span style="color: #2e7d32; font-weight: 600;">${lot ? lot.name : reservation.lotId}</span>
                      </div>
                      
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #ffffff; border-radius: 12px; border-left: 4px solid #4caf50;">
                        <span style="color: #666; font-weight: 500;">Location:</span>
                        <span style="color: #2e7d32; font-weight: 600;">${lot ? lot.location : reservation.location}</span>
                      </div>
                      
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #ffffff; border-radius: 12px; border-left: 4px solid #4caf50;">
                        <span style="color: #666; font-weight: 500;">Area:</span>
                        <span style="color: #2e7d32; font-weight: 600;">${lot ? lot.sqm : reservation.sqm} sq. meters</span>
                      </div>
                      
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border-radius: 12px; border-left: 4px solid #ff9800;">
                        <span style="color: #e65100; font-weight: 600;">Status:</span>
                        <span style="color: #e65100; font-weight: 700;">⏳ Pending Review</span>
                      </div>
                    </div>
                  </div>

                  <!-- Next steps -->
                  <div style="background: linear-gradient(135deg, #e3f2fd 0%, #e1f5fe 100%); border-radius: 16px; padding: 32px; margin: 32px 0; border: 1px solid #03a9f4;">
                    <h3 style="color: #0277bd; margin: 0 0 24px 0; font-size: 24px; font-weight: 600; display: flex; align-items: center; gap: 12px;">
                      <span style="font-size: 28px;">📝</span>
                      What Happens Next?
                    </h3>
                    
                    <div style="display: grid; gap: 16px;">
                      <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: rgba(255,255,255,0.7); border-radius: 12px;">
                        <div style="background: #03a9f4; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">1</div>
                        <span style="color: #01579b; line-height: 1.5;">Our staff will carefully review your reservation request</span>
                      </div>
                      
                      <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: rgba(255,255,255,0.7); border-radius: 12px;">
                        <div style="background: #03a9f4; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">2</div>
                        <span style="color: #01579b; line-height: 1.5;">You'll receive an email notification within 24-48 hours</span>
                      </div>
                      
                      <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: rgba(255,255,255,0.7); border-radius: 12px;">
                        <div style="background: #03a9f4; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">3</div>
                        <span style="color: #01579b; line-height: 1.5;">Upon approval, you'll receive payment and documentation instructions</span>
                      </div>
                    </div>
                  </div>

                  <!-- Contact information -->
                  <div style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-radius: 16px; padding: 32px; margin: 32px 0; border: 1px solid #dee2e6;">
                    <h3 style="color: #495057; margin: 0 0 24px 0; font-size: 20px; font-weight: 600; display: flex; align-items: center; gap: 12px;">
                      <span style="font-size: 24px;">📞</span>
                      Need Assistance?
                    </h3>
                    <p style="color: #6c757d; margin: 0 0 16px 0; line-height: 1.6;">If you have any questions about your reservation, please don't hesitate to contact us:</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-top: 20px;">
                      <a href="mailto:${process.env.EMAIL_FROM}" style="display: inline-flex; align-items: center; gap: 8px; color: #2e7d32; text-decoration: none; font-weight: 500;">
                        <span style="font-size: 18px;">📧</span>
                        ${process.env.EMAIL_FROM}
                      </a>
                      <span style="display: inline-flex; align-items: center; gap: 8px; color: #6c757d;">
                        <span style="font-size: 18px;">🏛️</span>
                        Garden of Memories, Pateros
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Footer -->
                <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 32px 40px; text-align: center; border-top: 1px solid #e9ecef;">
                  <p style="color: #6c757d; margin: 0 0 8px 0; font-size: 16px; font-weight: 500;">© 2024 Garden of Memories Memorial Park</p>
                  <p style="color: #adb5bd; margin: 0; font-size: 14px;">Pateros, Philippines | Serving families with compassion since 1978</p>
                  <p style="color: #adb5bd; margin: 8px 0 0 0; font-size: 12px; font-style: italic;">This is an automated message. Please do not reply to this email.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;
        await sendReservationEmail(recipientEmail, 'Reservation Pending - Garden of Memories', emailContent);
      }
    }

    res.status(201).json({
      message: 'Reservation created successfully',
      reservation,
      emailSent: shouldSendEmail !== 'false'
    });
  } catch (error) {
    console.error('Reservation error:', error);
    res.status(500).json({
      message: 'Error creating reservation',
      error: error.message
    });
  }
});

// Get all reservations - allow admin to see all
router.get('/', protect(['client', 'staff', 'admin']), async (req, res) => {
  try {
    let query = {};
    
    // If client role, only show their reservations
    if (req.user.role === 'client') {
      query.clientId = req.user.id;
    }
    // If staff role, only show reservations they created
    else if (req.user.role === 'staff') {
      query.staffId = req.user.id;
    }
    // Admin sees all reservations
    
    const reservations = await Reservation.find(query).sort({ createdAt: -1 });
    res.json(reservations);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get reservation by ID - allow both client and staff roles
router.get('/:id', protect(['client', 'staff']), async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update reservation status - allow both staff and admin
router.patch('/:id/status', protect(['staff', 'admin']), async (req, res) => {
  try {
    const { status, sendEmail, notifyAdmin } = req.body;
    const reservation = await Reservation.findById(req.params.id);
    
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    // Fetch lot details for email
    let lot = null;
    try {
      lot = await Lot.findOne({ id: reservation.lotId });
    } catch (e) {
      lot = null;
    }

    const oldStatus = reservation.status;
    reservation.status = status;
    await reservation.save();

    // Send status update email if requested
    if (sendEmail !== 'false') {
      let emailContent = '';
      let subject = '';

      if (status === 'approved') {
        subject = 'Garden of Memories - Reservation Approved! 🎉';
        emailContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reservation Approved - Garden of Memories</title>
          </head>
          <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="min-height: 100vh; padding: 40px 20px;">
              <div style="max-width: 700px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 15px 35px rgba(0,0,0,0.1); overflow: hidden;">
                
                <!-- Header with success theme -->
                <div style="background: linear-gradient(135deg, #4caf50 0%, #388e3c 50%, #2e7d32 100%); padding: 50px 40px; text-align: center; position: relative;">
                  <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><defs><pattern id=\"confetti\" x=\"0\" y=\"0\" width=\"20\" height=\"20\" patternUnits=\"userSpaceOnUse\"><circle cx=\"5\" cy=\"5\" r=\"2\" fill=\"rgba(255,255,255,0.1)\"/><circle cx=\"15\" cy=\"15\" r=\"1\" fill=\"rgba(255,255,255,0.1)\"/><circle cx=\"10\" cy=\"18\" r=\"1.5\" fill=\"rgba(255,255,255,0.1)\"/></pattern></defs><rect width=\"100\" height=\"100\" fill=\"url(%23confetti)\"/></svg>'); opacity: 0.4;"></div>
                  <div style="position: relative; z-index: 1;">
                    <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 36px; font-weight: 700; letter-spacing: -0.5px;">🏛️ Garden of Memories</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 18px; font-weight: 300;">Memorial Park</p>
                  </div>
                </div>

                <!-- Success banner -->
                <div style="background: linear-gradient(135deg, #e8f5e8 0%, #f3f9f3 100%); padding: 24px 40px; text-align: center; border-bottom: 2px solid #4caf50;">
                  <div style="display: inline-flex; align-items: center; gap: 12px; background: #ffffff; padding: 16px 32px; border-radius: 30px; box-shadow: 0 6px 20px rgba(76, 175, 80, 0.2);">
                    <span style="font-size: 28px;">✅</span>
                    <span style="color: #2e7d32; font-weight: 700; font-size: 18px;">RESERVATION APPROVED</span>
                  </div>
                </div>

                <!-- Main content -->
                <div style="padding: 50px 40px;">
                  <div style="text-align: center; margin-bottom: 40px;">
                    <div style="display: inline-block; background: linear-gradient(135deg, #e8f5e8 0%, #f3f9f3 100%); border-radius: 50%; padding: 20px; margin-bottom: 24px; position: relative;">
                      <span style="font-size: 56px;">🎉</span>
                      <div style="position: absolute; top: -8px; right: -8px; background: #4caf50; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 18px;">✓</div>
                    </div>
                    <h2 style="color: #2e7d32; margin: 0 0 16px 0; font-size: 32px; font-weight: 600;">Congratulations!</h2>
                    <p style="font-size: 20px; color: #555; line-height: 1.6; margin: 0;">Dear <strong style="color: #2e7d32;">${reservation.clientName}</strong>,</p>
                    <p style="font-size: 18px; color: #666; line-height: 1.6; margin: 16px 0 0 0;">Great news! Your reservation has been <strong style="color: #4caf50;">approved</strong>. We're honored to serve your family during this important time.</p>
                  </div>

                  <!-- Approved reservation details -->
                  <div style="background: linear-gradient(135deg, #e8f5e8 0%, #ffffff 100%); border: 2px solid #4caf50; border-radius: 16px; padding: 32px; margin: 32px 0; box-shadow: 0 8px 20px rgba(76, 175, 80, 0.15);">
                    <h3 style="color: #2e7d32; margin: 0 0 24px 0; font-size: 24px; font-weight: 600; display: flex; align-items: center; gap: 12px;">
                      <span style="font-size: 28px;">📋</span>
                      Approved Reservation Details
                    </h3>
                    
                    <div style="display: grid; gap: 16px;">
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #ffffff; border-radius: 12px; border-left: 4px solid #4caf50;">
                        <span style="color: #666; font-weight: 500;">Reservation ID:</span>
                        <span style="color: #2e7d32; font-weight: 600; font-family: 'Courier New', monospace;">${reservation._id}</span>
                      </div>
                      
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #ffffff; border-radius: 12px; border-left: 4px solid #4caf50;">
                        <span style="color: #666; font-weight: 500;">Plot:</span>
                        <span style="color: #2e7d32; font-weight: 600;">${lot ? lot.name : reservation.lotId}</span>
                      </div>
                      
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #ffffff; border-radius: 12px; border-left: 4px solid #4caf50;">
                        <span style="color: #666; font-weight: 500;">Location:</span>
                        <span style="color: #2e7d32; font-weight: 600;">${lot ? lot.location : reservation.location}</span>
                      </div>
                      
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #ffffff; border-radius: 12px; border-left: 4px solid #4caf50;">
                        <span style="color: #666; font-weight: 500;">Area:</span>
                        <span style="color: #2e7d32; font-weight: 600;">${lot ? lot.sqm : reservation.sqm} sq. meters</span>
                      </div>
                      
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; background: linear-gradient(135deg, #e8f5e8 0%, #f3f9f3 100%); border-radius: 12px; border: 2px solid #4caf50;">
                        <span style="color: #2e7d32; font-weight: 700; font-size: 16px;">Status:</span>
                        <span style="color: #2e7d32; font-weight: 700; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                          <span style="font-size: 20px;">✅</span>
                          APPROVED
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Next steps for approved reservation -->
                  <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border-radius: 16px; padding: 32px; margin: 32px 0; border: 1px solid #ff9800;">
                    <h3 style="color: #e65100; margin: 0 0 24px 0; font-size: 24px; font-weight: 600; display: flex; align-items: center; gap: 12px;">
                      <span style="font-size: 28px;">📝</span>
                      Important Next Steps
                    </h3>
                    
                    <div style="display: grid; gap: 16px;">
                      <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: rgba(255,255,255,0.8); border-radius: 12px;">
                        <div style="background: #ff9800; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">1</div>
                        <span style="color: #bf360c; line-height: 1.5; font-weight: 500;">Complete the payment process as per our payment terms</span>
                      </div>
                      
                      <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: rgba(255,255,255,0.8); border-radius: 12px;">
                        <div style="background: #ff9800; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">2</div>
                        <span style="color: #bf360c; line-height: 1.5; font-weight: 500;">Upload your payment proof through our system</span>
                      </div>
                      
                      <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: rgba(255,255,255,0.8); border-radius: 12px;">
                        <div style="background: #ff9800; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">3</div>
                        <span style="color: #bf360c; line-height: 1.5; font-weight: 500;">Wait for payment confirmation and receive your official documentation</span>
                      </div>
                    </div>
                  </div>

                  <!-- Important payment notice -->
                  <div style="background: linear-gradient(135deg, #e3f2fd 0%, #e1f5fe 100%); border-radius: 16px; padding: 32px; margin: 32px 0; border: 2px solid #03a9f4;">
                    <div style="display: flex; align-items: flex-start; gap: 16px;">
                      <div style="background: #03a9f4; color: white; border-radius: 50%; padding: 12px; flex-shrink: 0;">
                        <span style="font-size: 24px;">💰</span>
                      </div>
                      <div>
                        <h4 style="color: #0277bd; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Payment Information</h4>
                        <p style="color: #01579b; margin: 0 0 12px 0; line-height: 1.6;">Please complete your payment within the specified timeframe to finalize your reservation. Detailed payment instructions will be provided separately.</p>
                        <p style="color: #01579b; margin: 0; line-height: 1.6; font-weight: 500;">💡 <strong>Tip:</strong> Keep this email as your reservation confirmation record.</p>
                      </div>
                    </div>
                  </div>

                  <!-- Contact information -->
                  <div style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-radius: 16px; padding: 32px; margin: 32px 0; border: 1px solid #dee2e6;">
                    <h3 style="color: #495057; margin: 0 0 24px 0; font-size: 20px; font-weight: 600; display: flex; align-items: center; gap: 12px;">
                      <span style="font-size: 24px;">📞</span>
                      Questions or Assistance?
                    </h3>
                    <p style="color: #6c757d; margin: 0 0 16px 0; line-height: 1.6;">Our dedicated team is here to help you through every step of the process:</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-top: 20px;">
                      <a href="mailto:${process.env.EMAIL_FROM}" style="display: inline-flex; align-items: center; gap: 8px; color: #2e7d32; text-decoration: none; font-weight: 500;">
                        <span style="font-size: 18px;">📧</span>
                        ${process.env.EMAIL_FROM}
                      </a>
                      <span style="display: inline-flex; align-items: center; gap: 8px; color: #6c757d;">
                        <span style="font-size: 18px;">🏛️</span>
                        Garden of Memories, Pateros
                      </span>
                    </div>
                  </div>

                  <!-- Thank you message -->
                  <div style="text-align: center; margin: 40px 0;">
                    <div style="background: linear-gradient(135deg, #e8f5e8 0%, #f3f9f3 100%); border-radius: 16px; padding: 32px; border: 1px solid #4caf50;">
                      <h3 style="color: #2e7d32; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">Thank You for Choosing Us</h3>
                      <p style="color: #555; margin: 0; line-height: 1.6; font-size: 16px;">We understand this is an important decision for your family. We're committed to providing you with compassionate service and maintaining the highest standards for your loved one's resting place.</p>
                    </div>
                  </div>
                </div>

                <!-- Footer -->
                <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 32px 40px; text-align: center; border-top: 1px solid #e9ecef;">
                  <p style="color: #6c757d; margin: 0 0 8px 0; font-size: 16px; font-weight: 500;">© 2024 Garden of Memories Memorial Park</p>
                  <p style="color: #adb5bd; margin: 0; font-size: 14px;">Pateros, Philippines | Serving families with compassion since 1978</p>
                  <p style="color: #adb5bd; margin: 8px 0 0 0; font-size: 12px; font-style: italic;">This is an automated message. Please do not reply to this email.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;
      } else if (status === 'rejected') {
        subject = 'Garden of Memories - Reservation Status Update';
        emailContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reservation Status Update - Garden of Memories</title>
          </head>
          <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="min-height: 100vh; padding: 40px 20px;">
              <div style="max-width: 700px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 15px 35px rgba(0,0,0,0.1); overflow: hidden;">
                
                <!-- Header with memorial park theme -->
                <div style="background: linear-gradient(135deg, #4a7c59 0%, #388e3c 50%, #2e7d32 100%); padding: 50px 40px; text-align: center; position: relative;">
                  <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><defs><pattern id=\"crosses\" x=\"0\" y=\"0\" width=\"20\" height=\"20\" patternUnits=\"userSpaceOnUse\"><path d=\"M10,5 L10,15 M5,10 L15,10\" stroke=\"rgba(255,255,255,0.1)\" stroke-width=\"1\" fill=\"none\"/></pattern></defs><rect width=\"100\" height=\"100\" fill=\"url(%23crosses)\"/></svg>'); opacity: 0.3;"></div>
                  <div style="position: relative; z-index: 1;">
                    <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 36px; font-weight: 700; letter-spacing: -0.5px;">🏛️ Garden of Memories</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 18px; font-weight: 300;">Memorial Park</p>
                  </div>
                </div>

                <!-- Status indicator -->
                <div style="background: linear-gradient(135deg, #ffebee 0%, #fce4ec 100%); padding: 20px 40px; text-align: center; border-bottom: 1px solid #f48fb1;">
                  <div style="display: inline-flex; align-items: center; gap: 12px; background: #ffffff; padding: 12px 24px; border-radius: 25px; box-shadow: 0 4px 12px rgba(244, 143, 177, 0.2);">
                    <span style="font-size: 24px;">📝</span>
                    <span style="color: #c2185b; font-weight: 600; font-size: 16px;">STATUS UPDATE</span>
                  </div>
                </div>

                <!-- Main content -->
                <div style="padding: 50px 40px;">
                  <div style="text-align: center; margin-bottom: 40px;">
                    <div style="display: inline-block; background: linear-gradient(135deg, #ffebee 0%, #fce4ec 100%); border-radius: 50%; padding: 20px; margin-bottom: 24px;">
                      <span style="font-size: 56px;">📄</span>
                    </div>
                    <h2 style="color: #c2185b; margin: 0 0 16px 0; font-size: 32px; font-weight: 600;">Reservation Status Update</h2>
                    <p style="font-size: 20px; color: #555; line-height: 1.6; margin: 0;">Dear <strong style="color: #2e7d32;">${reservation.clientName}</strong>,</p>
                    <p style="font-size: 18px; color: #666; line-height: 1.6; margin: 16px 0 0 0;">Thank you for your interest in Garden of Memories Memorial Park. We have carefully reviewed your reservation request.</p>
                  </div>

                  <!-- Status message -->
                  <div style="background: linear-gradient(135deg, #ffebee 0%, #ffffff 100%); border: 2px solid #f48fb1; border-radius: 16px; padding: 32px; margin: 32px 0; text-align: center;">
                    <div style="margin-bottom: 24px;">
                      <div style="display: inline-block; background: #ffffff; border: 2px solid #f48fb1; border-radius: 50%; padding: 16px; margin-bottom: 16px;">
                        <span style="font-size: 32px; color: #c2185b;">❌</span>
                      </div>
                    </div>
                    <h3 style="color: #c2185b; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">Reservation Request Not Approved</h3>
                    <p style="color: #666; margin: 0; line-height: 1.6; font-size: 16px;">After careful consideration, we regret to inform you that we are unable to approve your reservation request at this time.</p>
                  </div>

                  <!-- Reservation details -->
                  <div style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 1px solid #dee2e6; border-radius: 16px; padding: 32px; margin: 32px 0;">
                    <h3 style="color: #495057; margin: 0 0 24px 0; font-size: 24px; font-weight: 600; display: flex; align-items: center; gap: 12px;">
                      <span style="font-size: 28px;">📋</span>
                      Reservation Details
                    </h3>
                    
                    <div style="display: grid; gap: 16px;">
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #ffffff; border-radius: 12px; border-left: 4px solid #6c757d;">
                        <span style="color: #666; font-weight: 500;">Reservation ID:</span>
                        <span style="color: #495057; font-weight: 600; font-family: 'Courier New', monospace;">${reservation._id}</span>
                      </div>
                      
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #ffffff; border-radius: 12px; border-left: 4px solid #6c757d;">
                        <span style="color: #666; font-weight: 500;">Requested Plot:</span>
                        <span style="color: #495057; font-weight: 600;">${lot ? lot.name : reservation.lotId}</span>
                      </div>
                      
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #ffffff; border-radius: 12px; border-left: 4px solid #6c757d;">
                        <span style="color: #666; font-weight: 500;">Location:</span>
                        <span style="color: #495057; font-weight: 600;">${lot ? lot.location : reservation.location}</span>
                      </div>
                      
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #ffffff; border-radius: 12px; border-left: 4px solid #6c757d;">
                        <span style="color: #666; font-weight: 500;">Total Price:</span>
                        <span style="color: #495057; font-weight: 600;">₱${Number(reservation.totalPrice || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Next steps / alternatives -->
                  <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border-radius: 16px; padding: 32px; margin: 32px 0; border: 1px solid #ffb74d;">
                    <h3 style="color: #e65100; margin: 0 0 24px 0; font-size: 24px; font-weight: 600; display: flex; align-items: center; gap: 12px;">
                      <span style="font-size: 28px;">💡</span>
                      Alternative Options
                    </h3>
                    
                    <div style="display: grid; gap: 16px;">
                      <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: rgba(255,255,255,0.8); border-radius: 12px;">
                        <div style="background: #ff9800; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">1</div>
                        <span style="color: #bf360c; line-height: 1.5; font-weight: 500;">Browse our available plots for alternative options that may better suit your needs</span>
                      </div>
                      
                      <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: rgba(255,255,255,0.8); border-radius: 12px;">
                        <div style="background: #ff9800; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">2</div>
                        <span style="color: #bf360c; line-height: 1.5; font-weight: 500;">Contact our staff to discuss other memorial options and packages</span>
                      </div>
                      
                      <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: rgba(255,255,255,0.8); border-radius: 12px;">
                        <div style="background: #ff9800; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">3</div>
                        <span style="color: #bf360c; line-height: 1.5; font-weight: 500;">Schedule a personal consultation to understand your specific requirements</span>
                      </div>
                    </div>
                  </div>

                  <!-- Support message -->
                  <div style="background: linear-gradient(135deg, #e3f2fd 0%, #e1f5fe 100%); border-radius: 16px; padding: 32px; margin: 32px 0; border: 2px solid #03a9f4;">
                    <div style="display: flex; align-items: flex-start; gap: 16px;">
                      <div style="background: #03a9f4; color: white; border-radius: 50%; padding: 12px; flex-shrink: 0;">
                        <span style="font-size: 24px;">🤝</span>
                      </div>
                      <div>
                        <h4 style="color: #0277bd; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">We're Here to Help</h4>
                        <p style="color: #01579b; margin: 0 0 12px 0; line-height: 1.6;">We understand this may be disappointing news during a difficult time. Our compassionate team is ready to assist you in finding the most suitable memorial option for your loved one.</p>
                        <p style="color: #01579b; margin: 0; line-height: 1.6; font-weight: 500;">Please don't hesitate to reach out to us for personalized assistance and guidance.</p>
                      </div>
                    </div>
                  </div>

                  <!-- Contact information -->
                  <div style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-radius: 16px; padding: 32px; margin: 32px 0; border: 1px solid #dee2e6;">
                    <h3 style="color: #495057; margin: 0 0 24px 0; font-size: 20px; font-weight: 600; display: flex; align-items: center; gap: 12px;">
                      <span style="font-size: 24px;">📞</span>
                      Contact Our Support Team
                    </h3>
                    <p style="color: #6c757d; margin: 0 0 16px 0; line-height: 1.6;">If you have any questions about this decision or would like to explore other options, please contact us:</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-top: 20px;">
                      <a href="mailto:${process.env.EMAIL_FROM}" style="display: inline-flex; align-items: center; gap: 8px; color: #2e7d32; text-decoration: none; font-weight: 500;">
                        <span style="font-size: 18px;">📧</span>
                        ${process.env.EMAIL_FROM}
                      </a>
                      <span style="display: inline-flex; align-items: center; gap: 8px; color: #6c757d;">
                        <span style="font-size: 18px;">🏛️</span>
                        Garden of Memories, Pateros
                      </span>
                    </div>
                  </div>

                  <!-- Compassionate closing -->
                  <div style="text-align: center; margin: 40px 0;">
                    <div style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-radius: 16px; padding: 32px; border: 1px solid #dee2e6;">
                      <h3 style="color: #495057; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">Our Commitment to You</h3>
                      <p style="color: #6c757d; margin: 0; line-height: 1.6; font-size: 16px;">Even though we cannot approve this particular request, we remain committed to helping you find a meaningful and peaceful resting place for your loved one. Your family's needs are important to us.</p>
                    </div>
                  </div>
                </div>

                <!-- Footer -->
                <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 32px 40px; text-align: center; border-top: 1px solid #e9ecef;">
                  <p style="color: #6c757d; margin: 0 0 8px 0; font-size: 16px; font-weight: 500;">© 2024 Garden of Memories Memorial Park</p>
                  <p style="color: #adb5bd; margin: 0; font-size: 14px;">Pateros, Philippines | Serving families with compassion since 1978</p>
                  <p style="color: #adb5bd; margin: 8px 0 0 0; font-size: 12px; font-style: italic;">This is an automated message. Please do not reply to this email.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;
      }

      if (emailContent) {
        const emailSent = await sendReservationEmail(
          reservation.clientContact,
          subject,
          emailContent
        );

        if (!emailSent) {
          console.warn('Failed to send status update email to:', reservation.clientContact);
        }
      }
    }

    // Notify admin if requested
    if (notifyAdmin === 'true' && process.env.ADMIN_EMAIL) {
      const adminEmailContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Admin Notification - Garden of Memories</title>
        </head>
        <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <div style="min-height: 100vh; padding: 40px 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 15px 35px rgba(0,0,0,0.1); overflow: hidden;">
              
              <!-- Header with admin theme -->
              <div style="background: linear-gradient(135deg, #6c757d 0%, #495057 50%, #343a40 100%); padding: 40px 32px; text-align: center; position: relative;">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><defs><pattern id=\"grid\" x=\"0\" y=\"0\" width=\"10\" height=\"10\" patternUnits=\"userSpaceOnUse\"><path d=\"M 10 0 L 0 0 0 10\" stroke=\"rgba(255,255,255,0.1)\" stroke-width=\"1\" fill=\"none\"/></pattern></defs><rect width=\"100\" height=\"100\" fill=\"url(%23grid)\"/></svg>'); opacity: 0.3;"></div>
                <div style="position: relative; z-index: 1;">
                  <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">🏛️ Garden of Memories</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px; font-weight: 300;">Admin Notification System</p>
                </div>
              </div>

              <!-- Notification badge -->
              <div style="background: linear-gradient(135deg, #e3f2fd 0%, #e1f5fe 100%); padding: 16px 32px; text-align: center; border-bottom: 1px solid #81c784;">
                <div style="display: inline-flex; align-items: center; gap: 10px; background: #ffffff; padding: 8px 20px; border-radius: 20px; box-shadow: 0 3px 10px rgba(108, 117, 125, 0.2);">
                  <span style="font-size: 18px;">🔔</span>
                  <span style="color: #495057; font-weight: 600; font-size: 14px;">ADMIN NOTIFICATION</span>
                </div>
              </div>

              <!-- Main content -->
              <div style="padding: 40px 32px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <div style="display: inline-block; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 50%; padding: 16px; margin-bottom: 20px;">
                    <span style="font-size: 40px;">📊</span>
                  </div>
                  <h2 style="color: #495057; margin: 0 0 12px 0; font-size: 24px; font-weight: 600;">Reservation Status Update</h2>
                  <p style="color: #6c757d; margin: 0; font-size: 16px; line-height: 1.5;">A reservation status has been updated and requires your attention.</p>
                </div>

                <!-- Status change summary -->
                <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border: 1px solid #ffb74d; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
                  <h3 style="color: #e65100; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Status Change Summary</h3>
                  <div style="display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap;">
                    <div style="background: #ffffff; padding: 12px 20px; border-radius: 8px; border: 1px solid #ddd;">
                      <span style="color: #666; font-size: 12px; text-transform: uppercase; display: block;">Previous</span>
                      <span style="color: #6c757d; font-weight: 600; font-size: 14px;">${oldStatus}</span>
                    </div>
                    <span style="color: #ff9800; font-size: 20px;">→</span>
                    <div style="background: #ffffff; padding: 12px 20px; border-radius: 8px; border: 1px solid #ddd;">
                      <span style="color: #666; font-size: 12px; text-transform: uppercase; display: block;">Current</span>
                      <span style="color: #e65100; font-weight: 600; font-size: 14px; text-transform: uppercase;">${status}</span>
                    </div>
                  </div>
                </div>

                <!-- Reservation details -->
                <div style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 1px solid #dee2e6; border-radius: 12px; padding: 28px; margin: 24px 0;">
                  <h3 style="color: #495057; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">📋</span>
                    Reservation Details
                  </h3>
                  
                  <div style="display: grid; gap: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #ffffff; border-radius: 8px; border-left: 3px solid #6c757d;">
                      <span style="color: #666; font-weight: 500; font-size: 14px;">Reservation ID:</span>
                      <span style="color: #495057; font-weight: 600; font-family: 'Courier New', monospace; font-size: 14px;">${reservation._id}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #ffffff; border-radius: 8px; border-left: 3px solid #6c757d;">
                      <span style="color: #666; font-weight: 500; font-size: 14px;">Client Name:</span>
                      <span style="color: #495057; font-weight: 600; font-size: 14px;">${reservation.clientName}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #ffffff; border-radius: 8px; border-left: 3px solid #6c757d;">
                      <span style="color: #666; font-weight: 500; font-size: 14px;">Client Contact:</span>
                      <span style="color: #495057; font-weight: 600; font-size: 14px;">${reservation.clientContact}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #ffffff; border-radius: 8px; border-left: 3px solid #6c757d;">
                      <span style="color: #666; font-weight: 500; font-size: 14px;">Lot ID:</span>
                      <span style="color: #495057; font-weight: 600; font-size: 14px;">${reservation.lotId}</span>
                    </div>
                  </div>
                </div>

                <!-- Update information -->
                <div style="background: linear-gradient(135deg, #e3f2fd 0%, #e1f5fe 100%); border: 1px solid #81c784; border-radius: 12px; padding: 24px; margin: 24px 0;">
                  <h3 style="color: #0277bd; margin: 0 0 16px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">👤</span>
                    Update Information
                  </h3>
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(255,255,255,0.8); border-radius: 8px;">
                    <span style="color: #0277bd; font-weight: 500; font-size: 14px;">Updated By:</span>
                    <span style="color: #01579b; font-weight: 600; font-size: 14px;">${req.user.role.toUpperCase()} (${req.user.email})</span>
                  </div>
                </div>

                <!-- System note -->
                <div style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #dee2e6; text-align: center;">
                  <p style="color: #6c757d; margin: 0; font-size: 14px; line-height: 1.5; font-style: italic;">
                    This is an automated notification for administrative purposes. No action is required unless specified by your organization's procedures.
                  </p>
                </div>
              </div>

              <!-- Footer -->
              <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 24px 32px; text-align: center; border-top: 1px solid #e9ecef;">
                <p style="color: #6c757d; margin: 0 0 6px 0; font-size: 14px; font-weight: 500;">© 2024 Garden of Memories Memorial Park</p>
                <p style="color: #adb5bd; margin: 0; font-size: 12px;">Admin Notification System | Pateros, Philippines</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const adminEmailSent = await sendReservationEmail(
        process.env.ADMIN_EMAIL,
        'Admin Notification - Reservation Status Update',
        adminEmailContent
      );

      if (!adminEmailSent) {
        console.warn('Failed to send admin notification email');
      }
    }

    res.json({
      success: true,
      message: 'Reservation status updated successfully',
      reservation,
      emailSent: sendEmail !== 'false',
      adminNotified: notifyAdmin === 'true'
    });
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router; 