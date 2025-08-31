import express from 'express';
import Burial from '../../models/Burial.js';

const router = express.Router();

// Seed 20 dummy burial records
router.post('/seed', async (_req, res) => {
  try {
    const dummyBurials = Array.from({ length: 20 }).map((_, i) => ({
      name: `John Doe ${i + 1}`,
      burialDate: new Date(Date.now() - i * 86400000),
      plotId: `PLOT-${100 + i}`,
      deathCertificateUrl: i % 2 === 0 ? `https://example.com/cert${i + 1}.pdf` : '',
    }));
    const created = await Burial.insertMany(dummyBurials);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to seed burials', error: err.message });
  }
});

// GET all burials
router.get('/', async (_req, res) => {
  try {
    const burials = await Burial.find().sort({ burialDate: -1 });
    res.json(burials);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch burials', error: err.message });
  }
});

// GET burial by ID
router.get('/:id', async (req, res) => {
  try {
    const burial = await Burial.findById(req.params.id);
    if (!burial) return res.status(404).json({ msg: 'Burial not found' });
    res.json(burial);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch burial', error: err.message });
  }
});

// CREATE burial
router.post('/', async (req, res) => {
  try {
    const burial = new Burial(req.body);
    await burial.save();
    res.status(201).json(burial);
  } catch (err) {
    res.status(400).json({ msg: 'Failed to create burial', error: err.message });
  }
});

// UPDATE burial
router.put('/:id', async (req, res) => {
  try {
    const burial = await Burial.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!burial) return res.status(404).json({ msg: 'Burial not found' });
    res.json(burial);
  } catch (err) {
    res.status(400).json({ msg: 'Failed to update burial', error: err.message });
  }
});

// DELETE burial
router.delete('/:id', async (req, res) => {
  try {
    await Burial.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ msg: 'Failed to delete burial', error: err.message });
  }
});

export default router; 