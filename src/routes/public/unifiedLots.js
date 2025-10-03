import express from 'express';
import Lot from '../../models/Lot.js';
import GardenA from '../../models/GardenA.js';
import GardenB from '../../models/GardenB.js';
import GardenC from '../../models/GardenC.js';
import GardenD from '../../models/GardenD.js';
import GraveReservation from '../../models/GraveReservation.js';

const router = express.Router();

// Unified endpoint to get all grave data from both old and new systems
// Used by the map to display graves with current status
router.get('/', async (req, res) => {
  try {
    // Use a Map to ensure unique graves by ID
    const gravesMap = new Map();

    // Skip old Lot model - use only new Garden models to avoid double-counting
    // The Garden models (A, B, C, D) are the current system and should be the source of truth
    console.log('Using Garden models only (A, B, C, D) - Lot model excluded to prevent double-counting');

    // Get graves from new garden models (A, B, C, D)
    const [gardenAGraves, gardenBGraves, gardenCGraves, gardenDGraves] = await Promise.all([
      GardenA.find({ type: 'grave' }),
      GardenB.find({ type: 'grave' }),
      GardenC.find({ type: 'grave' }),
      GardenD.find({ type: 'grave' })
    ]);

    // Process Garden A graves - prioritize garden model over lot model
    gardenAGraves.forEach(grave => {
      const graveId = `A-${grave.row}-${grave.column}`;
      gravesMap.set(graveId, {
        _id: grave._id,
        id: graveId,
        name: grave.name || '',
        birth: grave.birth || '',
        death: grave.death || '',
        status: grave.status,
        coordinates: grave.centerCoordinates,
        garden: 'A',
        row: grave.row,
        column: grave.column,
        location: `Garden A, Row ${grave.row}, Column ${grave.column}`,
        price: grave.price,
        sqm: grave.sqm,
        type: 'grave',
        source: 'garden_a_model'
      });
    });

    // Process Garden B graves - prioritize garden model over lot model
    gardenBGraves.forEach(grave => {
      const graveId = `B-${grave.row}-${grave.column}`;
      gravesMap.set(graveId, {
        _id: grave._id,
        id: graveId,
        name: grave.name || '',
        birth: grave.birth || '',
        death: grave.death || '',
        status: grave.status,
        coordinates: grave.centerCoordinates,
        garden: 'B',
        row: grave.row,
        column: grave.column,
        location: `Garden B, Row ${grave.row}, Column ${grave.column}`,
        price: grave.price,
        sqm: grave.sqm,
        type: 'grave',
        source: 'garden_b_model'
      });
    });

    // Process Garden C graves - prioritize garden model over lot model
    gardenCGraves.forEach(grave => {
      const graveId = `C-${grave.row}-${grave.column}`;
      gravesMap.set(graveId, {
        _id: grave._id,
        id: graveId,
        name: grave.name || '',
        birth: grave.birth || '',
        death: grave.death || '',
        status: grave.status,
        coordinates: grave.centerCoordinates,
        garden: 'C',
        row: grave.row,
        column: grave.column,
        location: `Garden C, Row ${grave.row}, Column ${grave.column}`,
        price: grave.price,
        sqm: grave.sqm,
        type: 'grave',
        source: 'garden_c_model'
      });
    });

    // Process Garden D graves (only in garden model)
    gardenDGraves.forEach(grave => {
      const graveId = `D-${grave.row}-${grave.column}`;
      gravesMap.set(graveId, {
        _id: grave._id,
        id: graveId,
        name: grave.name || '',
        birth: grave.birth || '',
        death: grave.death || '',
        status: grave.status,
        coordinates: grave.centerCoordinates,
        garden: 'D',
        row: grave.row,
        column: grave.column,
        location: `Garden D, Row ${grave.row}, Column ${grave.column}`,
        price: grave.price,
        sqm: grave.sqm,
        type: 'grave',
        source: 'garden_d_model'
      });
    });

    // Convert Map to array
    const allGraves = Array.from(gravesMap.values());

    // Update grave status based on active grave reservations
    const activeReservations = await GraveReservation.find({ 
      status: { $in: ['approved', 'pending'] } 
    });

    activeReservations.forEach(reservation => {
      const grave = allGraves.find(g => 
        g.garden === reservation.garden && 
        g.row === reservation.row && 
        g.column === reservation.column
      );
      
      if (grave) {
        // Update status based on reservation
        if (reservation.status === 'approved') {
          grave.status = 'reserved';
        } else if (reservation.status === 'pending') {
          grave.status = 'reserved'; // Show as reserved while pending
        }
      }
    });

    console.log(`Unified lots: ${gardenAGraves.length + gardenBGraves.length + gardenCGraves.length + gardenDGraves.length} graves from Garden models (A, B, C, D) = ${allGraves.length} total graves`);
    console.log(`Active grave reservations affecting status: ${activeReservations.length}`);

    res.json(allGraves);
  } catch (err) {
    console.error('Error fetching unified lots:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// Get unified lot availability for public access
router.get('/availability', async (req, res) => {
  try {
    // Get all graves from unified endpoint
    const response = await fetch(`${req.protocol}://${req.get('host')}/api/public/unified-lots`);
    const allGraves = await response.json();
    
    // Get custom lots from request if any
    const customLots = req.query.customLots ? JSON.parse(req.query.customLots) : [];
    
    // Combine unified graves with custom lots
    const allLots = [...allGraves, ...customLots];
    
    res.json(allLots);
  } catch (err) {
    console.error('Error fetching unified lot availability:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

export default router;
