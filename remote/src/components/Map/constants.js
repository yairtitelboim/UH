// Map boundaries for Washington DC
export const DC_BOUNDS = {
  north: 38.925,
  south: 38.895,
  east: -76.985,
  west: -77.035
};

// Map boundaries for Jacksonville
export const JAX_BOUNDS = {
  north: 30.4867,
  south: 30.1372,
  east: -81.3929,
  west: -81.8186
};

// Miami boundaries
export const MIAMI_BOUNDS = {
  north: 25.8557,
  south: 25.7087,
  east: -80.1307,
  west: -80.2867
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

// Power infrastructure locations for Jacksonville
export const POWER_SUBSTATIONS_JAX = [
    { coordinates: [-81.6557, 30.3322], name: "Downtown Jacksonville Substation" },
    { coordinates: [-81.6234, 30.3154], name: "San Marco Substation" },
    { coordinates: [-81.7157, 30.3084], name: "Westside Grid Hub" },
    { coordinates: [-81.5876, 30.3290], name: "Arlington Power Center" },
    { coordinates: [-81.6453, 30.2922], name: "Southside Main" },
    { coordinates: [-81.6892, 30.3486], name: "Northside Exchange" }
];

export const MAIN_CORRIDORS_JAX = [
    {
        start: [-81.6557, 30.3222], // Downtown
        end: [-81.6557, 30.3122],   // San Marco
        density: 80  // Higher density for downtown corridor
    },
    {
        start: [-81.6234, 30.3154], // San Marco
        end: [-81.6157, 30.3290],   // Arlington
        density: 75  // Medium-high density
    },
    {
        start: [-81.6453, 30.3422],
        end: [-81.5876, 30.3490],
        density: 70  // Medium density
    },
    {
        start: [-81.6599, 30.3322],
        end: [-81.6557, 30.3222],
        density: 85  // Highest density
    }
];

// Animation constants
export const MIN_ZOOM_JAX = 13;
export const FRAME_SKIP_JAX = 2;
export const THROTTLE_TIME_JAX = 50;
export const PARTICLE_SIZE_JAX = {
    MIN: 1.5,
    MAX: 3.0
};
export const PARTICLE_OPACITY_JAX = {
    MIN: 0.6,
    MAX: 0.9
};

// Building colors
export const BUILDING_COLORS = {
    DARK_GRAY: '#1a1a1a',    // Default buildings
    DARK_RED: '#380614',     // Negative performance
    BRIGHT_GREEN: '#51ff00', // High-performing buildings
    YELLOW_FAR: '#8B7355',   // Power grid buildings (far from green)
    YELLOW_MID: '#DAA520',   // Power grid buildings (medium distance)
    YELLOW_CLOSE: '#f7db05'  // Power grid buildings (close to green)
};

// Map configuration constants
export const MAP_CONFIG = {
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-80.2998, 25.7797],  // Miami coordinates
    zoom: 11,  // Changed from 13 to 11 for a more zoomed out view
    minZoom: 9,  // Changed from 11 to 9 to allow zooming out more
    maxZoom: 17
};

// Power infrastructure locations for Miami
export const POWER_SUBSTATIONS_MIAMI = [
    { coordinates: [-80.1917, 25.7617], name: "Downtown Miami Substation" },
    { coordinates: [-80.1927, 25.7897], name: "Wynwood Power Center" },
    { coordinates: [-80.1307, 25.7897], name: "Miami Beach Grid Hub" },
    { coordinates: [-80.2167, 25.7527], name: "Coral Gables Exchange" },
    { coordinates: [-80.1917, 25.8107], name: "Design District Substation" },
    { coordinates: [-80.1897, 25.7757], name: "Brickell Power Hub" }
];

export const MAIN_CORRIDORS_MIAMI = [
    {
        start: [-80.1917, 25.7617], // Downtown
        end: [-80.1897, 25.7757],   // Brickell
        density: 85  // High density for downtown-brickell corridor
    },
    {
        start: [-80.1927, 25.7897], // Wynwood
        end: [-80.1917, 25.8107],   // Design District
        density: 75  // Art district corridor
    },
    {
        start: [-80.1917, 25.7617], // Downtown
        end: [-80.1307, 25.7897],   // Miami Beach
        density: 80  // Beach corridor
    },
    {
        start: [-80.1917, 25.7617], // Downtown
        end: [-80.2167, 25.7527],   // Coral Gables
        density: 70  // Coral Gables corridor
    }
];
