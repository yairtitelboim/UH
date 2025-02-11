import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapLogic } from '../../hooks/useMapLogic';
import BuildingPopup from './BuildingPopup';
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

  useEffect(() => {
    if (map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [lng, lat],
        zoom: zoom,
        pitch: 45,
        bearing: -17.6,
        antialias: true
      });

      map.current.addControl(new mapboxgl.NavigationControl());

      map.current.on('load', () => {
        console.log("Map loaded, adding sources and layers...");

        // Add 3D buildings with full opacity
        map.current.addLayer({
          'id': '3d-buildings',
          'source': 'composite',
          'source-layer': 'building',
          'filter': ['==', 'extrude', 'true'],
          'type': 'fill-extrusion',
          'minzoom': 12,
          'paint': {
            'fill-extrusion-color': '#242424',
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15, 0,
              15.05, ['get', 'height']
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15, 0,
              15.05, ['get', 'min_height']
            ],
            'fill-extrusion-opacity': 1.0
          }
        });

        // Add power grid network source
        map.current.addSource('power-grid-network', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-streets-v8'
        });

        // Add main power grid lines following major roads
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
          },
          'layout': {
            'line-cap': 'round',
            'line-join': 'round'
          }
        });

        // Add secondary distribution lines
        map.current.addLayer({
          'id': 'power-grid-secondary',
          'type': 'line',
          'source': 'power-grid-network',
          'source-layer': 'road',
          'filter': [
            'all',
            ['match',
              ['get', 'class'],
              ['tertiary', 'tertiary_link'],
              true,
              false
            ],
            ['>=', ['zoom'], 14]
          ],
          'paint': {
            'line-color': '#FFE599',
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              14, 1,
              16, 2
            ],
            'line-opacity': 0.5,
            'line-blur': 1
          },
          'layout': {
            'line-cap': 'round',
            'line-join': 'round'
          }
        });

        // Add glow effect
        map.current.addLayer({
          'id': 'power-grid-glow',
          'type': 'line',
          'source': 'power-grid-network',
          'source-layer': 'road',
          'filter': [
            'all',
            ['match',
              ['get', 'class'],
              ['primary', 'trunk', 'motorway', 'secondary', 'tertiary'],
              true,
              false
            ]
          ],
          'paint': {
            'line-color': '#FFD966',
            'line-width': 6,
            'line-opacity': 0.2,
            'line-blur': 3
          },
          'layout': {
            'line-cap': 'round',
            'line-join': 'round'
          }
        });

        // Add secondary network nodes
        map.current.addLayer({
          'id': 'secondary-network-nodes',
          'type': 'circle',
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
            ['==', ['geometry-type'], 'Point']
          ],
          'paint': {
            'circle-radius': 2,
            'circle-color': '#67B7D1',
            'circle-blur': 0.5,
            'circle-opacity': 0.7
          }
        });

        // Add outer glow for secondary network
        map.current.addLayer({
          'id': 'secondary-network-glow-outer',
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
              13, 8,
              16, 12
            ],
            'line-opacity': 0.09,
            'line-blur': 6
          },
          'layout': {
            'line-cap': 'round',
            'line-join': 'round'
          }
        });

        // Add middle glow for secondary network
        map.current.addLayer({
          'id': 'secondary-network-glow-middle',
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
            'line-color': '#89CDE4',
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              13, 6,
              16, 9
            ],
            'line-opacity': 0.15,
            'line-blur': 4
          },
          'layout': {
            'line-cap': 'round',
            'line-join': 'round'
          }
        });

        // Add inner glow for secondary network
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
            'line-color': '#C7EBF7',
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
          },
          'layout': {
            'line-cap': 'round',
            'line-join': 'round'
          }
        });

        // Add intersection points between networks
        map.current.addLayer({
          'id': 'network-intersections',
          'type': 'circle',
          'source': 'power-grid-network',
          'source-layer': 'road',
          'filter': [
            'all',
            ['match',
              ['get', 'class'],
              ['primary', 'trunk', 'motorway', 'secondary', 'residential', 'service', 'street'],
              true,
              false
            ],
            ['==', ['geometry-type'], 'Point']
          ],
          'paint': {
            'circle-radius': 4,
            'circle-color': [
              'case',
              ['match', ['get', 'class'], ['primary', 'trunk', 'motorway', 'secondary'], true, false],
              '#FFD966',  // Yellow for power grid intersections
              '#67B7D1'   // Light blue for secondary network intersections
            ],
            'circle-opacity': 0.8,
            'circle-blur': 0.5,
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(255, 255, 255, 0.3)'
          }
        });

        // Add data centers (facilities)
        map.current.addSource('dc-facilities', {
          type: 'geojson',
          data: '/dc_peering_layers.json',
          generateId: true
        });

        // Debug log the loaded data
        fetch('/dc_peering_layers.json')
          .then(response => response.json())
          .then(data => {
            console.log("Loaded GeoJSON data:", {
              total_features: data.features.length,
              facilities: data.features.filter(f => f.properties.type === 'facility').length,
              ixps: data.features.filter(f => f.properties.type === 'ixp').length,
              connections: data.features.filter(f => f.properties.type === 'connection').length
            });
          });

        // Add facilities layer
        console.log("Adding facilities layer...");
        map.current.addLayer({
          'id': 'facilities',
          'type': 'circle',
          'source': 'dc-facilities',
          'filter': ['==', ['get', 'type'], 'facility'],
          'paint': {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'net_count'],
              0, 6,
              50, 20
            ],
            'circle-color': '#4CAF50',
            'circle-opacity': 0.7,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#2E7D32'
          }
        });

        // Add IXP layer
        console.log("Adding IXPs layer...");
        map.current.addLayer({
          'id': 'ixps',
          'type': 'circle',
          'source': 'dc-facilities',
          'filter': ['==', ['get', 'type'], 'ixp'],
          'paint': {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'participant_count'],
              0, 8,
              100, 25
            ],
            'circle-color': '#FF69B4',
            'circle-opacity': 0.8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FF1493'
          }
        });

        // Add connections layer
        console.log("Adding connections layer...");
        map.current.addLayer({
          'id': 'peering-connections',
          'type': 'line',
          'source': 'dc-facilities',
          'filter': ['==', ['get', 'type'], 'connection'],
          'paint': {
            'line-color': '#00FFFF',
            'line-width': [
              'interpolate',
              ['linear'],
              ['get', 'speed'],
              0, 2,
              10000, 4,
              100000, 6
            ],
            'line-opacity': 0.8,
            'line-blur': 0.5
          }
        });

        // Add hover effects and popups here if needed
      });

    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [lng, lat, zoom]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
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

