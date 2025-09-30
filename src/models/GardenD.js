// backend/src/models/GardenD.js
import mongoose from 'mongoose';

const gardenDSchema = new mongoose.Schema({
  // Feature ID from GeoJSON
  featureId: { 
    type: String, 
    required: [true, 'Feature ID is required'],
    unique: true,
    trim: true
  },
  
  // Feature type (grave or niche)
  type: {
    type: String,
    enum: ['grave', 'niche'],
    required: [true, 'Type is required']
  },
  
  // Feature name from GeoJSON
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true
  },
  
  // Row and column information
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
  
  // For niches, reference to parent grave
  graveRow: {
    type: Number,
    required: function() { return this.type === 'niche'; }
  },
  graveColumn: {
    type: Number,
    required: function() { return this.type === 'niche'; }
  },
  
  // GeoJSON polygon coordinates
  geometry: {
    type: {
      type: String,
      enum: ['Polygon'],
      default: 'Polygon'
    },
    coordinates: {
      type: [[[Number]]], // Array of coordinate rings
      required: [true, 'Coordinates are required']
    }
  },
  
  // Calculated center point for routing
  centerCoordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Center coordinates are required']
    }
  },
  
  // Calculated bounds for map display
  bounds: {
    southwest: {
      type: [Number], // [latitude, longitude]
      required: true
    },
    northeast: {
      type: [Number], // [latitude, longitude]
      required: true
    }
  },
  
  // Status for the 3D system
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
    default: function() { return this.type === 'grave' ? 2.0 : 1.0; }
  },
  
  // Pricing
  price: {
    type: Number,
    default: function() { return this.type === 'grave' ? 50000 : 25000; }
  },
  
  // Deceased information (if occupied)
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
  
  // Metadata
  source: {
    type: String,
    default: 'Garden_D.geojson'
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

// Update the updatedAt field before saving
gardenDSchema.pre('save', function(next) {
  this.updatedAt = Date.now;
  next();
});

// Create indexes for better performance
gardenDSchema.index({ type: 1 });
gardenDSchema.index({ row: 1, column: 1 });
gardenDSchema.index({ status: 1 });

const GardenD = mongoose.model('GardenD', gardenDSchema);

export default GardenD;



