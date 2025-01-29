import { DC_BOUNDS } from './constants';

// Coordinate generation
export const generateRandomLocation = (bounds) => {
  const lat = bounds.south + Math.random() * (bounds.north - bounds.south);
  const lng = bounds.west + Math.random() * (bounds.east - bounds.west);
  return [lng, lat];
};

// Building data generation
export const generateBuildingData = (id, bounds) => {
  const coords = generateRandomLocation(bounds);
  const propertyTypes = ['office', 'datacenter', 'mixed-use', 'industrial'];
  const neighborhoods = ['Downtown', 'Navy Yard', 'NoMa', 'Capitol Hill', 'Georgetown', 'Foggy Bottom'];
  
  return {
    type: "Feature",
    properties: {
      id: id,
      address: generateAddress(coords),
      property_type: propertyTypes[Math.floor(Math.random() * propertyTypes.length)],
      neighborhood: getNeighborhoodFromCoords(coords, neighborhoods),
      powerScore: Math.random().toFixed(2),
      coolingScore: Math.random().toFixed(2),
      squareFeet: Math.floor(Math.random() * (1000000 - 50000) + 50000),
      yearBuilt: Math.floor(Math.random() * (2023 - 1950) + 1950),
      location: {
        latitude: coords[1],
        longitude: coords[0],
        address: generateAddress(coords)
      }
    },
    geometry: {
      type: "Point",
      coordinates: coords
    }
  };
};

// Generate mock data for multiple buildings
export const generateMockData = (count = 50) => {
  const features = [];
  for (let i = 0; i < count; i++) {
    features.push(generateBuildingData(i, DC_BOUNDS));
  }
  return {
    type: "FeatureCollection",
    features: features
  };
};

export const generateAddress = (coordinates) => {
  const streets = [
    'K St NW', 'M St NW', 'Pennsylvania Ave', 'Connecticut Ave', 
    'Wisconsin Ave', 'Massachusetts Ave', 'Rhode Island Ave', 'New York Ave'
  ];
  const numbers = ['1200', '1400', '1600', '1800', '2000', '2200'];
  
  const streetIndex = Math.floor((coordinates[0] * 10) % streets.length);
  const numberIndex = Math.floor((coordinates[1] * 10) % numbers.length);
  
  return `${numbers[numberIndex]} ${streets[streetIndex]}`;
};

export const getNeighborhoodFromCoords = (coordinates) => {
  const neighborhoods = [
    { name: 'Downtown', lat: 38.9, lon: -77.03 },
    { name: 'Navy Yard', lat: 38.87, lon: -77.00 },
    { name: 'NoMa', lat: 38.91, lon: -77.01 },
    { name: 'Capitol Hill', lat: 38.89, lon: -77.00 },
    { name: 'Foggy Bottom', lat: 38.9, lon: -77.05 },
    { name: 'Georgetown', lat: 38.91, lon: -77.06 }
  ];
  
  let closest = neighborhoods[0];
  let minDistance = Infinity;
  
  neighborhoods.forEach(hood => {
    const distance = Math.sqrt(
      Math.pow(coordinates[1] - hood.lat, 2) + 
      Math.pow(coordinates[0] - hood.lon, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closest = hood;
    }
  });
  
  return closest.name;
};

export const distanceToLineSegment = (point, start, end) => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) {
    return Math.sqrt(
      Math.pow(point[0] - start[0], 2) + 
      Math.pow(point[1] - start[1], 2)
    );
  }

  const t = Math.max(0, Math.min(1, 
    ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (length * length)
  ));

  const projection = [
    start[0] + t * dx,
    start[1] + t * dy
  ];

  return Math.sqrt(
    Math.pow(point[0] - projection[0], 2) + 
    Math.pow(point[1] - projection[1], 2)
  );
};
