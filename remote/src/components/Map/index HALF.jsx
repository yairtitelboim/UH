import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import BuildingPopup from './BuildingPopup';
import PropTypes from 'prop-types';
import { createRoot } from 'react-dom/client';
import { useMapAnimation } from './hooks/useMapAnimation';
import FloatingCard from './components/FloatingCard';
import { MAP_CONFIG, POWER_GRID_LOCATIONS } from './hooks/mapConstants';
import { dcData } from './utils/mockDataGenerator';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const MapComponent = (props) => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    
    // Get animation controls from the hook
    const { startAnimation, stopAnimation, initializeParticleLayers } = useMapAnimation(map);
    
    const buildingStates = useRef(new Map());
    const [selectedBuilding, setSelectedBuilding] = useState(null);
    const [cogentActive, setCogentActive] = useState(false);
    const [cogentHighlight, setCogentHighlight] = useState(null);

    // Define initializeLayersAndAnimation
    const initializeLayersAndAnimation = useCallback(() => {
        if (!map.current) return;

        // Add 3D buildings layer
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
                        ['boolean', ['feature-state', 'isGreen'], false],
                        '#51ff00',
                        '#1a1a1a'
                    ],
                    'fill-extrusion-height': ['get', 'height']
                }
            });
        }

        startAnimation();
    }, [map, startAnimation]);

    // Handle map click events
    const handleMapClick = useCallback((e) => {
      if (!map.current) return;
      
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ['3d-buildings']
      });
      
      if (features.length > 0) {
        const feature = features[0];
        
        // Create a proper article structure
        const buildingArticle = {
          location: {
            address: feature.properties.address || 'Unknown Address',
            neighborhood: feature.properties.neighborhood || '',
            city: feature.properties.city || 'Washington',
            state: feature.properties.state || 'DC'
          },
          properties: feature.properties || {}
        };
        
        // Set the clicked building as selected
        setSelectedBuilding(buildingArticle);
      }
    }, []);

    // First useEffect for map initialization
    useEffect(() => {
        if (!map.current) {
            map.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/mapbox/dark-v10',
                center: [-77.0369, 38.9072],
                zoom: 12,
                pitch: 45
            });

            map.current.on('load', () => {
                console.log('Map style loaded, initializing layers...');
                initializeParticleLayers();
                initializeLayersAndAnimation();
                map.current.triggerRepaint();
                console.log('Layer initialization complete');
            });
        }

        return () => {
            if (map.current) {
                map.current.remove();
            }
        };
    }, [startAnimation, stopAnimation, initializeParticleLayers, initializeLayersAndAnimation]);

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
    }, [cogentHighlight, startAnimation, stopAnimation]);

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

            // Updated animation function with more rings and variation
            function animateParticles() {
                try {
                    const zoom = map.current.getZoom();
                    if (zoom < 13) {
                        return;
                    }

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

                                if (distToBuilding < MAP_CONFIG.TOTAL_SCALE * totalScale) {
                                    const fadeStart = 0.0002 * totalScale;
                                    const fadeEnd = 0.006 * totalScale;
                                    const rawFade = (distToBuilding - fadeStart) / (fadeEnd - fadeStart);
                                    const enhancedFade = Math.exp(-rawFade * 2);
                                    const dx = nextRoadCoord[0] - roadCoord[0];
                                    const dy = nextRoadCoord[1] - roadCoord[1];
                                    const roadSegmentLength = Math.sqrt(dx * dx + dy * dy);
                                    
                                    // Adjust particle count based on zoom
                                    const baseParticles = Math.floor(40 * Math.max(0.2, (zoom - 13) / 5));
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
                                            const whiteOffset = 0.00005 * Math.sin((t * Math.PI * waveFrequency) + (Date.now() * 0.001 * waveSpeed));
                                            
                                            const flowSpeed = 0.5;
                                            const flowOffset = ((t + Date.now() * 0.001 * flowSpeed) % 1.0) - 0.5;
                                            
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
                    console.error('Animation error:', error);
                }
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

            // Start animation after initialization
            startAnimation();
        }

        // Cleanup function
        return () => {
            if (map.current) {
                map.current.remove();
            }
        };
    }, [startAnimation, stopAnimation]); // Add animation controls to dependencies

    // Clean up function
    useEffect(() => {
        return () => {
            buildingStates.current.clear();
        };
    }, []);

    // Add click handler for buildings
    useEffect(() => {
      if (!map.current) return;

      map.current.on('click', '3d-buildings', handleMapClick);

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
          map.current.off('click', '3d-buildings', handleMapClick);
          map.current.off('mouseenter', '3d-buildings');
          map.current.off('mouseleave', '3d-buildings');
        }
      };
    }, [handleMapClick]);

    return (
      <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
            {selectedBuilding && (
          <>
            <button
              onClick={() => {
                setSelectedBuilding(null);
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
              onCogentClick={() => {}}
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

export default MapComponent;
