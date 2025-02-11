import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import BuildingPopup from './BuildingPopup';
import PropTypes from 'prop-types';

import { createRoot } from 'react-dom/client';

import {
  DC_BOUNDS,
  POWER_SUBSTATIONS,
  COGENT_PARTICLE_COLOR,
  MIN_ZOOM,
  THROTTLE_TIME,
  TOTAL_SCALE,
  BUILDING_TYPES,
  // Add these new imports
  WHITE_PARTICLE_COUNT,
  WHITE_PARTICLE_SIZE,
  WHITE_PARTICLE_OPACITY
} from './constants';

import {
  generateRandomLocation,
  generateBuildingData,
  generateAddress,
  getNeighborhoodFromCoords,
  distanceToLineSegment
} from './utils';

import {  MAIN_CORRIDORS } from './gridNetwork';

import { particleLayers, buildingLayers } from './layers';

import { useParticleSystem } from '../../hooks/useParticleSystem';

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
    features.push(generateBuildingData(i, DC_BOUNDS));
  }

  return {
    type: "FeatureCollection",
    features: features
  };
};

// Generate 50 buildings including landmarks
const dcData = generateMockData(50);

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;


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
      coordinates: building.geometry.coordinates[0][0],
      strength: parseFloat(building.properties.powerScore),
      name: building.properties.address,
      type: "building_connection"
    }))
];


// Add this function to generate particle paths
const createCogentParticles = (sourceCoords, targetBuildings) => {
    return {
        type: 'FeatureCollection',
        features: targetBuildings.map(building => {
            const targetCoords = building.geometry.coordinates[0][0];
            return {
                type: 'Feature',
                properties: {
                    targetId: building.id,
                    duration: Math.random() * 0.3 + 0.15 // Significantly reduced from 0.75 + 0.25
                },
                geometry: {
                    type: 'LineString',
                    coordinates: [sourceCoords, targetCoords]
                }
            };
        })
    };
};

const MapComponent = (props) => {
  const { onArticleUpdate = () => {} } = props;
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng] = useState(-77.019);
  const [lat] = useState(38.907);
  const [zoom] = useState(15.5);
  const buildingStates = useRef(new Map());
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const frameCount = useRef(0);
  const isAnimating = useRef(false);
  const clickTimeout = useRef(null);
  const [cogentActive, setCogentActive] = useState(false);
  const [cogentHighlight, setCogentHighlight] = useState(null);
  const currentFloatingCard = useRef(null);
  const currentRoot = useRef(null);  // Add this ref for React root

  const {  createCogentParticles, animationFrame } = useParticleSystem(map);

  // Add these refs
  const lastAnimationTime = useRef(0);
  const greenBuildings = useRef([]);
  const roads = useRef([]);

  // Add this at the component level
  const selectedCoordinates = useRef(null);

  // Add these update functions
  const updateHeatmap = useCallback(() => {
      if (!map.current || !map.current.getSource('cooling-efficiency')) return;
      
      // Regenerate and update cooling points
      const coolingPoints = generateCoolingPoints();
      map.current.getSource('cooling-efficiency').setData(coolingPoints);
  }, []);

  const updateGreenLines = useCallback(() => {
      if (!map.current || !map.current.getSource('green-lines')) return;
      
      // Regenerate and update green lines
      const greenLinesData = createGreenLines();
      map.current.getSource('green-lines').setData(greenLinesData);
  }, []);

  const updatePowerLines = useCallback(() => {
      if (!map.current) return;
      
      // Update power grid lines visibility and style
      ['power-grid-main', 'secondary-network-main'].forEach(layerId => {
          if (map.current.getLayer(layerId)) {
              map.current.setLayoutProperty(layerId, 'visibility', 'visible');
              // Reset any custom styles if needed
              map.current.setPaintProperty(layerId, 'line-opacity', 
                  layerId === 'power-grid-main' ? 0.7 : 0.4);
          }
      });
  }, []);

  const handleCogentClick = useCallback(() => {
    console.log('Cogent clicked in Map component');
    
    if (!map.current) {
        console.log('Map not initialized');
        return;
    }

    try {
        if (!cogentActive) {
            // Entering Cogent mode
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

            if (greenBuilding) {
                const greenCoords = greenBuilding.geometry.coordinates[0][0];
                
                // Hide heatmap during Cogent mode
                if (map.current.getLayer('building-distance-heatmap')) {
                    map.current.setLayoutProperty('building-distance-heatmap', 'visibility', 'none');
                }

                // Find 10 closest buildings (excluding the green building)
                const nearbyBuildings = features
                    .filter(feature => {
                        // Skip the green building itself from the yellow/orange/purple highlights
                        if (feature.id === greenBuilding.id) return false;
                        
                        const coords = feature.geometry.coordinates[0][0];
                        const distance = Math.sqrt(
                            Math.pow(coords[0] - greenCoords[0], 2) +
                            Math.pow(coords[1] - greenCoords[1], 2)
                        );
                        return distance < 0.003;
                    })
                    .sort((a, b) => {
                        const coordsA = a.geometry.coordinates[0][0];
                        const coordsB = b.geometry.coordinates[0][0];
                        const distanceA = Math.sqrt(
                            Math.pow(coordsA[0] - greenCoords[0], 2) +
                            Math.pow(coordsA[1] - greenCoords[1], 2)
                        );
                        const distanceB = Math.sqrt(
                            Math.pow(coordsB[0] - greenCoords[0], 2) +
                            Math.pow(coordsB[1] - greenCoords[1], 2)
                        );
                        return distanceA - distanceB;
                    })
                    .slice(0, 10);

                // Update the paint property to handle both green and highlighted buildings
                map.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
                  'case',
                  ['boolean', ['feature-state', 'isGreen'], false],
                  '#51ff00', // Keep green buildings green
                  ['boolean', ['feature-state', 'highlighted'], false],
                  [
                      'match',
                      ['feature-state', 'highlightColor'],
                      'yellow', '#f7db05',  // Yellow
                      'orange', '#ff9f1c',  // Orange
                      'purple', '#7048e8',  // Purple
                      '#050505'  // Default dimmed color - changed to very dark
                  ],
                  '#050505'  // Default dimmed color - changed to very dark
              ]);

                // Highlight nearby buildings in three colors
                nearbyBuildings.forEach((building, index) => {
                    const buildingId = building.properties.id || building.id;
                    if (buildingId) {
                        let highlightColor;
                        if (index < 4) {
                            highlightColor = 'yellow';
                        } else if (index < 7) {
                            highlightColor = 'orange';
                        } else {
                            highlightColor = 'purple';
                        }
                        
                        map.current.setFeatureState(
                            { source: 'composite', sourceLayer: 'building', id: buildingId },
                            { 
                                highlighted: true,
                                highlightColor: highlightColor 
                            }
                        );
                    }
                });

                // Add particle layer if it doesn't exist
                if (!map.current.getSource('cogent-particles')) {
                    map.current.addSource('cogent-particles', {
                        type: 'geojson',
                        data: {
                            type: 'FeatureCollection',
                            features: []
                        }
                    });

                    map.current.addLayer({
                        id: 'cogent-particle-lines',
                        type: 'line',
                        source: 'cogent-particles',
                        paint: {
                            'line-color': COGENT_PARTICLE_COLOR,
                            'line-width': 2,
                            'line-opacity': 0.6,
                            'line-gradient': [
                                'interpolate',
                                ['linear'],
                                ['line-progress'],
                                0, 'rgba(135, 206, 250, 0)',
                                0.1, 'rgba(135, 206, 250, 0.6)',
                                0.5, 'rgba(135, 206, 250, 0.8)',
                                1, 'rgba(135, 206, 250, 0)'
                            ]
                        }
                    });
                }

                // Start particle animation
                const sourceCoords = greenBuilding.geometry.coordinates[0][0];
                const particleData = createCogentParticles(sourceCoords, nearbyBuildings);
                
                if (map.current.getSource('cogent-particles')) {
                    map.current.getSource('cogent-particles').setData(particleData);
                }

                // Animate particles
                let start;
                const animate = (timestamp) => {
                    if (!start) start = timestamp;
                    const progress = (timestamp - start) / 250; // Reduced from 500 to make it twice as fast
                    
                    const animatedFeatures = particleData.features.map(feature => {
                        const duration = feature.properties.duration * 0.25; // Reduced from 0.5 to make it even faster
                        const currentProgress = (progress % duration) / duration;

                        return {
                            type: 'Feature',
                            properties: {
                                ...feature.properties,
                                'line-progress': currentProgress
                            },
                            geometry: feature.geometry
                        };
                    });

                    if (map.current.getSource('cogent-particles')) {
                        map.current.getSource('cogent-particles').setData({
                            type: 'FeatureCollection',
                            features: animatedFeatures
                        });
                    }

                    if (cogentActive) {
                        animationFrame.current = requestAnimationFrame(animate);
                    }
                };

                animationFrame.current = requestAnimationFrame(animate);
            } else {
                // When exiting Cogent mode, show heatmap again
                if (map.current.getLayer('building-distance-heatmap')) {
                    map.current.setLayoutProperty('building-distance-heatmap', 'visibility', 'visible');
                }
            }
        } else {
            // Exiting Cogent mode - Reset to original state
            
            // Clear the floating card
            if (currentRoot.current) {
                currentRoot.current.unmount();
                currentRoot.current = null;
            }
            if (currentFloatingCard.current) {
                currentFloatingCard.current.remove();
                currentFloatingCard.current = null;
            }
            setSelectedBuilding(null);

            // Reset base map colors to dark theme
            map.current.setPaintProperty('background', 'background-color', '#111111');
            map.current.setPaintProperty('water', 'fill-color', '#222222');
            map.current.setPaintProperty('land', 'background-color', '#111111');
            
            // Reset road colors to original dark theme
            ['road-primary', 'road-secondary', 'road-street'].forEach(layer => {
                if (map.current.getLayer(layer)) {
                    map.current.setPaintProperty(layer, 'line-color', '#333333');
                }
            });

            // Reset building colors to original state
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
                        '#121212'
                    ]
                ]
            ]);

            // Show all previously hidden layers
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

            // Reset building states
            const features = map.current.queryRenderedFeatures({
                layers: ['3d-buildings']
            });

            features.forEach(feature => {
                const buildingId = feature.properties.id || feature.id;
                if (!buildingId) return;

                const state = buildingStates.current.get(buildingId);
                if (state) {
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
                }
            });

            // Trigger updates for various visualizations
            updateHeatmap();
            updateGreenLines();
            updatePowerLines();
        }

        setCogentActive(!cogentActive);
    } catch (error) {
        console.error('Error in handleCogentClick:', error);
    }
}, [cogentActive, updateHeatmap, updateGreenLines, updatePowerLines]);

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
            '#1a1a1a'  // Changed from 'rgba(26, 26, 26, 0.3)' to a darker color
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

        // In your initialization code:
        Object.values(particleLayers).forEach(layer => {
          if (!map.current.getLayer(layer.id)) {
            map.current.addLayer(layer);
          }
        });

        Object.values(buildingLayers).forEach(layer => {
          if (!map.current.getLayer(layer.id)) {
            map.current.addLayer(layer);
          }
        });
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
                    14, 0.2,
                    16, 0.1
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
                            
                            for (const location of POWER_SUBSTATIONS) {
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
        const calculateBuildingArea = (coords) => {
            let area = 0;
            for (let i = 0; i < coords.length - 1; i++) {
                area += coords[i][0] * coords[i + 1][1] - coords[i + 1][0] * coords[i][1];
            }
            return Math.abs(area) * 10000000; // Scale factor to get reasonable numbers
        };

        // Update building colors when the map moves
        map.current.on('moveend', updateBuildingColors);
        // Initial update
        updateBuildingColors();

        function createGreenLines() {
            if (!map.current) return null;

            const features = map.current.queryRenderedFeatures({
                layers: ['3d-buildings']
            });

            const roads = map.current.queryRenderedFeatures({
                layers: ['road-simple'],
                source: 'composite',
                sourceLayer: 'road'
            });

            const greenBuildings = features.filter(building => {
                const buildingId = building.properties.id || building.id;
                if (!buildingId) return false;
                
                const state = buildingStates.current.get(buildingId);
                return state && state.isGreen;
            });

            const lines = {
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

                // Find nearby roads
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
                            lines.features.push({
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

            return lines;
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

  // Create a memoized handler for building clicks
  const handleBuildingClick = useMemo(() => (e) => {
    if (!e.features || e.features.length === 0) return;
    
    const feature = e.features[0];
    const coordinates = feature.geometry.coordinates[0][0];
    const buildingId = feature.properties.id || feature.id;
    const state = buildingStates.current.get(buildingId);
    
    if (state && state.isGreen) {
      // Use ref instead of state directly
      const newIndex = (buildingTypeIndexRef.current + 1) % BUILDING_TYPES.length;
      const newType = BUILDING_TYPES[newIndex];
      
      // Create building article with new type
      const buildingArticle = {
        location: {
          address: feature.properties.address || generateAddress(coordinates),
          neighborhood: feature.properties.neighborhood || getNeighborhoodFromCoords(coordinates),
          city: "Washington",
          state: "DC"
        },
        buildingType: newType,
        completion_date: feature.properties.completion_date || "2025",
        snapshot: {
          propertyType: newType,
          totalArea: `${Math.floor(Math.random() * 200000 + 100000)} sq ft`,
          floors: Math.floor(Math.random() * 20 + 5),
          zoning: "C-2",
          owner: "Franklin Holdings"
        }
      };
      
      // Update state
      setCurrentBuildingTypeIndex(newIndex);
      setSelectedBuilding(buildingArticle);
      
      // Update floating card
      if (currentRoot.current) {
        currentRoot.current.unmount();
      }
      if (currentFloatingCard.current) {
        currentFloatingCard.current.remove();
      }
      
      const floatingCardContainer = document.createElement('div');
      document.body.appendChild(floatingCardContainer);
      currentFloatingCard.current = floatingCardContainer;
      
      const root = createRoot(floatingCardContainer);
      currentRoot.current = root;
      
      root.render(
        <FloatingCard 
          coordinates={coordinates} 
          map={map.current}
          buildingData={buildingArticle}
        />
      );
    }
  }, []); // Empty dependency array since we're using refs

  // Add click handler in useEffect
  useEffect(() => {
    if (!map.current) return;
    
    map.current.on('click', '3d-buildings', handleBuildingClick);
    
    return () => {
      if (map.current) {
        map.current.off('click', '3d-buildings', handleBuildingClick);
      }
    };
  }, [handleBuildingClick]);

  // Update the particle generation code
  const generateParticles = () => {
    const particles = [];
    const baseParticleCount = 100; // Increased base number of particles
    const greenBuildingParticleCount = Math.floor(baseParticleCount * 1.5); // 50% more particles for green buildings
    
    greenBuildings.current.forEach(building => {
        const coordinates = building.geometry.coordinates[0][0];
        
        // Generate more particles for green buildings
        const particleCount = greenBuildingParticleCount;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 0.002; // Slightly increased spread
            
            const particle = {
                type: 'Feature',
                properties: {
                    particleSize: Math.random() * 4 + 3, // Increased size between 3-7
                    color: '#51ff00',
                    opacity: Math.random() * 0.5 + 0.4 // Slightly increased opacity between 0.4-0.9
                },
                geometry: {
                    type: 'Point',
                    coordinates: [
                        coordinates[0] + Math.cos(angle) * radius,
                        coordinates[1] + Math.sin(angle) * radius
                    ]
                }
            };
            particles.push(particle);
            
            // Add a second layer of larger particles (less frequent)
            if (i % 3 === 0) { // Only add large particles every third iteration
                const largeParticle = {
                    type: 'Feature',
                    properties: {
                        particleSize: Math.random() * 6 + 5, // Much larger size between 5-11
                        color: '#51ff00',
                        opacity: Math.random() * 0.3 + 0.2 // Lower opacity for larger particles
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [
                            coordinates[0] + Math.cos(angle) * (radius * 0.8),
                            coordinates[1] + Math.sin(angle) * (radius * 0.8)
                        ]
                    }
                };
                particles.push(largeParticle);
            }
        }
    });

    return {
        type: 'FeatureCollection',
        features: particles
    };
  };



  // Update the animation function
  const animate = useCallback(() => {
    if (!map.current || !map.current.loaded()) {
      animationFrame.current = requestAnimationFrame(animate);
      return;
    }

    frameCount.current += 1;
    
    const zoom = map.current.getZoom();
    
    // Skip animation at low zoom levels
    if (zoom < MIN_ZOOM) {
        animationFrame.current = requestAnimationFrame(animate);
        return;
    }

    const currentTime = Date.now();
    if (currentTime - lastAnimationTime.current < THROTTLE_TIME) {
        animationFrame.current = requestAnimationFrame(animate);
        return;
    }
    lastAnimationTime.current = currentTime;

    try {
        const bounds = map.current.getBounds();
        
        // Filter visible corridors
        const visibleCorridors = MAIN_CORRIDORS.filter(corridor => {
            return bounds.contains([corridor.start[0], corridor.start[1]]) ||
                   bounds.contains([corridor.end[0], corridor.end[1]]);
        }).slice(0, 15);

        const allParticles = [];

        // Generate particles for each visible corridor
        visibleCorridors.forEach(corridor => {
            // Generate multiple white particles per corridor
            for (let i = 0; i < WHITE_PARTICLE_COUNT; i++) {
                const progress = ((frameCount.current * 0.02) + (i / WHITE_PARTICLE_COUNT)) % 1;
                const position = [
                    corridor.start[0] + (corridor.end[0] - corridor.start[0]) * progress,
                    corridor.start[1] + (corridor.end[1] - corridor.start[1]) * progress
                ];

                // Add slight random offset to position for more natural look
                const offset = 0.00005;
                position[0] += (Math.random() - 0.5) * offset;
                position[1] += (Math.random() - 0.5) * offset;

                // Create white particle
                allParticles.push({
                    type: 'Feature',
                    properties: {
                        particleSize: Math.random() * 
                            (WHITE_PARTICLE_SIZE.MAX - WHITE_PARTICLE_SIZE.MIN) + 
                            WHITE_PARTICLE_SIZE.MIN,
                        color: `rgba(255, 255, 255, ${
                            Math.random() * 
                            (WHITE_PARTICLE_OPACITY.MAX - WHITE_PARTICLE_OPACITY.MIN) + 
                            WHITE_PARTICLE_OPACITY.MIN
                        })`,
                        type: 'road'
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: position
                    }
                });

                // Add trailing particles with decreasing size
                const trailLength = 3;
                for (let t = 1; t <= trailLength; t++) {
                    const trailProgress = (progress - (t * 0.01)) % 1;
                    if (trailProgress >= 0) {
                        const trailPosition = [
                            corridor.start[0] + (corridor.end[0] - corridor.start[0]) * trailProgress,
                            corridor.start[1] + (corridor.end[1] - corridor.start[1]) * trailProgress
                        ];

                        allParticles.push({
                            type: 'Feature',
                            properties: {
                                particleSize: (WHITE_PARTICLE_SIZE.MIN * (trailLength - t + 1)) / trailLength,
                                color: `rgba(255, 255, 255, ${
                                    WHITE_PARTICLE_OPACITY.MIN * (trailLength - t + 1) / trailLength
                                })`,
                                type: 'trail'
                            },
                            geometry: {
                                type: 'Point',
                                coordinates: trailPosition
                            }
                        });
                    }
                }
            }
        });

        // Add existing green building particles
        const greenParticles = generateParticles();
        allParticles.push(...greenParticles.features);

        // Update particle source with all particles
        if (map.current && map.current.getSource('particles')) {
            map.current.getSource('particles').setData({
                type: 'FeatureCollection',
                features: allParticles
            });
        }

    } catch (error) {
        console.error('Animation error:', error);
    }

    animationFrame.current = requestAnimationFrame(animate);
  }, []);

  // Move the particle layer setup inside useEffect
  useEffect(() => {
    if (!map.current) return;

    // Wait for map to load
    map.current.on('load', () => {
        // Add particle layer
        if (!map.current.getLayer('particles')) {
            map.current.addLayer({
                id: 'particles',
                type: 'circle',
                source: 'particles',
                minzoom: 13,
                maxzoom: 20,
                paint: {
                    'circle-radius': ['get', 'particleSize'],
                    'circle-color': ['get', 'color'],
                    'circle-opacity': [
                        'match',
                        ['get', 'type'],
                        'trail', ['*', 0.8, ['get', 'opacity']],
                        ['get', 'opacity']
                    ],
                    'circle-blur': [
                        'match',
                        ['get', 'type'],
                        'trail', 0.8,
                        0.5
                    ]
                }
            });
        }

        // Start animation
        animate();
    });

    return () => {
        if (animationFrame.current) {
            cancelAnimationFrame(animationFrame.current);
        }
    };
  }, [animate]);

  // Remove the particle layer setup from outside useEffect
  // (Delete or comment out the previous if (!map.current.getLayer('particles')) block)

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

  // Add these helper functions
  const generateCoolingPoints = useCallback(() => {
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
  }, []);

  // First define the helper function
  const calculateBuildingArea = useCallback((coords) => {
      let area = 0;
      for (let i = 0; i < coords.length - 1; i++) {
          area += coords[i][0] * coords[i + 1][1] - coords[i + 1][0] * coords[i][1];
      }
      return Math.abs(area) * 10000000; // Scale factor to get reasonable numbers
  }, []);

  // Then define createGreenLines which uses calculateBuildingArea
  const createGreenLines = useCallback(() => {
      if (!map.current) return null;

      const features = map.current.queryRenderedFeatures({
          layers: ['3d-buildings']
      });

      const roads = map.current.queryRenderedFeatures({
          layers: ['road-simple'],
          source: 'composite',
          sourceLayer: 'road'
      });

      const greenBuildings = features.filter(building => {
          const buildingId = building.properties.id || building.id;
          if (!buildingId) return false;
          
          const state = buildingStates.current.get(buildingId);
          return state && state.isGreen;
      });

      const lines = {
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

          // Find nearby roads
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
                      lines.features.push({
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

      return lines;
  }, [calculateBuildingArea]); // Add calculateBuildingArea as a dependency

  // Add this near the top with other state declarations
  const [currentBuildingTypeIndex, setCurrentBuildingTypeIndex] = useState(0);
  const buildingTypeIndexRef = useRef(0); // Add this ref to track current index

  // Update ref when state changes
  useEffect(() => {
    buildingTypeIndexRef.current = currentBuildingTypeIndex;
  }, [currentBuildingTypeIndex]);

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
const FloatingCard = ({ coordinates, map, buildingData }) => {
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



