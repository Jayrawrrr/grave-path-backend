import express     from 'express';
import Lot         from '../../models/Lot.js';
import { protect } from '../../middleware/auth.js';
import User        from '../../models/User.js';

const router = express.Router();

// must be logged in as client, staff or admin
router.use(protect(['client','staff','admin']));

router.get('/', async (req, res) => {
  try {
    const lots = await Lot.find();
    res.json(lots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * POST /api/client/lots/:id/bookmark
 * Bookmark a lot (clients only)
 */
router.post('/:id/bookmark', protect(['client']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if lot exists in database
    const lot = await Lot.findOne({ id: id });
    
    // If not in database, check if it's a valid GeoJSON grave format
    if (!lot) {
      // Validate the ID format (A-123-456, B-123-456, etc.)
      const validIdPattern = /^[ABCD]-\d+-\d+$/;
      if (!validIdPattern.test(id)) {
        return res.status(404).json({ msg: 'Invalid lot ID format' });
      }
      // Allow bookmarking valid GeoJSON graves even if not in database
    } else {
      // If in database, check status
      const validStatuses = ['unavailable', 'confirmed', 'reserved', 'active', 'occupied'];
      if (!validStatuses.includes(lot.status)) {
        return res.status(400).json({ msg: 'Can only bookmark active lots (occupied graves)' });
      }
    }

    // Update user's bookmarks
    const user = await User.findById(userId);
    if (!user.clientData.bookmarks.includes(id)) {
      user.clientData.bookmarks.push(id);
      await user.save();
    }

    res.json({ msg: 'Lot bookmarked successfully', bookmarks: user.clientData.bookmarks });
  } catch (err) {
    console.error('Bookmark lot error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * DELETE /api/client/lots/:id/bookmark
 * Remove bookmark from a lot (clients only)
 */
router.delete('/:id/bookmark', protect(['client']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Update user's bookmarks
    const user = await User.findById(userId);
    user.clientData.bookmarks = user.clientData.bookmarks.filter(
      bookmarkId => bookmarkId.toString() !== id
    );
    await user.save();

    res.json({ msg: 'Bookmark removed successfully', bookmarks: user.clientData.bookmarks });
  } catch (err) {
    console.error('Remove bookmark error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * GET /api/client/lots/bookmarks
 * Get user's bookmarked lots (clients only)
 */
router.get('/bookmarks', protect(['client']), async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    
    // Get bookmarked lot IDs (now stored as strings)
    const bookmarkIds = user.clientData.bookmarks || [];
    
    // Fetch lots from database that match the bookmark IDs
    const dbLots = await Lot.find({ id: { $in: bookmarkIds } });
    
    // Also handle GeoJSON graves (not in database) by creating mock objects
    const geoJsonBookmarks = bookmarkIds
      .filter(id => !dbLots.find(lot => lot.id === id))
      .filter(id => /^[ABCD]-\d+-\d+$/.test(id)) // Valid GeoJSON format
      .map(id => ({
        _id: id, // Use the ID as _id for consistency
        id: id,
        name: `Grave ${id}`,
        status: 'occupied',
        garden: id.charAt(0), // A, B, C, or D
        location: `Garden ${id.charAt(0)}`,
        type: 'grave',
        isFromGeoJSON: true
      }));

    // Combine database lots with GeoJSON bookmarks
    const allBookmarks = [...dbLots, ...geoJsonBookmarks];
    
    // Filter out any invalid bookmarks
    const validBookmarks = allBookmarks.filter(lot => 
      lot && (lot.status === 'unavailable' || lot.status === 'confirmed' || lot.status === 'reserved' || lot.status === 'active' || lot.status === 'occupied')
    );

    res.json(validBookmarks);
  } catch (err) {
    console.error('Get bookmarks error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
