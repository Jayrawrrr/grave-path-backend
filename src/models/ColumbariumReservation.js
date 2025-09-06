import mongoose from 'mongoose';

const columbariumSlotSchema = new mongoose.Schema({
  slotId: {
    type: String,
    required: true,
    unique: true
  },
  building: {
    type: String,
    required: true,
    default: 'Main Building'
  },
  floor: {
    type: Number,
    required: true,
    min: 1,
    max: 5 // Assume max 5 floors
  },
  section: {
    type: String,
    required: true,
    enum: ['A', 'B', 'C', 'D', 'E', 'F']
  },
  row: {
    type: Number,
    required: true,
    min: 1,
    max: 20 // Assume max 20 rows per section
  },
  column: {
    type: Number,
    required: true,
    min: 1,
    max: 10 // Assume max 10 columns per row
  },
  size: {
    type: String,
    required: true,
    enum: ['single', 'double', 'family']
  },
  dimensions: {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    depth: { type: Number, required: true }
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['available', 'reserved', 'occupied', 'maintenance'],
    default: 'available'
  },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true } // For 3D positioning
  }
}, {
  timestamps: true
});

const columbariumReservationSchema = new mongoose.Schema({
  slotId: {
    type: String,
    required: true,
    ref: 'ColumbariumSlot'
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.reservationType === 'staff';
    }
  },
  reservationType: {
    type: String,
    enum: ['client', 'staff', 'admin'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
    default: 'pending'
  },
  // Client Information
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
  // Duration and Terms
  duration: {
    type: Number,
    required: true,
    default: 5 // Years
  },
  renewalDate: {
    type: Date,
    required: true
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
columbariumReservationSchema.pre('save', function(next) {
  if (this.isNew && (this.reservationType === 'staff' || this.reservationType === 'admin')) {
    this.status = 'approved';
    this.approvedAt = new Date();
    this.approvedBy = this.staffId;
  }
  
  // Calculate renewal date if not set
  if (this.isNew && !this.renewalDate) {
    const currentDate = new Date();
    this.renewalDate = new Date(currentDate.getFullYear() + this.duration, currentDate.getMonth(), currentDate.getDate());
  }
  
  next();
});

// Create compound index for efficient slot lookup
columbariumSlotSchema.index({ building: 1, floor: 1, section: 1, row: 1, column: 1 });
columbariumSlotSchema.index({ status: 1, size: 1, price: 1 });

// Create indexes for reservations
columbariumReservationSchema.index({ slotId: 1 });
columbariumReservationSchema.index({ clientId: 1 });
columbariumReservationSchema.index({ status: 1 });
columbariumReservationSchema.index({ createdAt: -1 });

export const ColumbariumSlot = mongoose.model('ColumbariumSlot', columbariumSlotSchema);
export const ColumbariumReservation = mongoose.model('ColumbariumReservation', columbariumReservationSchema);