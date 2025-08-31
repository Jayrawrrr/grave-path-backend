import express from 'express';
import ActivityLog from '../../models/ActivityLogs.js';

const router = express.Router();

// GET all logs
router.get('/', async (req, res) => {
  try {
    const logs = await ActivityLog.find().sort({ timestamp: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching logs' });
  }
});

// GET summary
router.get('/summary', async (req, res) => {
  try {
    const summary = await ActivityLog.aggregate([
      { $group: { _id: '$userRole', count: { $sum: 1 } } }
    ]);
    const result = { client: 0, staff: 0, admin: 0 };
    summary.forEach(s => { result[s._id] = s.count; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching activity log summary' });
  }
});

export default router;
