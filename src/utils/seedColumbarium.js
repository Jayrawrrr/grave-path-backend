import mongoose from 'mongoose';
import { ColumbariumSlot } from '../models/ColumbariumReservation.js';
import dotenv from 'dotenv';

dotenv.config();

async function seedColumbariumSlots() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing slots
    await ColumbariumSlot.deleteMany({});
    console.log('Cleared existing columbarium slots');

    const slots = [];
    const building = 'Main Building';
    const floors = [1, 2, 3, 4, 5];
    const sections = ['A', 'B', 'C', 'D'];
    const rowsPerSection = 10;
    const columnsPerRow = 8;
    const basePrice = 50000;

    for (const floor of floors) {
      for (const section of sections) {
        for (let row = 1; row <= rowsPerSection; row++) {
          for (let col = 1; col <= columnsPerRow; col++) {
            const slotId = `${building.substring(0, 1)}${floor}${section}${String(row).padStart(2, '0')}${String(col).padStart(2, '0')}`;
            
            // Calculate position for 3D layout
            const position = {
              x: (col - 1) * 40, // 40cm spacing between columns
              y: (row - 1) * 40, // 40cm spacing between rows
              z: (floor - 1) * 250 // 250cm height per floor
            };

            // Vary prices based on location (premium for lower floors and front sections)
            let price = basePrice;
            if (floor <= 2) price *= 1.2; // Ground and first floor premium
            if (section === 'A' || section === 'B') price *= 1.1; // Front sections premium
            
            // Add some variety in sizes
            let size = 'single';
            if (row % 5 === 0 && col % 3 === 0) size = 'family'; // Every 5th row, 3rd column
            else if ((row + col) % 4 === 0) size = 'double'; // Some double slots

            // Dimensions based on size
            let dimensions = { width: 30, height: 30, depth: 30 };
            if (size === 'double') {
              dimensions = { width: 60, height: 30, depth: 30 };
            } else if (size === 'family') {
              dimensions = { width: 90, height: 45, depth: 45 };
              price *= 2.5; // Family slots cost more
            }

            slots.push({
              slotId,
              building,
              floor,
              section,
              row,
              column: col,
              size,
              dimensions,
              price: Math.round(price),
              status: 'available',
              position
            });
          }
        }
      }
    }

    // Insert slots in batches
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < slots.length; i += batchSize) {
      const batch = slots.slice(i, i + batchSize);
      await ColumbariumSlot.insertMany(batch);
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${slots.length} slots`);
    }

    console.log(`✅ Successfully created ${slots.length} columbarium slots`);
    console.log(`
📊 Summary:
- Building: ${building}
- Floors: ${floors.length} (${floors.join(', ')})
- Sections per floor: ${sections.length} (${sections.join(', ')})
- Rows per section: ${rowsPerSection}
- Columns per row: ${columnsPerRow}
- Total slots: ${slots.length}
- Price range: ₱${Math.min(...slots.map(s => s.price)).toLocaleString()} - ₱${Math.max(...slots.map(s => s.price)).toLocaleString()}
    `);

    // Create a few sample reservations (optional)
    console.log('Seeding completed successfully!');
    
  } catch (error) {
    console.error('Error seeding columbarium slots:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the seeder
seedColumbariumSlots();
