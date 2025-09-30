// backend/src/models/GraveReservation.js
import mongoose from 'mongoose';

const graveReservationSchema = new mongoose.Schema({
  // Grave identification
  graveId: {
    type: String,
    required: true
  },
  garden: {
    type: String,
    required: true,
    enum: ['A', 'B', 'C', 'D']
  },
  row: {
    type: Number,
    required: true,
    min: 1
  },
  column: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Client Information
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clientName: {
    type: String,
    required: true
  },
  clientContact: {
    type: String,
    required: true
  },
  clientEmail: {
    type: String,
    required: true
  },
  
  // Staff Information (for staff/admin bookings)
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.reservationType === 'staff' || this.reservationType === 'admin';
    }
  },
  
  // Reservation type
  reservationType: {
    type: String,
    enum: ['client', 'staff', 'admin'],
    required: true
  },
  
  // Deceased Information
  deceasedInfo: {
    name: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    dateOfDeath: { type: Date, required: true },
    relationship: { type: String, required: true } // Relationship to client
  },
  
  // Payment Information
  paymentMethod: {
    type: String,
    required: true,
    enum: ['gcash', 'bank_transfer', 'credit_card', 'cash', 'check'],
    default: 'gcash'
  },
  paymentAmount: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  proofImage: {
    type: String,
    required: function() {
      return this.reservationType === 'client';
    }
  },
  
  // Reservation Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
    default: 'pending'
  },
  
  // Special Requirements
  specialRequirements: {
    type: String,
    maxlength: 500
  },
  
  // Staff Notes (for admin/staff use)
  staffNotes: {
    type: String,
    maxlength: 1000
  },
  
  // Approval Information
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Middleware to auto-approve staff/admin reservations
graveReservationSchema.pre('save', function(next) {
  if (this.isNew && (this.reservationType === 'staff' || this.reservationType === 'admin')) {
    this.status = 'approved';
    this.approvedAt = new Date();
    this.approvedBy = this.staffId;
  }
  next();
});

// Create indexes for better performance
graveReservationSchema.index({ graveId: 1 });
graveReservationSchema.index({ garden: 1, row: 1, column: 1 });
graveReservationSchema.index({ clientId: 1 });
graveReservationSchema.index({ status: 1 });
graveReservationSchema.index({ createdAt: -1 });

const GraveReservation = mongoose.model('GraveReservation', graveReservationSchema);

export default GraveReservation;
