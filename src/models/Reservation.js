import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema({
  lotId: {
    type: String,
    required: true
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
      return this.role === 'staff';
    }
  },
  sqm: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  clientName: {
    type: String,
    required: true
  },
  clientContact: {
    type: String,
    required: true
  },
  paymentMethod: {
    type: String,
    required: true,
    default: 'gcash'
  },
  paymentAmount: {
    type: String,
    required: true
  },
  totalPrice: {
    type: String,
    required: true
  },
  proofImage: {
    type: String,
    required: function() {
      // Only require proof image for client reservations
      return !this.staffId; // If there's no staffId, it's a client reservation
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
reservationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Reservation', reservationSchema);
