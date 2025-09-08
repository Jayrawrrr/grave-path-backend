import express from 'express';
import { ChatbotConfig } from '../../models/ChatbotConfig.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

// Protect all routes - admin only
router.use(protect(['admin']));

/**
 * GET /api/admin/chatbot/config
 * Get current chatbot configuration
 */
router.get('/config', async (req, res) => {
  try {
    const config = await ChatbotConfig.getActiveConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error fetching chatbot config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chatbot configuration'
    });
  }
});

/**
 * PUT /api/admin/chatbot/config
 * Update chatbot configuration
 */
router.put('/config', async (req, res) => {
  try {
    const { quickQuestions, faqResponses, systemPrompt, guestSystemPrompt } = req.body;
    const adminEmail = req.user.email;

    // Get current active config
    let config = await ChatbotConfig.getActiveConfig();

    // Deactivate current config
    config.isActive = false;
    await config.save();

    // Create new config
    const newConfig = new ChatbotConfig({
      quickQuestions: quickQuestions || config.quickQuestions,
      faqResponses: faqResponses || config.faqResponses,
      systemPrompt: systemPrompt || config.systemPrompt,
      guestSystemPrompt: guestSystemPrompt || config.guestSystemPrompt,
      updatedBy: adminEmail,
      version: config.version + 1
    });

    await newConfig.save();

    res.json({
      success: true,
      message: 'Chatbot configuration updated successfully',
      data: newConfig
    });
  } catch (error) {
    console.error('Error updating chatbot config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update chatbot configuration'
    });
  }
});

/**
 * POST /api/admin/chatbot/questions
 * Add a new quick question
 */
router.post('/questions', async (req, res) => {
  try {
    const { question, category, userType, order } = req.body;
    const adminEmail = req.user.email;

    if (!question || !category) {
      return res.status(400).json({
        success: false,
        message: 'Question and category are required'
      });
    }

    const config = await ChatbotConfig.getActiveConfig();
    
    // Deactivate current config
    config.isActive = false;
    await config.save();

    // Create new config with added question
    const newQuestion = {
      question,
      category,
      userType: userType || 'all',
      order: order || config.quickQuestions.length + 1,
      isActive: true
    };

    const newConfig = new ChatbotConfig({
      quickQuestions: [...config.quickQuestions, newQuestion],
      faqResponses: config.faqResponses,
      systemPrompt: config.systemPrompt,
      guestSystemPrompt: config.guestSystemPrompt,
      updatedBy: adminEmail,
      version: config.version + 1
    });

    await newConfig.save();

    res.json({
      success: true,
      message: 'Quick question added successfully',
      data: newConfig
    });
  } catch (error) {
    console.error('Error adding quick question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add quick question'
    });
  }
});

/**
 * PUT /api/admin/chatbot/questions/:id
 * Update a quick question
 */
router.put('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { question, category, userType, order, isActive } = req.body;
    const adminEmail = req.user.email;

    const config = await ChatbotConfig.getActiveConfig();
    const questionIndex = config.quickQuestions.findIndex(q => q._id.toString() === id);

    if (questionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Quick question not found'
      });
    }

    // Deactivate current config
    config.isActive = false;
    await config.save();

    // Update the question
    const updatedQuestions = [...config.quickQuestions];
    updatedQuestions[questionIndex] = {
      ...updatedQuestions[questionIndex],
      question: question || updatedQuestions[questionIndex].question,
      category: category || updatedQuestions[questionIndex].category,
      userType: userType || updatedQuestions[questionIndex].userType,
      order: order !== undefined ? order : updatedQuestions[questionIndex].order,
      isActive: isActive !== undefined ? isActive : updatedQuestions[questionIndex].isActive
    };

    const newConfig = new ChatbotConfig({
      quickQuestions: updatedQuestions,
      faqResponses: config.faqResponses,
      systemPrompt: config.systemPrompt,
      guestSystemPrompt: config.guestSystemPrompt,
      updatedBy: adminEmail,
      version: config.version + 1
    });

    await newConfig.save();

    res.json({
      success: true,
      message: 'Quick question updated successfully',
      data: newConfig
    });
  } catch (error) {
    console.error('Error updating quick question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quick question'
    });
  }
});

/**
 * DELETE /api/admin/chatbot/questions/:id
 * Delete a quick question
 */
router.delete('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const adminEmail = req.user.email;

    const config = await ChatbotConfig.getActiveConfig();
    const questionIndex = config.quickQuestions.findIndex(q => q._id.toString() === id);

    if (questionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Quick question not found'
      });
    }

    // Deactivate current config
    config.isActive = false;
    await config.save();

    // Remove the question
    const updatedQuestions = config.quickQuestions.filter(q => q._id.toString() !== id);

    const newConfig = new ChatbotConfig({
      quickQuestions: updatedQuestions,
      faqResponses: config.faqResponses,
      systemPrompt: config.systemPrompt,
      guestSystemPrompt: config.guestSystemPrompt,
      updatedBy: adminEmail,
      version: config.version + 1
    });

    await newConfig.save();

    res.json({
      success: true,
      message: 'Quick question deleted successfully',
      data: newConfig
    });
  } catch (error) {
    console.error('Error deleting quick question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quick question'
    });
  }
});

/**
 * POST /api/admin/chatbot/faq
 * Add a new FAQ response
 */
router.post('/faq', async (req, res) => {
  try {
    const { question, answer, category, keywords, userType } = req.body;
    const adminEmail = req.user.email;

    if (!question || !answer || !category) {
      return res.status(400).json({
        success: false,
        message: 'Question, answer, and category are required'
      });
    }

    const config = await ChatbotConfig.getActiveConfig();
    
    // Deactivate current config
    config.isActive = false;
    await config.save();

    // Create new config with added FAQ
    const newFaq = {
      question,
      answer,
      category,
      keywords: keywords || [],
      userType: userType || 'all',
      isActive: true
    };

    const newConfig = new ChatbotConfig({
      quickQuestions: config.quickQuestions,
      faqResponses: [...config.faqResponses, newFaq],
      systemPrompt: config.systemPrompt,
      guestSystemPrompt: config.guestSystemPrompt,
      updatedBy: adminEmail,
      version: config.version + 1
    });

    await newConfig.save();

    res.json({
      success: true,
      message: 'FAQ response added successfully',
      data: newConfig
    });
  } catch (error) {
    console.error('Error adding FAQ response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add FAQ response'
    });
  }
});

/**
 * PUT /api/admin/chatbot/faq/:id
 * Update an FAQ response
 */
router.put('/faq/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, category, keywords, userType, isActive } = req.body;
    const adminEmail = req.user.email;

    const config = await ChatbotConfig.getActiveConfig();
    const faqIndex = config.faqResponses.findIndex(f => f._id.toString() === id);

    if (faqIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'FAQ response not found'
      });
    }

    // Deactivate current config
    config.isActive = false;
    await config.save();

    // Update the FAQ
    const updatedFaqs = [...config.faqResponses];
    updatedFaqs[faqIndex] = {
      ...updatedFaqs[faqIndex],
      question: question || updatedFaqs[faqIndex].question,
      answer: answer || updatedFaqs[faqIndex].answer,
      category: category || updatedFaqs[faqIndex].category,
      keywords: keywords || updatedFaqs[faqIndex].keywords,
      userType: userType || updatedFaqs[faqIndex].userType,
      isActive: isActive !== undefined ? isActive : updatedFaqs[faqIndex].isActive
    };

    const newConfig = new ChatbotConfig({
      quickQuestions: config.quickQuestions,
      faqResponses: updatedFaqs,
      systemPrompt: config.systemPrompt,
      guestSystemPrompt: config.guestSystemPrompt,
      updatedBy: adminEmail,
      version: config.version + 1
    });

    await newConfig.save();

    res.json({
      success: true,
      message: 'FAQ response updated successfully',
      data: newConfig
    });
  } catch (error) {
    console.error('Error updating FAQ response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update FAQ response'
    });
  }
});

/**
 * DELETE /api/admin/chatbot/faq/:id
 * Delete an FAQ response
 */
router.delete('/faq/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const adminEmail = req.user.email;

    const config = await ChatbotConfig.getActiveConfig();
    const faqIndex = config.faqResponses.findIndex(f => f._id.toString() === id);

    if (faqIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'FAQ response not found'
      });
    }

    // Deactivate current config
    config.isActive = false;
    await config.save();

    // Remove the FAQ
    const updatedFaqs = config.faqResponses.filter(f => f._id.toString() !== id);

    const newConfig = new ChatbotConfig({
      quickQuestions: config.quickQuestions,
      faqResponses: updatedFaqs,
      systemPrompt: config.systemPrompt,
      guestSystemPrompt: config.guestSystemPrompt,
      updatedBy: adminEmail,
      version: config.version + 1
    });

    await newConfig.save();

    res.json({
      success: true,
      message: 'FAQ response deleted successfully',
      data: newConfig
    });
  } catch (error) {
    console.error('Error deleting FAQ response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete FAQ response'
    });
  }
});

/**
 * GET /api/admin/chatbot/history
 * Get configuration history
 */
router.get('/history', async (req, res) => {
  try {
    const configs = await ChatbotConfig.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .select('version updatedBy createdAt isActive');

    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('Error fetching chatbot history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration history'
    });
  }
});

/**
 * POST /api/admin/chatbot/reset
 * Reset to default configuration
 */
router.post('/reset', async (req, res) => {
  try {
    const adminEmail = req.user.email;

    // Deactivate current config
    const currentConfig = await ChatbotConfig.getActiveConfig();
    currentConfig.isActive = false;
    await currentConfig.save();

    // Create default configuration
    const defaultConfig = new ChatbotConfig({
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
      systemPrompt: `You are a helpful AI assistant for Garden of Memories Memorial Park. You provide information about cemetery services, plot availability, pricing, and general park information.

Be compassionate, respectful, and professional. Always provide accurate information and direct users to appropriate resources when needed.`,
      guestSystemPrompt: `You are a helpful AI assistant for Garden of Memories Memorial Park. You are speaking to a GUEST USER who is not logged in.

IMPORTANT LIMITATIONS FOR GUESTS:
- Guests CANNOT make reservations - always redirect them to create an account and log in for reservations
- You can help with: grave locating, plot availability info, pricing, visiting hours, facilities, general information
- If they ask about reservations, politely explain they need to create an account first

Be warm, professional, and helpful while respecting these limitations.`,
      updatedBy: adminEmail,
      version: 1
    });

    await defaultConfig.save();

    res.json({
      success: true,
      message: 'Chatbot configuration reset to defaults successfully',
      data: defaultConfig
    });
  } catch (error) {
    console.error('Error resetting chatbot config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset chatbot configuration'
    });
  }
});

export default router;
