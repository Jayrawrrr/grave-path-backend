import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All profile routes require authentication
router.use(protect(['client', 'staff', 'admin']));

/**
 * GET /api/profile
 * Get current user's profile
 */
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -verificationCode')
      .populate('staffData.supervisor', 'firstName lastName email');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * PUT /api/profile
 * Update current user's profile
 */
router.put('/', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const {
      firstName,
      lastName,
      profile,
      clientData,
      staffData,
      adminData
    } = req.body;

    // Update basic information
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;

    // Update profile information
    if (profile) {
      user.profile = { ...user.profile, ...profile };
    }

    // Update role-specific data based on user's role
    if (user.role === 'client' && clientData) {
      user.clientData = { ...user.clientData, ...clientData };
    } else if (user.role === 'staff' && staffData) {
      // Don't allow staff to change their own supervisor or permissions
      const { supervisor, permissions, ...allowedStaffData } = staffData;
      user.staffData = { ...user.staffData, ...allowedStaffData };
    } else if (user.role === 'admin' && adminData) {
      user.adminData = { ...user.adminData, ...adminData };
    }

    await user.save();

    // Return updated user without sensitive data
    const updatedUser = await User.findById(user._id)
      .select('-password -verificationCode')
      .populate('staffData.supervisor', 'firstName lastName email');

    res.json(updatedUser);
  } catch (err) {
    console.error('Update profile error:', err);
    console.error('Error details:', err.message);
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        msg: errors[0] || 'Validation error',
        errors: errors 
      });
    }
    
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

/**
 * PUT /api/profile/password
 * Change user's password
 */
router.put('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ msg: 'Current password and new password are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.json({ msg: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * POST /api/profile/request-email-change
 * Request to change email - sends verification code to new email
 */
router.post('/request-email-change', async (req, res) => {
  try {
    const { newEmail } = req.body;
    
    if (!newEmail) {
      return res.status(400).json({ msg: 'New email is required' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ msg: 'Invalid email format' });
    }
    
    // Check if new email already exists
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) {
      return res.status(400).json({ msg: 'Email already exists' });
    }
    
    // Get current user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Generate 6-digit verification code
    const crypto = await import('crypto');
    const code = crypto.default.randomBytes(3).toString('hex').toUpperCase();
    
    // Store the code and new email temporarily
    user.verificationCode = code;
    user.pendingEmail = newEmail;
    await user.save();
    
    // Send verification email using Gmail API
    const { google } = await import('googleapis');
    const { OAuth2Client } = await import('google-auth-library');
    
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
    
    const gmail = google.google.gmail({ version: 'v1', auth: oauth2Client });
    
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Change Verification - Garden of Memories</title>
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
            <h2 style="color: #212529; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Verify your new email address</h2>
            <p style="color: #6c757d; font-size: 16px; margin: 0 0 32px 0;">You've requested to change your email address. Please enter the verification code below to confirm this change.</p>

            <!-- Verification code -->
            <div style="text-align: center; margin: 32px 0;">
              <p style="color: #495057; font-size: 14px; margin: 0 0 12px 0; font-weight: 500;">Verification Code</p>
              <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 0 auto; max-width: 280px;">
                <span style="font-size: 28px; font-weight: 600; color: #212529; letter-spacing: 3px; font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;">
${code}
                </span>
              </div>
            </div>

            <!-- Instructions -->
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin: 32px 0; border-left: 3px solid #495057;">
              <h3 style="color: #212529; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Instructions</h3>
              <ol style="color: #495057; margin: 0; padding-left: 20px; font-size: 14px;">
                <li style="margin-bottom: 6px;">Copy the verification code above</li>
                <li style="margin-bottom: 6px;">Return to your profile page</li>
                <li style="margin-bottom: 6px;">Enter the code in the verification field</li>
                <li>Complete the email change</li>
              </ol>
            </div>

            <!-- Security notice -->
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <h4 style="color: #856404; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Security Notice</h4>
              <p style="color: #856404; margin: 0; font-size: 13px;">This code expires in 10 minutes. If you didn't request this change, please secure your account immediately.</p>
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
      `To: ${newEmail}\r\n` +
      `From: ${process.env.EMAIL_FROM}\r\n` +
      `Subject: GravePath Email Change Verification\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n` +
      emailContent
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });
    
    res.json({ msg: 'Verification code sent to new email' });
  } catch (err) {
    console.error('Request email change error:', err);
    res.status(500).json({ msg: 'Failed to send verification code' });
  }
});

/**
 * POST /api/profile/verify-email-change
 * Verify the code and update email
 */
router.post('/verify-email-change', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ msg: 'Verification code is required' });
    }
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    if (!user.verificationCode || !user.pendingEmail) {
      return res.status(400).json({ msg: 'No pending email change request' });
    }
    
    if (user.verificationCode !== code) {
      return res.status(400).json({ msg: 'Invalid verification code' });
    }
    
    // Check again if the new email is still available
    const existingUser = await User.findOne({ email: user.pendingEmail });
    if (existingUser) {
      user.verificationCode = undefined;
      user.pendingEmail = undefined;
      await user.save();
      return res.status(400).json({ msg: 'Email already taken by another user' });
    }
    
    // Update email
    user.email = user.pendingEmail;
    user.verificationCode = undefined;
    user.pendingEmail = undefined;
    user.emailVerified = true;
    await user.save();
    
    // Return updated user without sensitive data
    const updatedUser = await User.findById(user._id)
      .select('-password -verificationCode')
      .populate('staffData.supervisor', 'firstName lastName email');
    
    res.json({ 
      msg: 'Email updated successfully',
      user: updatedUser
    });
  } catch (err) {
    console.error('Verify email change error:', err);
    res.status(500).json({ msg: 'Failed to verify email change' });
  }
});

/**
 * GET /api/profile/:id
 * Get another user's profile (admin/staff only, limited information)
 */
router.get('/:id', protect(['admin', 'staff']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -verificationCode -adminData.specialPermissions')
      .populate('staffData.supervisor', 'firstName lastName email');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Staff can only view basic info of other users
    if (req.user.role === 'staff' && user.role === 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    res.json(user);
  } catch (err) {
    console.error('Get user profile error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * PUT /api/profile/:id (Admin only)
 * Update another user's profile
 */
router.put('/:id', protect(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const {
      firstName,
      lastName,
      profile,
      clientData,
      staffData,
      adminData,
      isActive
    } = req.body;

    // Update basic information
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (isActive !== undefined) user.isActive = isActive;

    // Update profile information
    if (profile) {
      user.profile = { ...user.profile, ...profile };
    }

    // Update role-specific data
    if (user.role === 'client' && clientData) {
      user.clientData = { ...user.clientData, ...clientData };
    } else if (user.role === 'staff' && staffData) {
      user.staffData = { ...user.staffData, ...staffData };
    } else if (user.role === 'admin' && adminData) {
      user.adminData = { ...user.adminData, ...adminData };
    }

    await user.save();

    // Return updated user without sensitive data
    const updatedUser = await User.findById(user._id)
      .select('-password -verificationCode')
      .populate('staffData.supervisor', 'firstName lastName email');

    res.json(updatedUser);
  } catch (err) {
    console.error('Admin update profile error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router; 