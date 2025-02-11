import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapLogic } from '../../../hooks/useMapLogic';
import BuildingPopup from '../BuildingPopup';
import { Building, Zap, Thermometer, HardDrive } from 'lucide-react';
import { buffer } from '@turf/turf';
import PropTypes from 'prop-types';
import { HeatmapLayer } from 'react-map-gl';
import powerGridIcon from '../../assets/power-grid.svg'; // You'll need to create this

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

const MapComponent = ({ onArticleUpdate = () => {} }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng] = useState(-77.019);
  const [lat] = useState(38.907);
  const [zoom] = useState(15.5);
  const [animationFrame, setAnimationFrame] = useState(null);
  const buildingStates = useRef(new Map());
  const [selectedBuilding, setSelectedBuilding] = useState(null);

  // First useEffect for map initialization
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [lng, lat],
        zoom: zoom,
        pitch: 45,
        bearing: -17.6,
        antialias: true
    });

    // Return cleanup function
    return () => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
        map.current?.remove();
    };
  }, []); // Empty dependency array since we only want to initialize once

  // Second useEffect for layers and animation
  useEffect(() => {
    if (!map.current) return;

    // Wait for map to be loaded
    if (!map.current.loaded()) {
        map.current.on('load', initializeLayersAndAnimation);
        return;
    }

    function initializeLayersAndAnimation() {
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
                    // Using different road types for TCP routes
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
                    // Using a different combination of road types for TCP2
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
                    // Using residential and service roads for dense coverage
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
            const greenBuildingParticles = {
                type: 'FeatureCollection',
                features: []
            };
            
            const whiteRoadParticles = {
                type: 'FeatureCollection',
                features: []
            };

            const buildings = map.current.queryRenderedFeatures({
                layers: ['3d-buildings']
            });

            const roads = map.current.queryRenderedFeatures({
                layers: ['road-simple', 'road-pedestrian']
            });

            // Pre-calculate building centers and cache green buildings
            const greenBuildingsData = buildings
                .filter(building => {
                    const height = building.properties.height || 0;
                    return height > 10 && height % 4 === 0;
                })
                .map(building => ({
                    building,
                    center: [
                        building.geometry.coordinates[0].reduce((sum, coord) => sum + coord[0], 0) / building.geometry.coordinates[0].length,
                        building.geometry.coordinates[0].reduce((sum, coord) => sum + coord[1], 0) / building.geometry.coordinates[0].length
                    ]
                }));

            const currentTime = Date.now();
            const processedRoads = new Set();

            greenBuildingsData.forEach(({ building, center: buildingCenter }) => {
                const buildingCoords = building.geometry.coordinates[0];

                // Generate green particles around the building
                const numParticles = 50; // Number of green particles per building
                const radius = 0.0005; // Radius of particle field

                for (let i = 0; i < numParticles; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = Math.sqrt(Math.random()) * radius;
                    const offsetX = Math.cos(angle) * r;
                    const offsetY = Math.sin(angle) * r;

                    greenBuildingParticles.features.push({
                        type: 'Feature',
                        properties: {
                            particleSize: 1.2 + Math.random() * 0.3,
                            opacity: 0.4 + Math.random() * 0.3,
                            color: `rgba(81, 255, 0, ${0.6 + Math.random() * 0.4})`
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: [
                                buildingCenter[0] + offsetX,
                                buildingCenter[1] + offsetY
                            ]
                        }
                    });
                }

                // Generate white road particles
                roads.forEach(road => {
                    if (!road.geometry || !road.geometry.coordinates) return;
                    
                    const roadId = road.id || JSON.stringify(road.geometry.coordinates);
                    if (processedRoads.has(roadId)) return;
                    processedRoads.add(roadId);

                    const roadCoords = road.geometry.type === 'LineString' ? 
                        road.geometry.coordinates : 
                        road.geometry.coordinates[0];

                    roadCoords.forEach((coord) => {
                        const distToBuilding = Math.sqrt(
                            Math.pow(coord[0] - buildingCenter[0], 2) +
                            Math.pow(coord[1] - buildingCenter[1], 2)
                        );

                        if (distToBuilding < 0.001) {
                            const particlesPerPoint = 8;
                            
                            for (let i = 0; i < particlesPerPoint; i++) {
                                const dirX = buildingCenter[0] - coord[0];
                                const dirY = buildingCenter[1] - coord[1];
                                const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
                                
                                const normalizedDirX = dirX / dirLength;
                                const normalizedDirY = dirY / dirLength;
                                
                                const timeOffset = (currentTime + i * 100) % 2000 / 2000;
                                const particleProgress = (timeOffset + Math.random() * 0.1) % 1;
                                const randomSpread = (Math.random() - 0.5) * 0.00002;
                                
                                whiteRoadParticles.features.push({
                                    type: 'Feature',
                                    properties: {
                                        particleSize: 1.8 + Math.random() * 0.4,
                                        opacity: 0.8 * (1 - particleProgress),
                                        color: `rgba(255, 255, 255, ${0.9 * (1 - particleProgress)})`
                                    },
                                    geometry: {
                                        type: 'Point',
                                        coordinates: [
                                            coord[0] + normalizedDirX * distToBuilding * particleProgress + randomSpread,
                                            coord[1] + normalizedDirY * distToBuilding * particleProgress + randomSpread
                                        ]
                                    }
                                });
                            }
                        }
                    });
                });
            });

            if (map.current.getSource('green-building-particles')) {
                map.current.getSource('green-building-particles').setData(greenBuildingParticles);
            }
            if (map.current.getSource('white-road-particles')) {
                map.current.getSource('white-road-particles').setData(whiteRoadParticles);
            }

            requestAnimationFrame(animateParticles);
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
            if (map.current.getSource('green-lines')) {
                map.current.getSource('green-lines').setData(greenLinesData);
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
    }

    // Cleanup function
    return () => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
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
      // Check if clicked building is green
      const buildingId = e.features[0].properties.id || e.features[0].id;
      const state = map.current.getFeatureState({
        source: 'composite',
        sourceLayer: 'building',
        id: buildingId
      });

      if (state.isGreen) {
        // Format building data for the popup
        const building = e.features[0];
        const coords = building.geometry.coordinates[0][0];
        
        setSelectedBuilding({
          location: {
            address: building.properties.address || 'Unknown Address',
            neighborhood: building.properties.neighborhood || 'Unknown Neighborhood',
            city: 'Washington',
            state: 'DC',
            latitude: coords[1],
            longitude: coords[0]
          },
          completion_date: building.properties.yearBuilt || 'Unknown',
          image_url: 'https://via.placeholder.com/150', // Replace with actual building image
          title: building.properties.address || 'Green Building'
        });
      } else {
        setSelectedBuilding(null);
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      {selectedBuilding && (
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
        />
      )}
    </div>
  );
};

MapComponent.propTypes = {
  onArticleUpdate: PropTypes.func
};

MapComponent.defaultProps = {
  onArticleUpdate: () => {}
};

export default MapComponent;



