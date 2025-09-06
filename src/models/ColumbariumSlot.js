import mongoose from 'mongoose';

const columbariumSlotSchema = new mongoose.Schema({
  slotId: { 
    type: String, 
    required: [true, 'Slot ID is required'],
    unique: true,
    trim: true
    // Format: "C-A-001" (C=Columbarium, A=Section, 001=Slot Number)
  },
  section: { 
    type: String, 
    required: [true, 'Section is required'],
    enum: {
      values: ['A', 'B', 'C', 'D', 'E', 'F'],
      message: '{VALUE} is not a valid section'
    },
    trim: true
  },
  row: { 
    type: Number, 
    required: [true, 'Row is required'],
    min: [1, 'Row must be at least 1'],
    max: [15, 'Row cannot exceed 15']
  },
  column: { 
    type: Number, 
    required: [true, 'Column is required'],
    min: [1, 'Column must be at least 1'],
    max: [25, 'Column cannot exceed 25']
  },
  level: { 
    type: String, 
    enum: {
      values: ['ground', 'eye', 'high'],
      message: '{VALUE} is not a valid level'
    },
    required: [true, 'Level is required']
  },
  slotType: { 
    type: String, 
    enum: {
      values: ['single', 'double', 'family'],
      message: '{VALUE} is not a valid slot type'
    },
    default: 'single'
  },
  status: { 
    type: String, 
    enum: {
      values: ['available', 'reserved', 'occupied', 'maintenance', 'unavailable'],
      message: '{VALUE} is not a valid status'
    },
    default: 'available'
  },
  dimensions: {
    width: { 
      type: Number, 
      default: 30,
      min: [20, 'Width must be at least 20cm'],
      max: [60, 'Width cannot exceed 60cm']
    },
    height: { 
      type: Number, 
      default: 30,
      min: [20, 'Height must be at least 20cm'],
      max: [60, 'Height cannot exceed 60cm']
    },
    depth: { 
      type: Number, 
      default: 30,
      min: [25, 'Depth must be at least 25cm'],
      max: [50, 'Depth cannot exceed 50cm']
    }
  },
  pricing: {
    basePrice: { 
      type: Number, 
      required: [true, 'Base price is required'],
      min: [0, 'Base price cannot be negative']
    },
    maintenanceFee: { 
      type: Number, 
      default: 0,
      min: [0, 'Maintenance fee cannot be negative']
    },
    leasePeriod: { 
      type: Number, 
      default: 25,
      min: [5, 'Lease period must be at least 5 years'],
      max: [99, 'Lease period cannot exceed 99 years']
    }
  },
  features: {
    hasGlass: { 
      type: Boolean, 
      default: true 
    },
    hasLighting: { 
      type: Boolean, 
      default: false 
    },
    hasVentilation: { 
      type: Boolean, 
      default: true 
    },
    hasSecurity: { 
      type: Boolean, 
      default: false 
    },
    glassType: {
      type: String,
      enum: ['standard', 'premium', 'tempered'],
      default: 'standard'
    }
  },
  location: {
    wall: {
      type: String,
      enum: ['north', 'south', 'east', 'west', 'center'],
      required: [true, 'Wall location is required']
    },
    floor: {
      type: Number,
      default: 1,
      min: [1, 'Floor must be at least 1'],
      max: [5, 'Floor cannot exceed 5']
    }
  },
  coordinates: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 }
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
    trim: true,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Indexes for better query performance
columbariumSlotSchema.index({ section: 1, row: 1, column: 1 });
columbariumSlotSchema.index({ status: 1 });
columbariumSlotSchema.index({ slotType: 1 });
columbariumSlotSchema.index({ 'pricing.basePrice': 1 });

// Pre-save middleware to update timestamps
columbariumSlotSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for full slot identifier
columbariumSlotSchema.virtual('fullIdentifier').get(function() {
  return `${this.section}-${this.row.toString().padStart(2, '0')}-${this.column.toString().padStart(2, '0')}`;
});

// Virtual for calculated total price
columbariumSlotSchema.virtual('totalPrice').get(function() {
  let total = this.pricing.basePrice;
  
  // Add feature costs
  if (this.features.hasLighting) total += 15000;
  if (this.features.glassType === 'premium') total += 10000;
  if (this.features.glassType === 'tempered') total += 20000;
  if (this.features.hasSecurity) total += 12000;
  
  // Level multipliers
  if (this.level === 'ground') total *= 0.8;
  else if (this.level === 'high') total *= 0.9;
  
  // Size multipliers
  if (this.slotType === 'double') total *= 1.8;
  else if (this.slotType === 'family') total *= 2.5;
  
  return Math.round(total);
});

// Static method to generate slot ID
columbariumSlotSchema.statics.generateSlotId = function(section, row, column) {
  return `C-${section}-${row.toString().padStart(2, '0')}${column.toString().padStart(2, '0')}`;
};

// Instance method to check availability
columbariumSlotSchema.methods.isAvailable = function() {
  return this.status === 'available';
};

// Instance method to reserve slot
columbariumSlotSchema.methods.reserve = function() {
  if (this.isAvailable()) {
    this.status = 'reserved';
    return true;
  }
  return false;
};

export default mongoose.model('ColumbariumSlot', columbariumSlotSchema);
