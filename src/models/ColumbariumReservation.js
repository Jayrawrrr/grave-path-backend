import mongoose from 'mongoose';

const columbariumReservationSchema = new mongoose.Schema({
  reservationId: {
    type: String,
    unique: true,
    required: [true, 'Reservation ID is required']
    // Format: "CR-2024-001" (CR=Columbarium Reservation, Year, Sequential Number)
  },
  slotId: { 
    type: String, 
    required: [true, 'Slot ID is required'],
    ref: 'ColumbariumSlot'
  },
  clientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Client ID is required']
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
    enum: ['client', 'staff', 'transfer'],
    default: 'client'
  },
  
  // Deceased Information
  deceasedInfo: {
    fullName: { 
      type: String, 
      required: [true, 'Deceased full name is required'],
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters']
    },
    birthDate: { 
      type: Date, 
      required: [true, 'Birth date is required'],
      validate: {
        validator: function(date) {
          return date < new Date();
        },
        message: 'Birth date must be in the past'
      }
    },
    deathDate: { 
      type: Date, 
      required: [true, 'Death date is required'],
      validate: {
        validator: function(date) {
          return date >= this.deceasedInfo.birthDate && date <= new Date();
        },
        message: 'Death date must be after birth date and not in the future'
      }
    },
    cremationDate: { 
      type: Date,
      validate: {
        validator: function(date) {
          return !date || date >= this.deceasedInfo.deathDate;
        },
        message: 'Cremation date must be after death date'
      }
    },
    relationToClient: { 
      type: String, 
      required: [true, 'Relation to client is required'],
      enum: {
        values: ['self', 'spouse', 'parent', 'child', 'sibling', 'grandparent', 'grandchild', 'relative', 'friend', 'other'],
        message: '{VALUE} is not a valid relation'
      }
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Gender is required']
    },
    religion: {
      type: String,
      trim: true,
      maxlength: [50, 'Religion cannot exceed 50 characters']
    },
    nationality: {
      type: String,
      trim: true,
      maxlength: [50, 'Nationality cannot exceed 50 characters']
    }
  },

  // Client Contact Information
  clientInfo: {
    fullName: { 
      type: String, 
      required: [true, 'Client full name is required'],
      trim: true
    },
    contactNumber: { 
      type: String, 
      required: [true, 'Contact number is required'],
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(email) {
          return !email || /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
        },
        message: 'Please enter a valid email address'
      }
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
      maxlength: [200, 'Address cannot exceed 200 characters']
    }
  },

  // Urn and Memorial Details
  urnDetails: {
    material: { 
      type: String, 
      enum: {
        values: ['bronze', 'marble', 'wood', 'ceramic', 'glass', 'metal', 'biodegradable'],
        message: '{VALUE} is not a valid urn material'
      },
      default: 'ceramic'
    },
    size: {
      type: String,
      enum: ['small', 'medium', 'large', 'extra-large'],
      default: 'medium'
    },
    color: {
      type: String,
      trim: true,
      maxlength: [30, 'Color cannot exceed 30 characters']
    },
    inscription: { 
      type: String, 
      maxlength: [300, 'Inscription cannot exceed 300 characters'],
      trim: true
    },
    hasPhoto: { 
      type: Boolean, 
      default: false 
    },
    photoUrl: {
      type: String,
      trim: true
    },
    hasFlowers: {
      type: Boolean,
      default: false
    },
    hasCandles: {
      type: Boolean,
      default: false
    },
    personalItems: [{
      itemName: String,
      description: String
    }]
  },

  // Lease Information
  leaseInfo: {
    startDate: { 
      type: Date, 
      required: [true, 'Lease start date is required']
    },
    endDate: { 
      type: Date, 
      required: [true, 'Lease end date is required']
    },
    leasePeriodYears: {
      type: Number,
      default: 25,
      min: [5, 'Lease period must be at least 5 years'],
      max: [99, 'Lease period cannot exceed 99 years']
    },
    renewalReminders: [{
      reminderDate: Date,
      reminderType: {
        type: String,
        enum: ['2_years', '1_year', '6_months', '3_months', '1_month']
      },
      sent: {
        type: Boolean,
        default: false
      }
    }],
    autoRenewal: {
      type: Boolean,
      default: false
    }
  },

  // Financial Information
  pricing: {
    slotBasePrice: { 
      type: Number, 
      required: [true, 'Slot base price is required'],
      min: [0, 'Price cannot be negative']
    },
    additionalFeatures: { 
      type: Number, 
      default: 0,
      min: [0, 'Additional features cost cannot be negative']
    },
    maintenanceFee: { 
      type: Number, 
      default: 0,
      min: [0, 'Maintenance fee cannot be negative']
    },
    totalPrice: { 
      type: Number, 
      required: [true, 'Total price is required'],
      min: [0, 'Total price cannot be negative']
    },
    downPayment: {
      type: Number,
      default: 0,
      min: [0, 'Down payment cannot be negative']
    },
    balanceRemaining: {
      type: Number,
      default: 0,
      min: [0, 'Balance cannot be negative']
    }
  },

  // Payment Information
  paymentInfo: {
    paymentMethod: { 
      type: String, 
      enum: {
        values: ['gcash', 'bank_transfer', 'cash', 'check', 'installment'],
        message: '{VALUE} is not a valid payment method'
      },
      required: [true, 'Payment method is required']
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'completed', 'overdue', 'cancelled'],
      default: 'pending'
    },
    payments: [{
      amount: {
        type: Number,
        required: true,
        min: [0, 'Payment amount cannot be negative']
      },
      paymentDate: {
        type: Date,
        default: Date.now
      },
      paymentMethod: String,
      referenceNumber: String,
      proofImage: String,
      processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
      }
    }],
    proofImages: [String], // Array of payment proof image paths
    referenceNumber: String
  },

  // Reservation Status and Workflow
  status: { 
    type: String, 
    enum: {
      values: ['pending', 'approved', 'active', 'completed', 'cancelled', 'expired', 'transferred'],
      message: '{VALUE} is not a valid reservation status'
    },
    default: 'pending'
  },
  approvalDate: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  activationDate: Date,
  completionDate: Date,
  cancellationReason: {
    type: String,
    maxlength: [200, 'Cancellation reason cannot exceed 200 characters']
  },

  // Memorial Services
  memorialServices: [{
    serviceType: {
      type: String,
      enum: ['blessing', 'memorial_mass', 'prayer_service', 'custom'],
      required: true
    },
    serviceDate: Date,
    officiant: String,
    attendees: Number,
    specialRequests: String,
    cost: {
      type: Number,
      default: 0
    }
  }],

  // Documents and Attachments
  documents: {
    deathCertificate: {
      uploaded: { type: Boolean, default: false },
      filePath: String,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      verificationDate: Date
    },
    cremationCertificate: {
      uploaded: { type: Boolean, default: false },
      filePath: String,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      verificationDate: Date
    },
    clientId: {
      uploaded: { type: Boolean, default: false },
      filePath: String,
      idType: String,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    additionalDocuments: [{
      documentType: String,
      filePath: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // Audit Trail
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    trim: true
  },
  internalNotes: {
    type: String,
    maxlength: [1000, 'Internal notes cannot exceed 1000 characters'],
    trim: true
  },
  statusHistory: [{
    status: String,
    changedAt: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String
  }],

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better performance
columbariumReservationSchema.index({ slotId: 1 });
columbariumReservationSchema.index({ clientId: 1 });
columbariumReservationSchema.index({ status: 1 });
columbariumReservationSchema.index({ 'leaseInfo.endDate': 1 });
columbariumReservationSchema.index({ reservationId: 1 });

// Pre-save middleware
columbariumReservationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-generate reservation ID if not provided
  if (!this.reservationId) {
    const year = new Date().getFullYear();
    // This would need to be implemented with a counter
    this.reservationId = `CR-${year}-${Date.now().toString().slice(-6)}`;
  }
  
  // Calculate balance remaining
  if (this.pricing.totalPrice && this.pricing.downPayment) {
    this.pricing.balanceRemaining = this.pricing.totalPrice - this.pricing.downPayment;
  }
  
  // Set lease end date based on start date and period
  if (this.leaseInfo.startDate && this.leaseInfo.leasePeriodYears) {
    this.leaseInfo.endDate = new Date(this.leaseInfo.startDate);
    this.leaseInfo.endDate.setFullYear(this.leaseInfo.endDate.getFullYear() + this.leaseInfo.leasePeriodYears);
  }
  
  next();
});

// Virtual for full deceased name
columbariumReservationSchema.virtual('deceasedFullInfo').get(function() {
  const birth = this.deceasedInfo.birthDate ? this.deceasedInfo.birthDate.getFullYear() : '';
  const death = this.deceasedInfo.deathDate ? this.deceasedInfo.deathDate.getFullYear() : '';
  return `${this.deceasedInfo.fullName} (${birth} - ${death})`;
});

// Virtual for lease status
columbariumReservationSchema.virtual('leaseStatus').get(function() {
  const now = new Date();
  const endDate = this.leaseInfo.endDate;
  
  if (!endDate) return 'unknown';
  
  const monthsUntilExpiry = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
  
  if (monthsUntilExpiry < 0) return 'expired';
  if (monthsUntilExpiry < 6) return 'expiring_soon';
  if (monthsUntilExpiry < 12) return 'renewal_due';
  return 'active';
});

// Instance methods
columbariumReservationSchema.methods.addPayment = function(paymentData) {
  this.paymentInfo.payments.push(paymentData);
  
  // Update payment status based on total payments
  const totalPaid = this.paymentInfo.payments
    .filter(p => p.status === 'verified')
    .reduce((sum, p) => sum + p.amount, 0);
    
  if (totalPaid >= this.pricing.totalPrice) {
    this.paymentInfo.paymentStatus = 'completed';
  } else if (totalPaid > 0) {
    this.paymentInfo.paymentStatus = 'partial';
  }
  
  this.pricing.balanceRemaining = Math.max(0, this.pricing.totalPrice - totalPaid);
};

columbariumReservationSchema.methods.updateStatus = function(newStatus, userId, reason) {
  this.statusHistory.push({
    status: this.status,
    changedBy: userId,
    reason: reason
  });
  
  this.status = newStatus;
  
  if (newStatus === 'approved') {
    this.approvalDate = new Date();
    this.approvedBy = userId;
  } else if (newStatus === 'active') {
    this.activationDate = new Date();
  } else if (newStatus === 'completed') {
    this.completionDate = new Date();
  }
};

// Static methods
columbariumReservationSchema.statics.generateReservationId = async function() {
  const year = new Date().getFullYear();
  const count = await this.countDocuments({
    createdAt: {
      $gte: new Date(year, 0, 1),
      $lt: new Date(year + 1, 0, 1)
    }
  });
  return `CR-${year}-${(count + 1).toString().padStart(3, '0')}`;
};

export default mongoose.model('ColumbariumReservation', columbariumReservationSchema);
