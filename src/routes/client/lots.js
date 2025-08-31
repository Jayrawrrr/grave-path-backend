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

    // Check if lot exists and is occupied (active)
    const lot = await Lot.findById(id);
    if (!lot) {
      return res.status(404).json({ msg: 'Lot not found' });
    }

    if (lot.status !== 'unavailable' && lot.status !== 'confirmed' && lot.status !== 'reserved' && lot.status !== 'active' && lot.status !== 'occupied') {
      return res.status(400).json({ msg: 'Can only bookmark active lots (occupied graves)' });
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
    
    const user = await User.findById(userId).populate({
      path: 'clientData.bookmarks',
      model: 'Lot'
    });

    // Filter out any invalid bookmarks (lots that no longer exist or are no longer active)
    const validBookmarks = user.clientData.bookmarks.filter(lot => 
      lot && (lot.status === 'unavailable' || lot.status === 'confirmed' || lot.status === 'reserved' || lot.status === 'active' || lot.status === 'occupied')
    );

    // Update user's bookmarks to remove invalid ones
    if (validBookmarks.length !== user.clientData.bookmarks.length) {
      user.clientData.bookmarks = validBookmarks.map(lot => lot._id);
      await user.save();
    }

    res.json(validBookmarks);
  } catch (err) {
    console.error('Get bookmarks error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
