// backend/src/models/Lot.js
import mongoose from 'mongoose';

const lotSchema = new mongoose.Schema({
  // Grave ID format: A-15-23 (Garden-Row-Column)
  id: { 
    type: String, 
    required: [true, 'Grave ID is required'],
    unique: true,
    trim: true,
    match: [/^[ABC]-\d+-\d+$/, 'Grave ID must be in format A-15-23 (Garden-Row-Column)']
  },
  
  // Garden information
  garden: {
    type: String,
    enum: ['A', 'B', 'C'],
    required: [true, 'Garden is required']
  },
  row: {
    type: Number,
    required: [true, 'Row number is required'],
    min: 1
  },
  column: {
    type: Number,
    required: [true, 'Column number is required'],
    min: 1
  },
  
  // GPS coordinates for precise location
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Coordinates are required']
    }
  },
  
  // Deceased information
  name: { 
    type: String, 
    default: '',
    trim: true
  },
  birth: { 
    type: String, 
    default: '',
    trim: true
  },
  death: { 
    type: String, 
    default: '',
    trim: true
  },
  
  // Grave status
  status: { 
    type: String, 
    enum: {
      values: ['available', 'occupied', 'reserved', 'maintenance', 'unavailable'],
      message: '{VALUE} is not a valid status'
    },
    default: 'available'
  },
  
  // Physical properties
  sqm: {
    type: Number,
    default: 2.0 // Standard grave size
  },
  
  // Location description
  location: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Navigation information
  navigation: {
    fromEntrance: {
      type: String,
      default: ''
    },
    nearestLandmarks: [{
      name: String,
      distance: Number // in meters
    }],
    accessRoute: {
      type: String,
      default: ''
    }
  },
  
  // Pricing
  pricePerSqm: {
    type: Number,
    default: 4000
  },
  price: {
    type: Number,
    default: 8000 // 2 sqm × 4000
  },
  
  // Family information
  family: {
    contactPerson: String,
    contactNumber: String,
    contactEmail: String,
    relationship: String
  },
  
  // Maintenance
  maintenance: {
    lastCleaned: Date,
    condition: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor'],
      default: 'good'
    },
    notes: String
  },
  
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

// Create index for efficient queries
lotSchema.index({ garden: 1, row: 1, column: 1 });
lotSchema.index({ coordinates: '2dsphere' });
lotSchema.index({ status: 1 });

// Update the updatedAt field before saving
lotSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for full location description
lotSchema.virtual('fullLocation').get(function() {
  return `${this.garden}-${this.row}-${this.column}`;
});

export default mongoose.model('Lot', lotSchema);
