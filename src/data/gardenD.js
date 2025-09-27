// backend/src/data/gardenD.js
// Garden D GeoJSON data - 3D implementation
// This file imports the real Garden D GeoJSON data from the public folder

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const geoJsonPath = path.join(__dirname, '../../data/Garden_D.geojson');

let gardenDGeoJSON;
try {
  if (fs.existsSync(geoJsonPath)) {
    gardenDGeoJSON = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));
  } else {
    console.log('Garden D GeoJSON file not found at:', geoJsonPath);
    gardenDGeoJSON = { type: 'FeatureCollection', features: [] };
  }
} catch (error) {
  console.error('Error loading Garden D GeoJSON:', error);
  gardenDGeoJSON = { type: 'FeatureCollection', features: [] };
}

export const gardenDData = gardenDGeoJSON;

