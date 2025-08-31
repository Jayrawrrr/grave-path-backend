import mongoose from 'mongoose';

const AnnouncementSchema = new mongoose.Schema({
  title:     { type: String,  required: true },
  message:   { type: String,  required: true },
  createdAt: { type: Date,    default: Date.now },
  pinned:    { type: Boolean, default: false }
});

export default mongoose.model('Announcement', AnnouncementSchema);
