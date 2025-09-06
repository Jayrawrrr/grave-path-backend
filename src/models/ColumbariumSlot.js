const mongoose = require('mongoose');

const columbariumSlotSchema = new mongoose.Schema({
  slotId: { type: String, required: true, unique: true },
  section: { type: String, required: true },
  row: { type: Number, required: true },
  column: { type: Number, required: true },
  level: { type: String, enum: ['ground', 'eye', 'high'], required: true },
  slotType: { type: String, enum: ['single', 'double', 'family'], default: 'single' },
  status: {
    type: String,
    enum: ['available', 'reserved', 'occupied', 'maintenance'],
    default: 'available'
  },
  dimensions: {
    width: { type: Number, default: 30 },
    height: { type: Number, default: 30 },
    depth: { type: Number, default: 30 }
  },
  pricing: {
    basePrice: { type: Number, required: true },
    maintenanceFee: { type: Number, default: 0 },
    leasePeriod: { type: Number, default: 25 }
  },
  features: {
    hasGlass: { type: Boolean, default: true },
    hasLighting: { type: Boolean, default: false },
    hasVentilation: { type: Boolean, default: true }
  },
  notes: { type: String, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
columbariumSlotSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ColumbariumSlot', columbariumSlotSchema);
