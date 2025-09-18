// Garden A GeoJSON data - simplified version for testing
export const gardenAData = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "grave_1_1",
      "properties": {
        "type": "grave",
        "name": "Grave 1-1",
        "row": 1,
        "column": 1
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [121.069412, 14.538799],
          [121.0699, 14.538781],
          [121.069888, 14.538398],
          [121.0694, 14.538416],
          [121.069412, 14.538799]
        ]]
      }
    },
    {
      "type": "Feature",
      "id": "niche_1_1",
      "properties": {
        "type": "niche",
        "name": "Niche 1-1",
        "row": 1,
        "column": 1,
        "grave_row": 1,
        "grave_column": 1
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [121.069412, 14.538799],
          [121.0699, 14.538781],
          [121.069888, 14.538398],
          [121.0694, 14.538416],
          [121.069412, 14.538799]
        ]]
      }
    }
  ]
};
