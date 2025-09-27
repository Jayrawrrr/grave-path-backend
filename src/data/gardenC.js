// backend/src/data/gardenC.js
// Garden C GeoJSON data - 3D implementation
// This file imports the real Garden C GeoJSON data from the public folder

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const geoJsonPath = path.join(__dirname, '../../data/Garden_C.geojson');

let gardenCGeoJSON;
try {
  if (fs.existsSync(geoJsonPath)) {
    gardenCGeoJSON = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));
  } else {
    console.log('Garden C GeoJSON file not found at:', geoJsonPath);
    gardenCGeoJSON = { type: 'FeatureCollection', features: [] };
  }
} catch (error) {
  console.error('Error loading Garden C GeoJSON:', error);
  gardenCGeoJSON = { type: 'FeatureCollection', features: [] };
}

export const gardenCData = gardenCGeoJSON;
