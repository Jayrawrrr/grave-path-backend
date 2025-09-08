import mongoose from 'mongoose';

const quickQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['general', 'reservation', 'visiting', 'pricing', 'location', 'services'],
    default: 'general'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  userType: {
    type: String,
    enum: ['all', 'guest', 'client'],
    default: 'all'
  }
}, { _id: true });

const faqResponseSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['general', 'reservation', 'visiting', 'pricing', 'location', 'services'],
    default: 'general'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  keywords: [{
    type: String,
    trim: true
  }],
  userType: {
    type: String,
    enum: ['all', 'guest', 'client'],
    default: 'all'
  }
}, { _id: true });

const chatbotConfigSchema = new mongoose.Schema({
  quickQuestions: [quickQuestionSchema],
  faqResponses: [faqResponseSchema],
  systemPrompt: {
    type: String,
    default: `You are a helpful AI assistant for Garden of Memories Memorial Park. You provide information about cemetery services, plot availability, pricing, and general park information.

Be compassionate, respectful, and professional. Always provide accurate information and direct users to appropriate resources when needed.`
  },
  guestSystemPrompt: {
    type: String,
    default: `You are a helpful AI assistant for Garden of Memories Memorial Park. You are speaking to a GUEST USER who is not logged in.

IMPORTANT LIMITATIONS FOR GUESTS:
- Guests CANNOT make reservations - always redirect them to create an account and log in for reservations
- You can help with: grave locating, plot availability info, pricing, visiting hours, facilities, general information
- If they ask about reservations, politely explain they need to create an account first

Be warm, professional, and helpful while respecting these limitations.`
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: String,
    required: true
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Create indexes for better performance
chatbotConfigSchema.index({ 'quickQuestions.category': 1, 'quickQuestions.isActive': 1 });
chatbotConfigSchema.index({ 'faqResponses.category': 1, 'faqResponses.isActive': 1 });
chatbotConfigSchema.index({ isActive: 1 });

// Static method to get active configuration
chatbotConfigSchema.statics.getActiveConfig = async function() {
  const config = await this.findOne({ isActive: true }).sort({ createdAt: -1 });
  if (!config) {
    // Create default configuration if none exists
    const defaultConfig = new this({
      quickQuestions: [
        {
          question: "I want to make a reservation",
          category: "reservation",
          userType: "client",
          order: 1
        },
        {
          question: "I want to find a grave",
          category: "location",
          userType: "all",
          order: 2
        },
        {
          question: "What are the visiting hours for Garden of Memories?",
          category: "visiting",
          userType: "all",
          order: 3
        },
        {
          question: "How much does a cemetery plot cost?",
          category: "pricing",
          userType: "all",
          order: 4
        },
        {
          question: "What facilities and amenities are available?",
          category: "services",
          userType: "all",
          order: 5
        },
        {
          question: "Tell me about the history of Garden of Memories Memorial Park",
          category: "general",
          userType: "all",
          order: 6
        },
        {
          question: "What are the visiting policies and rules?",
          category: "visiting",
          userType: "all",
          order: 7
        }
      ],
      faqResponses: [
        {
          question: "What are your visiting hours?",
          answer: "Garden of Memories Memorial Park is open daily from 6:00 AM to 6:00 PM. We recommend visiting during daylight hours for safety and to fully appreciate the peaceful environment.",
          category: "visiting",
          keywords: ["hours", "visiting", "open", "time"],
          userType: "all"
        },
        {
          question: "How much does a plot cost?",
          answer: "Plot prices vary based on location and size. Our standard plots are 12.5 square meters and start at ₱4,000 per square meter. The average plot price is around ₱50,000. We offer flexible payment plans and require a 10% reservation fee to secure your plot.",
          category: "pricing",
          keywords: ["cost", "price", "plot", "pricing"],
          userType: "all"
        },
        {
          question: "How do I make a reservation?",
          answer: "To make a reservation, you need to create an account and log in to our system. Once logged in, you can browse available plots, select your preferred location, and complete the reservation process with payment. Our staff will guide you through each step.",
          category: "reservation",
          keywords: ["reservation", "book", "reserve", "process"],
          userType: "client"
        }
      ],
      updatedBy: "system"
    });
    await defaultConfig.save();
    return defaultConfig;
  }
  return config;
};

// Instance method to get quick questions for specific user type
chatbotConfigSchema.methods.getQuickQuestions = function(userType = 'all') {
  return this.quickQuestions
    .filter(q => q.isActive && (q.userType === 'all' || q.userType === userType))
    .sort((a, b) => a.order - b.order);
};

// Instance method to get FAQ responses for specific user type
chatbotConfigSchema.methods.getFaqResponses = function(userType = 'all') {
  return this.faqResponses
    .filter(f => f.isActive && (f.userType === 'all' || f.userType === userType));
};

export const ChatbotConfig = mongoose.model('ChatbotConfig', chatbotConfigSchema);
