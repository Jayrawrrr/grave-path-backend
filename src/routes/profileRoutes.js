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