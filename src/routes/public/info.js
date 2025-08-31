import express from 'express';

const router = express.Router();

// Public endpoint to get visitor information without authentication
// Used by guest users to view visitor info (hours, rules, amenities)
router.get('/', async (req, res) => {
  try {
    // For now, return static visitor information
    // In the future, this could be stored in a database
    const visitorInfo = {
      visitingHours: `Monday – Friday: 9:00 AM – 5:00 PM
Saturday – Sunday: 10:00 AM – 4:00 PM
Holidays: 10:00 AM – 2:00 PM`,
      rules: `• Please check in at the reception area
• Maintain silence and respect for other visitors
• No outside food and drinks allowed
• Keep the premises clean
• Follow designated pathways
• Photography requires permission`,
      amenities: [
        { 
          imageUrl: '/amenity1.jpg',
          title: 'Memorial Church',
          description: 'A peaceful sanctuary for prayer and reflection'
        },
        { 
          imageUrl: '/amenity2.jpg',
          title: 'Memorial Garden',
          description: 'Beautifully landscaped gardens for quiet contemplation'
        },
        { 
          imageUrl: '/amenity3.jpg',
          title: 'Parking Area',
          description: 'Spacious parking facility with 24/7 security'
        },
        { 
          imageUrl: '/amenity4.jpg',
          title: 'Memorial Chapel',
          description: 'Intimate space for private ceremonies'
        },
        { 
          imageUrl: '/amenity5.jpg',
          title: 'Fountain Plaza',
          description: 'Serene water feature with seating areas'
        }
      ]
    };
    
    res.json(visitorInfo);
  } catch (err) {
    console.error('Error fetching visitor info for public access:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router; 