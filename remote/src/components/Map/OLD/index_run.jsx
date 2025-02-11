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
    // North-South Corridors - Following exact street grid
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
  const markers = useRef(new Map());
  const [buildingPerformance] = useState(new Map());
  const [showCoolingOverlay, setShowCoolingOverlay] = useState(true);

  // Initialize openCards with 20% of buildings
  const [openCards, setOpenCards] = useState(() => {
    const initialOpenCards = new Set();
    const fullInfoCount = Math.floor(dcData.features.length * 0.2);
    
    while (initialOpenCards.size < fullInfoCount) {
      const randomIndex = Math.floor(Math.random() * dcData.features.length);
      initialOpenCards.add(dcData.features[randomIndex].properties.id);
    }
    
    return initialOpenCards;
  });

  const [initialState] = useState({
    lng: -77.019,
    lat: 38.907,
    zoom: 15.5
  });

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v10',
      center: [initialState.lng, initialState.lat],
      zoom: initialState.zoom,
      pitch: 45,
      bearing: -17.6
    });

    map.current.on('load', () => {
      // Generate cooling efficiency points based on building locations
      const generateCoolingPoints = () => {
        const points = [];
        
        dcData.features.forEach(feature => {
          const [baseLng, baseLat] = feature.geometry.coordinates;
          const isPositive = Math.random() > 0.5;
          
          // Increased base radius by 25%
          const baseRadius = 0.00375; // Previous 0.003 * 1.25
          const outerRadius = 0.00625; // Previous 0.005 * 1.25
          
          // Core points
          for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * baseRadius;
            const lng = baseLng + Math.cos(angle) * radius;
            const lat = baseLat + Math.sin(angle) * radius;
            
            // Central high-intensity points
            if (i < 5) {
              points.push({
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
            points.push({
              type: 'Feature',
              properties: {
                efficiency: isPositive ? 
                  0.6 + (Math.random() * 0.4) : 
                  0.1 + (Math.random() * 0.3),
                intensity: 1 - (radius * 160) // Adjusted for new radius
              },
              geometry: {
                type: 'Point',
                coordinates: [lng, lat]
              }
            });
          }

          // Outer diffuse points
          for (let i = 0; i < 25; i++) { // Increased point count for wider coverage
            const angle = Math.random() * Math.PI * 2;
            const radius = baseRadius + (Math.random() * outerRadius);
            const lng = baseLng + Math.cos(angle) * radius;
            const lat = baseLat + Math.sin(angle) * radius;
            
            points.push({
              type: 'Feature',
              properties: {
                efficiency: isPositive ? 
                  0.3 + (Math.random() * 0.3) : 
                  0.1 + (Math.random() * 0.2),
                intensity: 0.4 - (Math.random() * 0.2) // Slightly increased for better visibility
              },
              geometry: {
                type: 'Point',
                coordinates: [lng, lat]
              }
            });
          }
        });
        
        return {
          type: 'FeatureCollection',
          features: points
        };
      };

      // Add cooling efficiency heatmap source
      map.current.addSource('cooling-efficiency', {
        type: 'geojson',
        data: generateCoolingPoints()
      });

      // Adjusted heatmap layer for increased spread
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
            14, 0.7, // Slightly reduced to compensate for wider spread
            16, 1.1
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(255,65,54,0.25)',  // Slightly more transparent
            0.5, 'rgba(133,133,133,0.25)',
            1, 'rgba(76,175,80,0.25)'
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14, 50,  // Increased from 40
            16, 75   // Increased from 60
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

      // Randomly select 20% of features to show full info
      const features = [...dcData.features];
      const fullInfoCount = Math.floor(features.length * 0.2); // Changed to 0.2 for 20%
      const fullInfoIndices = new Set();
      
      while (fullInfoIndices.size < fullInfoCount) {
        fullInfoIndices.add(Math.floor(Math.random() * features.length));
      }

      // Create custom markers
      features.forEach((article, index) => {
        const percentageChange = ((Math.random() * 20) - 10).toFixed(1);
        const isPositive = parseFloat(percentageChange) > 0;
        const capacityUsage = (Math.random() * 100).toFixed(1);
        const isOpen = openCards.has(article.properties.id);

        // Store building data for highlighting
        buildingPerformance.set(article.geometry.coordinates.join(','), {
          isPositive,
          percentageChange,
          capacityUsage
        });

        // Create marker element
        const markerEl = document.createElement('div');
        markerEl.className = 'custom-marker';
        markerEl.style.cssText = `
          position: absolute;
          transform: translate(-50%, -50%);
          width: 32px;
          height: 32px;
          cursor: pointer;
          z-index: ${isOpen ? 2000 : 1000};
        `;
        
        // Add click handler
        markerEl.onclick = (e) => {
          e.stopPropagation();
          
          setOpenCards(prevOpenCards => {
            const newOpenCards = new Set(prevOpenCards);
            if (newOpenCards.has(article.properties.id)) {
              newOpenCards.delete(article.properties.id);
            } else {
              newOpenCards.add(article.properties.id);
            }
            return newOpenCards;
          });
        };

        const markerContent = document.createElement('div');
        
        if (!isOpen) {
          markerContent.innerHTML = `
            <div class="marker-content" style="
              position: absolute;
              transform: translate(-50%, -50%);
              background: rgba(0, 0, 0, 0.85);
              border-radius: 50%;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              border: ${isPositive ? '2px' : '1px'} solid ${isPositive ? '#4CAF50' : '#FF4136'};
              z-index: 1000;
            ">
              <div style="
                color: ${isPositive ? '#4CAF50' : '#FF4136'};
                transform: scale(0.7);
              ">
                ${getBuildingIcon(article.properties.property_type)}
              </div>
            </div>
          `;
        } else {
          const iconColor = isPositive ? '#4CAF50' : '#FF4136';
          // Combine all icons into one template literal
          const statusIcons = `
            <div style="display: flex; gap: 6px; margin-left: auto;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="stroke: ${iconColor}; stroke-width: 2.5;">
                <path d="M2 2v20h20"/><path d="M14 10v8"/><path d="M10 14v4"/><path d="M18 6v12"/>
              </svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="stroke: ${iconColor}; stroke-width: 2.5;">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="stroke: ${iconColor}; stroke-width: 2.5;">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="stroke: ${iconColor}; stroke-width: 2.5;">
                <path d="M12 2v20M2 12h20"/>
              </svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="stroke: ${iconColor}; stroke-width: 2.5;">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                <path d="M12 18c3.3 0 6-2.7 6-6s-2.7-6-6-6-6 2.7-6 6 2.7 6 6 6z"/>
              </svg>
            </div>
          `;

          markerContent.innerHTML = `
            <div class="marker-content" style="
              position: absolute;
              transform: translate(-50%, -100%);
              width: 240px;
              background: rgba(0, 0, 0, 0.85);
              border-radius: 8px;
              padding: 8px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
              border: 1px solid ${isPositive ? '#4CAF50' : '#FF4136'};
              z-index: 2000;
            ">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="
                  color: ${isPositive ? '#4CAF50' : '#FF4136'};
                  display: flex;
                  align-items: center;
                  flex-shrink: 0;
                ">
                  ${getBuildingIcon(article.properties.property_type)}
                </div>
                <div style="flex-grow: 1; min-width: 0;">
                  <div class="text-sm font-bold mb-1" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${article.properties.address}
                  </div>
                  <div class="text-xs text-gray-400 mb-1" style="display: flex; align-items: center; gap: 8px;">
                    <span>${article.properties.property_type}</span>
                    ${isOpen ? `
                      <div style="display: flex; gap: 6px; margin-left: auto;">
                        ${statusIcons}
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
              <div class="flex justify-between items-center mt-2">
                <span class="text-${isPositive ? 'green' : 'red'}-400 text-lg font-bold">
                  ${isPositive ? '+' : ''}${percentageChange}%
                </span>
                <span class="text-sm text-gray-300">
                  ${capacityUsage}% cap
                </span>
              </div>
            </div>
          `;
        }

        markerEl.appendChild(markerContent);

        new mapboxgl.Marker({
          element: markerEl,
          anchor: 'center',
          offset: [0, 0]
        })
          .setLngLat(article.geometry.coordinates)
          .addTo(map.current);

        markers.current.set(article.properties.id, new mapboxgl.Marker({
          element: markerEl,
          anchor: 'center',
          offset: [0, 0]
        }));
      });

      // Add 3D buildings layer
      map.current.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 14,
        'paint': {
          'fill-extrusion-color': [
            'case',
            ['boolean', ['feature-state', 'isGridNode'], false],
            'rgba(255, 217, 102, 0.8)', // Yellow for grid nodes
            ['boolean', ['feature-state', 'hasMarker'], false],
            [
              'case',
              ['boolean', ['feature-state', 'isPositive'], false],
              'rgba(76, 175, 80, 0.8)',  // Green for positive performance
              'rgba(255, 65, 54, 0.8)'   // Red for negative performance
            ],
            '#1a1a1a'  // Changed from '#aaa' to '#1a1a1a' for darker background buildings
          ],
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            15.05, ['get', 'height']
          ],
          'fill-extrusion-opacity': 0.7
        }
      });

      // Update the building highlighting logic
      const highlightBuildings = () => {
        const buildings = map.current.queryRenderedFeatures({
          layers: ['3d-buildings']
        });
        
        // Get grid intersection points
        const gridNodes = findGridIntersections();

        buildings.forEach(building => {
          if (!building.geometry || !building.geometry.coordinates || !building.geometry.coordinates[0]) return;
          
          // Get building center point
          const buildingCoords = building.geometry.coordinates[0][0];
          if (!Array.isArray(buildingCoords) || buildingCoords.length !== 2) return;
          
          const buildingCenter = map.current.project(buildingCoords);
          let isGridNode = false;
          let isPerformanceMarker = false;
          let isPositive = false;

          // Check if building is near a grid intersection
          for (let node of gridNodes) {
            const nodePos = map.current.project(node);
            const distance = Math.sqrt(
              Math.pow(buildingCenter.x - nodePos.x, 2) +
              Math.pow(buildingCenter.y - nodePos.y, 2)
            );
            
            if (distance < 50) { // Adjust radius as needed
              isGridNode = true;
              break;
            }
          }

          // Check existing performance markers
          dcData.features.forEach(article => {
            if (!article.geometry || !article.geometry.coordinates) return;
            
            const markerPos = map.current.project(article.geometry.coordinates);
            const distance = Math.sqrt(
              Math.pow(buildingCenter.x - markerPos.x, 2) +
              Math.pow(buildingCenter.y - markerPos.y, 2)
            );

            if (distance < 50) {
              isPerformanceMarker = true;
              const performance = buildingPerformance.get(article.geometry.coordinates.join(','));
              if (performance) {
                isPositive = performance.isPositive;
              }
            }
          });

          // Set building state based on conditions
          map.current.setFeatureState(
            {
              source: 'composite',
              sourceLayer: 'building',
              id: building.id
            },
            {
              isGridNode: isGridNode,
              hasMarker: isPerformanceMarker,
              isPositive: isPositive
            }
          );
        });
      };

      // Make sure to call highlightBuildings when needed
      map.current.on('moveend', highlightBuildings);
      highlightBuildings();

      // Fit map to markers
      const bounds = new mapboxgl.LngLatBounds();
      dcData.features.forEach(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
          bounds.extend(feature.geometry.coordinates);
        }
      });

      map.current.fitBounds(bounds, {
        padding: 50,
        pitch: 45,
        bearing: -17.6,
        duration: 2000
      });

      // Add control for toggling cooling overlay
      const toggleControl = document.createElement('div');
      toggleControl.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
      toggleControl.innerHTML = `
        <button class="cooling-overlay-toggle" style="
          padding: 10px;
          background: ${showCoolingOverlay ? '#4CAF50' : '#666'};
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 12l-7.5 7.5-7.5-7.5"/>
            <path d="M16.5 19.5V4"/>
          </svg>
          Cooling Efficiency
        </button>
      `;

      toggleControl.onclick = () => {
        setShowCoolingOverlay(!showCoolingOverlay);
        const layer = map.current.getLayer('cooling-heat');
        if (layer) {
          map.current.setLayoutProperty(
            'cooling-heat',
            'visibility',
            showCoolingOverlay ? 'none' : 'visible'
          );
        }
        toggleControl.querySelector('button').style.background = 
          showCoolingOverlay ? '#666' : '#4CAF50';
      };

      map.current.addControl({
        onAdd: () => toggleControl,
        onRemove: () => {
          toggleControl.parentNode.removeChild(toggleControl);
        }
      });

      // Add power grid source
      const powerGridLocations = [
        {
          coordinates: [-77.0214, 38.8921], // DOE location
          strength: 1.0
        },
        {
          coordinates: [-77.0128, 38.9034],
          strength: 0.8
        },
        {
          coordinates: [-77.0366, 38.8977],
          strength: 0.9
        }
      ];

      // Generate power grid points with spread
      const generatePowerGridPoints = () => {
        const points = [];
        
        powerGridLocations.forEach(location => {
          // Core points around each power grid hub
          for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const baseRadius = 0.004;
            const radius = Math.random() * baseRadius;
            const lng = location.coordinates[0] + Math.cos(angle) * radius;
            const lat = location.coordinates[1] + Math.sin(angle) * radius;
            
            // Add high-intensity core points
            if (i < 5) {
              points.push({
                type: 'Feature',
                properties: { strength: location.strength, intensity: 1 },
                geometry: { type: 'Point', coordinates: [lng, lat] }
              });
            }
            
            // Add medium-intensity points
            points.push({
              type: 'Feature',
              properties: {
                strength: location.strength * (1 - (radius / baseRadius)),
                intensity: 0.8 - (radius / baseRadius)
              },
              geometry: { type: 'Point', coordinates: [lng, lat] }
            });
          }

          // Add outer diffuse points
          for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const outerRadius = 0.004 + (Math.random() * 0.004);
            const lng = location.coordinates[0] + Math.cos(angle) * outerRadius;
            const lat = location.coordinates[1] + Math.sin(angle) * outerRadius;
            
            points.push({
              type: 'Feature',
              properties: { 
                strength: location.strength * 0.3,
                intensity: 0.3 
              },
              geometry: { type: 'Point', coordinates: [lng, lat] }
            });
          }
        });

        return points;
      };

      // Update the power grid source
      map.current.addSource('power-grid', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: generatePowerGridPoints()
        }
      });

      // Create grid network connections
      const createGridNetwork = () => {
        const lines = [];
        const points = POWER_GRID_LOCATIONS;

        // Helper function to check if points are on same street
        const onSameStreet = (p1, p2) => {
          const latDiff = Math.abs(p1.coordinates[1] - p2.coordinates[1]);
          const lngDiff = Math.abs(p1.coordinates[0] - p2.coordinates[0]);
          return latDiff < 0.002 || lngDiff < 0.002; // Threshold for "same street"
        };

        // Connect points along streets
        for (let i = 0; i < points.length; i++) {
          // Find nearest points on same street
          const nearestPoints = points
            .filter((p, idx) => idx !== i && onSameStreet(points[i], p))
            .sort((a, b) => {
              const distA = Math.hypot(
                points[i].coordinates[0] - a.coordinates[0],
                points[i].coordinates[1] - a.coordinates[1]
              );
              const distB = Math.hypot(
                points[i].coordinates[0] - b.coordinates[0],
                points[i].coordinates[1] - b.coordinates[1]
              );
              return distA - distB;
            })
            .slice(0, 2); // Connect to 2 nearest points on same street

          // Create main power lines
          nearestPoints.forEach(point => {
            lines.push({
              type: 'Feature',
              properties: {
                strength: Math.min(points[i].strength, point.strength),
                isMainLine: true
              },
              geometry: {
                type: 'LineString',
                coordinates: [points[i].coordinates, point.coordinates]
              }
            });
          });

          // Add cross-street connections for main stations
          if (points[i].isMainStation) {
            const crossConnections = points
              .filter(p => !onSameStreet(points[i], p))
              .sort((a, b) => {
                const distA = Math.hypot(
                  points[i].coordinates[0] - a.coordinates[0],
                  points[i].coordinates[1] - a.coordinates[1]
                );
                const distB = Math.hypot(
                  points[i].coordinates[0] - b.coordinates[0],
                  points[i].coordinates[1] - b.coordinates[1]
                );
                return distA - distB;
              })
              .slice(0, 3); // Connect to 3 nearest cross-street points

            crossConnections.forEach(point => {
              lines.push({
                type: 'Feature',
                properties: {
                  strength: Math.min(points[i].strength, point.strength) * 0.8,
                  isMainLine: false
                },
                geometry: {
                  type: 'LineString',
                  coordinates: [points[i].coordinates, point.coordinates]
                }
              });
            });
          }
        }

        // Add distribution lines
        lines.forEach(mainLine => {
          if (mainLine.properties.isMainLine) {
            const start = mainLine.geometry.coordinates[0];
            const end = mainLine.geometry.coordinates[1];
            
            // Add smaller distribution lines
            for (let i = 0; i < 3; i++) {
              const t = (i + 1) / 4; // Position along main line
              const point = [
                start[0] + (end[0] - start[0]) * t,
                start[1] + (end[1] - start[1]) * t
              ];
              
              // Add perpendicular distribution lines
              const angle = Math.atan2(end[1] - start[1], end[0] - start[0]) + Math.PI/2;
              const length = 0.001 + (Math.random() * 0.001);
              
              lines.push({
                type: 'Feature',
                properties: {
                  strength: mainLine.properties.strength * 0.5,
                  isDistribution: true
                },
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    point,
                    [
                      point[0] + Math.cos(angle) * length,
                      point[1] + Math.sin(angle) * length
                    ]
                  ]
                }
              });
            }
          }
        });

        return {
          type: 'FeatureCollection',
          features: lines
        };
      };

      // Add grid network source
      map.current.addSource('power-grid-network', {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v8'
      });

      // Add the power grid lines following main roads
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
          'line-opacity': 0.3,
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

      // Add secondary power distribution lines
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

      // Add connection points at major intersections
      map.current.addLayer({
        'id': 'power-grid-nodes',
        'type': 'circle',
        'source': 'power-grid-network',
        'source-layer': 'road',
        'filter': [
          'all',
          ['match',
            ['get', 'class'],
            ['primary', 'trunk', 'motorway', 'secondary'],
            true,
            false
          ]  // Added missing closing bracket for match
        ],  // Added missing closing bracket for filter
        'paint': {
          'circle-radius': 3,
          'circle-color': '#FFD966',
          'circle-blur': 0.5,
          'circle-opacity': 0.8
        }
      });

      // Add glow effect
      map.current.addLayer({
        id: 'power-grid-glow',
        type: 'line',
        source: 'power-grid-network',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#FFD966',
          'line-width': [
            'interpolate',
            ['linear'],
            ['get', 'strength'],
            0, 3,
            1, 6
          ],
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14, 0.1,
            16, 0.2
          ],
          'line-blur': 3
        }
      });

      // Add power grid icons
      powerGridLocations.forEach(location => {
        // Create power grid icon element
        const el = document.createElement('div');
        el.className = 'power-grid-marker';
        el.innerHTML = `
          <div style="
            background: rgba(0, 0, 0, 0.7);
            padding: 8px;
            border-radius: 50%;
            border: 2px solid #FFD966;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
          ">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFD966" stroke-width="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div style="
            position: absolute;
            top: -40px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            padding: 4px 8px;
            border-radius: 4px;
            color: #FFD966;
            font-size: 12px;
            white-space: nowrap;
          ">
            Power Grid Hub (${(location.strength * 100).toFixed(0)}%)
          </div>
        `;

        // Add marker to map
        new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat(location.coordinates)
          .addTo(map.current);
      });

      // Add 3D buildings layer with conditional coloring
      map.current.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 14,
        'paint': {
          'fill-extrusion-color': [
            'case',
            ['boolean', ['feature-state', 'inPowerGrid'], false],
            '#FFD700', // Bright yellow for buildings in power grid area
            '#aaa'     // Default gray for other buildings
          ],
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            15.05, ['get', 'height']
          ],
          'fill-extrusion-opacity': 0.7
        }
      });

      // Function to check if a building is within power grid influence
      const updateBuildingColors = () => {
        const buildings = map.current.queryRenderedFeatures({
          layers: ['3d-buildings']
        });

        buildings.forEach(building => {
          if (!building.geometry || !building.geometry.coordinates) return;

          // Get building centroid
          const centroid = building.geometry.coordinates[0][0];
          if (!Array.isArray(centroid)) return;

          // Check proximity to power grid points
          const powerGridPoints = generatePowerGridPoints();
          let isInPowerGrid = false;

          for (const point of powerGridPoints) {
            const coords = point.geometry.coordinates;
            const distance = Math.sqrt(
              Math.pow(centroid[0] - coords[0], 2) + 
              Math.pow(centroid[1] - coords[1], 2)
            );

            // If building is within threshold distance of a power grid point
            if (distance < 0.004) { // Adjust this threshold as needed
              isInPowerGrid = true;
              break;
            }
          }

          // Update building color
          map.current.setFeatureState(
            {
              source: 'composite',
              sourceLayer: 'building',
              id: building.id
            },
            {
              inPowerGrid: isInPowerGrid
            }
          );
        });
      };

      // Update building colors when the map moves
      map.current.on('moveend', updateBuildingColors);
      // Initial update
      updateBuildingColors();

      // Add cluster source
      map.current.addSource('power-grid-points', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: powerGridLocations.map(location => ({
            type: 'Feature',
            properties: {
              strength: location.strength,
              description: `Power Grid Hub (${(location.strength * 100).toFixed(0)}%)`
            },
            geometry: {
              type: 'Point',
              coordinates: location.coordinates
            }
          }))
        },
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points
        clusterRadius: 50 // Radius of each cluster when clustering points
      });

      // Add cluster circles
      map.current.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'power-grid-points',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#FFD966',
            2, '#FFD966',
            5, '#FFD966'
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20,
            2, 30,
            5, 40
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff'
        }
      });

      // Add cluster count text
      map.current.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'power-grid-points',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count} Sites',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12
        },
        paint: {
          'text-color': '#000'
        }
      });

      // Add unclustered point markers
      map.current.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'power-grid-points',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#FFD966',
          'circle-radius': 15,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff'
        }
      });

      // Handle clicks on clusters
      map.current.on('click', 'clusters', (e) => {
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: ['clusters']
        });
        const clusterId = features[0].properties.cluster_id;
        map.current.getSource('power-grid-points').getClusterExpansionZoom(
          clusterId,
          (err, zoom) => {
            if (err) return;

            map.current.easeTo({
              center: features[0].geometry.coordinates,
              zoom: zoom + 1
            });
          }
        );
      });

      // Add hover effects
      map.current.on('mouseenter', 'clusters', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', 'clusters', () => {
        map.current.getCanvas().style.cursor = '';
      });

      // Add popup for unclustered points
      map.current.on('click', 'unclustered-point', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const description = e.features[0].properties.description;

        new mapboxgl.Popup()
          .setLngLat(coordinates)
          .setHTML(`
            <div style="
              padding: 8px;
              background: rgba(0, 0, 0, 0.8);
              color: #FFD966;
              border-radius: 4px;
              font-size: 14px;
            ">
              ${description}
            </div>
          `)
          .addTo(map.current);
      });

      // Add hover effect for unclustered points
      map.current.on('mouseenter', 'unclustered-point', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', 'unclustered-point', () => {
        map.current.getCanvas().style.cursor = '';
      });

      // Add secondary network lines (light blue)
      map.current.addLayer({
        'id': 'secondary-network-main',
        'type': 'line',
        'source': 'power-grid-network',
        'source-layer': 'road',
        'filter': [
          'all',
          ['match',
            ['get', 'class'],
            ['residential', 'service', 'street'],  // Different road types than the power grid
            true,
            false
          ],
          ['>=', ['zoom'], 13]
        ],
        'paint': {
          'line-color': '#67B7D1',  // Light blue color
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
          'line-opacity': 0.05,
          'line-blur': [
            'interpolate',
            ['linear'],
            ['zoom'],
            13, 0.5,
            16, 1.5
          ]
        },
        'layout': {
          'line-cap': 'round',
          'line-join': 'round'
        }
      });

      // Add connection points for secondary network
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
          'circle-opacity': 0.2
        }
      });

      // Add outer glow layer (largest blur)
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
          'line-opacity': 0.15,
          'line-blur': 6
        },
        'layout': {
          'line-cap': 'round',
          'line-join': 'round'
        }
      });

      // Add middle glow layer
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
          'line-color': '#89CDE4',  // Slightly lighter blue
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            13, 6,
            16, 9
          ],
          'line-opacity': 0.25,
          'line-blur': 4
        },
        'layout': {
          'line-cap': 'round',
          'line-join': 'round'
        }
      });

      // Add inner glow layer
      map.current.addLayer({
        'id': 'secondary-network-glow-inner',
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
          ['==', ['geometry-type'], 'Point']
        ],
        'paint': {
          'line-color': '#A5E0F2',  // Even lighter blue
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            13, 4,
            16, 6
          ],
          'line-opacity': 0.3,
          'line-blur': 2
        },
        'layout': {
          'line-cap': 'round',
          'line-join': 'round'
        }
      });

      // Main line layer (sharpest)
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
          'line-color': '#C7EBF7',  // Brightest blue for the center
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
          'line-opacity': 0.9,
          'line-blur': 0.5
        },
        'layout': {
          'line-cap': 'round',
          'line-join': 'round'
        }
      });

      // Enhanced nodes with stronger glow
      map.current.addLayer({
        'id': 'secondary-network-nodes-glow',
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
          'circle-radius': 6,
          'circle-color': '#67B7D1',
          'circle-blur': 3,
          'circle-opacity': 0.4
        }
      });

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
          'circle-radius': 3,
          'circle-color': '#C7EBF7',
          'circle-blur': 0.5,
          'circle-opacity': 0.9,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255, 255, 255, 0.5)'
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

      // Add pulsing effect for intersection points
      const size = 100;
      const pulsingDot = {
        width: size,
        height: size,
        data: new Uint8Array(size * size * 4),
        onAdd: function() {
          const canvas = document.createElement('canvas');
          canvas.width = this.width;
          canvas.height = this.height;
          this.context = canvas.getContext('2d');
        },
        render: function() {
          const duration = 1000;
          const t = (performance.now() % duration) / duration;
          const radius = (size / 2) * 0.3;
          const outerRadius = (size / 2) * 0.7 * t + radius;
          const context = this.context;

          context.clearRect(0, 0, this.width, this.height);
          context.beginPath();
          context.arc(
            this.width / 2,
            this.height / 2,
            outerRadius,
            0,
            Math.PI * 2
          );
          context.fillStyle = `rgba(103, 183, 209, ${1 - t})`;
          context.fill();

          context.beginPath();
          context.arc(
            this.width / 2,
            this.height / 2,
            radius,
            0,
            Math.PI * 2
          );
          context.fillStyle = 'rgba(103, 183, 209, 1)';
          context.strokeStyle = 'white';
          context.lineWidth = 2 + 4 * (1 - t);
          context.fill();
          context.stroke();

          this.data = context.getImageData(
            0,
            0,
            this.width,
            this.height
          ).data;

          map.current.triggerRepaint();
          return true;
        }
      };
    });

    return () => map.current.remove();
  }, []);

  // Helper function to simulate distance to water (you'd replace with real data)
  const calculateDistanceToWater = (lng, lat) => {
    // Simplified example - replace with actual water body proximity calculation
    const waterBodies = [
      { lng: -77.0366, lat: 38.8977 }, // Example water body coordinates
    ];
    
    const distances = waterBodies.map(water => {
      const dx = lng - water.lng;
      const dy = lat - water.lat;
      return Math.sqrt(dx * dx + dy * dy);
    });
    
    return Math.min(...distances);
  };

  // Helper function to simulate elevation (you'd replace with real data)
  const getElevation = (lng, lat) => {
    // Simplified example - replace with actual elevation data
    return Math.random();
  };

  // Add this function to find grid intersections
  const findGridIntersections = () => {
    const intersections = new Set();
    
    // Helper to check if two lines intersect
    const addIntersection = (line1, line2) => {
      for (let i = 0; i < line1.coordinates.length - 1; i++) {
        for (let j = 0; j < line2.coordinates.length - 1; j++) {
          // Check if segments share a point (intersection)
          const point1 = line1.coordinates[i];
          const point2 = line2.coordinates[j];
          
          // If points are very close, consider it an intersection
          const distance = Math.hypot(point1[0] - point2[0], point1[1] - point2[1]);
          if (distance < 0.0002) { // About 20 meters
            intersections.add(`${point1[0]},${point1[1]}`);
          }
        }
      }
    };

    // Find intersections between all grid lines
    [...DC_GRID_NETWORK.primaryLines, 
     ...DC_GRID_NETWORK.secondaryLines, 
     ...DC_GRID_NETWORK.tertiaryLines,
     ...(DC_GRID_NETWORK.crossConnectors || [])].forEach((line1, i, arr) => {
      arr.slice(i + 1).forEach(line2 => {
        addIntersection(line1, line2);
      });
    });

    return Array.from(intersections).map(str => {
      const [lng, lat] = str.split(',').map(Number);
      return [lng, lat];
    });
  };

  // Update the building colors to include grid nodes
  const updateBuildingColors = () => {
    if (!map.current) return;

    // Get grid intersection points
    const gridNodes = findGridIntersections();
    
    // Update the 3D buildings layer
    map.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
      'case',
      // First check if building is near a grid intersection
      ['any',
        ...gridNodes.map(node => [
          '<',
          ['distance',
            ['get', 'coordinates'],
            node
          ],
          50 // 50 meters radius
        ])
      ],
      '#FFD966', // Yellow for grid nodes
      
      // Then check existing building performance conditions
      ['boolean', ['feature-state', 'hasMarker'], false],
      [
        'case',
        ['boolean', ['feature-state', 'isPositive'], false],
        'rgba(76, 175, 80, 0.8)', // Green for positive performance
        'rgba(255, 65, 54, 0.8)'  // Red for negative performance
      ],
      '#aaa' // Default building color
    ]);
  };

  // Make sure to call updateBuildingColors when the map loads and when data changes
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [initialState.lng, initialState.lat],
      zoom: initialState.zoom,
      pitch: 45
    });

    map.current.on('load', () => {
      // ... existing setup code ...

      // Update building colors to show grid nodes
      updateBuildingColors();

      // Update colors when the map moves
      map.current.on('moveend', updateBuildingColors);
    });
  }, []);

  // Helper function to get building icon SVG based on type
  const getBuildingIcon = (type) => {
    switch (type) {
      case 'office':
        return `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="6" width="16" height="12" rx="1" />
          </svg>
        `;
      case 'industrial':
        return `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" />
          </svg>
        `;
      case 'mixed-use':
        return `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12,4 4,20 20,20" />
          </svg>
        `;
      default:
        return `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="8" />
          </svg>
        `;
    }
  };

  // Add function to update marker appearance
  const updateMarker = (id) => {
    const marker = markers.current.get(id);
    if (marker) {
      const article = dcData.features.find(f => f.properties.id === id);
      const isOpen = openCards.has(id);
      const percentageChange = ((Math.random() * 20) - 10).toFixed(1);
      const isPositive = parseFloat(percentageChange) > 0;
      const capacityUsage = (Math.random() * 100).toFixed(1);
      
      const element = marker.getElement();
      element.style.zIndex = isOpen ? '2000' : '1000';
      
      // Update content (same as in the useEffect above)
      element.innerHTML = isOpen ? 
        // Card view HTML
        `<div class="marker-content" style="
          position: absolute;
          transform: translate(-50%, -100%);
          width: 240px;
          background: rgba(0, 0, 0, 0.85);
          border-radius: 8px;
          padding: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
          border: ${isPositive ? '3px' : '1px'} solid ${isPositive ? '#4CAF50' : '#FF4136'};
          z-index: 2000;
        ">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="color: ${isPositive ? '#4CAF50' : '#FF4136'}; display: flex; align-items: center;">
              ${getBuildingIcon(article.properties.property_type)}
            </div>
            <div style="flex-grow: 1;">
              <div class="text-sm font-bold mb-1">${article.properties.address}</div>
              <div class="text-xs text-gray-400 mb-1">${article.properties.property_type}</div>
            </div>
          </div>
          <div class="flex justify-between items-center mt-2">
            <span class="text-${isPositive ? 'green' : 'red'}-400 text-lg font-bold">
              ${isPositive ? '+' : ''}${percentageChange}%
            </span>
            <span class="text-sm text-gray-300">
              ${capacityUsage}% cap
            </span>
          </div>
        </div>` :
        // Icon view HTML
        `<div class="marker-content" style="
          position: absolute;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.85);
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: ${isPositive ? '2px' : '1px'} solid ${isPositive ? '#4CAF50' : '#FF4136'};
          z-index: 1000;
        ">
          <div style="color: ${isPositive ? '#4CAF50' : '#FF4136'}; transform: scale(0.7);">
            ${getBuildingIcon(article.properties.property_type)}
          </div>
        </div>`;
    }
  };

  useEffect(() => {
    markers.current.forEach((marker, id) => {
      const element = marker.getElement();
      const article = dcData.features.find(f => f.properties.id === id);
      const isOpen = openCards.has(id);
      const percentageChange = ((Math.random() * 20) - 10).toFixed(1);
      const isPositive = parseFloat(percentageChange) > 0;
      const capacityUsage = (Math.random() * 100).toFixed(1);
      
      const score = Math.round(
        (parseFloat(article.properties.powerScore) || 0) + 
        (parseFloat(article.properties.coolingScore) || 0) * 50
      );

      element.style.zIndex = isOpen ? '2000' : '1000';
      
      // Define icons based on performance
      const icons = isPositive ? `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isPositive ? '#4CAF50' : '#FF4136'}" stroke-width="2">
          <path d="M2 2v20h20"/><path d="M14 10v8"/><path d="M10 14v4"/><path d="M18 6v12"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isPositive ? '#4CAF50' : '#FF4136'}" stroke-width="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isPositive ? '#4CAF50' : '#FF4136'}" stroke-width="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isPositive ? '#4CAF50' : '#FF4136'}" stroke-width="2">
          <path d="M12 2v20M2 12h20"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isPositive ? '#4CAF50' : '#FF4136'}" stroke-width="2">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
          <path d="M12 18c3.3 0 6-2.7 6-6s-2.7-6-6-6-6 2.7-6 6 2.7 6 6 6z"/>
        </svg>
      ` : `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isPositive ? '#4CAF50' : '#FF4136'}" stroke-width="2">
          <path d="M2 2v20h20"/><path d="M14 10v8"/><path d="M10 14v4"/><path d="M18 6v12"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isPositive ? '#4CAF50' : '#FF4136'}" stroke-width="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isPositive ? '#4CAF50' : '#FF4136'}" stroke-width="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
      `;
      
      element.innerHTML = isOpen ? 
        `
        <div style="
          position: relative;
          transform: translate(-50%, -100%);
        ">
          <!-- Score Badge -->
          <div style="
            position: absolute;
            bottom: 100%;
            left: 0;
            margin-bottom: 8px;
            background: rgba(0, 0, 0, 0.85);
            border: ${isPositive ? '2px' : '1px'} solid ${isPositive ? '#4CAF50' : '#FF4136'};
            border-radius: 12px;
            padding: 4px 12px;
            font-size: 14px;
            font-weight: bold;
            color: ${isPositive ? '#4CAF50' : '#FF4136'};
            white-space: nowrap;
            z-index: 2001;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          ">
            ${score}%
          </div>

          <!-- Main Card -->
          <div class="marker-content" style="
            width: 240px;
            background: rgba(0, 0, 0, 0.85);
            border-radius: 8px;
            padding: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
            border: ${isPositive ? '3px' : '1px'} solid ${isPositive ? '#4CAF50' : '#FF4136'};
            z-index: 2000;
          ">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="color: ${isPositive ? '#4CAF50' : '#FF4136'}; display: flex; align-items: center;">
                ${getBuildingIcon(article.properties.property_type)}
              </div>
              <div style="flex-grow: 1;">
                <div class="text-sm font-bold mb-1">${article.properties.address}</div>
                <div class="text-xs text-gray-400 mb-1" style="display: flex; align-items: center; justify-content: space-between;">
                  <span>${article.properties.property_type}</span>
                  <div style="display: flex; gap: 6px; margin-left: auto;">
                    ${icons}
                  </div>
                </div>
              </div>
            </div>
            <div class="flex justify-between items-center mt-2">
              <span class="text-${isPositive ? 'green' : 'red'}-400 text-lg font-bold">
                ${isPositive ? '+' : ''}${percentageChange}%
              </span>
              <span class="text-sm text-gray-300">
                ${capacityUsage}% cap
              </span>
            </div>
          </div>
        </div>` :
        `<div class="marker-content" style="
          position: absolute;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.85);
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: ${isPositive ? '2px' : '1px'} solid ${isPositive ? '#4CAF50' : '#FF4136'};
          z-index: 1000;
        ">
          <div style="color: ${isPositive ? '#4CAF50' : '#FF4136'}; transform: scale(0.7);">
            ${getBuildingIcon(article.properties.property_type)}
          </div>
        </div>`;
    });
  }, [openCards]); // Only re-run when openCards changes

  // Add this helper function to determine if a site is top performing
  const isTopPerformer = (article) => {
    const performance = buildingPerformance.get(article.geometry.coordinates.join(','));
    return performance && performance.percentageChange > 4; // Threshold for top performers
  };

  // Add this function to generate AI insights based on the building data
  const getAIInsights = (article) => {
    const insights = [];
    const performance = buildingPerformance.get(article.geometry.coordinates.join(','));
    
    if (performance) {
      if (performance.capacityUsage < 50) {
        insights.push({
          icon: '💡',
          text: 'Optimal cooling efficiency detected',
          color: '#4CAF50'
        });
      }
      if (performance.percentageChange > 5) {
        insights.push({
          icon: '📈',
          text: 'High ROI potential identified',
          color: '#FFD700'
        });
      }
      if (performance.capacityUsage > 80) {
        insights.push({
          icon: '⚡',
          text: 'AI suggests capacity optimization',
          color: '#FF9800'
        });
      }
    }
    
    return insights;
  };

  // Modify the marker content template to include AI insights for top performers
  const getMarkerContent = (article, isOpen) => {
    const performance = buildingPerformance.get(article.geometry.coordinates.join(','));
    const isPositive = performance?.percentageChange > 0;
    const insights = isTopPerformer(article) ? getAIInsights(article) : [];
    
    // Create separate constant for the icons to ensure consistent rendering
    const iconColor = isPositive ? '#4CAF50' : '#FF4136';
    const statusIcons = `
      <div style="display: flex; gap: 6px; margin-left: auto;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="stroke: ${iconColor}; stroke-width: 2.5;">
          <path d="M2 2v20h20"/><path d="M14 10v8"/><path d="M10 14v4"/><path d="M18 6v12"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="stroke: ${iconColor}; stroke-width: 2.5;">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="stroke: ${iconColor}; stroke-width: 2.5;">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="stroke: ${iconColor}; stroke-width: 2.5;">
          <path d="M12 2v20M2 12h20"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="stroke: ${iconColor}; stroke-width: 2.5;">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
          <path d="M12 18c3.3 0 6-2.7 6-6s-2.7-6-6-6-6 2.7-6 6 2.7 6 6 6z"/>
        </svg>
      </div>
    `;

    return `
      <div class="marker-content" style="
        position: absolute;
        transform: translate(-50%, -100%);
        width: ${isOpen ? '280px' : '32px'};
        background: rgba(0, 0, 0, 0.85);
        border-radius: 8px;
        padding: ${isOpen ? '12px' : '0'};
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        border: ${isPositive ? '3px' : '1px'} solid ${isPositive ? '#4CAF50' : '#FF4136'};
        z-index: ${isOpen ? '2000' : '1'};
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="color: ${isPositive ? '#4CAF50' : '#FF4136'}; display: flex; align-items: center; flex-shrink: 0;">
            ${getBuildingIcon(article.properties.property_type)}
          </div>
          <div style="flex-grow: 1; min-width: 0;">
            <div style="
              font-weight: bold; 
              font-size: 0.875rem; 
              margin-bottom: 0.25rem;
              white-space: nowrap; 
              overflow: hidden; 
              text-overflow: ellipsis;
            ">
              ${article.properties.address}
            </div>
            <div class="building-info" style="
              font-size: 0.75rem;
              color: #a0aec0;
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 0.25rem;
              pointer-events: auto;
            ">
              <span>${article.properties.property_type}</span>
              ${isOpen ? `
                <div style="display: flex; gap: 6px; margin-left: auto;">
                  ${statusIcons}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
        ${isOpen ? `
          ${insights.length > 0 ? `
            <div style="
              margin-top: 12px;
              padding-top: 12px;
              border-top: 1px solid rgba(255, 255, 255, 0.1);
            ">
              ${insights.map(insight => `
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: 8px;
                  padding: 6px;
                  background: rgba(255, 255, 255, 0.05);
                  border-radius: 4px;
                  border-left: 3px solid ${insight.color};
                ">
                  <span style="font-size: 16px;">${insight.icon}</span>
                  <span style="font-size: 12px; color: ${insight.color}; font-weight: 500;">
                    ${insight.text}
                  </span>
                </div>
              `).join('')}
            </div>
          ` : ''}
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 8px;
          ">
            <span style="
              color: ${isPositive ? '#4CAF50' : '#FF4136'};
              font-size: 1.125rem;
              font-weight: bold;
            ">
              ${isPositive ? '+' : ''}${performance?.percentageChange.toFixed(1)}%
            </span>
            <span style="font-size: 0.875rem; color: #a0aec0;">
              ${performance?.capacityUsage}% cap
            </span>
          </div>
        ` : ''}
        ${isOpen ? `
          <div style="
            position: absolute;
            top: -30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.85);
            padding: 4px 8px;
            border-radius: 12px;
            border: 2px solid ${isPositive ? '#4CAF50' : '#FF4136'};
            z-index: 2001;
            display: flex;
            align-items: center;
            gap: 4px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${isPositive ? '#4CAF50' : '#FF4136'}" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <span style="
              color: ${isPositive ? '#4CAF50' : '#FF4136'};
              font-weight: bold;
              font-size: 12px;
            ">
              ${Math.round((parseFloat(article.properties.powerScore) + parseFloat(article.properties.coolingScore)) * 50)}%
            </span>
          </div>
        ` : ''}
      </div>
    `;
  };

  return (
    <div className="relative w-full h-screen">
      <NeuralNetworkOverlay />
      <div ref={mapContainer} className="w-full h-full" />
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

