import express from 'express';
import VisitorInfo from '../../models/VisitorInfo.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

// Get visitor info for management
router.get('/', protect(['admin', 'staff']), async (req, res) => {
  try {
    const visitorInfo = await VisitorInfo.getVisitorInfo();
    res.json(visitorInfo);
  } catch (error) {
    console.error('Error fetching visitor info:', error);
    res.status(500).json({ message: 'Failed to fetch visitor info' });
  }
});

// Update visitor info
router.put('/', protect(['admin', 'staff']), async (req, res) => {
  try {
    const { visitingHours, rules, amenities } = req.body;

    // Validate required fields
    if (!visitingHours || !rules || !amenities || !Array.isArray(amenities)) {
      return res.status(400).json({ 
        message: 'Visiting hours, rules, and amenities are required' 
      });
    }

    // Validate amenities array
    for (const amenity of amenities) {
      if (!amenity.imageUrl || !amenity.title || !amenity.description) {
        return res.status(400).json({ 
          message: 'Each amenity must have imageUrl, title, and description' 
        });
      }
    }

    // Get or create visitor info document
    let visitorInfo = await VisitorInfo.findOne();
    
    if (!visitorInfo) {
      visitorInfo = new VisitorInfo();
    }

    // Update fields
    visitorInfo.visitingHours = visitingHours;
    visitorInfo.rules = rules;
    visitorInfo.amenities = amenities;
    visitorInfo.lastUpdated = new Date();
    visitorInfo.updatedBy = req.user.id;

    await visitorInfo.save();

    res.json({
      message: 'Visitor information updated successfully',
      visitorInfo
    });
  } catch (error) {
    console.error('Error updating visitor info:', error);
    res.status(500).json({ message: 'Failed to update visitor info' });
  }
});

// Add new amenity
router.post('/amenities', protect(['admin', 'staff']), async (req, res) => {
  try {
    const { imageUrl, title, description } = req.body;

    if (!imageUrl || !title || !description) {
      return res.status(400).json({ 
        message: 'Image URL, title, and description are required' 
      });
    }

    const visitorInfo = await VisitorInfo.getVisitorInfo();
    
    visitorInfo.amenities.push({
      imageUrl,
      title,
      description
    });
    
    visitorInfo.lastUpdated = new Date();
    visitorInfo.updatedBy = req.user.id;
    
    await visitorInfo.save();

    res.json({
      message: 'Amenity added successfully',
      amenity: visitorInfo.amenities[visitorInfo.amenities.length - 1]
    });
  } catch (error) {
    console.error('Error adding amenity:', error);
    res.status(500).json({ message: 'Failed to add amenity' });
  }
});

// Update specific amenity
router.put('/amenities/:index', protect(['admin', 'staff']), async (req, res) => {
  try {
    const { index } = req.params;
    const { imageUrl, title, description } = req.body;

    if (!imageUrl || !title || !description) {
      return res.status(400).json({ 
        message: 'Image URL, title, and description are required' 
      });
    }

    const visitorInfo = await VisitorInfo.getVisitorInfo();
    const amenityIndex = parseInt(index);

    if (amenityIndex < 0 || amenityIndex >= visitorInfo.amenities.length) {
      return res.status(400).json({ message: 'Invalid amenity index' });
    }

    visitorInfo.amenities[amenityIndex] = {
      imageUrl,
      title,
      description
    };
    
    visitorInfo.lastUpdated = new Date();
    visitorInfo.updatedBy = req.user.id;
    
    await visitorInfo.save();

    res.json({
      message: 'Amenity updated successfully',
      amenity: visitorInfo.amenities[amenityIndex]
    });
  } catch (error) {
    console.error('Error updating amenity:', error);
    res.status(500).json({ message: 'Failed to update amenity' });
  }
});

// Delete amenity
router.delete('/amenities/:index', protect(['admin', 'staff']), async (req, res) => {
  try {
    const { index } = req.params;
    const visitorInfo = await VisitorInfo.getVisitorInfo();
    const amenityIndex = parseInt(index);

    if (amenityIndex < 0 || amenityIndex >= visitorInfo.amenities.length) {
      return res.status(400).json({ message: 'Invalid amenity index' });
    }

    const deletedAmenity = visitorInfo.amenities.splice(amenityIndex, 1)[0];
    
    visitorInfo.lastUpdated = new Date();
    visitorInfo.updatedBy = req.user.id;
    
    await visitorInfo.save();

    res.json({
      message: 'Amenity deleted successfully',
      deletedAmenity
    });
  } catch (error) {
    console.error('Error deleting amenity:', error);
    res.status(500).json({ message: 'Failed to delete amenity' });
  }
});

export default router;
