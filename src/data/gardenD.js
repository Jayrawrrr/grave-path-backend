// backend/src/data/gardenD.js
// Garden D GeoJSON data - 3D implementation
// This file imports the real Garden D GeoJSON data from the public folder

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const geoJsonPath = path.join(__dirname, '../../../staff-dashboard/public/data/Garden_D.geojson');
const gardenDGeoJSON = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));

export const gardenDData = gardenDGeoJSON;

