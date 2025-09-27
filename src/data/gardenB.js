// backend/src/data/gardenB.js
// Garden B GeoJSON data - 3D implementation
// This file imports the real Garden B GeoJSON data from the public folder

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const geoJsonPath = path.join(__dirname, '../../data/Garden_B.geojson');

let gardenBGeoJSON;
try {
  if (fs.existsSync(geoJsonPath)) {
    gardenBGeoJSON = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));
  } else {
    console.log('Garden B GeoJSON file not found at:', geoJsonPath);
    gardenBGeoJSON = { type: 'FeatureCollection', features: [] };
  }
} catch (error) {
  console.error('Error loading Garden B GeoJSON:', error);
  gardenBGeoJSON = { type: 'FeatureCollection', features: [] };
}

export const gardenBData = gardenBGeoJSON;
