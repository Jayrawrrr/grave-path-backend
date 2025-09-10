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
          imageUrl: '/Field1.jpg',
          title: 'Memorial Field 1',
          description: 'Peaceful burial grounds with well-maintained plots'
        },
        { 
          imageUrl: '/Field2.jpg',
          title: 'Memorial Field 2',
          description: 'Additional burial area with serene surroundings'
        },
        { 
          imageUrl: '/BoardMonument.jpg',
          title: 'Memorial Board & Monument',
          description: 'Dedicated memorial space with commemorative monuments'
        },
        { 
          imageUrl: '/Schedule&Announcement.jpg',
          title: 'Schedule & Announcement Board',
          description: 'Information center for park schedules and announcements'
        },
        { 
          imageUrl: '/EntranceName.jpg',
          title: 'Main Entrance',
          description: 'Welcome entrance to Garden of Memories Memorial Park'
        },
        { 
          imageUrl: '/Columbarium.jpg',
          title: 'Columbarium',
          description: 'Modern columbarium facility for cremated remains'
        },
        { 
          imageUrl: '/MainBuilding.jpg',
          title: 'Main Building',
          description: 'Administrative building and visitor services center'
        },
        { 
          imageUrl: '/Chapel.jpg',
          title: 'Memorial Chapel',
          description: 'Sacred space for prayer, reflection, and ceremonies'
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