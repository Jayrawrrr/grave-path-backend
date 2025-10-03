import express    from 'express';
import bcrypt     from 'bcryptjs';
import jwt        from 'jsonwebtoken';
import crypto     from 'crypto';
import nodemailer from 'nodemailer';
import dotenv     from 'dotenv';
import User       from '../models/User.js';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

dotenv.config();
const router = express.Router();

// Configure OAuth2 client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// 1) send code
router.post('/send-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate input
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Check if user already exists with verified email
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.emailVerified && existingUser.password) {
      return res.status(400).json({ message: 'Email already exists with an active account' });
    }
    
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    let user = existingUser; // Use the user we already found
    if (!user) {
      user = new User({ email, verificationCode: code });
    } else {
      user.verificationCode = code;
      user.emailVerified = false;
    }
    await user.save();

    // Minimalist professional HTML email content
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification - Garden of Memories</title>
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
            <h2 style="color: #212529; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Verify your email address</h2>
            <p style="color: #6c757d; font-size: 16px; margin: 0 0 32px 0;">Please enter the verification code below to complete your account registration.</p>

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
                <li style="margin-bottom: 6px;">Return to the registration page</li>
                <li style="margin-bottom: 6px;">Enter the code in the verification field</li>
                <li>Complete your account setup</li>
              </ol>
            </div>

            <!-- Security notice -->
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <h4 style="color: #856404; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Security Notice</h4>
              <p style="color: #856404; margin: 0; font-size: 13px;">This code expires in 10 minutes. If you didn't request this verification, please ignore this email.</p>
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

    // Check if email service is configured
    const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'EMAIL_FROM'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('Missing environment variables:', missingVars);
      return res.status(500).json({ message: 'Email service not configured properly' });
    }

    const encodedMessage = Buffer.from(
      `To: ${email}\r\n` +
      `From: ${process.env.EMAIL_FROM}\r\n` +
      `Subject: GravePath Email Verification\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n` +
      emailContent
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Send email using Gmail API
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    res.json({ msg: 'Code sent' });
  } catch (err) {
    console.error('Email verification error:', err);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      status: err.status,
      stack: err.stack
    });
    
    // Log OAuth2 specific details
    if (err.response) {
      console.error('Gmail API Response Error:', {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data
      });
    }
    
    // More specific error handling
    if (err.message && err.message.includes('invalid_grant')) {
      console.error('OAuth2 Token Error - Token likely expired or invalid');
      return res.status(500).json({ message: 'Email authentication failed. Please check OAuth2 configuration.' });
    }
    
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return res.status(500).json({ message: 'Unable to connect to email service. Please try again later.' });
    }
    
    // Check for OAuth2Client setup errors
    if (err.message && (err.message.includes('OAuth2Client') || err.message.includes('client_id'))) {
      return res.status(500).json({ message: 'OAuth2 configuration error. Please check email settings.' });
    }
    
    // Check for Gmail API specific errors
    if (err.message && err.message.includes('quota')) {
      console.error('Gmail API Quota Exceeded');
      return res.status(500).json({ message: 'Email service quota exceeded. Please try again later.' });
    }
    
    if (err.message && err.message.includes('unauthorized')) {
      console.error('Gmail API Unauthorized - Check OAuth2 setup');
      return res.status(500).json({ message: 'Email authentication failed. Please check OAuth2 configuration.' });
    }
    
    res.status(500).json({ message: 'Failed to send verification code. Please try again.' });
  }
});

// 2) verify code
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    if (user?.verificationCode === code) {
      user.emailVerified = true;
      user.verificationCode = undefined;
      await user.save();
      return res.json({ msg: 'Verified', verified: true });
    }
    res.status(400).json({ msg: 'Invalid code', verified: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// 3) register
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;
    
    // Validate first name
    if (!firstName || firstName.trim().length < 2 || firstName.trim().length > 20) {
      return res.status(400).json({ msg: 'First name must be 2-20 characters' });
    }
    if (!/^[a-zA-Z\s\-']+$/.test(firstName.trim())) {
      return res.status(400).json({ msg: 'First name can only contain letters, spaces, hyphens, and apostrophes' });
    }
    
    // Validate last name
    if (!lastName || lastName.trim().length < 2 || lastName.trim().length > 20) {
      return res.status(400).json({ msg: 'Last name must be 2-20 characters' });
    }
    if (!/^[a-zA-Z\s\-']+$/.test(lastName.trim())) {
      return res.status(400).json({ msg: 'Last name can only contain letters, spaces, hyphens, and apostrophes' });
    }
    
    // Validate email
    if (!email || email.trim().length > 30) {
      return res.status(400).json({ msg: 'Email must not exceed 30 characters' });
    }
    
    // Validate password
    if (!password || password.length > 20) {
      return res.status(400).json({ msg: 'Password must not exceed 20 characters' });
    }
    
    if (role === 'client') {
      const found = await User.findOne({ email });
      if (!found) {
        return res.status(400).json({ msg: 'Please verify email first.' });
      }
      if (!found.emailVerified) {
        return res.status(400).json({ msg: 'Please verify email first.' });
      }
      found.firstName = firstName.trim();
      found.lastName  = lastName.trim();
      found.role      = 'client';
      found.password  = await bcrypt.hash(password, 12);
      await found.save();
      return res.status(201).json({ msg: 'Client registered.' });
    }
    // staff/admin flow
    const hash = await bcrypt.hash(password, 12);
    await User.create({ 
      firstName: firstName.trim(), 
      lastName: lastName.trim(), 
      email: email.trim(), 
      password: hash, 
      role 
    });
    res.status(201).json({ msg: `${role} registered.` });
  } catch (err) {
    console.error(err);
    // Return validation errors from mongoose
    if (err.name === 'ValidationError') {
      const firstError = Object.values(err.errors)[0];
      return res.status(400).json({ msg: firstError.message });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// 4) login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ msg: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Forgot Password - Send Verification Code
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ msg: 'No account found with this email' });
    }

    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = code;
    await user.save();

    // Minimalist professional HTML email content
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - Garden of Memories</title>
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
            <h2 style="color: #212529; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Reset your password</h2>
            <p style="color: #6c757d; font-size: 16px; margin: 0 0 32px 0;">We received a request to reset your password. Please use the verification code below to proceed.</p>

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
                <li style="margin-bottom: 6px;">Enter this code on the password reset page</li>
                <li style="margin-bottom: 6px;">Create your new password</li>
                <li>Sign in with your new credentials</li>
              </ol>
            </div>

            <!-- Security notice -->
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <h4 style="color: #856404; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Security Notice</h4>
              <p style="color: #856404; margin: 0; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
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
      `To: ${email}\r\n` +
      `From: ${process.env.EMAIL_FROM}\r\n` +
      `Subject: GravePath Password Reset\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n` +
      emailContent
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Send email using Gmail API
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    res.json({ msg: 'Verification code sent' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ msg: 'Failed to send verification code' });
  }
});

// Verify Reset Code
router.post('/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ msg: 'No account found with this email' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ msg: 'Invalid verification code' });
    }

    res.json({ verified: true });
  } catch (err) {
    console.error('Code verification error:', err);
    res.status(500).json({ msg: 'Failed to verify code' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ msg: 'No account found with this email' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ msg: 'Invalid verification code' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    user.verificationCode = undefined; // Clear the verification code
    await user.save();

    res.json({ msg: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ msg: 'Failed to reset password' });
  }
});

// Resend Reset Code
router.post('/resend-reset-code', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ msg: 'No account found with this email' });
    }

    // Generate a new 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = code;
    await user.save();

    // Minimalist professional HTML email content
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Code - Garden of Memories</title>
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
            <h2 style="color: #212529; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Password reset requested</h2>
            <p style="color: #6c757d; font-size: 16px; margin: 0 0 32px 0;">Use the code below to reset your password. Your previous reset code has been disabled for security.</p>

            <!-- Reset code -->
            <div style="text-align: center; margin: 32px 0;">
              <p style="color: #495057; font-size: 14px; margin: 0 0 12px 0; font-weight: 500;">Reset Code</p>
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
                <li style="margin-bottom: 6px;">Use this new code (your old code is now disabled)</li>
                <li style="margin-bottom: 6px;">Return to the password reset page</li>
                <li style="margin-bottom: 6px;">Enter this verification code</li>
                <li>Create your new password</li>
              </ol>
            </div>

            <!-- Security notice -->
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <h4 style="color: #856404; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Security Notice</h4>
              <p style="color: #856404; margin: 0; font-size: 13px;">This code expires in 10 minutes. If you didn't request a password reset, please secure your account immediately.</p>
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
      `To: ${email}\r\n` +
      `From: ${process.env.EMAIL_FROM}\r\n` +
      `Subject: GravePath New Password Reset Code\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n` +
      emailContent
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Send email using Gmail API
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    res.json({ msg: 'New verification code sent' });
  } catch (err) {
    console.error('Resend code error:', err);
    res.status(500).json({ msg: 'Failed to resend verification code' });
  }
});

// Test email configuration
router.post('/test-email-config', async (req, res) => {
  try {
    // Check if all required environment variables are set
    const requiredEnvVars = {
      'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID,
      'GOOGLE_CLIENT_SECRET': process.env.GOOGLE_CLIENT_SECRET,
      'GOOGLE_REDIRECT_URI': process.env.GOOGLE_REDIRECT_URI,
      'GOOGLE_REFRESH_TOKEN': process.env.GOOGLE_REFRESH_TOKEN,
      'EMAIL_FROM': process.env.EMAIL_FROM
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required environment variables',
        missingVars
      });
    }

    // Test email content
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 40px 0;">
        <div style="background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); padding: 32px; text-align: center;">
          <h1 style="color: #388e3c; margin-bottom: 0;">GravePath</h1>
          <p style="color: #888; margin-top: 4px; margin-bottom: 32px;">Email Configuration Test</p>
          <h2 style="color: #388e3c; margin-bottom: 16px;">Test Successful!</h2>
          <p style="font-size: 16px; color: #333;">This is a test email to verify that the email configuration is working correctly.</p>
          <div style="margin: 32px 0; padding: 20px; background: #f5f5f5; border-radius: 8px;">
            <h3 style="color: #388e3c; margin-top: 0;">Configuration Details</h3>
            <p><strong>From Email:</strong> ${process.env.EMAIL_FROM}</p>
            <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p style="color: #888; font-size: 14px;">If you received this email, the email configuration is working properly!</p>
        </div>
      </div>
    `;

    const encodedMessage = Buffer.from(
      `To: ${process.env.EMAIL_FROM}\r\n` +
      `From: ${process.env.EMAIL_FROM}\r\n` +
      `Subject: GravePath Email Configuration Test\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n` +
      emailContent
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Send test email using Gmail API
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    res.json({
      success: true,
      message: 'Email configuration test successful! Check your inbox.',
      config: {
        from: process.env.EMAIL_FROM,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Email configuration test error:', err);
    res.status(500).json({
      success: false,
      error: 'Email configuration test failed',
      details: err.message
    });
  }
});

export default router;