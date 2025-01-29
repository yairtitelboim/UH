// Map boundaries for Washington DC
export const DC_BOUNDS = {
  north: 38.925,
  south: 38.895,
  east: -76.985,
  west: -77.035
};

// Power infrastructure locations
export const POWER_SUBSTATIONS = [
    { coordinates: [-77.0366, 38.9077], name: "Georgetown Substation" },
    { coordinates: [-77.0214, 38.8921], name: "Capitol Hill Substation" },
    { coordinates: [-77.0491, 38.9241], name: "Tenleytown Grid Hub" },
    { coordinates: [-77.0131, 38.9129], name: "Union Station Power Center" },
    { coordinates: [-77.0303, 38.8980], name: "Downtown DC Main" },
    { coordinates: [-77.0492, 38.8846], name: "Pentagon City Exchange" }
];

export const POWER_HOTSPOTS = [
  {
    coordinates: [-77.0214, 38.8921],
    strength: 1.0,
    name: "Department of Energy"
  },
  {
    coordinates: [-77.0366, 38.8977],
    strength: 0.9,
    name: "White House Complex"
  },
  {
    coordinates: [-77.0091, 38.8899],
    strength: 0.9,
    name: "Capitol Complex"
  },
  {
    coordinates: [-77.0425, 38.9079],
    strength: 0.85,
    name: "Dupont Circle"
  }
];

export const HIGHLIGHTED_BUILDINGS = [
  {
    center: [-77.0214, 38.8921],
    radius: 100,
    name: "Department of Energy Complex"
  },
  {
    center: [-77.0366, 38.8977],
    radius: 150,
    name: "White House District"
  },
  {
    center: [-77.0091, 38.8899],
    radius: 200,
    name: "Capitol Complex"
  },
  {
    center: [-77.0425, 38.9079],
    radius: 120,
    name: "Dupont Circle District"
  }
];

// Animation and rendering constants
export const COGENT_PARTICLE_COLOR = 'rgba(135, 206, 250, 0.6)';
export const PARTICLE_COUNT = 50;
export const PARTICLE_SPEED = 2.0;
export const FRAME_SKIP = 0;
export const MIN_ZOOM = 13;
export const THROTTLE_TIME = 25;
export const TOTAL_SCALE = 0.006;

// Building types and neighborhoods
export const BUILDING_TYPES = ['Office Class A', 'Industrial', 'Mixed Use'];
export const DC_NEIGHBORHOODS = [
  'Downtown', 
  'Navy Yard', 
  'NoMa', 
  'Capitol Hill', 
  'Georgetown', 
  'Foggy Bottom'
];

// Add these new constants
export const WHITE_PARTICLE_COUNT = 8;
export const WHITE_PARTICLE_SIZE = {
    MIN: 1.5,
    MAX: 3.0
};
export const WHITE_PARTICLE_OPACITY = {
    MIN: 0.6,
    MAX: 0.9
};

// Add to existing exports
export const MAIN_CORRIDORS = [
    {
        start: [-77.0366, 38.9077],
        end: [-77.0214, 38.8921],
        name: "Georgetown-Capitol Corridor"
    },
    {
        start: [-77.0491, 38.9241],
        end: [-77.0131, 38.9129],
        name: "Tenleytown-Union Station Corridor"
    },
    // Add more corridors as needed
];
