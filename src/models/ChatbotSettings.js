const mongoose = require('mongoose');

const chatbotSettingsSchema = new mongoose.Schema({
  // Quick Questions for different user types
  quickQuestions: {
    loggedIn: [{
      question: {
        type: String,
        required: true,
        trim: true
      },
      order: {
        type: Number,
        default: 0
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }],
    guest: [{
      question: {
        type: String,
        required: true,
        trim: true
      },
      order: {
        type: Number,
        default: 0
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }]
  },

  // System prompt settings
  systemPrompt: {
    type: String,
    default: ''
  },

  // Cemetery information that can be updated
  cemeteryInfo: {
    name: {
      type: String,
      default: 'Garden of Memories Memorial Park'
    },
    location: {
      type: String,
      default: 'Pateros, Philippines'
    },
    visitingHours: {
      type: String,
      default: 'Daily 6:00 AM - 6:00 PM'
    },
    contactInfo: {
      phone: String,
      email: String,
      address: String
    },
    facilities: [String],
    policies: [String]
  },

  // Chatbot behavior settings
  settings: {
    maxTokens: {
      type: Number,
      default: 500
    },
    temperature: {
      type: Number,
      default: 0.7
    },
    model: {
      type: String,
      default: 'gpt-3.5-turbo'
    },
    enableFileUpload: {
      type: Boolean,
      default: true
    },
    enableReservations: {
      type: Boolean,
      default: true
    }
  },

  // Metadata
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
chatbotSettingsSchema.index({}, { unique: true });

module.exports = mongoose.model('ChatbotSettings', chatbotSettingsSchema);
