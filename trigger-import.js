// Simple script to trigger Garden A import
import axios from 'axios';

async function triggerImport() {
  try {
    console.log('Triggering Garden A import...');
    
    // Call your import endpoint
    const response = await axios.post('http://localhost:5000/api/admin/garden-a/import', {}, {
      headers: {
        'Authorization': 'Bearer YOUR_ADMIN_TOKEN_HERE' // You'll need to replace this with a real token
      }
    });
    
    console.log('✅ Import successful:', response.data);
  } catch (error) {
    console.error('❌ Import failed:', error.response?.data || error.message);
  }
}

triggerImport();
