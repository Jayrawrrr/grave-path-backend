// backend/src/models/Lot.js
import mongoose from 'mongoose';

const lotSchema = new mongoose.Schema({
  id: { 
    type: String, 
    required: [true, 'Lot ID is required'],
    unique: true,
    trim: true
  },
  bounds: {
    type: [[Number]],
    required: [true, 'Bounds are required'],
    validate: {
      validator: function(bounds) {
        return Array.isArray(bounds) && 
               bounds.length === 2 && 
               Array.isArray(bounds[0]) && bounds[0].length === 2 &&
               Array.isArray(bounds[1]) && bounds[1].length === 2;
      },
      message: 'Bounds must be a 2D array with format [[y1,x1], [y2,x2]]'
    }
  },
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
  status: { 
    type: String, 
    enum: {
      values: ['available', 'unavailable', 'reserved', 'confirmed', 'cancelled', 'pending', 'active', 'occupied', 'approved', 'reserve', 'landmark'],
      message: '{VALUE} is not a valid status'
    },
    default: 'available'
  },
  sqm: {
    type: Number,
    default: 12.5
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },
  landmark: {
    type: String,
    trim: true,
    default: ''
  },
  type: {
    type: String,
    enum: {
      values: ['lot', 'landmark'],
      message: '{VALUE} is not a valid type'
    },
    default: 'lot'
  },
  pricePerSqm: {
    type: Number,
    default: 4000
  },
  price: {
    type: String,
    default: '50000'
  }
});

export default mongoose.model('Lot', lotSchema);
