import express from 'express';
import Lot from '../../models/Lot.js';
import { ColumbariumReservation } from '../../models/ColumbariumReservation.js';

const router = express.Router();

// Public endpoint to get lots without authentication
// Used by guest users to view plot availability and map data
router.get('/', async (req, res) => {
  try {
    const lots = await Lot.find();
    res.json(lots);
  } catch (err) {
    console.error('Error fetching lots for public access:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Public endpoint to get lot availability without authentication
router.get('/availability', async (req, res) => {
  try {
    // Get all lots from database
    const lots = await Lot.find();
    
    // Get custom lots from request if any
    const customLots = req.query.customLots ? JSON.parse(req.query.customLots) : [];
    
    // Combine database lots with custom lots
    const allLots = [...lots, ...customLots];
    
    res.json(allLots);
  } catch (err) {
    console.error('Error fetching lot availability for public access:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Unified search endpoint for both graves and columbarium entries
router.get('/search-graves', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ msg: 'Search query is required' });
    }

    const searchTerm = query.trim().toLowerCase();
    const results = [];

    // Search in regular burial lots
    const lots = await Lot.find({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { id: { $regex: searchTerm, $options: 'i' } },
        { birth: { $regex: searchTerm, $options: 'i' } },
        { death: { $regex: searchTerm, $options: 'i' } },
        { location: { $regex: searchTerm, $options: 'i' } },
        { landmark: { $regex: searchTerm, $options: 'i' } }
      ]
    }).limit(10);

    // Add regular burial results
    lots.forEach(lot => {
      results.push({
        type: 'grave',
        id: lot._id,
        lot_id: lot.id,
        lot_name: lot.name || lot.id,
        deceased_name: lot.birth || lot.name || 'Unknown',
        birth_date: lot.birth || null,
        death_date: lot.death || null,
        location: lot.location || 'Garden of Memories Memorial Park',
        status: lot.status,
        sqm: lot.sqm,
        price: lot.price
      });
    });

    // Search in columbarium reservations
    const columbariumReservations = await ColumbariumReservation.find({
      status: { $in: ['approved', 'completed'] },
      $or: [
        { 'deceasedInfo.name': { $regex: searchTerm, $options: 'i' } },
        { clientName: { $regex: searchTerm, $options: 'i' } },
        { slotId: { $regex: searchTerm, $options: 'i' } }
      ]
    })
    .populate('slotId')
    .limit(10);

    // Add columbarium results
    columbariumReservations.forEach(reservation => {
      if (reservation.slotId) {
        results.push({
          type: 'columbarium',
          id: reservation._id,
          slot_id: reservation.slotId.slotId,
          deceased_name: reservation.deceasedInfo.name,
          birth_date: reservation.deceasedInfo.dateOfBirth,
          death_date: reservation.deceasedInfo.dateOfDeath,
          location: 'Columbarium Building',
          building: reservation.slotId.building,
          floor: reservation.slotId.floor,
          section: reservation.slotId.section,
          row: reservation.slotId.row,
          column: reservation.slotId.column,
          size: reservation.slotId.size,
          status: reservation.status,
          client_name: reservation.clientName
        });
      }
    });

    // Sort results by relevance (exact matches first, then partial matches)
    results.sort((a, b) => {
      const aName = a.deceased_name.toLowerCase();
      const bName = b.deceased_name.toLowerCase();
      
      if (aName === searchTerm && bName !== searchTerm) return -1;
      if (aName !== searchTerm && bName === searchTerm) return 1;
      if (aName.startsWith(searchTerm) && !bName.startsWith(searchTerm)) return -1;
      if (!aName.startsWith(searchTerm) && bName.startsWith(searchTerm)) return 1;
      
      return aName.localeCompare(bName);
    });

    res.json(results);
  } catch (err) {
    console.error('Error searching graves and columbarium:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router; 