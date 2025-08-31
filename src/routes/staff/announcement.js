import express from 'express';
import Announcement from '../../models/Announcement.js';

const router = express.Router();

// ─── CREATE ───────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message required.' });
    }
    const ann = new Announcement({ title, message });
    await ann.save();
    res.status(201).json(ann);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── READ ALL ──────────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const data = await Announcement.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── UPDATE ───────────────────────────────────────────────────────────
// Edit title/message/pinned
router.put('/:id', async (req, res) => {
  try {
    const updates = {};
    ['title','message','pinned'].forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    const ann = await Announcement.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );
    if (!ann) return res.status(404).json({ message: 'Not found' });
    res.json(ann);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── DELETE ───────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const ann = await Announcement.findByIdAndDelete(req.params.id);
    if (!ann) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── TOGGLE PIN ────────────────────────────────────────────────────────
// PATCH /:id/pin  { pinned: true/false }
router.patch('/:id/pin', async (req, res) => {
  try {
    const { pinned } = req.body;
    if (typeof pinned !== 'boolean') {
      return res.status(400).json({ message: 'pinned must be true or false' });
    }
    const ann = await Announcement.findByIdAndUpdate(
      req.params.id,
      { $set: { pinned } },
      { new: true }
    );
    if (!ann) return res.status(404).json({ message: 'Not found' });
    res.json(ann);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;
