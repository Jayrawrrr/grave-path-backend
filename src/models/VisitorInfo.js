import mongoose from 'mongoose';

const visitorInfoSchema = new mongoose.Schema({
  visitingHours: {
    type: String,
    required: true,
    default: `Monday – Friday: 9:00 AM – 5:00 PM
Saturday – Sunday: 10:00 AM – 4:00 PM
Holidays: 10:00 AM – 2:00 PM`
  },
  rules: {
    type: String,
    required: true,
    default: `• Please check in at the reception area
• Maintain silence and respect for other visitors
• No outside food and drinks allowed
• Keep the premises clean
• Follow designated pathways
• Photography requires permission`
  },
  amenities: [{
    imageUrl: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    }
  }],
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

// Ensure only one document exists
visitorInfoSchema.statics.getVisitorInfo = async function() {
  let visitorInfo = await this.findOne();
  if (!visitorInfo) {
    // Create default visitor info if none exists
    visitorInfo = new this({
      amenities: [
        { 
          imageUrl: '/EntranceName.jpg',
          title: 'Main Entrance',
          description: 'Welcome entrance to Garden of Memories Memorial Park'
        },
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
    });
    await visitorInfo.save();
  }
  return visitorInfo;
};

export default mongoose.model('VisitorInfo', visitorInfoSchema);

