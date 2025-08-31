// backend/src/models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // Basic information
  firstName:        { type: String, default: '' },
  lastName:         { type: String, default: '' },
  email:            { type: String, required: true, unique: true },
  password:         { type: String, default: '' },
  role:             { type: String, enum: ['client','staff','admin'], default: 'client' },
  
  // Email verification
  emailVerified:    { type: Boolean, default: false },
  verificationCode: { type: String, default: null },
  
  // Profile information
  profile: {
    avatar:         { type: String, default: '' }, // URL to profile picture
    phone:          { type: String, default: '' },
    address: {
      street:       { type: String, default: '' },
      city:         { type: String, default: '' },
      state:        { type: String, default: '' },
      zipCode:      { type: String, default: '' },
      country:      { type: String, default: 'USA' }
    },
    emergencyContact: {
      name:         { type: String, default: '' },
      phone:        { type: String, default: '' },
      relationship: { type: String, default: '' }
    },
    preferences: {
      notifications: {
        email:      { type: Boolean, default: true },
        sms:        { type: Boolean, default: false }
      },
      language:     { type: String, default: 'en' },
      timezone:     { type: String, default: 'America/New_York' }
    }
  },
  
  // Role-specific data
  clientData: {
    membershipType:   { type: String, enum: ['basic', 'premium', 'family'], default: 'basic' },
    memberSince:      { type: Date, default: Date.now },
    totalReservations: { type: Number, default: 0 },
    preferredPaymentMethod: { type: String, default: '' },
    bookmarks:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lot' }] // Bookmarked lots
  },
  
  staffData: {
    employeeId:       { type: String, default: '' },
    department:       { type: String, default: '' },
    position:         { type: String, default: '' },
    hireDate:         { type: Date, default: Date.now },
    supervisor:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    permissions:      [{ type: String }], // array of specific permissions
    schedule: {
      workDays:       [{ type: String }], // ['monday', 'tuesday', etc.]
      startTime:      { type: String, default: '09:00' },
      endTime:        { type: String, default: '17:00' }
    }
  },
  
  adminData: {
    adminLevel:       { type: String, enum: ['super', 'manager', 'supervisor'], default: 'supervisor' },
    departments:      [{ type: String }], // departments they oversee
    specialPermissions: [{ type: String }], // high-level permissions
    lastSystemAccess: { type: Date, default: Date.now }
  },
  
  // Activity tracking
  lastLogin:        { type: Date, default: Date.now },
  isActive:         { type: Boolean, default: true },
  
}, { timestamps: true });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });

export default mongoose.model('User', userSchema);
