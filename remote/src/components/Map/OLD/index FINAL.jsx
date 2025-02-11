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

const MapComponent = ({ onArticleUpdate }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng] = useState(-77.019);
  const [lat] = useState(38.907);
  const [zoom] = useState(15.5);
  const [animationFrame, setAnimationFrame] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);

  // Define handleBuildingClick inside the component
  const handleBuildingClick = (building) => {
    // Convert building data to match the expected format for BuildingPopup
    const formattedBuilding = {
      location: {
        address: building.properties.address,
        neighborhood: building.properties.neighborhood,
        city: 'Washington',
        state: 'DC'
      },
      completion_date: building.properties.yearBuilt,
      image_url: 'https://via.placeholder.com/150',
      title: building.properties.address
    };
    
    setSelectedBuilding(formattedBuilding);
  };

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

    initializeLayersAndAnimation();

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
                    ['==', ['%', ['get', 'height'], 4], 0],
                    // Green buildings
                    [
                        'interpolate',
                        ['linear'],
                        ['get', 'height'],
                        0, '#4CAF50',
                        50, '#00FF00',
                        100, '#90EE90',
                        200, '#98FB98'
                    ],
                    ['==', ['%', ['get', 'height'], 4], 1],
                    // Red buildings
                    [
                        'interpolate',
                        ['linear'],
                        ['get', 'height'],
                        0, '#FF4136',
                        50, '#FF6B6B',
                        100, '#FF8585',
                        200, '#FFA07A'
                    ],
                    ['==', ['%', ['get', 'height'], 4], 2],
                    // Cyan buildings
                    [
                        'interpolate',
                        ['linear'],
                        ['get', 'height'],
                        0, '#00CED1',
                        50, '#40E0D0',
                        100, '#7FFFD4',
                        200, '#E0FFFF'
                    ],
                    // Dark gray for remaining buildings
                    '#2F2F2F'
                ],
                'fill-extrusion-height': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    15, 0,
                    15.05, ['get', 'height']
                ],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.8
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

        // Add this before adding any layers
        map.current.addSource('white-road-particles', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

        // Then add the white particles layer
        map.current.addLayer({
            'id': 'white-road-particles',
            'type': 'circle',
            'source': 'white-road-particles',
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
        }, '3d-buildings');

        // Make sure the green building particles layer is added last
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

        // Updated animation function with more rings and variation
        function animateParticles() {
            const currentTime = Date.now() / 1000; // Convert to seconds for smoother animation
            
            const greenBuildingParticles = {
                type: 'FeatureCollection',
                features: []
            };

            const buildings = map.current.queryRenderedFeatures({
                layers: ['3d-buildings']
            });

            const roads = map.current.queryRenderedFeatures({
                layers: ['road-simple', 'road-pedestrian']
            });

            // Increased to 30 buildings and optimized the filter
            const greenBuildings = buildings
                .filter(building => {
                    const height = building.properties.height || 0;
                    // Added height threshold to focus on taller buildings
                    return height > 10 && height % 4 === 0;
                })
                .slice(0, 30); // Increased from 15 to 30

            // Calculate all building centers first for better performance
            const buildingCenters = greenBuildings.map(building => {
                const buildingCoords = building.geometry.coordinates[0];
                return [
                    buildingCoords.reduce((sum, coord) => sum + coord[0], 0) / buildingCoords.length,
                    buildingCoords.reduce((sum, coord) => sum + coord[1], 0) / buildingCoords.length
                ];
            });

            // Rest of the particle generation code remains the same...
            greenBuildings.forEach((building, buildingIndex) => {
                const buildingCoords = building.geometry.coordinates[0];
                const buildingHeight = building.properties.height || 20;
                const buildingArea = building.properties.area || 1000;
                const heightScale = Math.pow(buildingHeight / 20, 1.5);
                const areaScale = Math.pow(buildingArea / 1000, 1.3);
                const totalScale = Math.min(Math.max(heightScale + areaScale, 1), 6);

                const buildingCenter = buildingCenters[buildingIndex];

                // Building edge particles with noise
                buildingCoords.forEach((coord, index, array) => {
                    const nextCoord = array[(index + 1) % array.length];
                    const dx = nextCoord[0] - coord[0];
                    const dy = nextCoord[1] - coord[1];
                    const edgeLength = Math.sqrt(dx * dx + dy * dy);
                    
                    const particlesPerEdge = Math.floor(65 * edgeLength * 1000);
                    
                    for (let i = 0; i < particlesPerEdge; i++) {
                        const t = i / particlesPerEdge;
                        const particleLng = coord[0] + dx * t;
                        const particleLat = coord[1] + dy * t;
                        
                        // Multiple layers with smoother falloff
                        for (let layer = 0; layer < 5; layer++) {
                            const layerOffset = (Math.random() * 0.00012 * totalScale) * Math.pow(layer, 0.7);
                            const perpX = -dy;
                            const perpY = dx;
                            const perpLength = Math.sqrt(perpX * perpX + perpY * perpY);
                            const normalizedPerpX = perpX / perpLength;
                            const normalizedPerpY = perpY / perpLength;

                            // Add both green and white particles
                            const isWhiteParticle = Math.random() < 0.3; // 30% chance for white particles
                            
                            if (isWhiteParticle) {
                                // White particles (larger and brighter)
                                const whiteBrightness = 255;
                                const layerFade = Math.exp(-layer * 0.5);
                                const randomOffset = (Math.random() - 0.5) * 0.2;
                                
                                greenBuildingParticles.features.push({
                                    type: 'Feature',
                                    properties: {
                                        particleSize: 2.0 - (layer * 0.2), // Larger size for white particles
                                        opacity: Math.min(1, (0.95 - (layer * 0.12)) * (1 + randomOffset)),
                                        color: `rgba(${whiteBrightness}, ${whiteBrightness}, ${whiteBrightness}, ${0.95 * layerFade})`
                                    },
                                    geometry: {
                                        type: 'Point',
                                        coordinates: [
                                            particleLng + normalizedPerpX * layerOffset + (Math.random() - 0.5) * 0.00002,
                                            particleLat + normalizedPerpY * layerOffset + (Math.random() - 0.5) * 0.00002
                                        ]
                                    }
                                });
                            } else {
                                // Original green particles
                                const isDarkParticle = Math.random() < 0.1;
                                const brightness = isDarkParticle ? 
                                    80 + Math.random() * 40 : 
                                    200 + Math.random() * 55;
                                
                                const layerFade = Math.exp(-layer * 0.5);
                                const randomOffset = (Math.random() - 0.5) * 0.2;
                                
                                greenBuildingParticles.features.push({
                                    type: 'Feature',
                                    properties: {
                                        particleSize: (isDarkParticle ? 0.8 : 1.4) - (layer * 0.2),
                                        opacity: Math.min(1, (0.95 - (layer * 0.12)) * (1 + randomOffset)),
                                        color: `rgba(${brightness * 0.4}, ${brightness}, ${brightness * 0.4}, ${0.95 * layerFade})`
                                    },
                                    geometry: {
                                        type: 'Point',
                                        coordinates: [
                                            particleLng + normalizedPerpX * layerOffset + (Math.random() - 0.5) * 0.00002,
                                            particleLat + normalizedPerpY * layerOffset + (Math.random() - 0.5) * 0.00002
                                        ]
                                    }
                                });
                            }
                        }
                    }
                });

                // Road spillover particles with smoother gradient
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

                        // Extended fade distance with smoother falloff
                        if (distToBuilding < 0.006 * totalScale) {
                            const fadeStart = 0.0002 * totalScale;
                            const fadeEnd = 0.006 * totalScale;
                            const rawFade = (distToBuilding - fadeStart) / (fadeEnd - fadeStart);
                            const fadeFactor = Math.max(0, 1 - Math.pow(rawFade, 1.5));
                            const enhancedFade = Math.exp(-rawFade * 2);

                            const dx = nextRoadCoord[0] - roadCoord[0];
                            const dy = nextRoadCoord[1] - roadCoord[1];
                            const roadSegmentLength = Math.sqrt(dx * dx + dy * dy);
                            
                            // Separate particle generation for green and white particles
                            const particlesPerRoadSegment = Math.floor(40 * roadSegmentLength * 1000 * (enhancedFade + 0.1));
                            
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

                                // Green particles (random spread)
                                const offset = (Math.random() * 0.0001) * Math.sqrt(enhancedFade);
                                const randomOffset = (Math.random() - 0.5) * 0.00004 * enhancedFade;
                                
                                // Add green particle
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

                                // White particles (orderly pattern)
                                if (i % 3 === 0) { // Regular spacing
                                    const waveSpeed = 2.0;
                                    const waveFrequency = 4.0;
                                    const whiteOffset = 0.00005 * Math.sin((t * Math.PI * waveFrequency) + (currentTime * waveSpeed));
                                    
                                    const flowSpeed = 0.5;
                                    const flowOffset = ((t + currentTime * flowSpeed) % 1.0) - 0.5;
                                    
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
                                                roadLng + normalizedPerpX * whiteOffset + (normalizedPerpX * flowOffset * 0.00002),
                                                roadLat + normalizedPerpY * whiteOffset + (normalizedPerpY * flowOffset * 0.00002)
                                            ]
                                        }
                                    });

                                    // Second particle on the opposite side
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
                                                roadLng - normalizedPerpX * whiteOffset + (normalizedPerpX * flowOffset * 0.00002),
                                                roadLat - normalizedPerpY * whiteOffset + (normalizedPerpY * flowOffset * 0.00002)
                                            ]
                                        }
                                    });
                                }
                            }
                        }
                    }
                });
            });

            if (map.current.getSource('green-building-particles')) {
                map.current.getSource('green-building-particles').setData(greenBuildingParticles);
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

        // Add click handler for 3d-buildings layer
        map.current.on('click', '3d-buildings', (e) => {
            if (e.features.length > 0) {
                const building = e.features[0];
                handleBuildingClick(building);
            }
        });

        // Optional: Change cursor on hover
        map.current.on('mouseenter', '3d-buildings', () => {
            map.current.getCanvas().style.cursor = 'pointer';
        });

        map.current.on('mouseleave', '3d-buildings', () => {
            map.current.getCanvas().style.cursor = '';
        });
    }

    // Cleanup function
    return () => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
    };
  }, [map.current]); // Only re-run if map.current changes

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
          validationScore={null}
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



