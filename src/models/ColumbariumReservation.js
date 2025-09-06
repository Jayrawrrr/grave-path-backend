const mongoose = require('mongoose');

const columbariumReservationSchema = new mongoose.Schema({
  slotId: { type: String, required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deceasedInfo: {
    fullName: { type: String, required: true },
    birthDate: { type: Date, required: true },
    deathDate: { type: Date, required: true },
    cremationDate: { type: Date },
    relationToClient: { type: String, required: true }
  },
  urnDetails: {
    material: { type: String, enum: ['bronze', 'marble', 'wood', 'ceramic'] },
    inscription: { type: String, maxlength: 200 },
    hasPhoto: { type: Boolean, default: false }
  },
  leaseInfo: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    renewalReminders: [{ type: Date }]
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'active', 'expired', 'cancelled'],
    default: 'pending'
  },
  paymentInfo: {
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'overdue'],
      default: 'pending'
    },
    paymentMethod: { type: String },
    paymentDate: { type: Date },
    receiptNumber: { type: String }
  },
  documents: [{
    type: { type: String, required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  }],
  notes: { type: String, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
columbariumReservationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ColumbariumReservation', columbariumReservationSchema);
