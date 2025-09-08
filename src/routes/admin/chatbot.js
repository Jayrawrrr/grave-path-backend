const express = require('express');
const router = express.Router();
const ChatbotSettings = require('../../models/ChatbotSettings');
const { protect } = require('../../middleware/auth');

// Get chatbot settings
router.get('/settings', protect(['admin']), async (req, res) => {
  try {
    let settings = await ChatbotSettings.findOne();
    
    // If no settings exist, create default ones
    if (!settings) {
      settings = new ChatbotSettings({
        quickQuestions: {
          loggedIn: [
            { question: "I want to make a reservation", order: 1, isActive: true },
            { question: "I want to find a grave", order: 2, isActive: true },
            { question: "What are the visiting hours for Garden of Memories?", order: 3, isActive: true },
            { question: "How much does a cemetery plot cost?", order: 4, isActive: true },
            { question: "What facilities and amenities are available?", order: 5, isActive: true },
            { question: "Tell me about the history of Garden of Memories Memorial Park", order: 6, isActive: true },
            { question: "What are the visiting policies and rules?", order: 7, isActive: true }
          ],
          guest: [
            { question: "I want to find a grave", order: 1, isActive: true },
            { question: "What are the visiting hours for Garden of Memories?", order: 2, isActive: true },
            { question: "How much does a cemetery plot cost?", order: 3, isActive: true },
            { question: "What facilities and amenities are available?", order: 4, isActive: true },
            { question: "Tell me about the history of Garden of Memories Memorial Park", order: 5, isActive: true },
            { question: "What are the visiting policies and rules?", order: 6, isActive: true },
            { question: "How do I get directions to the park?", order: 7, isActive: true }
          ]
        },
        cemeteryInfo: {
          name: 'Garden of Memories Memorial Park',
          location: 'Pateros, Philippines',
          visitingHours: 'Daily 6:00 AM - 6:00 PM',
          contactInfo: {
            phone: '',
            email: '',
            address: ''
          },
          facilities: [
            'Professional landscaping and maintenance',
            'Employee welfare programs',
            'Continuous facility expansion',
            'Community-focused memorial services'
          ],
          policies: [
            'Respectful behavior required',
            'No loud music or disturbances',
            'Follow designated pathways',
            'Contact staff for assistance'
          ]
        }
      });
      await settings.save();
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching chatbot settings:', error);
    res.status(500).json({ error: 'Failed to fetch chatbot settings' });
  }
});

// Update chatbot settings
router.put('/settings', protect(['admin']), async (req, res) => {
  try {
    const updates = req.body;
    
    let settings = await ChatbotSettings.findOne();
    
    if (!settings) {
      settings = new ChatbotSettings();
    }

    // Update fields
    if (updates.quickQuestions) {
      settings.quickQuestions = updates.quickQuestions;
    }
    
    if (updates.cemeteryInfo) {
      settings.cemeteryInfo = { ...settings.cemeteryInfo, ...updates.cemeteryInfo };
    }
    
    if (updates.settings) {
      settings.settings = { ...settings.settings, ...updates.settings };
    }
    
    if (updates.systemPrompt) {
      settings.systemPrompt = updates.systemPrompt;
    }

    settings.lastUpdated = new Date();
    settings.updatedBy = req.user.id;

    await settings.save();
    res.json({ message: 'Chatbot settings updated successfully', settings });
  } catch (error) {
    console.error('Error updating chatbot settings:', error);
    res.status(500).json({ error: 'Failed to update chatbot settings' });
  }
});

// Add new quick question
router.post('/quick-questions', protect(['admin']), async (req, res) => {
  try {
    const { question, userType, order } = req.body;
    
    if (!question || !userType || !['loggedIn', 'guest'].includes(userType)) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    let settings = await ChatbotSettings.findOne();
    if (!settings) {
      settings = new ChatbotSettings();
    }

    const newQuestion = {
      question: question.trim(),
      order: order || settings.quickQuestions[userType].length + 1,
      isActive: true
    };

    settings.quickQuestions[userType].push(newQuestion);
    settings.lastUpdated = new Date();
    settings.updatedBy = req.user.id;

    await settings.save();
    res.json({ message: 'Quick question added successfully', question: newQuestion });
  } catch (error) {
    console.error('Error adding quick question:', error);
    res.status(500).json({ error: 'Failed to add quick question' });
  }
});

// Update quick question
router.put('/quick-questions/:id', protect(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { question, order, isActive, userType } = req.body;
    
    if (!userType || !['loggedIn', 'guest'].includes(userType)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    let settings = await ChatbotSettings.findOne();
    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    const questionIndex = settings.quickQuestions[userType].findIndex(q => q._id.toString() === id);
    if (questionIndex === -1) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question !== undefined) settings.quickQuestions[userType][questionIndex].question = question.trim();
    if (order !== undefined) settings.quickQuestions[userType][questionIndex].order = order;
    if (isActive !== undefined) settings.quickQuestions[userType][questionIndex].isActive = isActive;

    settings.lastUpdated = new Date();
    settings.updatedBy = req.user.id;

    await settings.save();
    res.json({ message: 'Quick question updated successfully' });
  } catch (error) {
    console.error('Error updating quick question:', error);
    res.status(500).json({ error: 'Failed to update quick question' });
  }
});

// Delete quick question
router.delete('/quick-questions/:id', protect(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { userType } = req.query;
    
    if (!userType || !['loggedIn', 'guest'].includes(userType)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    let settings = await ChatbotSettings.findOne();
    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    settings.quickQuestions[userType] = settings.quickQuestions[userType].filter(
      q => q._id.toString() !== id
    );

    settings.lastUpdated = new Date();
    settings.updatedBy = req.user.id;

    await settings.save();
    res.json({ message: 'Quick question deleted successfully' });
  } catch (error) {
    console.error('Error deleting quick question:', error);
    res.status(500).json({ error: 'Failed to delete quick question' });
  }
});

// Reorder quick questions
router.put('/quick-questions/reorder', protect(['admin']), async (req, res) => {
  try {
    const { userType, questionIds } = req.body;
    
    if (!userType || !['loggedIn', 'guest'].includes(userType) || !Array.isArray(questionIds)) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    let settings = await ChatbotSettings.findOne();
    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    // Reorder questions based on the provided order
    const reorderedQuestions = questionIds.map((id, index) => {
      const question = settings.quickQuestions[userType].find(q => q._id.toString() === id);
      if (question) {
        question.order = index + 1;
        return question;
      }
      return null;
    }).filter(Boolean);

    settings.quickQuestions[userType] = reorderedQuestions;
    settings.lastUpdated = new Date();
    settings.updatedBy = req.user.id;

    await settings.save();
    res.json({ message: 'Questions reordered successfully' });
  } catch (error) {
    console.error('Error reordering questions:', error);
    res.status(500).json({ error: 'Failed to reorder questions' });
  }
});

// Get quick questions for public API (used by frontend)
router.get('/quick-questions/:userType', async (req, res) => {
  try {
    const { userType } = req.params;
    
    if (!['loggedIn', 'guest'].includes(userType)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    const settings = await ChatbotSettings.findOne();
    if (!settings) {
      return res.json([]);
    }

    const questions = settings.quickQuestions[userType]
      .filter(q => q.isActive)
      .sort((a, b) => a.order - b.order)
      .map(q => q.question);

    res.json(questions);
  } catch (error) {
    console.error('Error fetching quick questions:', error);
    res.status(500).json({ error: 'Failed to fetch quick questions' });
  }
});

module.exports = router;
