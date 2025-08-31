import express from 'express';
import Interment from '../../models/Interments.js';

const router = express.Router();

// Seed 20 dummy interment records
router.post('/seed', async (_req, res) => {
  try {
    const dummyInterments = Array.from({ length: 20 }).map((_, i) => ({
      name: `Jane Smith ${i + 1}`,
      plotId: `PLOT-${200 + i}`,
      intermentDate: new Date(Date.now() - i * 86400000),
      intermentTime: `${9 + (i % 8)}:00 AM`,
      officiant: `Officiant ${String.fromCharCode(65 + (i % 5))}`,
      status: i % 3 === 0 ? 'completed' : (i % 3 === 1 ? 'scheduled' : 'cancelled'),
    }));
    const created = await Interment.insertMany(dummyInterments);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to seed interments', error: err.message });
  }
});

// GET all interments
router.get('/', async (_req, res) => {
  try {
    const interments = await Interment.find().sort({ intermentDate: -1 });
    res.json(interments);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch interments', error: err.message });
  }
});

// GET interment by ID
router.get('/:id', async (req, res) => {
  try {
    const interment = await Interment.findById(req.params.id);
    if (!interment) return res.status(404).json({ msg: 'Interment not found' });
    res.json(interment);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch interment', error: err.message });
  }
});

// CREATE interment
router.post('/', async (req, res) => {
  try {
    const interment = new Interment(req.body);
    await interment.save();
    res.status(201).json(interment);
  } catch (err) {
    res.status(400).json({ msg: 'Failed to create interment', error: err.message });
  }
});

// UPDATE interment
router.put('/:id', async (req, res) => {
  try {
    const interment = await Interment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!interment) return res.status(404).json({ msg: 'Interment not found' });
    res.json(interment);
  } catch (err) {
    res.status(400).json({ msg: 'Failed to update interment', error: err.message });
  }
});

// DELETE interment
router.delete('/:id', async (req, res) => {
  try {
    await Interment.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ msg: 'Failed to delete interment', error: err.message });
  }
});

export default router;
