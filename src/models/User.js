// backend/src/models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // Basic information
  firstName:        { 
    type: String, 
    default: '',
    trim: true,
    validate: {
      validator: function(v) {
        if (!v || v.trim() === '') return true; // Allow empty
        if (v.length < 2) return false; // Must be at least 2 characters if provided
        if (v.length > 20) return false; // Must not exceed 20 characters
        return /^[a-zA-Z\s\-']+$/.test(v); // Only letters, spaces, hyphens, apostrophes
      },
      message: 'First name must be 2-20 characters and contain only letters, spaces, hyphens, and apostrophes'
    }
  },
  lastName:         { 
    type: String, 
    default: '',
    trim: true,
    validate: {
      validator: function(v) {
        if (!v || v.trim() === '') return true; // Allow empty
        if (v.length < 2) return false; // Must be at least 2 characters if provided
        if (v.length > 20) return false; // Must not exceed 20 characters
        return /^[a-zA-Z\s\-']+$/.test(v); // Only letters, spaces, hyphens, apostrophes
      },
      message: 'Last name must be 2-20 characters and contain only letters, spaces, hyphens, and apostrophes'
    }
  },
  email:            { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: [30, 'Email must not exceed 30 characters'],
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please provide a valid email address'
    }
  },
  password:         { 
    type: String, 
    default: ''
    // Note: Password length validation is done before hashing in auth routes
    // Don't validate here as hashed passwords are 60+ characters
  },
  role:             { type: String, enum: ['client','staff','admin'], default: 'client' },
  
  // Email verification
  emailVerified:    { type: Boolean, default: false },
  verificationCode: { type: String, default: null },
  
  // Profile information
  profile: {
    avatar:         { type: String, default: '', maxlength: 500 }, // URL to profile picture
    phone:          { 
      type: String, 
      default: '', 
      maxlength: 11,
      validate: {
        validator: function(v) {
          if (!v) return true; // Allow empty phone
          return /^[0-9]{11}$/.test(v); // Exactly 11 digits
        },
        message: 'Phone number must be exactly 11 digits (e.g., 09171234567)'
      }
    },
    address: {
      street:       { type: String, default: '', maxlength: 100 },
      city:         { type: String, default: '', maxlength: 50 },
      state:        { type: String, default: '', maxlength: 50 },
      zipCode:      { 
        type: String, 
        default: '', 
        maxlength: 10,
        validate: {
          validator: function(v) {
            if (!v) return true;
            return /^[0-9]+$/.test(v); // Only numbers
          },
          message: 'ZIP code can only contain numbers'
        }
      },
      country:      { type: String, default: 'Philippines', maxlength: 50 }
    },
    emergencyContact: {
      name:         { 
        type: String, 
        default: '', 
        maxlength: 20,
        validate: {
          validator: function(v) {
            if (!v) return true;
            return /^[a-zA-Z\s\-']+$/.test(v);
          },
          message: 'Emergency contact name can only contain letters, spaces, hyphens, and apostrophes'
        }
      },
      phone:        { 
        type: String, 
        default: '', 
        maxlength: 11,
        validate: {
          validator: function(v) {
            if (!v) return true; // Allow empty phone
            return /^[0-9]{11}$/.test(v); // Exactly 11 digits
          },
          message: 'Emergency contact phone must be exactly 11 digits (e.g., 09171234567)'
        }
      },
      relationship: { type: String, default: '', maxlength: 30 }
    },
    preferences: {
      notifications: {
        email:      { type: Boolean, default: true },
        sms:        { type: Boolean, default: false }
      },
      language:     { type: String, default: 'en' },
      timezone:     { type: String, default: 'Asia/Manila' }
    }
  },
  
  // Role-specific data
  clientData: {
    membershipType:   { type: String, enum: ['basic', 'premium', 'family'], default: 'basic' },
    memberSince:      { type: Date, default: Date.now },
    totalReservations: { type: Number, default: 0 },
    preferredPaymentMethod: { type: String, default: '' },
    bookmarks:        [{ type: String }] // Bookmarked lot IDs (strings like A-123-456)
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
