// Simple test to verify Garden A data structure
import { gardenAData } from './src/data/gardenA.js';

console.log('Testing Garden A data structure...');
console.log('Has data:', !!gardenAData);
console.log('Has features:', !!gardenAData.features);
console.log('Features count:', gardenAData.features?.length || 0);
console.log('First feature:', gardenAData.features?.[0]);
console.log('✅ Garden A data structure is valid!');
