import express from 'express';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Reservation from '../models/Reservation.js';
import Lot from '../models/Lot.js';
import ActivityLogs from '../models/ActivityLogs.js';
import { ChatbotConfig } from '../models/ChatbotConfig.js';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

dotenv.config();
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = 'uploads/proofs';
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `proof-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and PDF files are allowed.'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper function to get real-time cemetery data
async function getCemeteryData() {
  try {
    const [lots, reservations] = await Promise.all([
      Lot.countDocuments({ status: 'available' }),
      Reservation.countDocuments()
    ]);

    // Calculate average pricing
    const availableLots = await Lot.find({ status: 'available' }).limit(5);
    const totalPrice = availableLots.reduce((sum, lot) => {
      const sqm = parseFloat(lot.sqm) || 12.5;
      const pricePerSqm = parseFloat(lot.pricePerSqm) || 4000;
      return sum + (sqm * pricePerSqm);
    }, 0);
    const avgPrice = availableLots.length > 0 ? totalPrice / availableLots.length : 50000;

    return {
      availablePlots: lots,
      totalReservations: reservations,
      averagePrice: Math.round(avgPrice),
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching cemetery data:', error);
    return {
      availablePlots: 'unavailable',
      totalReservations: 'unavailable',
      averagePrice: 50000,
      lastUpdated: new Date().toISOString()
    };
  }
}

// Enhanced system prompt with dynamic data
function createEnhancedSystemPrompt(cemeteryData, baseSystemPrompt) {
  return `${baseSystemPrompt}

GARDEN OF MEMORIES MEMORIAL PARK INFORMATION:

🏛️ HISTORY & ESTABLISHMENT:
- Founded: January 1978 under TAPAT Park Developers, Inc.
- Established by: Engr. Tomas Sanchez Jr.
- Location: Pateros, Philippines
- Started operations: July 1978
- Initial capital: ₱25 million
- Founded to address overcrowded and unsightly conditions of local cemeteries
- 40th Anniversary: 2018, with new Columbarium and Chapel Complex
- Recognition: One of the premier memorial parks in the Philippines

⏰ OPERATING HOURS:
- Monday – Friday: 9:00 AM – 5:00 PM
- Saturday – Sunday: 10:00 AM – 4:00 PM
- Holidays: 10:00 AM – 2:00 PM

📋 VISITING POLICIES:
- Please check in at the reception area upon arrival
- Maintain silence and respect for other visitors
- No outside food and drinks allowed within the grounds
- Keep the premises clean at all times
- Follow designated pathways
- Photography requires permission from management

🏗️ FACILITIES & AMENITIES:
- Memorial Church: Peaceful sanctuary for prayer and reflection
- Memorial Garden: Beautifully landscaped gardens for quiet contemplation
- Memorial Chapel: Intimate space for private ceremonies
- Fountain Plaza: Serene water feature with seating areas
- Parking Area: Spacious parking facility with 24/7 security
- Columbarium: Modern facility for cremated remains
- Chapel Complex: Full-service facility for memorial services

💰 REAL-TIME PLOT INFORMATION (Updated: ${new Date().toLocaleDateString()}):
- Available plots: ${cemeteryData.availablePlots} plots currently available
- Total reservations: ${cemeteryData.totalReservations} reservations made
- Standard plot size: 12.5 square meters
- Base price: ₱4,000 per square meter
- Average plot price: ₱${cemeteryData.averagePrice.toLocaleString()}
- Reservation fee: 10% of total plot price (required to secure plot)
- Payment methods: Cash, GCash, Bank Transfer
- Reservation policy: 10% deposit required, full payment within 30 days
- Cancellation: Must be made 7 days before scheduled service

📞 CONTACT & LOCATION:
- Location: Pateros, Philippines
- For specific grave locations or detailed inquiries, direct visitors to contact our staff directly for privacy and security reasons

📝 RESERVATION SERVICES - CRITICAL INSTRUCTIONS:

⚠️ NEVER tell users to email payment proof to any email address!
⚠️ ALWAYS direct users to use the built-in reservation system with file upload!

🚨 CRITICAL UPLOAD INSTRUCTIONS - READ CAREFULLY 🚨

IF USERS MENTION UPLOADING PAYMENT PROOF OR COMPLETING PAYMENTS:

YOU MUST RESPOND EXACTLY LIKE THIS:
"I understand you want to upload payment proof, but I need to direct you to our working reservation system. 

Please start a NEW conversation by:
1. Clear this chat (click the refresh button)
2. Type: 'I want to make a reservation' 
3. Follow the step-by-step process

The upload feature ONLY works within the official reservation flow, not in regular chat."

🚨 NEVER SAY:
- "Upload the payment proof here"
- "Upload in our official system" 
- "I'll guide you through the uploading process"
- Any variation of upload instructions

🚨 ALWAYS SAY:
- "Please start a new reservation process to access the upload feature"
- "The upload button appears only after completing reservation steps"

PAYMENT PROOF PROCESS:
- After reservation: User pays online (GCash/Bank Transfer)
- Then: User uploads proof file directly in this chatbot (NOT email!)
- Admin sees: Pending reservation with attached proof file for review

NEVER MENTION:
- Emailing proof to reservations@gardenofmemories.ph
- Sending screenshots to any email
- Manual email submission processes

ALWAYS SAY:
- "I'll help you make a reservation right now!"
- "You can upload your payment proof directly here after payment"
- "The admin will see your proof file attached to your reservation"

🌿 SPECIAL FEATURES:
- Employee welfare programs
- Continuous facility expansion
- Professional landscaping and maintenance
- Community-focused memorial services

Always be compassionate, respectful, and professional. Provide specific information about Garden of Memories when available. For personal inquiries, plot locations, or detailed pricing, direct visitors to contact our staff directly. When discussing plot availability, use the real-time data provided above.`;
}

// Setup Gmail API client (reuse from auth.js)
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// Get chatbot configuration (public access for quick questions)
router.get('/config', async (req, res) => {
  try {
    const config = await ChatbotConfig.getActiveConfig();
    const userType = req.query.userType || 'all';
    
    res.json({
      success: true,
      data: {
        quickQuestions: config.getQuickQuestions(userType),
        faqResponses: config.getFaqResponses(userType)
      }
    });
  } catch (error) {
    console.error('Error fetching chatbot config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chatbot configuration'
    });
  }
});

// Guest chatbot endpoint (public access, no authentication required)
router.post('/guest-message', async (req, res) => {
  try {
    const { message, conversationHistory, isGuest } = req.body;

    // Validate input
    if (!message || !conversationHistory) {
      return res.status(400).json({ error: 'Message and conversation history are required' });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return res.status(500).json({ error: 'AI service not configured' });
    }

    // Get dynamic guest system prompt from configuration
    const config = await ChatbotConfig.getActiveConfig();
    const guestSystemPrompt = config.guestSystemPrompt;

    // Prepare conversation for OpenAI
    const openaiMessages = conversationHistory.map(msg => {
      if (msg.role === 'system') {
        return { role: 'system', content: guestSystemPrompt };
      }
      return { role: msg.role, content: msg.content };
    });

    // Add current message
    openaiMessages.push({ role: 'user', content: message });

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: openaiMessages,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      return res.status(response.status).json({ 
        error: 'Failed to get AI response',
        details: errorData.error?.message || 'Unknown error'
      });
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Return the AI response
    res.json({ 
      response: aiResponse,
      usage: data.usage
    });

  } catch (error) {
    console.error('Guest chatbot API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process guest chatbot request'
    });
  }
});

// Secure chatbot endpoint that calls OpenAI API with dynamic cemetery data
router.post('/message', async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    // Validate input
    if (!message || !conversationHistory) {
      return res.status(400).json({ error: 'Message and conversation history are required' });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return res.status(500).json({ error: 'AI service not configured' });
    }

    // Fetch real-time cemetery data and chatbot configuration
    const [cemeteryData, config] = await Promise.all([
      getCemeteryData(),
      ChatbotConfig.getActiveConfig()
    ]);
    
    // Create enhanced system prompt with real-time data and dynamic configuration
    const enhancedSystemPrompt = createEnhancedSystemPrompt(cemeteryData, config.systemPrompt);
    
    // Update conversation history with enhanced system prompt
    const enhancedConversationHistory = conversationHistory.map(msg => {
      if (msg.role === 'system') {
        return { role: 'system', content: enhancedSystemPrompt };
      }
      return msg;
    });

    // Call OpenAI API securely from backend
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` // Backend env variable (secure)
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: enhancedConversationHistory,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      return res.status(response.status).json({ 
        error: 'Failed to get AI response',
        details: errorData.error?.message || 'Unknown error'
      });
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    // Return the AI response with cemetery data
    res.json({ 
      reply,
      cemeteryData: {
        availablePlots: cemeteryData.availablePlots,
        totalReservations: cemeteryData.totalReservations,
        lastUpdated: cemeteryData.lastUpdated
      },
      usage: data.usage // Optional: include usage statistics
    });

  } catch (error) {
    console.error('Chatbot API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process chatbot request'
    });
  }
});

// Helper function to get available lots for reservation
async function getAvailableLotsForReservation() {
  try {
    const availableLots = await Lot.find({ status: 'available' })
      .select('id sqm location pricePerSqm')
      .limit(10)
      .sort({ id: 1 });
    
    return availableLots.map(lot => ({
      id: lot.id,
      sqm: lot.sqm || 12.5,
      location: lot.location || 'Garden Section',
      pricePerSqm: lot.pricePerSqm || 4000,
      totalPrice: (lot.sqm || 12.5) * (lot.pricePerSqm || 4000),
      reservationFee: Math.round(((lot.sqm || 12.5) * (lot.pricePerSqm || 4000)) * 0.10)
    }));
  } catch (error) {
    console.error('Error fetching available lots:', error);
    return [];
  }
}

// Helper function to create reservation
async function createChatbotReservation(reservationData) {
  try {
    // Validate required fields
    const { lotId, lotName, clientName, clientContact, clientEmail, paymentMethod, userId, userToken } = reservationData;
    
    if (!lotName || !clientName || !clientContact || !clientEmail || !paymentMethod) {
      return { success: false, error: 'Missing required information' };
    }

    // Try to find the actual lot by name or ID
    let actualLot = null;
    try {
      // Search for lot by ID first, then by name
      actualLot = await Lot.findOne({
        $or: [
          { id: lotName },
          { name: lotName },
          { id: { $regex: lotName, $options: 'i' } },
          { name: { $regex: lotName, $options: 'i' } }
        ]
      });
      
    } catch (err) {
      // Lot lookup error handled below
    }

    // If lot not found, check if it's available
    if (actualLot && actualLot.status !== 'available') {
      return { success: false, error: `Lot ${lotName} is not available for reservation` };
    }

    // Use actual lot data if found, otherwise use defaults
    const sqm = actualLot?.sqm || 12.5;
    const pricePerSqm = actualLot?.pricePerSqm || 4000;
    const location = actualLot?.location || 'Garden Section';
    const totalPrice = sqm * pricePerSqm;
    const reservationFee = Math.round(totalPrice * 0.10);

    // Use real user ID if provided, otherwise create dummy ObjectId
    const mongoose = await import('mongoose');
    let clientId;
    
    if (userId && mongoose.default.Types.ObjectId.isValid(userId)) {
      clientId = userId; // Use the string directly, not wrapped in ObjectId constructor
    } else {
      clientId = new mongoose.default.Types.ObjectId();
    }
    
    // Create reservation with chatbot data
    const reservation = await Reservation.create({
      lotId: actualLot?.id || lotName,
      lotName: lotName,
      clientName: clientName,
      clientContact: clientContact,
      clientEmail: clientEmail,
      clientId: clientId, // Use real user ID if available
      paymentMethod: paymentMethod,
      paymentAmount: reservationFee.toString(), // Ensure it's a string
      totalPrice: totalPrice.toString(), // Ensure it's a string
      status: 'pending', // Chatbot reservations start as pending
      sqm: sqm.toString(), // Ensure it's a string
      location: location,
      source: 'chatbot', // Mark as chatbot reservation
      reservationType: 'chatbot_online',
      notes: `Online reservation via chatbot for ${lotName}. Payment proof required. Contact: ${clientEmail}`,
      proofImage: 'pending_upload', // Placeholder to satisfy required field
      payment: {
        method: paymentMethod,
        amount: reservationFee,
        status: 'pending',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
      },
      attachments: {
        paymentProof: 'pending_upload', // Placeholder for payment proof
        documents: 'ready_for_processing'
      }
    });

    // Update lot status to 'reserved' if actual lot was found
    if (actualLot) {
      await Lot.findByIdAndUpdate(actualLot._id, { 
        status: 'reserved',
        reservedBy: clientEmail,
        reservedAt: new Date()
      });
    }

    // Log activity (use the same client ID for consistency)
    await ActivityLogs.create({
      userId: clientId, // Use the same client ObjectId
      userName: clientName,
      userRole: 'client', 
      action: 'chatbot_reservation',
      details: `Chatbot online reservation for ${lotName} by ${clientName} (${clientEmail})`
    });

    // Don't send email here - send it after upload instead

    return { 
      success: true, 
      reservation: {
        id: reservation._id,
        lotId: actualLot?.id || lotName,
        lotName: lotName,
        clientName: clientName,
        clientEmail: clientEmail,
        clientContact: clientContact,
        totalPrice: totalPrice,
        reservationFee: reservationFee,
        paymentMethod: paymentMethod,
        status: 'pending',
        actualLotFound: !!actualLot
      }
    };

  } catch (error) {
    return { success: false, error: 'Failed to create reservation' };
  }
}

// POST /api/chatbot/create-reservation
// Endpoint for chatbot to create reservations
router.post('/create-reservation', async (req, res) => {
  try {
    const { lotId, lotName, clientName, clientContact, clientEmail, paymentMethod, userId, userToken } = req.body;
    
    const result = await createChatbotReservation({
      lotId,
      lotName,
      clientName,
      clientContact,
      clientEmail,
      paymentMethod,
      userId,
      userToken
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/chatbot/available-lots
// Endpoint to get available lots for reservation
router.get('/available-lots', async (req, res) => {
  try {
    const lots = await getAvailableLotsForReservation();
    res.json({ success: true, lots });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch available lots' 
    });
  }
});

// GET /api/chatbot/cemetery-stats
// Endpoint to get real-time cemetery statistics
router.get('/cemetery-stats', async (req, res) => {
  try {
    const data = await getCemeteryData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cemetery statistics' });
  }
});

// POST /api/chatbot/upload-proof
// Endpoint for uploading payment proof for chatbot reservations
router.post('/upload-proof', upload.single('proofImage'), async (req, res) => {
  try {
    const { reservationId, isTemporary } = req.body;
    
    if (!reservationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Reservation ID is required' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    // Handle temporary uploads (when user uploads without completing reservation)
    if (isTemporary === 'true' || reservationId.startsWith('temp-upload-')) {
      return res.json({ 
        success: true, 
        message: 'File uploaded successfully! Please note: This is a temporary upload. To properly submit payment proof, please complete the full reservation process.',
        filename: req.file.filename,
        isTemporary: true
      });
    }

    // Find and update the reservation
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      // Delete uploaded file if reservation not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ 
        success: false, 
        error: 'Reservation not found' 
      });
    }

    // Update reservation with proof image path
    reservation.proofImage = req.file.path;
    reservation.paymentProofUploaded = true;
    reservation.paymentProofUploadedAt = new Date();
    await reservation.save();

    // Log activity (using dummy ObjectId since chatbot users don't have real accounts)
    const mongoose = await import('mongoose');
    const dummyUserId = new mongoose.default.Types.ObjectId();
    
    await ActivityLogs.create({
      userId: dummyUserId,
      userName: reservation.clientName,
      userRole: 'client',
      action: 'payment_proof_upload',
      details: `Payment proof uploaded for reservation ${reservationId} via chatbot`
    });

    // Send confirmation email now that upload is complete
    // EMAIL IS REQUIRED FOR RESERVATION COMPLETION
    let emailSent = false;
    let emailError = null;
    
    try {
      // Check if email is configured
      if (!process.env.EMAIL_FROM) {
        emailError = 'Email not configured - EMAIL_FROM missing';
        throw new Error(emailError);
      }
      
      // Validate required email fields - check both clientEmail and clientContact
      const emailToUse = reservation.clientEmail || reservation.clientContact;
      if (!emailToUse || !emailToUse.includes('@')) {
        emailError = 'No valid email found in reservation';
        throw new Error(emailError);
      }
        
      if (!reservation.clientName) {
        reservation.clientName = 'Valued Customer';
      }
      
      const emailContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Proof Received - Garden of Memories</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              
              <!-- Header -->
              <div style="background-color: #ffffff; padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #e9ecef;">
                <h1 style="color: #212529; margin: 0 0 8px 0; font-size: 24px; font-weight: 600; letter-spacing: -0.02em;">Garden of Memories</h1>
                <p style="color: #6c757d; margin: 0; font-size: 14px; font-weight: 400;">Memorial Park</p>
              </div>

              <!-- Status indicator -->
              <div style="background-color: #d4edda; padding: 16px 40px; text-align: center; border-bottom: 1px solid #c3e6cb;">
                <span style="color: #155724; font-weight: 600; font-size: 14px;">PAYMENT PROOF RECEIVED</span>
              </div>

              <!-- Main content -->
              <div style="padding: 40px 40px 20px 40px;">
                <h2 style="color: #212529; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Payment proof submitted</h2>
                <p style="color: #6c757d; font-size: 16px; margin: 0 0 32px 0;">Dear <strong>${reservation.clientName}</strong>, thank you for submitting your payment proof. Your reservation is now complete and awaiting staff approval.</p>

                <!-- Reservation details -->
                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin: 32px 0; border-left: 3px solid #495057;">
                  <h3 style="color: #212529; margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">Reservation Details</h3>
                  
                  <div style="display: grid; gap: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #dee2e6;">
                      <span style="color: #495057; font-size: 14px; font-weight: 500;">Reservation ID</span>
                      <span style="color: #212529; font-size: 14px; font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;">${reservation._id || 'N/A'}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #dee2e6;">
                      <span style="color: #495057; font-size: 14px; font-weight: 500;">Plot Name</span>
                      <span style="color: #212529; font-size: 14px;">${reservation.lotName || 'N/A'}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #dee2e6;">
                      <span style="color: #495057; font-size: 14px; font-weight: 500;">Location</span>
                      <span style="color: #212529; font-size: 14px;">${reservation.location || 'Garden of Memories Memorial Park'}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #dee2e6;">
                      <span style="color: #495057; font-size: 14px; font-weight: 500;">Size</span>
                      <span style="color: #212529; font-size: 14px;">${reservation.sqm || '12.5'} square meters</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #dee2e6;">
                      <span style="color: #495057; font-size: 14px; font-weight: 500;">Total Price</span>
                      <span style="color: #212529; font-size: 14px;">₱${Number(reservation.totalPrice || 50000).toLocaleString()}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #dee2e6;">
                      <span style="color: #495057; font-size: 14px; font-weight: 500;">Amount Paid</span>
                      <span style="color: #212529; font-size: 14px;">₱${Number(reservation.paymentAmount || 5000).toLocaleString()}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
                      <span style="color: #495057; font-size: 14px; font-weight: 500;">Payment Method</span>
                      <span style="color: #212529; font-size: 14px;">${reservation.paymentMethod || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <!-- Next steps -->
                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin: 32px 0; border-left: 3px solid #495057;">
                  <h3 style="color: #212529; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">What happens next</h3>
                  <ol style="color: #495057; margin: 0; padding-left: 20px; font-size: 14px;">
                    <li style="margin-bottom: 6px;">Our staff will verify your payment within 24 hours during business hours</li>
                    <li style="margin-bottom: 6px;">You'll receive a confirmation call once approved</li>
                    <li style="margin-bottom: 6px;">Complete reservation documents will be emailed to you</li>
                    <li>Complete remaining balance within 30 days after approval</li>
                  </ol>
                </div>

                <!-- Contact information -->
                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin: 32px 0;">
                  <h3 style="color: #212529; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Questions or assistance?</h3>
                  <p style="color: #6c757d; margin: 0 0 12px 0; font-size: 14px;">If you have any questions about your reservation, please contact us:</p>
                  <div style="margin-top: 16px;">
                    <p style="color: #495057; margin: 0 0 4px 0; font-size: 14px;">Email: reservations@gardenofmemories.ph</p>
                    <p style="color: #495057; margin: 0 0 4px 0; font-size: 14px;">Office: Garden of Memories Memorial Park, Pateros</p>
                    <p style="color: #495057; margin: 0; font-size: 14px;">Hours: Mon-Fri 9AM-5PM, Weekends 10AM-4PM</p>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div style="background-color: #f8f9fa; padding: 24px 40px; text-align: center; border-top: 1px solid #e9ecef;">
                <p style="color: #6c757d; margin: 0 0 8px 0; font-size: 13px;">© 2024 Garden of Memories Memorial Park</p>
                <p style="color: #adb5bd; margin: 0; font-size: 12px;">Pateros, Philippines</p>
                <p style="color: #adb5bd; margin: 8px 0 0 0; font-size: 11px;">This confirmation was sent after payment proof upload via our AI Assistant chatbot.</p>
              </div>
            </div>
          </body>
          </html>
      `;

      const encodedMessage = Buffer.from(
        `To: ${emailToUse}\r\nFrom: "Garden of Memories Memorial Park" <${process.env.EMAIL_FROM}>\r\nSubject: ✅ Payment Proof Received - Garden of Memories Memorial Park\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${emailContent}`
      ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
      emailSent = true;
      
    } catch (error) {
      emailError = error.message;
      emailSent = false;
    }
    
    // If email failed, revert the reservation and lot status
    if (!emailSent) {
      try {
        // Find and revert the lot status if it was marked as reserved
        const lotToRevert = await Lot.findOne({ 
          $or: [
            { id: reservation.lotId },
            { name: reservation.lotName },
            { id: { $regex: reservation.lotName, $options: 'i' } },
            { name: { $regex: reservation.lotName, $options: 'i' } }
          ]
        });
        
        if (lotToRevert && lotToRevert.status === 'reserved') {
          await Lot.findByIdAndUpdate(lotToRevert._id, { 
            status: 'available',
            $unset: { reservedBy: 1, reservedAt: 1 }
          });
        }
        
        // Delete the reservation since email failed
        await Reservation.findByIdAndDelete(reservationId);
        
        // Delete uploaded file since reservation failed
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        return res.status(500).json({ 
          success: false, 
          error: `Reservation failed: Unable to send confirmation email (${emailError}). Please check your email address and try again.`,
          emailError: emailError
        });
        
      } catch (revertError) {
        return res.status(500).json({ 
          success: false, 
          error: `Reservation and email failed. Please contact staff to resolve this issue. Error: ${emailError}`,
          emailError: emailError
        });
      }
    }

    // Only reach here if email was sent successfully
    res.json({ 
      success: true, 
      message: 'Payment proof uploaded successfully and confirmation email sent',
      filename: req.file.filename,
      emailSent: true
    });

  } catch (error) {
    // Delete uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to upload payment proof' 
    });
  }
});

// POST /api/chatbot/fix-orphaned-reservations
// Endpoint to fix old chatbot reservations that have dummy user IDs
router.post('/fix-orphaned-reservations', async (req, res) => {
  try {
    const { userEmail, userContact, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // Find orphaned chatbot reservations by email/contact/clientId mismatch
    const query = {
      source: 'chatbot',
      $or: [
        // Find reservations where clientId doesn't match the current user ID
        { clientId: { $ne: userId } }
      ]
    };
    
    // Also add email/contact matching if provided
    if (userEmail) {
      query.$or.push({ clientEmail: userEmail });
    }
    if (userContact) {
      query.$or.push({ clientContact: userContact });
    }

    const orphanedReservations = await Reservation.find(query);

    // Update these reservations to use the correct user ID
    const updateResult = await Reservation.updateMany(
      query,
      { $set: { clientId: userId } }
    );

    res.json({ 
      success: true, 
      message: `Successfully linked ${updateResult.modifiedCount} orphaned reservations to your account`,
      fixedCount: updateResult.modifiedCount
    });

      } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fix orphaned reservations' 
    });
  }
});

// POST /api/chatbot/test-email
// Test endpoint to check email configuration
router.post('/test-email', async (req, res) => {
  try {
    const { testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Test email address is required' 
      });
    }

    // Check if email is configured
    if (!process.env.EMAIL_FROM) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email not configured - EMAIL_FROM missing in environment variables' 
      });
    }

    const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #17a2b8; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">🏛️ Garden of Memories Memorial Park</h1>
            <p style="margin: 5px 0 0 0;">📧 Email Configuration Test</p>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #17a2b8;">Email Test Successful!</h2>
            
            <p>This is a test email to verify that the email configuration is working correctly.</p>
            
            <div style="background: white; border: 2px solid #17a2b8; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #17a2b8; margin-top: 0;">📋 Configuration Details</h3>
              <p><strong>Email Service:</strong> Gmail API</p>
              <p><strong>Sender:</strong> ${process.env.EMAIL_FROM}</p>
              <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <p>If you received this email, the email configuration is working properly!</p>
          </div>
        </div>
    `;

    const encodedMessage = Buffer.from(
      `To: ${testEmail}\r\nFrom: "Garden of Memories Memorial Park" <${process.env.EMAIL_FROM}>\r\nSubject: 📧 Email Test - Garden of Memories Memorial Park\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${emailContent}`
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });

    res.json({ 
      success: true, 
      message: `Test email sent successfully to ${testEmail}`,
      emailFrom: process.env.EMAIL_FROM
    });

  } catch (error) {
    console.error('Email test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: `Email test failed: ${error.message}`,
      details: error.code || 'Unknown error'
    });
  }
});

export default router; 