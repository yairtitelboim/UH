import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapLogic } from '../../hooks/useMapLogic';
import BuildingPopup from './BuildingPopup';
import { Building, Zap, Thermometer, HardDrive } from 'lucide-react';
import { buffer } from '@turf/turf';
import PropTypes from 'prop-types';
import { HeatmapLayer } from 'react-map-gl';
import powerGridIcon from '../../assets/power-grid.svg'; // You'll need to create this
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';

// At the top of the file, after imports
const style = document.createElement('style');
document.head.appendChild(style);

// Combine all styles into one
style.textContent = `
  .custom-marker {
    transform: translate(-50%, -50%);
  }
  
  .marker-content {
    transition: all 0.3s ease;
    position: relative;
  }
  
  .marker-simple {
    z-index: 1;
  }
  
  .marker-full-info {
    z-index: 2000 !important;
  }
  
  .marker-content:hover {
    transform: scale(1.05);
  }
  
  .power-grid-marker {
    position: relative;
    cursor: pointer;
    transition: transform 0.3s ease;
  }
  
  .power-grid-marker:hover {
    transform: scale(1.1);
  }
  
  .mapboxgl-popup {
    z-index: 3000 !important;
  }
  
  .cluster-marker {
    z-index: 1500;
  }
  
  .neural-node {
    filter: blur(2px) drop-shadow(0 0 3px #4CAF50);
  }
  
  .neural-connection {
    filter: blur(1px) drop-shadow(0 0 2px #4CAF50);
    stroke-dasharray: 15;
    animation: flow 15s linear infinite;
  }
  
  @keyframes flow {
    0% {
      stroke-dashoffset: 1000;
    }
    100% {
      stroke-dashoffset: 0;
    }
  }
  
  .grid-card {
    transition: all 0.3s ease;
  }
  
  .grid-icon {
    transition: all 0.3s ease;
  }
  
  .grid-icon:hover {
    transform: translate(-50%, -50%) scale(1.1);
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
  }
  
  .ai-insight {
    animation: fadeIn 0.3s ease;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .status-icons {
    display: flex !important;
    opacity: 1 !important;
    visibility: visible !important;
    margin-left: auto;
    gap: 6px;
    z-index: 3;
  }
  
  .status-icon {
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    display: flex !important;
  }
  
  .building-info {
    opacity: 1 !important;
    visibility: visible !important;
    display: flex !important;
    align-items: center;
    gap: 8px;
  }
  
  @keyframes powerPulse {
    0% {
      line-opacity: 0.4;
      line-blur: 1;
    }
    50% {
      line-opacity: 0.8;
      line-blur: 3;
    }
    100% {
      line-opacity: 0.4;
      line-blur: 1;
    }
  }
`;

// DC area coordinates bounds
const DC_BOUNDS = {
  north: 38.925,
  south: 38.895,
  east: -76.985,
  west: -77.035
};

// Define power substation locations (following major arteries and high-density areas)
const POWER_SUBSTATIONS = [
    { coordinates: [-77.0366, 38.9077], name: "Georgetown Substation" },
    { coordinates: [-77.0214, 38.8921], name: "Capitol Hill Substation" },
    { coordinates: [-77.0491, 38.9241], name: "Tenleytown Grid Hub" },
    { coordinates: [-77.0131, 38.9129], name: "Union Station Power Center" },
    { coordinates: [-77.0303, 38.8980], name: "Downtown DC Main" },
    { coordinates: [-77.0492, 38.8846], name: "Pentagon City Exchange" },
    // Add more based on grid density
];

// Critical fiber crossings (intersections of major routes)
const FIBER_CROSSINGS = [
    { coordinates: [-77.0214, 38.8991], intensity: 0.9 },  // Near Union Station
    { coordinates: [-77.0366, 38.8977], intensity: 1.0 },  // Downtown Core
    { coordinates: [-77.0431, 38.9026], intensity: 0.8 },  // K Street Hub
    { coordinates: [-77.0317, 38.9048], intensity: 0.85 }, // Mass Ave Exchange
    { coordinates: [-77.0209, 38.9026], intensity: 0.75 }, // NoMa Junction
    // Add more at key intersections
];

// High-potential districts (areas with concentrated infrastructure)
const PRIORITY_DISTRICTS = [
    {
        name: "Downtown Core",
        coordinates: [
            [-77.0431, 38.9026],
            [-77.0317, 38.9026],
            [-77.0317, 38.8977],
            [-77.0431, 38.8977]
        ]
    },
    {
        name: "NoMa Tech Corridor",
        coordinates: [
            [-77.0209, 38.9048],
            [-77.0131, 38.9048],
            [-77.0131, 38.8991],
            [-77.0209, 38.8991]
        ]
    },
    // Add more districts
];

// Generate random coordinates within DC bounds
const generateRandomLocation = () => {
  const lat = DC_BOUNDS.south + Math.random() * (DC_BOUNDS.north - DC_BOUNDS.south);
  const lng = DC_BOUNDS.west + Math.random() * (DC_BOUNDS.east - DC_BOUNDS.west);
  return [lng, lat];
};

// Generate random building data
const generateBuildingData = (id) => {
  const coords = generateRandomLocation();
  const propertyTypes = ['office', 'datacenter', 'mixed-use', 'industrial'];
  const neighborhoods = ['Downtown', 'Navy Yard', 'NoMa', 'Capitol Hill', 'Georgetown', 'Foggy Bottom'];
  
  return {
    type: "Feature",
    properties: {
      id: id,
      address: `${Math.floor(Math.random() * 1999)} ${['K St', 'M St', 'Pennsylvania Ave', 'Connecticut Ave'][Math.floor(Math.random() * 4)]} NW`,
      property_type: propertyTypes[Math.floor(Math.random() * propertyTypes.length)],
      neighborhood: neighborhoods[Math.floor(Math.random() * neighborhoods.length)],
      powerScore: Math.random().toFixed(2),
      coolingScore: Math.random().toFixed(2),
      squareFeet: Math.floor(Math.random() * (1000000 - 50000) + 50000),
      yearBuilt: Math.floor(Math.random() * (2023 - 1950) + 1950),
      location: {
        latitude: coords[1],
        longitude: coords[0],
        address: `${Math.floor(Math.random() * 1999)} ${['K St', 'M St', 'Pennsylvania Ave', 'Connecticut Ave'][Math.floor(Math.random() * 4)]} NW`
      }
    },
    geometry: {
      type: "Point",
      coordinates: coords
    }
  };
};

// Generate mock dataset
const generateMockData = (count) => {
  const features = [];
  
  // Add some specific landmark buildings
  const landmarks = [
    {
      coords: [-77.0366, 38.8977],
      address: "1600 Pennsylvania Avenue NW",
      name: "White House Complex",
      type: "office"
    },
    {
      coords: [-77.0091, 38.8899],
      address: "First St SE",
      name: "US Capitol",
      type: "office"
    },
    {
      coords: [-77.0214, 38.8921],
      address: "1000 Independence Ave SW",
      name: "Department of Energy",
      type: "datacenter"
    }
  ];

  // Add landmark buildings
  landmarks.forEach((landmark, index) => {
    features.push({
      type: "Feature",
      properties: {
        id: index,
        address: landmark.address,
        property_type: landmark.type,
        neighborhood: "Downtown",
        powerScore: (Math.random() * 0.3 + 0.7).toFixed(2), // Higher scores for landmarks
        coolingScore: (Math.random() * 0.3 + 0.7).toFixed(2),
        squareFeet: Math.floor(Math.random() * (1000000 - 200000) + 200000),
        yearBuilt: Math.floor(Math.random() * (2010 - 1950) + 1950),
        location: {
          latitude: landmark.coords[1],
          longitude: landmark.coords[0],
          address: landmark.address
        }
      },
      geometry: {
        type: "Point",
        coordinates: landmark.coords
      }
    });
  });

  // Add random buildings
  for (let i = landmarks.length; i < count; i++) {
    features.push(generateBuildingData(i));
  }

  return {
    type: "FeatureCollection",
    features: features
  };
};

// Generate 50 buildings including landmarks
const dcData = generateMockData(50);

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

// Define a more comprehensive DC grid network that follows actual roads
const DC_GRID_NETWORK = {
  primaryLines: [
    // Major East-West power corridors
    {
      name: 'K Street Main',
      coordinates: [
        [-77.0501, 38.9026], // K St & 23rd
        [-77.0431, 38.9026], // K St & 21st
        [-77.0317, 38.9026], // K St & 16th
        [-77.0209, 38.9026], // K St & 11th
        [-77.0120, 38.9026]  // K St & North Capitol
      ],
      strength: 1.0
    },
    {
      name: 'M Street',
      coordinates: [
        [-77.0501, 38.9048], // M St & 23rd
        [-77.0425, 38.9048], // M St & Connecticut
        [-77.0317, 38.9048], // M St & 16th
        [-77.0209, 38.9048], // M St & 11th
        [-77.0120, 38.9048]  // M St & North Capitol
      ],
      strength: 0.9
    }
  ],
  secondaryLines: [
    // North-South Corridors
    {
      name: '16th Street',
      coordinates: [
        [-77.0317, 38.9145], // 16th & U
        [-77.0317, 38.9079], // 16th & Mass
        [-77.0317, 38.9048], // 16th & M
        [-77.0317, 38.9026], // 16th & K
        [-77.0317, 38.8977]  // 16th & Penn
      ],
      strength: 0.8
    },
    {
      name: '11th Street',
      coordinates: [
        [-77.0209, 38.9145], // 11th & U
        [-77.0209, 38.9048], // 11th & M
        [-77.0209, 38.9026], // 11th & K
        [-77.0209, 38.8977]  // 11th & Penn
      ],
      strength: 0.8
    }
  ],
  tertiaryLines: [
    // Diagonal Avenues
    {
      name: 'Connecticut Ave',
      coordinates: [
        [-77.0425, 38.9145], // Conn & Florida
        [-77.0425, 38.9079], // Dupont Circle
        [-77.0390, 38.9026], // Conn & K
        [-77.0366, 38.8977]  // White House
      ],
      strength: 0.7
    },
    {
      name: 'Vermont Ave',
      coordinates: [
        [-77.0319, 38.9145], // Vermont & U
        [-77.0317, 38.9079], // Vermont & Mass
        [-77.0315, 38.8977]  // McPherson Square
      ],
      strength: 0.6
    }
  ],
  crossConnectors: [
    // East-West cross streets
    {
      name: 'U Street',
      coordinates: [
        [-77.0425, 38.9145], // U & Florida
        [-77.0319, 38.9145], // U & 14th
        [-77.0209, 38.9145]  // U & 9th
      ],
      strength: 0.6
    },
    {
      name: 'P Street',
      coordinates: [
        [-77.0425, 38.9091], // P & Dupont
        [-77.0317, 38.9091], // P & 16th
        [-77.0209, 38.9091]  // P & 11th
      ],
      strength: 0.6
    }
  ]
};

// Define power grid locations based on high-performing buildings and key infrastructure
const POWER_GRID_LOCATIONS = [
  // Main power stations and substations
  {
    coordinates: [-77.0214, 38.8921],
    strength: 1.0,
    name: "Department of Energy",
    type: "main_station"
  },
  {
    coordinates: [-77.0366, 38.8977],
    strength: 0.9,
    name: "White House Complex",
    type: "substation"
  },
  {
    coordinates: [-77.0425, 38.9079],
    strength: 0.9,
    name: "Dupont Circle Substation",
    type: "substation"
  },
  {
    coordinates: [-77.0319, 38.9145],
    strength: 0.8,
    name: "U Street Distribution",
    type: "distribution"
  },
  {
    coordinates: [-77.0317, 38.9026],
    strength: 0.85,
    name: "K Street Hub",
    type: "distribution"
  },
  {
    coordinates: [-77.0091, 38.8899],
    strength: 0.9,
    name: "Capitol Complex",
    type: "substation"
  },
  {
    coordinates: [-77.0471, 38.9048],
    strength: 0.8,
    name: "Georgetown Station",
    type: "distribution"
  },
  {
    coordinates: [-77.0233, 38.9048],
    strength: 0.75,
    name: "Shaw Distribution",
    type: "distribution"
  },
  // Add dynamic locations from high-performing buildings
  ...dcData.features
    .filter(building => parseFloat(building.properties.powerScore) > 0.7)
    .map(building => ({
      coordinates: building.geometry.coordinates,
      strength: parseFloat(building.properties.powerScore),
      name: building.properties.address,
      type: "building_connection"
    }))
];

// Define power hotspots (key buildings in DC)
const POWER_HOTSPOTS = [
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

// Define important building clusters (coordinates of building centers)
const HIGHLIGHTED_BUILDINGS = [
  {
    center: [-77.0214, 38.8921], // DOE area
    radius: 100, // meters
    name: "Department of Energy Complex"
  },
  {
    center: [-77.0366, 38.8977], // White House area
    radius: 150,
    name: "White House District"
  },
  {
    center: [-77.0091, 38.8899], // Capitol area
    radius: 200,
    name: "Capitol Complex"
  },
  {
    center: [-77.0425, 38.9079], // Dupont Circle
    radius: 120,
    name: "Dupont Circle District"
  }
];

const MAIN_CORRIDORS = [
    // Major Circles/Roundabouts (using multiple short segments to create circular paths)
    // Dupont Circle
    {
        start: [-77.0434, 38.9097], // Dupont Circle North
        end: [-77.0434, 38.9086],   // Dupont Circle South
        density: 40
    },
    {
        start: [-77.0434, 38.9086], // Dupont Circle South
        end: [-77.0425, 38.9090],   // Dupont Circle Southeast
        density: 40
    },
    {
        start: [-77.0425, 38.9090], // Dupont Circle Southeast
        end: [-77.0434, 38.9097],   // Dupont Circle North
        density: 40
    },

    // Logan Circle
    {
        start: [-77.0319, 38.9097], // Logan Circle North
        end: [-77.0319, 38.9086],   // Logan Circle South
        density: 35
    },
    {
        start: [-77.0319, 38.9086], // Logan Circle South
        end: [-77.0309, 38.9090],   // Logan Circle Southeast
        density: 35
    },
    {
        start: [-77.0309, 38.9090], // Logan Circle Southeast
        end: [-77.0319, 38.9097],   // Logan Circle North
        density: 35
    },

    // Major East-West Arteries (more precisely aligned)
    {
        start: [-77.0501, 38.9026], // K Street from Georgetown
        end: [-77.0366, 38.9026],   // K Street to 14th
        density: 80
    },
    {
        start: [-77.0366, 38.9026], // K Street from 14th
        end: [-77.0209, 38.9026],   // K Street to 7th
        density: 80
    },
    {
        start: [-77.0209, 38.9026], // K Street from 7th
        end: [-77.0120, 38.9026],   // K Street to Union Station
        density: 80
    },

    // Pennsylvania Avenue (precise segments)
    {
        start: [-77.0501, 38.8977], // Penn Ave from Georgetown
        end: [-77.0366, 38.8977],   // to White House
        density: 85
    },
    {
        start: [-77.0366, 38.8977], // Penn Ave from White House
        end: [-77.0209, 38.8977],   // to Federal Triangle
        density: 85
    },
    {
        start: [-77.0209, 38.8977], // Penn Ave from Federal Triangle
        end: [-77.0120, 38.8977],   // to Capitol
        density: 85
    },

    // Massachusetts Avenue (precise diagonal)
    {
        start: [-77.0501, 38.9091], // Mass Ave from Embassy Row
        end: [-77.0425, 38.9075],   // to Dupont
        density: 75
    },
    {
        start: [-77.0425, 38.9075], // Mass Ave from Dupont
        end: [-77.0317, 38.9048],   // to Mt Vernon Square
        density: 75
    },
    {
        start: [-77.0317, 38.9048], // Mass Ave from Mt Vernon
        end: [-77.0209, 38.9026],   // to Union Station
        density: 75
    },

    // Connecticut Avenue (precise diagonal)
    {
        start: [-77.0425, 38.9145], // Conn Ave from Woodley
        end: [-77.0434, 38.9097],   // to Dupont Circle
        density: 70
    },
    {
        start: [-77.0434, 38.9097], // Conn Ave from Dupont
        end: [-77.0366, 38.8977],   // to White House
        density: 70
    },

    // 16th Street (precise north-south)
    {
        start: [-77.0317, 38.9145], // 16th from Columbia Heights
        end: [-77.0317, 38.9097],   // to Logan Circle
        density: 65
    },
    {
        start: [-77.0317, 38.9097], // 16th from Logan Circle
        end: [-77.0317, 38.8977],   // to White House
        density: 65
    },

    // 14th Street (precise north-south)
    {
        start: [-77.0366, 38.9145], // 14th from Columbia Heights
        end: [-77.0366, 38.9026],   // to Franklin Square
        density: 60
    },
    {
        start: [-77.0366, 38.9026], // 14th from Franklin Square
        end: [-77.0366, 38.8977],   // to Federal Triangle
        density: 60
    },

    // Thomas Circle
    {
        start: [-77.0366, 38.9048], // Thomas Circle North
        end: [-77.0366, 38.9038],   // Thomas Circle South
        density: 30
    },
    {
        start: [-77.0366, 38.9038], // Thomas Circle South
        end: [-77.0356, 38.9043],   // Thomas Circle Southeast
        density: 30
    },
    {
        start: [-77.0356, 38.9043], // Thomas Circle Southeast
        end: [-77.0366, 38.9048],   // Thomas Circle North
        density: 30
    }
];

function distanceToLineSegment(point, start, end) {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) {
        return Math.sqrt(
            Math.pow(point[0] - start[0], 2) + 
            Math.pow(point[1] - start[1], 2)
        );
    }

    // Calculate projection of point onto line
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
}

const NeuralNetworkOverlay = () => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.3,
        zIndex: 1
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          top: 0,
          left: 0
        }}
      >
        <defs>
          <pattern
            id="neural-pattern"
            x="0"
            y="0"
            width="200"
            height="200"
            patternUnits="userSpaceOnUse"
          >
            {/* Generate more random nodes */}
            {Array.from({ length: 12 }).map((_, i) => (
              <circle
                key={`node-${i}`}
                cx={Math.random() * 200}
                cy={Math.random() * 200}
                r="3"
                fill="#4CAF50"
                className="neural-node"
              >
                <animate
                  attributeName="opacity"
                  values="0.4;0.8;0.4"
                  dur={`${2 + Math.random() * 2}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
            
            {/* Generate more random connections */}
            {Array.from({ length: 20 }).map((_, i) => (
              <line
                key={`connection-${i}`}
                x1={Math.random() * 200}
                y1={Math.random() * 200}
                x2={Math.random() * 200}
                y2={Math.random() * 200}
                stroke="#4CAF50"
                strokeWidth="1"
                className="neural-connection"
              >
                <animate
                  attributeName="opacity"
                  values="0.2;0.5;0.2"
                  dur={`${3 + Math.random() * 2}s`}
                  repeatCount="indefinite"
                />
              </line>
            ))}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#neural-pattern)" />
      </svg>
    </div>
  );
};

const MapComponent = (props) => {
  const { onArticleUpdate = () => {} } = props;
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng] = useState(-77.019);
  const [lat] = useState(38.907);
  const [zoom] = useState(15.5);
  const animationFrame = useRef(null);
  const buildingStates = useRef(new Map());
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const frameCount = useRef(0);
  const FRAME_SKIP = 2; // Reduced from 3 to make particles more visible
  const MIN_ZOOM = 13;
  const isAnimating = useRef(false);
  const clickTimeout = useRef(null);
  const [cogentActive, setCogentActive] = useState(false);
  const [cogentHighlight, setCogentHighlight] = useState(null);
  const currentFloatingCard = useRef(null);
  const currentRoot = useRef(null);  // Add this ref for React root

  // Add these constants and refs
  const THROTTLE_TIME = 50; // ms
  const TOTAL_SCALE = 0.006; // Adjust this value based on your needs
  const lastAnimationTime = useRef(0);
  const greenBuildings = useRef([]);
  const roads = useRef([]);

  // Add this at the component level
  const selectedCoordinates = useRef(null);

  const handleCogentClick = useCallback(() => {
    console.log('Cogent clicked in Map component');
    setCogentActive(!cogentActive);
    
    if (!map.current) {
      console.log('Map not initialized');
      return;
    }

    try {
      if (!cogentActive) {
        // Darken the base map
        map.current.setPaintProperty('background', 'background-color', '#000000');
        map.current.setPaintProperty('water', 'fill-color', '#000000');
        map.current.setPaintProperty('land', 'background-color', '#000000');
        
        // Make all other layers darker
        ['road-primary', 'road-secondary', 'road-street'].forEach(layer => {
          if (map.current.getLayer(layer)) {
            map.current.setPaintProperty(layer, 'line-color', '#111111');
          }
        });

        const features = map.current.queryRenderedFeatures({
          layers: ['3d-buildings']
        });
        console.log('Total buildings found:', features.length);

        // Find green building
        const greenBuilding = features.find(feature => {
          const state = map.current.getFeatureState({
            source: 'composite',
            sourceLayer: 'building',
            id: feature.id
          });
          return state.isGreen;
        });

        console.log('Green building found:', greenBuilding ? 'yes' : 'no');
        if (greenBuilding) {
          console.log('Green building ID:', greenBuilding.id);
          
          const greenCoords = greenBuilding.geometry.coordinates[0][0];
          console.log('Green building coordinates:', greenCoords);
          
          const nearbyBuildings = features
            .filter(building => {
              if (!building.geometry || building.id === greenBuilding.id) {
                return false;
              }
              
              const buildingCoords = building.geometry.coordinates[0][0];
              
              const latDiff = Math.abs(greenCoords[1] - buildingCoords[1]) * 69 * 5280;
              const lonDiff = Math.abs(greenCoords[0] - buildingCoords[0]) * 69 * 5280 * 
                             Math.cos(greenCoords[1] * Math.PI/180);
              
              const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
              console.log(`Building ${building.id}: lat=${buildingCoords[1]}, lon=${buildingCoords[0]}, distance=${distance.toFixed(2)} feet`);
              
              return distance < 500;
            })
            .slice(0, 3);

          console.log('Nearby buildings found:', nearbyBuildings.length);
          console.log('Nearby building IDs:', nearbyBuildings.map(b => b.id));

          map.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
            'case',
            ['boolean', ['feature-state', 'isGreen'], false],
            '#51ff00',  // Green building
            ['in', ['id'], ['literal', nearbyBuildings.map(b => b.id)]],
            '#FFFF00',  // Bright yellow for nearby buildings
            'rgba(26, 26, 26, 0.3)'  // Dimmed for others
          ]);

          const layersToHide = [
            'cooling-heat',
            'heatmap-layer',
            'heatmap',
            'building-distance-heatmap',
            'road-layer',
            'route-lines'
          ];

          layersToHide.forEach(layer => {
            if (map.current.getLayer(layer)) {
              map.current.setLayoutProperty(layer, 'visibility', 'none');
            }
          });
        }

      } else {
        // Reset to original mapbox style (dark theme)
        map.current.setPaintProperty('background', 'background-color', '#111111');
        map.current.setPaintProperty('water', 'fill-color', '#222222');
        map.current.setPaintProperty('land', 'background-color', '#111111');
        
        // Reset road colors to original dark theme
        ['road-primary', 'road-secondary', 'road-street'].forEach(layer => {
          if (map.current.getLayer(layer)) {
            map.current.setPaintProperty(layer, 'line-color', '#333333');
          }
        });

        // Reset building colors
        map.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
          'case',
          ['boolean', ['feature-state', 'isGreen'], false],
          '#51ff00',
          '#1a1a1a'
        ]);

        const layersToShow = [
          'cooling-heat',
          'heatmap-layer',
          'heatmap',
          'building-distance-heatmap',
          'road-layer',
          'route-lines'
        ];

        layersToShow.forEach(layer => {
          if (map.current.getLayer(layer)) {
            map.current.setLayoutProperty(layer, 'visibility', 'visible');
          }
        });
      }
    } catch (error) {
      console.error('Error in handleCogentClick:', error);
    }
  }, [cogentActive]);

  // First useEffect for map initialization
  useEffect(() => {
    // Define updateMapHighlighting at the top level of the effect
    const updateMapHighlighting = () => {
      if (!map.current || !map.current.getLayer('3d-buildings')) return;
      
      try {
        if (cogentHighlight) {
          // Dim all buildings
          map.current.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', 0.3);
          map.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
            'case',
            ['boolean', ['feature-state', 'isCogentHighlight'], false],
            '#f7db05', // Highlighted buildings
            'rgba(26, 26, 26, 0.3)' // Dimmed buildings
          ]);

          // Find and highlight nearby buildings
          const nearbyBuildings = map.current.queryRenderedFeatures({
            layers: ['3d-buildings'],
            filter: ['!=', ['get', 'height'], 0]
          }).filter(building => {
            if (!building.geometry || !building.geometry.coordinates) return false;
            
            const buildingCoords = building.geometry.coordinates[0][0];
            const distance = Math.sqrt(
              Math.pow(buildingCoords[0] - cogentHighlight.longitude, 2) +
              Math.pow(buildingCoords[1] - cogentHighlight.latitude, 2)
            );
            
            return distance < 0.005; // Adjust this value to control the highlight radius
          }).slice(0, 3); // Limit to 3 nearby buildings

          nearbyBuildings.forEach(building => {
            const buildingId = building.properties.id || building.id;
            if (!buildingId) return;

            map.current.setFeatureState(
              { source: 'composite', sourceLayer: 'building', id: buildingId },
              { isCogentHighlight: true }
            );
          });
        } else {
          // Reset to original state
          map.current.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', 1);
          map.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
            'case',
            ['boolean', ['feature-state', 'inPowerGrid'], false],
            [
              'interpolate',
              ['linear'],
              ['feature-state', 'yellowIntensity'],
              0, '#8B7355',
              0.5, '#DAA520',
              1, '#f7db05'
            ],
            ['case',
              ['boolean', ['feature-state', 'isNegative'], false],
              '#380614',
              ['case',
                ['boolean', ['feature-state', 'isGreen'], false],
                '#51ff00',
                '#1a1a1a'
              ]
            ]
          ]);
        }
      } catch (error) {
        console.error('Error updating map highlighting:', error);
      }
    };

    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-77.0369, 38.9072],
        zoom: 14,
        pitch: 45
      });

      // Wait for map to load before initializing layers
      map.current.on('load', () => {
        // Helper function to safely remove a layer if it exists
        const removeLayerIfExists = (id) => {
          if (map.current.getLayer(id)) {
            map.current.removeLayer(id);
          }
        };

        // Helper function to safely add or update a source
        const addOrUpdateSource = (id, config) => {
          try {
            if (map.current.getSource(id)) {
              // If source exists, update its data
              map.current.getSource(id).setData(config.data);
            } else {
              // If source doesn't exist, add it
              map.current.addSource(id, config);
            }
          } catch (error) {
            console.error(`Error handling source ${id}:`, error);
          }
        };

        // Remove existing layers first (they must be removed before sources)
        removeLayerIfExists('particles');
        removeLayerIfExists('building-markers');
        removeLayerIfExists('3d-buildings');

        // Add or update sources
        addOrUpdateSource('particles', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        addOrUpdateSource('buildings', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        // Now add the layers
        if (!map.current.getLayer('3d-buildings')) {
          map.current.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'type': 'fill-extrusion',
            'minzoom': 12,
            'paint': {
              'fill-extrusion-color': [
                'case',
                ['boolean', ['feature-state', 'inPowerGrid'], false],
                [
                  'interpolate',
                  ['linear'],
                  ['feature-state', 'yellowIntensity'],
                  0, '#8B7355',
                  0.5, '#DAA520',
                  1, '#f7db05'
                ],
                ['case',
                  ['boolean', ['feature-state', 'isNegative'], false],
                  '#380614',
                  ['case',
                    ['boolean', ['feature-state', 'isGreen'], false],
                    '#51ff00',
                    '#1a1a1a'
                  ]
                ]
              ],
              'fill-extrusion-height': ['get', 'height']
            }
          });
        }

        if (!map.current.getLayer('particles')) {
          map.current.addLayer({
            id: 'particles',
            type: 'circle',
            source: 'particles',
            minzoom: 13,
            maxzoom: 20,
            paint: {
              'circle-radius': 2,
              'circle-color': '#4CAF50',
              'circle-blur': 1
            }
          });
        }

        if (!map.current.getLayer('building-markers')) {
          map.current.addLayer({
            id: 'building-markers',
            type: 'symbol',
            source: 'buildings',
            minzoom: 14,
            maxzoom: 20,
            layout: {
              'icon-image': 'building-icon',
              'icon-size': 1,
              'icon-allow-overlap': false
            }
          });
        }

        // Initialize the Cogent highlight effect
        if (cogentHighlight) {
          updateMapHighlighting();
        }
      });
    }

    // Cleanup function
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [cogentHighlight]); // Add cogentHighlight to dependencies

  // Separate effect for handling Cogent highlighting
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) {
      return;
    }

    const updateMapHighlighting = () => {
      try {
        if (cogentHighlight) {
          // Dim all buildings
          map.current.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', 0.3);
          map.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
            'case',
            ['boolean', ['feature-state', 'isCogentHighlight'], false],
            '#f7db05', // Highlighted buildings
            'rgba(26, 26, 26, 0.3)' // Dimmed buildings
          ]);

          // Find and highlight nearby buildings
          const nearbyBuildings = map.current.queryRenderedFeatures({
            layers: ['3d-buildings'],
            filter: ['!=', ['get', 'height'], 0]
          }).filter(building => {
            if (!building.geometry || !building.geometry.coordinates) return false;
            
            const buildingCoords = building.geometry.coordinates[0][0];
            const distance = Math.sqrt(
              Math.pow(buildingCoords[0] - cogentHighlight.longitude, 2) +
              Math.pow(buildingCoords[1] - cogentHighlight.latitude, 2)
            );
            
            return distance < 0.005; // Adjust this value to control the highlight radius
          }).slice(0, 3); // Limit to 3 nearby buildings

          nearbyBuildings.forEach(building => {
            const buildingId = building.properties.id || building.id;
            if (!buildingId) return;

            map.current.setFeatureState(
              { source: 'composite', sourceLayer: 'building', id: buildingId },
              { isCogentHighlight: true }
            );
          });
        } else {
          // Reset to original state
          map.current.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', 1);
          map.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
            'case',
            ['boolean', ['feature-state', 'inPowerGrid'], false],
            [
              'interpolate',
              ['linear'],
              ['feature-state', 'yellowIntensity'],
              0, '#8B7355',
              0.5, '#DAA520',
              1, '#f7db05'
            ],
            ['case',
              ['boolean', ['feature-state', 'isNegative'], false],
              '#380614',
              ['case',
                ['boolean', ['feature-state', 'isGreen'], false],
                '#51ff00',
                '#1a1a1a'
              ]
            ]
          ]);
        }
      } catch (error) {
        console.error('Error updating map highlighting:', error);
      }
    };

    const handleStyleLoad = () => {
      updateMapHighlighting();
    };

    map.current.on('style.load', handleStyleLoad);

    // Initial update if style is already loaded
    if (map.current.isStyleLoaded()) {
      updateMapHighlighting();
    }

    return () => {
      if (map.current) {
        map.current.off('style.load', handleStyleLoad);
      }
    };
  }, [cogentHighlight]);

  // Second useEffect for layers and animation
  useEffect(() => {
    if (!map.current) return;

    // Wait for map to be loaded
    if (!map.current.loaded()) {
        map.current.on('load', initializeLayersAndAnimation);
        return;
    }

    function initializeLayersAndAnimation() {
        // Helper function to safely remove a layer if it exists
        const removeLayerIfExists = (id) => {
          if (map.current.getLayer(id)) {
            map.current.removeLayer(id);
          }
        };

        // Helper function to safely add or update a source
        const addOrUpdateSource = (id, config) => {
          try {
            if (map.current.getSource(id)) {
              // If source exists, update its data
              map.current.getSource(id).setData(config.data);
            } else {
              // If source doesn't exist, add it
              map.current.addSource(id, config);
            }
          } catch (error) {
            console.error(`Error handling source ${id}:`, error);
          }
        };

        // Remove existing layers first (they must be removed before sources)
        removeLayerIfExists('particles');
        removeLayerIfExists('building-markers');
        removeLayerIfExists('3d-buildings');

        // Add or update sources
        addOrUpdateSource('particles', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        addOrUpdateSource('buildings', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        // Now add the layers
        if (!map.current.getLayer('3d-buildings')) {
          map.current.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'type': 'fill-extrusion',
            'minzoom': 12,
            'paint': {
              'fill-extrusion-color': [
                'case',
                ['boolean', ['feature-state', 'inPowerGrid'], false],
                [
                  'interpolate',
                  ['linear'],
                  ['feature-state', 'yellowIntensity'],
                  0, '#8B7355',
                  0.5, '#DAA520',
                  1, '#f7db05'
                ],
                ['case',
                  ['boolean', ['feature-state', 'isNegative'], false],
                  '#380614',
                  ['case',
                    ['boolean', ['feature-state', 'isGreen'], false],
                    '#51ff00',
                    '#1a1a1a'
                  ]
                ]
              ],
              'fill-extrusion-height': ['get', 'height']
            }
          });
        }

        if (!map.current.getLayer('particles')) {
          map.current.addLayer({
            id: 'particles',
            type: 'circle',
            source: 'particles',
            minzoom: 13,
            maxzoom: 20,
            paint: {
              'circle-radius': 2,
              'circle-color': '#4CAF50',
              'circle-blur': 1
            }
          });
        }

        if (!map.current.getLayer('building-markers')) {
          map.current.addLayer({
            id: 'building-markers',
            type: 'symbol',
            source: 'buildings',
            minzoom: 14,
            maxzoom: 20,
            layout: {
              'icon-image': 'building-icon',
              'icon-size': 1,
              'icon-allow-overlap': false
            }
          });
        }

        // 1. Add power grid network source
        map.current.addSource('power-grid-network', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-streets-v8'
        });

        // 2. Add colored 3D buildings
        map.current.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill-extrusion',
            'minzoom': 12,
            'paint': {
                'fill-extrusion-color': [
                    'case',
                    ['boolean', ['feature-state', 'inPowerGrid'], false],
                    [
                        'interpolate',
                        ['linear'],
                        ['feature-state', 'yellowIntensity'],
                        0, '#8B7355',    // Darker yellow/brown for far buildings
                        0.5, '#DAA520',  // Golden yellow for medium distance
                        1, '#f7db05'     // Changed to specified bright yellow for closest buildings
                    ],
                    ['case',
                        ['boolean', ['feature-state', 'isNegative'], false],
                        '#380614', // Dark red for negative performance
                        ['case',
                            ['boolean', ['feature-state', 'isGreen'], false],
                            '#51ff00', // Bright lime green for high-performing buildings
                            '#1a1a1a'  // Dark gray for other buildings
                        ]
                    ]
                ],
                'fill-extrusion-height': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    15, 0,
                    15.05, ['get', 'height']
                ],
                'fill-extrusion-opacity': 1.0
            }
        });

        // 3. Add main power grid lines (yellow)
        map.current.addLayer({
            'id': 'power-grid-main',
            'type': 'line',
            'source': 'power-grid-network',
            'source-layer': 'road',
            'filter': [
                'all',
                ['match',
                    ['get', 'class'],
                    ['primary', 'trunk', 'motorway', 'secondary'],
                    true,
                    false
                ],
                ['>=', ['zoom'], 13]
            ],
            'paint': {
                'line-color': '#FFD966',
                'line-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    13, [
                        'match',
                        ['get', 'class'],
                        'motorway', 3,
                        'trunk', 3,
                        'primary', 2.5,
                        'secondary', 2,
                        1
                    ],
                    16, [
                        'match',
                        ['get', 'class'],
                        'motorway', 6,
                        'trunk', 6,
                        'primary', 5,
                        'secondary', 4,
                        2
                    ]
                ],
                'line-opacity': 0.7,
                'line-blur': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    13, 1,
                    16, 2
                ]
            }
        });

        // 4. Add secondary network (blue)
        map.current.addLayer({
            'id': 'secondary-network-main',
            'type': 'line',
            'source': 'power-grid-network',
            'source-layer': 'road',
            'filter': [
                'all',
                ['match',
                    ['get', 'class'],
                    ['residential', 'service', 'street'],
                    true,
                    false
                ],
                ['>=', ['zoom'], 13]
            ],
            'paint': {
                'line-color': '#67B7D1',
                'line-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    13, [
                        'match',
                        ['get', 'class'],
                        'street', 2,
                        'residential', 1.5,
                        'service', 1,
                        0.5
                    ],
                    16, [
                        'match',
                        ['get', 'class'],
                        'street', 4,
                        'residential', 3,
                        'service', 2,
                        1
                    ]
                ],
                'line-opacity': 0.4,
                'line-blur': 0.5
            }
        });

        // 5. Add data flow source and particles
        map.current.addSource('data-flow', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-streets-v8'
        });

        // 6. Add the particle layer
        map.current.addLayer({
            'id': 'data-flow-particles',
            'type': 'circle',
            'source': 'data-flow',
            'source-layer': 'road',
            'filter': [
                'all',
                ['match',
                    ['get', 'class'],
                    ['primary', 'trunk', 'motorway', 'secondary', 'tertiary'],
                    true,
                    false
                ],
                ['>=', ['zoom'], 13]
            ],
            'paint': {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    12, 1.5,
                    16, 2.5
                ],
                'circle-color': '#FFFFFF',
                'circle-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    12, 0.7,
                    16, 0.9
                ],
                'circle-blur': 0.3
            }
        });

        // 7. Add TCP flow source
        map.current.addSource('tcp-flow', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-streets-v8'
        });

        // 8. Add the TCP particle layer
        map.current.addLayer({
            'id': 'tcp-flow-particles',
            'type': 'circle',
            'source': 'tcp-flow',
            'source-layer': 'road',
            'filter': [
                'all',
                ['match',
                    ['get', 'class'],
                    ['secondary', 'tertiary', 'service'],
                    true,
                    false
                ],
                ['>=', ['zoom'], 13]
            ],
            'paint': {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    12, 1.5,
                    16, 2.5
                ],
                'circle-color': '#FF4500', // Bright orange color
                'circle-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    12, 0.8,
                    16, 0.95
                ],
                'circle-blur': 0.2
            }
        });

        // 9. Add TCP2 flow source
        map.current.addSource('tcp2-flow', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-streets-v8'
        });

        // 10. Add the TCP2 particle layer
        map.current.addLayer({
            'id': 'tcp2-flow-particles',
            'type': 'circle',
            'source': 'tcp2-flow',
            'source-layer': 'road',
            'filter': [
                'all',
                ['match',
                    ['get', 'class'],
                    ['motorway', 'primary', 'street'],
                    true,
                    false
                ],
                ['>=', ['zoom'], 13]
            ],
            'paint': {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    12, 1.3,
                    16, 2.3
                ],
                'circle-color': '#00BFFF', // Light blue (DeepSkyBlue)
                'circle-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    12, 0.75,
                    16, 0.9
                ],
                'circle-blur': 0.25
            }
        });

        // 11. Add TCP3 flow source
        map.current.addSource('tcp3-flow', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-streets-v8'
        });

        // 12. Add the TCP3 particle layer (white, high density)
        map.current.addLayer({
            'id': 'tcp3-flow-particles',
            'type': 'circle',
            'source': 'tcp3-flow',
            'source-layer': 'road',
            'filter': [
                'all',
                ['match',
                    ['get', 'class'],
                    ['residential', 'service', 'street', 'path'],
                    true,
                    false
                ],
                ['>=', ['zoom'], 13]
            ],
            'paint': {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    12, 1.0,
                    16, 1.8
                ],
                'circle-color': '#FFFFFF',
                'circle-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    12, 0.6,
                    16, 0.8
                ],
                'circle-blur': 0.2
            }
        });

        // Add green building particles source
        map.current.addSource('green-building-particles', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

        // Add the green particles layer with increased radius
        map.current.addLayer({
            'id': 'green-building-particles',
            'type': 'circle',
            'source': 'green-building-particles',
            'paint': {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, ['*', ['get', 'particleSize'], 1.5],
                    10, ['*', ['get', 'particleSize'], 1.5],
                    12, ['*', ['get', 'particleSize'], 1.4],
                    14, ['*', ['get', 'particleSize'], 1.25],
                    16, ['*', ['get', 'particleSize'], 1.1]
                ],
                'circle-color': ['get', 'color'],
                'circle-opacity': ['get', 'opacity'],
                'circle-blur': 0.2
            }
        });

        // Add white particles source
        map.current.addSource('white-road-particles', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

        // Add the white particles layer
        map.current.addLayer({
            'id': 'white-road-particles',
            'type': 'circle',
            'source': 'white-road-particles',
            'paint': {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, ['*', ['get', 'particleSize'], 1.2],
                    10, ['*', ['get', 'particleSize'], 1.1],
                    12, ['*', ['get', 'particleSize'], 1.0],
                    14, ['*', ['get', 'particleSize'], 0.9],
                    16, ['*', ['get', 'particleSize'], 0.8]
                ],
                'circle-color': ['get', 'color'],
                'circle-opacity': ['get', 'opacity'],
                'circle-blur': 0.2
            }
        });

        // Updated animation function with more rings and variation
        function animateParticles() {
            const currentTime = Date.now();
            
            // Throttle animation updates
            if (currentTime - lastAnimationTime.current < THROTTLE_TIME) {
                animationFrame.current = requestAnimationFrame(animateParticles);
                return;
            }
            
            lastAnimationTime.current = currentTime;

            // Skip animation if map is not visible or at low zoom
            if (!map.current || !map.current.loaded() || map.current.getZoom() < 13) {
                animationFrame.current = requestAnimationFrame(animateParticles);
                return;
            }

            try {
                const zoom = map.current.getZoom();
                const zoomFactor = Math.max(0.2, (zoom - 13) / 5);
                
                const greenBuildingParticles = {
                    type: 'FeatureCollection',
                    features: []
                };

                // Get current buildings and roads
                const buildings = map.current.queryRenderedFeatures({
                    layers: ['3d-buildings']
                });

                const roads = map.current.queryRenderedFeatures({
                    layers: ['road-simple', 'road-pedestrian']
                });

                // Filter for green buildings
                const greenBuildings = buildings.filter(building => {
                    const buildingId = building.properties.id || building.id;
                    if (!buildingId) return false;
                    
                    const state = buildingStates.current.get(buildingId);
                    return state && state.isGreen;
                });

                // Calculate building centers
                const buildingCenters = greenBuildings.map(building => {
                    const buildingCoords = building.geometry.coordinates[0];
                    return [
                        buildingCoords.reduce((sum, coord) => sum + coord[0], 0) / buildingCoords.length,
                        buildingCoords.reduce((sum, coord) => sum + coord[1], 0) / buildingCoords.length
                    ];
                });

                greenBuildings.forEach((building, buildingIndex) => {
                    const buildingCenter = buildingCenters[buildingIndex];
                    const buildingHeight = building.properties.height || 20;
                    const buildingArea = building.properties.area || 1000;
                    const heightScale = Math.pow(buildingHeight / 20, 1.5);
                    const areaScale = Math.pow(buildingArea / 1000, 1.3);
                    const totalScale = Math.min(Math.max(heightScale + areaScale, 1), 6);

                    roads.forEach(road => {
                        if (!road.geometry || !road.geometry.coordinates) return;

                        const roadCoords = road.geometry.type === 'LineString' ? 
                            road.geometry.coordinates : 
                            road.geometry.coordinates[0];

                        for (let idx = 0; idx < roadCoords.length - 1; idx++) {
                            const roadCoord = roadCoords[idx];
                            const nextRoadCoord = roadCoords[idx + 1];
                            
                            const distToBuilding = Math.sqrt(
                                Math.pow(roadCoord[0] - buildingCenter[0], 2) +
                                Math.pow(roadCoord[1] - buildingCenter[1], 2)
                            );

                            if (distToBuilding < TOTAL_SCALE * totalScale) {
                                const fadeStart = 0.0002 * totalScale;
                                const fadeEnd = 0.006 * totalScale;
                                const rawFade = (distToBuilding - fadeStart) / (fadeEnd - fadeStart);
                                const fadeFactor = Math.max(0, 1 - Math.pow(rawFade, 1.5));
                                const enhancedFade = Math.exp(-rawFade * 2);

                                const dx = nextRoadCoord[0] - roadCoord[0];
                                const dy = nextRoadCoord[1] - roadCoord[1];
                                const roadSegmentLength = Math.sqrt(dx * dx + dy * dy);
                                
                                // Adjust particle count based on zoom
                                const baseParticles = Math.floor(40 * zoomFactor);
                                const particlesPerRoadSegment = Math.floor(baseParticles * roadSegmentLength * 1000 * (enhancedFade + 0.1));
                                
                                for (let i = 0; i < particlesPerRoadSegment; i++) {
                                    const t = i / particlesPerRoadSegment;
                                    const roadLng = roadCoord[0] + dx * t;
                                    const roadLat = roadCoord[1] + dy * t;

                                    const perpX = -dy;
                                    const perpY = dx;
                                    const perpLength = Math.sqrt(perpX * perpX + perpY * perpY);
                                    
                                    if (perpLength === 0) continue;

                                    const normalizedPerpX = perpX / perpLength;
                                    const normalizedPerpY = perpY / perpLength;

                                    // Green particles
                                    const offset = (Math.random() * 0.0001) * Math.sqrt(enhancedFade);
                                    const randomOffset = (Math.random() - 0.5) * 0.00004 * enhancedFade;
                                    
                                    greenBuildingParticles.features.push({
                                        type: 'Feature',
                                        properties: {
                                            particleSize: 1.2 * (enhancedFade + 0.1),
                                            opacity: Math.max(0.1, Math.min(0.9, 0.9 * enhancedFade)),
                                            color: `rgba(80, 220, 80, ${Math.pow(enhancedFade, 1.2)})`
                                        },
                                        geometry: {
                                            type: 'Point',
                                            coordinates: [
                                                roadLng + normalizedPerpX * offset + randomOffset,
                                                roadLat + normalizedPerpY * offset + randomOffset
                                            ]
                                        }
                                    });

                                    // White particles (every third particle)
                                    if (i % 3 === 0) {
                                        const waveSpeed = 2.0;
                                        const waveFrequency = 4.0;
                                        const whiteOffset = 0.00005 * Math.sin((t * Math.PI * waveFrequency) + (currentTime * 0.001 * waveSpeed));
                                        
                                        const flowSpeed = 0.5;
                                        const flowOffset = ((t + currentTime * 0.001 * flowSpeed) % 1.0) - 0.5;
                                        
                                        // Add white particle on both sides of the road
                                        [-1, 1].forEach(side => {
                                            greenBuildingParticles.features.push({
                                                type: 'Feature',
                                                properties: {
                                                    particleSize: 2.0 * (enhancedFade + 0.1),
                                                    opacity: 0.2,
                                                    color: `rgba(255, 255, 255, ${Math.pow(enhancedFade, 1.1)})`
                                                },
                                                geometry: {
                                                    type: 'Point',
                                                    coordinates: [
                                                        roadLng + side * normalizedPerpX * whiteOffset + (normalizedPerpX * flowOffset * 0.00002),
                                                        roadLat + side * normalizedPerpY * whiteOffset + (normalizedPerpY * flowOffset * 0.00002)
                                                    ]
                                                }
                                            });
                                        });
                                    }
                                }
                            }
                        }
                    });
                });

                // Update the particle source with all particles
                if (map.current && map.current.getSource('green-building-particles')) {
                    map.current.getSource('green-building-particles').setData(greenBuildingParticles);
                }

            } catch (error) {
                console.warn('Animation error:', error);
            }

            animationFrame.current = requestAnimationFrame(animateParticles);
        }

        // Start animation
        animateParticles();

        // Generate cooling points function
        function generateCoolingPoints() {
            const points = {
                type: 'FeatureCollection',
                features: []
            };

            // Generate points for each building
            dcData.features.forEach(feature => {
                const [baseLng, baseLat] = feature.geometry.coordinates;
                const isPositive = Math.random() > 0.5;
                
                // Base radius for point spread
                const baseRadius = 0.00375;
                const outerRadius = 0.00625;
                
                // Core points
                for (let i = 0; i < 30; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const radius = Math.random() * baseRadius;
                    const lng = baseLng + Math.cos(angle) * radius;
                    const lat = baseLat + Math.sin(angle) * radius;
                    
                    // Central high-intensity points
                    if (i < 5) {
                        points.features.push({
                            type: 'Feature',
                            properties: {
                                efficiency: isPositive ? 0.9 : 0.1,
                                intensity: 1
                            },
                            geometry: {
                                type: 'Point',
                                coordinates: [lng, lat]
                            }
                        });
                    }
                    
                    // Mid-range points
                    points.features.push({
                        type: 'Feature',
                        properties: {
                            efficiency: isPositive ? 
                                0.6 + (Math.random() * 0.4) : 
                                0.1 + (Math.random() * 0.3),
                            intensity: 1 - (radius * 160)
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: [lng, lat]
                        }
                    });
                }

                // Outer diffuse points
                for (let i = 0; i < 25; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const radius = baseRadius + (Math.random() * outerRadius);
                    const lng = baseLng + Math.cos(angle) * radius;
                    const lat = baseLat + Math.sin(angle) * radius;
                    
                    points.features.push({
                        type: 'Feature',
                        properties: {
                            efficiency: isPositive ? 
                                0.3 + (Math.random() * 0.3) : 
                                0.1 + (Math.random() * 0.2),
                            intensity: 0.4 - (Math.random() * 0.2)
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: [lng, lat]
                        }
                    });
                }
            });

            return points;
        }

        // Add cooling efficiency heatmap source
        map.current.addSource('cooling-efficiency', {
            type: 'geojson',
            data: generateCoolingPoints()
        });

        // Add the heatmap layer
        map.current.addLayer({
            id: 'cooling-heat',
            type: 'heatmap',
            source: 'cooling-efficiency',
            paint: {
                'heatmap-weight': [
                    'interpolate',
                    ['linear'],
                    ['get', 'efficiency'],
                    0, 0,
                    0.5, 1,
                    1, 2
                ],
                'heatmap-intensity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14, 0.7,
                    16, 1.1
                ],
                'heatmap-color': [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    0, 'rgba(0,0,0,0)',
                    0.2, 'rgba(255,65,54,0.25)',
                    0.5, 'rgba(133,133,133,0.25)',
                    1, 'rgba(76,175,80,0.25)'
                ],
                'heatmap-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14, 50,
                    16, 75
                ],
                'heatmap-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14, 0.9,
                    16, 0.7
                ]
            }
        }, 'waterway-label');

        // Modified update function to maintain consistent states
        const updateBuildingColors = () => {
            const buildings = map.current.queryRenderedFeatures({
                layers: ['3d-buildings']
            });

            // First pass: identify green buildings
            const greenBuildingCoordinates = buildings
                .filter(building => {
                    const height = building.properties.height || 0;
                    return height > 10 && height % 4 === 0;
                })
                .map(building => building.geometry.coordinates[0][0]);

            buildings.forEach(building => {
                if (!building.geometry || !building.geometry.coordinates) return;

                const buildingId = building.properties.id || building.id;
                if (!buildingId) return;

                if (!buildingStates.current.has(buildingId)) {
                    // Calculate building size
                    const height = building.properties.height || 0;
                    const area = calculateBuildingArea(building.geometry.coordinates[0]);
                    
                    let isInPowerGrid = false;
                    let isNegative = false;
                    let isGreen = false;
                    let yellowIntensity = 0;

                    // Check if it's a green building
                    if (height > 10 && height % 4 === 0) {
                        isGreen = true;
                    }

                    // Only check power grid and negative if not green
                    if (!isGreen) {
                        // Increased chance for large buildings to be yellow
                        const shouldCheckPowerGrid = Math.random() > 0.55 || // Increased base chance
                            (height > 30 && area > 1000 && Math.random() > 0.3); // Additional chance for large buildings

                        if (shouldCheckPowerGrid) {
                            const centroid = building.geometry.coordinates[0][0];
                            
                            for (const location of POWER_GRID_LOCATIONS) {
                                const coords = location.coordinates;
                                const distance = Math.sqrt(
                                    Math.pow(centroid[0] - coords[0], 2) + 
                                    Math.pow(centroid[1] - coords[1], 2)
                                );

                                if (distance < 0.002) {
                                    isInPowerGrid = true;
                                    
                                    // Calculate yellow intensity based on proximity to green buildings
                                    if (greenBuildingCoordinates.length > 0) {
                                        let minDistance = Infinity;
                                        for (const greenCoord of greenBuildingCoordinates) {
                                            const distToGreen = Math.sqrt(
                                                Math.pow(centroid[0] - greenCoord[0], 2) + 
                                                Math.pow(centroid[1] - greenCoord[1], 2)
                                            );
                                            minDistance = Math.min(minDistance, distToGreen);
                                        }
                                        // Convert distance to intensity (closer = brighter)
                                        yellowIntensity = Math.max(0, 1 - (minDistance * 500));
                                    }
                                    break;
                                }
                            }
                        }

                        // Only be negative if not green and not in power grid
                        if (!isInPowerGrid) {
                            isNegative = Math.random() < 0.15;
                        }
                    }

                    buildingStates.current.set(buildingId, { 
                        isInPowerGrid, 
                        isNegative, 
                        isGreen,
                        yellowIntensity
                    });
                }

                const state = buildingStates.current.get(buildingId);

                try {
                    map.current.setFeatureState(
                        {
                            source: 'composite',
                            sourceLayer: 'building',
                            id: buildingId
                        },
                        {
                            inPowerGrid: state.isInPowerGrid,
                            isNegative: state.isNegative,
                            isGreen: state.isGreen,
                            yellowIntensity: state.yellowIntensity
                        }
                    );
                } catch (error) {
                    console.warn('Could not set feature state for building:', buildingId);
                }
            });
        };

        // Helper function to calculate building area (if not already present)
        function calculateBuildingArea(coordinates) {
            if (!coordinates || coordinates.length < 3) return 0;
            
            let area = 0;
            for (let i = 0; i < coordinates.length; i++) {
                const j = (i + 1) % coordinates.length;
                area += coordinates[i][0] * coordinates[j][1];
                area -= coordinates[j][0] * coordinates[i][1];
            }
            return Math.abs(area) * 10000;
        }

        // Update building colors when the map moves
        map.current.on('moveend', updateBuildingColors);
        // Initial update
        updateBuildingColors();

        function createGreenLines() {
            const zoom = map.current.getZoom();
            const buildings = map.current.queryRenderedFeatures({
                layers: ['3d-buildings']
            });
            
            // Reduce number of buildings processed based on zoom
            const zoomFactor = Math.max(0.2, (zoom - 13) / 5); // Results in 0.2 at zoom 14, increasing to 1 at zoom 18
            const buildingsToProcess = Math.floor(buildings.length * zoomFactor);
            
            const greenBuildings = buildings
                .filter(building => {
                    const buildingId = building.properties.id || building.id;
                    if (!buildingId) return false;
                    
                    const state = buildingStates.current.get(buildingId);
                    return state && state.isGreen;
                })
                .slice(0, buildingsToProcess); // Limit the number of buildings processed
            
            const roads = map.current.queryRenderedFeatures({
                layers: ['road-simple'],
                source: 'composite',
                sourceLayer: 'road'
            });
            
            const greenLinesData = {
                type: 'FeatureCollection',
                features: []
            };

            greenBuildings.forEach(building => {
                if (!building.geometry || !building.geometry.coordinates) return;

                const buildingCoords = building.geometry.coordinates[0];
                const centroid = [
                    buildingCoords.reduce((sum, coord) => sum + coord[0], 0) / buildingCoords.length,
                    buildingCoords.reduce((sum, coord) => sum + coord[1], 0) / buildingCoords.length
                ];

                // Filter nearby roads
                const nearbyRoads = roads.filter(road => {
                    if (!road.geometry || !road.geometry.coordinates) return false;
                    const roadCoords = Array.isArray(road.geometry.coordinates[0]) ? 
                        road.geometry.coordinates[0] : road.geometry.coordinates;
                    
                    return roadCoords.some(coord => 
                        Math.sqrt(
                            Math.pow(centroid[0] - coord[0], 2) + 
                            Math.pow(centroid[1] - coord[1], 2)
                        ) < 0.003
                    );
                });

                // Number of lines based on building size
                const buildingArea = calculateBuildingArea(buildingCoords);
                const numLines = Math.min(Math.max(3, Math.floor(buildingArea / 1000)), 10);
                let linesAdded = 0;

                // Shuffle roads for variety
                const shuffledRoads = [...nearbyRoads].sort(() => Math.random() - 0.5);

                shuffledRoads.forEach(road => {
                    if (linesAdded >= numLines) return;

                    const roadCoords = Array.isArray(road.geometry.coordinates[0]) ? 
                        road.geometry.coordinates[0] : road.geometry.coordinates;

                    if (roadCoords && roadCoords.length >= 2) {
                        const lineCoords = [];
                        let totalDistance = 0;
                        const maxDistance = 0.004;

                        for (let i = 0; i < roadCoords.length - 1 && totalDistance < maxDistance; i++) {
                            if (!lineCoords.length) {
                                lineCoords.push(roadCoords[i]);
                            }
                            lineCoords.push(roadCoords[i + 1]);
                            
                            totalDistance += Math.sqrt(
                                Math.pow(roadCoords[i + 1][0] - roadCoords[i][0], 2) + 
                                Math.pow(roadCoords[i + 1][1] - roadCoords[i][1], 2)
                            );
                        }

                        if (lineCoords.length >= 2) {
                            greenLinesData.features.push({
                                type: 'Feature',
                                properties: {
                                    roadClass: road.properties.class
                                },
                                geometry: {
                                    type: 'LineString',
                                    coordinates: lineCoords
                                }
                            });
                            linesAdded++;
                        }
                    }
                });
            });

            return greenLinesData;
        }

        // First, add the source for green lines
        map.current.addSource('green-lines', {
            type: 'geojson',
            lineMetrics: true,
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

        // Then add the layer for green lines
        map.current.addLayer({
            'id': 'green-building-lines',
            'type': 'line',
            'source': 'green-lines',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#51ff00',
                'line-width': 3,
                'line-opacity': 0.8,
                'line-gradient': [
                    'interpolate',
                    ['linear'],
                    ['line-progress'],
                    0, '#51ff00',
                    1, '#143d00'
                ]
            }
        });

        // Add an update function to refresh the lines
        function updateGreenLines() {
            if (!map.current) return;
            const greenLinesData = createGreenLines();
            const powerFeedData = createPowerFeedLines();
            
            if (map.current.getSource('green-lines')) {
                map.current.getSource('green-lines').setData(greenLinesData);
            }
            if (map.current.getSource('power-lines')) {
                map.current.getSource('power-lines').setData(powerFeedData);
            }
        }

        // Add event listeners
        map.current.on('style.load', () => {
            updateGreenLines();
        });

        map.current.on('moveend', () => {
            updateGreenLines();
        });

        map.current.on('zoom', () => {
            updateGreenLines();
        });

        // Add source for both line types
        map.current.addSource('power-lines', {
            type: 'geojson',
            lineMetrics: true,
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

        // Add yellow power feed lines layer
        map.current.addLayer({
            'id': 'power-feed-lines',
            'type': 'line',
            'source': 'power-lines',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#FFD700',
                'line-width': 2.5,
                'line-opacity': 0.9,
                'line-gradient': [
                    'interpolate',
                    ['linear'],
                    ['line-progress'],
                    0, '#3d3100',  // Darker at the start
                    1, '#FFD700'   // Brighter yellow near the buildings
                ]
            }
        }, 'green-building-lines'); // Place below green lines

        // Update function to handle both line types
        function updatePowerLines() {
            if (!map.current) return;
            
            const greenLinesData = createGreenLines();
            const powerFeedData = createPowerFeedLines();
            
            if (map.current.getSource('green-lines')) {
                map.current.getSource('green-lines').setData(greenLinesData);
            }
            if (map.current.getSource('power-lines')) {
                map.current.getSource('power-lines').setData(powerFeedData);
            }
        }

        // New function to create power feed lines
        function createPowerFeedLines() {
            const buildings = map.current.queryRenderedFeatures({
                layers: ['3d-buildings']
            });

            const greenBuildings = buildings.filter(building => {
                const buildingId = building.properties.id || building.id;
                if (!buildingId) return false;
                
                const state = map.current.getFeatureState({
                    source: 'composite',
                    sourceLayer: 'building',
                    id: buildingId
                });
                return state.isGreen === true;
            });

            const roads = map.current.queryRenderedFeatures({
                layers: ['road-simple'],
                source: 'composite',
                sourceLayer: 'road'
            });

            const powerLinesData = {
                type: 'FeatureCollection',
                features: []
            };

            greenBuildings.forEach(building => {
                if (!building.geometry || !building.geometry.coordinates) return;

                const buildingCoords = building.geometry.coordinates[0];
                const centroid = [
                    buildingCoords.reduce((sum, coord) => sum + coord[0], 0) / buildingCoords.length,
                    buildingCoords.reduce((sum, coord) => sum + coord[1], 0) / buildingCoords.length
                ];

                // Filter nearby roads
                const nearbyRoads = roads.filter(road => {
                    if (!road.geometry || !road.geometry.coordinates) return false;
                    const roadCoords = Array.isArray(road.geometry.coordinates[0]) ? 
                        road.geometry.coordinates[0] : road.geometry.coordinates;
                    
                    // Check if any part of the road is within the desired distance range
                    return roadCoords.some(coord => {
                        const distance = Math.sqrt(
                            Math.pow(centroid[0] - coord[0], 2) + 
                            Math.pow(centroid[1] - coord[1], 2)
                        );
                        return distance > 0.003 && distance < 0.008; // Slightly further than green lines
                    });
                });

                // Number of lines based on building size
                const buildingArea = calculateBuildingArea(buildingCoords);
                const numLines = Math.min(Math.max(2, Math.floor(buildingArea / 1000)), 5);
                let linesAdded = 0;

                // Shuffle roads for variety
                const shuffledRoads = [...nearbyRoads].sort(() => Math.random() - 0.5);

                shuffledRoads.forEach(road => {
                    if (linesAdded >= numLines) return;

                    const roadCoords = Array.isArray(road.geometry.coordinates[0]) ? 
                        road.geometry.coordinates[0] : road.geometry.coordinates;

                    if (roadCoords && roadCoords.length >= 2) {
                        const lineCoords = [];
                        let totalDistance = 0;
                        const maxDistance = 0.006; // Longer segments than green lines

                        for (let i = 0; i < roadCoords.length - 1 && totalDistance < maxDistance; i++) {
                            if (!lineCoords.length) {
                                lineCoords.push(roadCoords[i]);
                            }
                            lineCoords.push(roadCoords[i + 1]);
                            
                            totalDistance += Math.sqrt(
                                Math.pow(roadCoords[i + 1][0] - roadCoords[i][0], 2) + 
                                Math.pow(roadCoords[i + 1][1] - roadCoords[i][1], 2)
                            );
                        }

                        if (lineCoords.length >= 2) {
                            powerLinesData.features.push({
                                type: 'Feature',
                                properties: {
                                    roadClass: road.properties.class
                                },
                                geometry: {
                                    type: 'LineString',
                                    coordinates: lineCoords
                                }
                            });
                            linesAdded++;
                        }
                    }
                });
            });

            return powerLinesData;
        }

        // Update event listeners to use new combined update function
        map.current.on('style.load', () => {
            updatePowerLines();
        });

        map.current.on('moveend', () => {
            updatePowerLines();
        });

        map.current.on('zoom', () => {
            updatePowerLines();
        });

        // Add source for heatmap
        map.current.addSource('distance-heatmap', {
            'type': 'geojson',
            'data': {
                'type': 'FeatureCollection',
                'features': []
            }
        });

        // Add heatmap layer
        map.current.addLayer({
            'id': 'building-distance-heatmap',
            'type': 'heatmap',
            'source': 'distance-heatmap',
            'paint': {
                'heatmap-weight': [
                    'interpolate',
                    ['linear'],
                    ['get', 'intensity'],
                    0, 0,
                    1, 2
                ],
                'heatmap-intensity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    12, 0.5,
                    15, 1
                ],
                'heatmap-color': [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    0, 'rgba(236, 22, 22, 0)',
                    0.2, 'rgba(236, 22, 22, 0.7)',
                    0.4, 'rgba(255, 195, 0, 0.8)',
                    0.8, 'rgba(255, 140, 0, 0.9)',  // Changed to orange
                    1, 'rgba(255, 120, 0, 1)'       // Changed to deeper orange
                ],
                'heatmap-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    12, 20,
                    15, 35
                ],
                'heatmap-opacity': 0.08
            }
        }, 'green-building-lines');

        // Function to update heatmap data
        function updateHeatmap() {
            if (!map.current) return;

            const buildings = map.current.queryRenderedFeatures({
                layers: ['3d-buildings']
            });

            const greenBuildings = buildings.filter(building => {
                const buildingId = building.properties.id || building.id;
                if (!buildingId) return false;
                
                const state = map.current.getFeatureState({
                    source: 'composite',
                    sourceLayer: 'building',
                    id: buildingId
                });
                return state.isGreen === true;
            });

            const points = [];
            
            // Create points around each green building
            greenBuildings.forEach(building => {
                if (!building.geometry || !building.geometry.coordinates) return;
                
                const buildingCoords = building.geometry.coordinates[0];
                const centroid = [
                    buildingCoords.reduce((sum, coord) => sum + coord[0], 0) / buildingCoords.length,
                    buildingCoords.reduce((sum, coord) => sum + coord[1], 0) / buildingCoords.length
                ];

                // Create a circular pattern of points around each building
                const numRings = 15;
                const pointsPerRing = 12;
                const maxRadius = 0.003; // Maximum radius of influence

                for (let ring = 0; ring < numRings; ring++) {
                    const radius = (ring / numRings) * maxRadius;
                    for (let point = 0; point < pointsPerRing; point++) {
                        const angle = (point / pointsPerRing) * Math.PI * 2;
                        const lng = centroid[0] + Math.cos(angle) * radius;
                        const lat = centroid[1] + Math.sin(angle) * radius;
                        
                        // Intensity decreases with distance from center
                        const intensity = Math.pow(1 - (ring / numRings), 2);
                        
                        points.push({
                            'type': 'Feature',
                            'properties': {
                                'intensity': intensity
                            },
                            'geometry': {
                                'type': 'Point',
                                'coordinates': [lng, lat]
                            }
                        });
                    }
                }

                // Add center point with maximum intensity
                points.push({
                    'type': 'Feature',
                    'properties': {
                        'intensity': 1
                    },
                    'geometry': {
                        'type': 'Point',
                        'coordinates': centroid
                    }
                });
            });

            // Update the heatmap source
            if (map.current.getSource('distance-heatmap')) {
                map.current.getSource('distance-heatmap').setData({
                    type: 'FeatureCollection',
                    features: points
                });
            }
        }

        // Add event listeners for heatmap updates
        map.current.on('moveend', updateHeatmap);
        map.current.on('zoom', updateHeatmap);
        map.current.on('style.load', updateHeatmap);

        // Initial update
        updateHeatmap();

        // Add particle layer with zoom constraints
        map.current.addLayer({
          id: 'particles',
          type: 'circle',
          source: 'particles',
          minzoom: 13, // Only show particles at zoom >= 13
          maxzoom: 20,
          paint: {
            'circle-radius': 2,
            'circle-color': '#4CAF50',
            'circle-blur': 1
          }
        });

        // Add power lines layer with zoom constraints
        map.current.addLayer({
          id: 'power-lines',
          type: 'line',
          source: 'power-lines',
          minzoom: 12, // Show power lines slightly earlier
          maxzoom: 20,
          paint: {
            'line-color': '#FFD700',
            'line-width': 2,
            'line-opacity': 0.6
          }
        });

        // Add building markers with zoom constraints
        map.current.addLayer({
          id: 'building-markers',
          type: 'symbol',
          source: 'buildings',
          minzoom: 14, // Only show building details at higher zoom
          maxzoom: 20,
          layout: {
            'icon-image': 'building-icon',
            'icon-size': 1,
            'icon-allow-overlap': false
          }
        });

        // Optimize animation based on zoom level
        const animate = () => {
          if (!map.current || !map.current.loaded()) {
            animationFrame.current = requestAnimationFrame(animate);
            return;
          }

          const zoom = map.current.getZoom();
          
          // Skip animation completely at low zoom levels
          if (zoom < 13) {
            animationFrame.current = requestAnimationFrame(animate);
            return;
          }

          // Adjust particle count based on zoom
          const particleCount = Math.max(1, Math.min(Math.floor(zoom - 12), 4));
          
          // Update particles only if we're at appropriate zoom level
          if (map.current.getLayer('particles') && map.current.getZoom() >= 13) {
            // Your existing particle update logic here
            // but with reduced particle count
          }

          animationFrame.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
          if (animationFrame.current) {
            cancelAnimationFrame(animationFrame.current);
          }
        };
    }

    // Cleanup function
    return () => {
        if (animationFrame.current) {
            cancelAnimationFrame(animationFrame.current);
            animationFrame.current = null;
        }
        if (map.current) {
            map.current.remove();
        }
    };
  }, [map.current]); // Only re-run if map.current changes

  // Clean up function
  useEffect(() => {
    return () => {
      buildingStates.current.clear();
    };
  }, []);

  // Add click handler for buildings
  useEffect(() => {
    if (!map.current) return;

    map.current.on('click', '3d-buildings', (e) => {
      if (e.features.length > 0) {
        const feature = e.features[0];
        const coordinates = feature.geometry.coordinates[0][0];
        
        // Create a proper article structure
        const buildingArticle = {
          location: {
            address: feature.properties.address || 'Unknown Address',
            neighborhood: feature.properties.neighborhood || '',
            city: feature.properties.city || 'Washington',
            state: feature.properties.state || 'DC'
          },
          completion_date: feature.properties.completion_date || 'N/A',
          properties: feature.properties || {}
        };
        
        // Set the clicked building as selected
        setSelectedBuilding(buildingArticle);
        
        // Clean up previous floating card
        if (currentRoot.current) {
          currentRoot.current.unmount();
        }
        if (currentFloatingCard.current) {
          currentFloatingCard.current.remove();
        }
        
        // Create new floating card
        const floatingCardContainer = document.createElement('div');
        document.body.appendChild(floatingCardContainer);
        currentFloatingCard.current = floatingCardContainer;
        
        // Create new React root
        const root = createRoot(floatingCardContainer);
        currentRoot.current = root;
        
        // Render the floating card
        root.render(
          <FloatingCard 
            coordinates={coordinates} 
            map={map.current}
          />
        );
      }
    });

    // Add cursor styling
    map.current.on('mouseenter', '3d-buildings', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', '3d-buildings', () => {
      map.current.getCanvas().style.cursor = '';
    });

    return () => {
      // Cleanup event listeners
      if (map.current) {
        map.current.off('click', '3d-buildings');
        map.current.off('mouseenter', '3d-buildings');
        map.current.off('mouseleave', '3d-buildings');
      }
    };
  }, [map.current]);

  // Update the particle generation code
  const generateParticles = () => {
    if (!map.current) return;
    
    const zoom = map.current.getZoom();
    const bounds = map.current.getBounds();
    
    // Reduce particles at lower zoom levels more aggressively
    let particlesPerRoadSegment;
    if (zoom <= 12) return; // No particles at very low zoom
    if (zoom <= 13) particlesPerRoadSegment = 1;
    else if (zoom <= 14) particlesPerRoadSegment = 2;
    else if (zoom <= 15) particlesPerRoadSegment = 3;
    else particlesPerRoadSegment = 4;

    // Only process visible segments and limit total particles
    const visibleSegments = MAIN_CORRIDORS.filter(corridor => {
      return bounds.contains([corridor.start[0], corridor.start[1]]) ||
             bounds.contains([corridor.end[0], corridor.end[1]]);
    }).slice(0, 20); // Limit max segments processed

    for (const corridor of visibleSegments) {
      for (let i = 0; i < particlesPerRoadSegment; i++) {
        // Your existing particle generation code
        if (map.current && map.current.getSource('particles')) {
          // Your particle update logic
        }
      }
    }
  };

  // Update the animation function
  const animate = useCallback(() => {
    if (!map.current || !map.current.loaded()) {
      animationFrame.current = requestAnimationFrame(animate);
      return;
    }

    frameCount.current += 1;
    
    // Only process every Nth frame
    if (frameCount.current % FRAME_SKIP !== 0) {
      animationFrame.current = requestAnimationFrame(animate);
      return;
    }

    const zoom = map.current.getZoom();
    
    // Adjust particle count based on zoom level
    let particlesPerRoadSegment;
    if (zoom < MIN_ZOOM) particlesPerRoadSegment = 1;
    else if (zoom < 14) particlesPerRoadSegment = 2;
    else if (zoom < 15) particlesPerRoadSegment = 3;
    else particlesPerRoadSegment = 4;

    try {
      // Get visible bounds
      const bounds = map.current.getBounds();
      
      // Filter visible corridors
      const visibleCorridors = MAIN_CORRIDORS.filter(corridor => {
        return bounds.contains([corridor.start[0], corridor.start[1]]) ||
               bounds.contains([corridor.end[0], corridor.end[1]]);
      }).slice(0, 15); // Limit max corridors

      // Update particles for visible corridors
      visibleCorridors.forEach(corridor => {
        for (let i = 0; i < particlesPerRoadSegment; i++) {
          // Your existing particle generation/update code here
          const progress = (frameCount.current * 0.001) % 1;
          const position = [
            corridor.start[0] + (corridor.end[0] - corridor.start[0]) * progress,
            corridor.start[1] + (corridor.end[1] - corridor.start[1]) * progress
          ];

          if (map.current && map.current.getSource('particles')) {
            // Update particle positions
            map.current.getSource('particles').setData({
              type: 'FeatureCollection',
              features: [{
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: position
                }
              }]
            });
          }
        }
      });
    } catch (error) {
      console.error('Animation error:', error);
    }

    animationFrame.current = requestAnimationFrame(animate);
  }, []);

  // Start/Stop animation based on visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isAnimating.current) {
          isAnimating.current = true;
          animate();
        } else if (!entry.isIntersecting && isAnimating.current) {
          isAnimating.current = false;
          if (animationFrame.current) {
            cancelAnimationFrame(animationFrame.current);
          }
        }
      },
      { threshold: 0.1 }
    );

    if (mapContainer.current) {
      observer.observe(mapContainer.current);
    }

    return () => {
      observer.disconnect();
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [animate]);

  // Optimize event handlers
  const handleMapClick = useCallback((e) => {
    if (!map.current) return;
    
    // Debounce click handler
    if (clickTimeout.current) {
        clearTimeout(clickTimeout.current);
    }
    
    clickTimeout.current = setTimeout(() => {
        // Your existing click handler code
    }, 100);
}, [map.current]);

  // Add this cleanup to your useEffect
  useEffect(() => {
    return () => {
      if (currentFloatingCard.current) {
        currentFloatingCard.current.remove();
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      {selectedBuilding && (
        <>
          <button
            onClick={() => {
              setSelectedBuilding(null);
              // Clean up floating card when closing
              if (currentRoot.current) {
                currentRoot.current.unmount();
              }
              if (currentFloatingCard.current) {
                currentFloatingCard.current.remove();
              }
            }}
            style={{
              position: 'absolute',
              left: '470px',
              top: '10px',
              background: 'rgba(0, 0, 0, 0.7)',
              border: 'none',
              color: '#fff',
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              cursor: 'pointer',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
          <BuildingPopup
            selectedArticle={selectedBuilding}
            handleBackToOriginal={() => setSelectedBuilding(null)}
            handleValidate={() => {}}
            handleMatchResults={() => {}}
            showComparison={false}
            validationError={null}
            isValidating={false}
            retryCount={0}
            MAX_RETRIES={3}
            lastValidationTime={null}
            showTypewriter={false}
            matchedResults={[]}
            validatedData={null}
            validationScore={0}
            handleAnalysis={() => {}}
            onCogentClick={handleCogentClick}
            cogentActive={cogentActive}
          />
        </>
      )}
    </div>
  );
};

MapComponent.propTypes = {
  onArticleUpdate: PropTypes.func
};

// Add this helper function at the top level
const FloatingCard = ({ coordinates, map }) => {
  const [position, setPosition] = useState(() => map.project(coordinates));
  const iconColor = '#4CAF50';

  useEffect(() => {
    const updatePosition = () => {
      setPosition(map.project(coordinates));
    };

    map.on('move', updatePosition);
    map.on('zoom', updatePosition);
    map.on('rotate', updatePosition);

    return () => {
      map.off('move', updatePosition);
      map.off('zoom', updatePosition);
      map.off('rotate', updatePosition);
    };
  }, [map, coordinates]);

  return (
    <div style={{
      position: 'fixed',
      left: `${position.x}px`,
      top: `${position.y - 40}px`,
      transform: 'translate(10%, -100%)',  // Changed from -25% to 10% to shift further right
      background: 'rgba(0, 0, 0, 0.85)',
      borderRadius: '8px',
      padding: '8px',
      width: 'auto',
      border: '2px solid #4CAF50',
      color: 'white',
      zIndex: 1000,
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
      pointerEvents: 'none',
      transition: 'left 0.1s, top 0.1s'
    }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">
          <path d="M2 2v20h20"/><path d="M14 10v8"/><path d="M10 14v4"/><path d="M18 6v12"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">
          <path d="M12 2v20M2 12h20"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
          <path d="M12 18c3.3 0 6-2.7 6-6s-2.7-6-6-6-6 2.7-6 6 2.7 6 6 6z"/>
        </svg>
      </div>
    </div>
  );
};

export default MapComponent;



