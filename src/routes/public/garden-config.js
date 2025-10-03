import express from 'express';

const router = express.Router();

// Garden configuration based on your GeoJSON data
const GARDEN_CONFIG = {
  A: {
    name: 'Garden A',
    bounds: {
      north: 14.53879,
      south: 14.538394,
      east: 121.069888,
      west: 121.069403
    },
    rows: 20,
    columns: 42,
    totalGraves: 840
  },
  B: {
    name: 'Garden B',
    bounds: {
      north: 14.538777,
      south: 14.53839,
      east: 121.070611,
      west: 121.069928
    },
    rows: 20,
    columns: 61,
    totalGraves: 1220
  },
  C: {
    name: 'Garden C',
    bounds: {
      north: 14.538362,
      south: 14.538103,
      east: 121.071787,
      west: 121.070769
    },
    rows: 20,
    columns: 42,
    totalGraves: 840
  },
  D: {
    name: 'Garden D',
    bounds: {
      north: 14.538362,
      south: 14.538103,
      east: 121.071787,
      west: 121.070769
    },
    rows: 20,
    columns: 50,
    totalGraves: 1000
  }
};

// Get garden configuration (public access)
router.get('/', (req, res) => {
  try {
    res.json(GARDEN_CONFIG);
  } catch (error) {
    console.error('Error fetching garden config:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch garden configuration' 
    });
  }
});

export default router;
