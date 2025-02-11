// Import necessary dependencies
import { MIN_ZOOM, THROTTLE_TIME, PARTICLE_SIZE_JAX as PARTICLE_SIZE, PARTICLE_OPACITY_JAX as PARTICLE_OPACITY } from '../constants';
import { center } from '@turf/turf';

export const initializeParticleLayers = (map) => {
    try {
        // Add source for dynamic particles
        if (!map.getSource('building-particles')) {
            map.addSource('building-particles', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });
        }

        // Add particle layer
        if (!map.getLayer('building-particles')) {
            map.addLayer({
                'id': 'building-particles',
                'type': 'circle',
                'source': 'building-particles',
                'paint': {
                    'circle-radius': 2,
                    'circle-color': '#FFFFFF',
                    'circle-opacity': 0.3,
                    'circle-blur': 0
                }
            }, 'waterway-label');  // Make sure it's added before labels
        }

        // Make sure buildings are visible
        ['building', '3d-buildings'].forEach(layerId => {
            if (map.getLayer(layerId)) {
                try {
                    map.setLayoutProperty(layerId, 'visibility', 'visible');
                    const layer = map.getLayer(layerId);
                    if (layer.type === 'fill' || layer.type === 'fill-extrusion') {
                        const opacityProp = layer.type === 'fill' ? 'fill-opacity' : 'fill-extrusion-opacity';
                        map.setPaintProperty(layerId, opacityProp, 0.8);
                    }
                } catch (error) {}
            }
        });
    } catch (error) {}
};

export const generateParticles = (map, highlightedBuildings) => {
    const features = [];
    
    if (!highlightedBuildings?.buildings) {
        return { type: 'FeatureCollection', features: [] };
    }

    // Get roads near highlighted buildings
    const roads = map.queryRenderedFeatures({
        layers: ['road-simple'],  // Try just one layer first
    });

    // Generate road particles
    roads.forEach(road => {
        if (!road.geometry.coordinates) return;
        
        const coords = road.geometry.type === 'LineString' ? 
            road.geometry.coordinates : 
            road.geometry.coordinates[0];

        const particleCount = 10;
        const progress = (Date.now() * 0.0005) % 1; // Slower movement

        for (let i = 0; i < particleCount; i++) {
            if (coords.length < 2) continue;
            
            const offset = (i / particleCount + progress) % 1;
            const index = Math.floor(offset * (coords.length - 1));
            const nextIndex = (index + 1) % coords.length;
            
            const start = coords[index];
            const end = coords[nextIndex];
            
            const position = [
                start[0] + (end[0] - start[0]) * (offset % 1),
                start[1] + (end[1] - start[1]) * (offset % 1)
            ];

            features.push({
                type: 'Feature',
                properties: {
                    particleSize: 14,
                    opacity: 0.8,
                    color: '#FFD700'  // Yellow for roads
                },
                geometry: {
                    type: 'Point',
                    coordinates: position
                }
            });
        }
    });

    // Generate building perimeter particles
    Array.from(highlightedBuildings.buildings.keys()).forEach(buildingId => {
        const building = map.queryRenderedFeatures({
            layers: ['3d-buildings'],
            filter: ['==', ['get', 'id'], buildingId]
        })[0];

        if (building?.geometry?.coordinates?.[0]) {
            const perimeter = building.geometry.coordinates[0];
            const particleCount = 30;
            const progress = (Date.now() * 0.001) % 1;

            for (let i = 0; i < particleCount; i++) {
                const offset = (i / particleCount + progress) % 1;
                const index = Math.floor(offset * (perimeter.length - 1));
                const nextIndex = (index + 1) % perimeter.length;
                
                const start = perimeter[index];
                const end = perimeter[nextIndex];
                
                const position = [
                    start[0] + (end[0] - start[0]) * (offset % 1),
                    start[1] + (end[1] - start[1]) * (offset % 1)
                ];

                features.push({
                    type: 'Feature',
                    properties: {
                        particleSize: 3,
                        opacity: 0.9,
                        color: '#4169E1'  // Royal Blue for buildings
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: position
                    }
                });
            }
        }
    });

    return {
        type: 'FeatureCollection',
        features: features
    };
};

export const animateParticles = ({ map, highlightedBuildings }) => {
    if (!highlightedBuildings?.buildings?.size) {
        return null;
    }

    try {
        const roads = map.queryRenderedFeatures({
            layers: ['road-simple']  // Just use main roads for now
        });

        const features = [];
        const time = Date.now() * 0.0005;

        roads.forEach(road => {
            if (!road.geometry.coordinates) return;

            const coords = road.geometry.type === 'LineString' ? 
                road.geometry.coordinates : 
                road.geometry.coordinates[0];

            if (!coords || coords.length < 2) return;

            // Add fewer particles for testing
            for (let i = 0; i < 5; i++) {
                const progress = (time + i * 0.2) % 1;
                const index = Math.floor(progress * (coords.length - 1));
                const nextIndex = (index + 1) % coords.length;

                const pos = [
                    coords[index][0] + (coords[nextIndex][0] - coords[index][0]) * (progress % 1),
                    coords[index][1] + (coords[nextIndex][1] - coords[index][1]) * (progress % 1)
                ];

                features.push({
                    type: 'Feature',
                    properties: {
                        color: '#FFFFFF'
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: pos
                    }
                });
            }
        });

        const source = map.getSource('building-particles');
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features: features
            });
        }

        return requestAnimationFrame(() => 
            animateParticles({ map, highlightedBuildings })
        );

    } catch (error) {
        return null;
    }
};

// Add other animation-related functions here
export const createGreenLines = (map, buildingStates) => {
    if (!map.getSource('green-lines')) {
        map.addSource('green-lines', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

        map.addLayer({
            'id': 'green-lines',
            'type': 'line',
            'source': 'green-lines',
            'paint': {
                'line-color': '#4CAF50',
                'line-width': 2,
                'line-opacity': 0.6,
                'line-blur': 3
            }
        });
    }

    // Generate connecting lines between green buildings
    const features = [];
    const greenBuildings = Array.from(buildingStates.values())
        .filter(building => building.isGreen);

    greenBuildings.forEach((building, i) => {
        for (let j = i + 1; j < greenBuildings.length; j++) {
            const otherBuilding = greenBuildings[j];
            features.push({
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        building.center,
                        otherBuilding.center
                    ]
                }
            });
        }
    });

    map.getSource('green-lines').setData({
        type: 'FeatureCollection',
        features: features
    });
};

export const generateCoolingPoints = (map) => {
    const points = {
        type: 'FeatureCollection',
        features: []
    };

    const buildings = map.queryRenderedFeatures({
        layers: ['3d-buildings'],
        filter: ['>', 'height', 10]
    });

    buildings.forEach(building => {
        const buildingCoords = building.geometry.coordinates[0];
        const [baseLng, baseLat] = [
            buildingCoords.reduce((sum, coord) => sum + coord[0], 0) / buildingCoords.length,
            buildingCoords.reduce((sum, coord) => sum + coord[1], 0) / buildingCoords.length
        ];
        
        const isPositive = Math.random() > 0.5;
        const baseRadius = 0.00375;
        const outerRadius = 0.00625;

        // Core points (high intensity)
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * baseRadius;
            const lng = baseLng + Math.cos(angle) * radius;
            const lat = baseLat + Math.sin(angle) * radius;

            points.features.push({
                type: 'Feature',
                properties: {
                    efficiency: isPositive ? 0.9 : 0.1,
                    intensity: 1 - (radius / baseRadius)
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
};

export const createCogentParticles = (sourceCoords, targetBuildings) => {
    const features = [];
    targetBuildings.forEach(building => {
        const targetCoords = building.geometry.coordinates[0][0];
        features.push({
            type: 'Feature',
            properties: {
                duration: Math.random() * 2 + 1 // Random duration between 1-3 seconds
            },
            geometry: {
                type: 'LineString',
                coordinates: [sourceCoords, targetCoords]
            }
        });
    });
    return {
        type: 'FeatureCollection',
        features: features
    };
};

export const initializePowerGrid = (map) => {
    if (!map) return;

    try {
        map.addSource('power-grid-network', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-streets-v8'
        });

        // Add main power grid lines (yellow) - now much thinner and more transparent
        map.addLayer({
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
                    13, 1.3,  // Much thinner
                    16, 1.5   // Much thinner
                ],
                'line-opacity': 0.4,  // More transparent
                'line-blur': 0.5
            }
        });
    } catch (error) {}
};

// Add new initialization function for GEOID particles
export const initializeGEOIDParticleLayers = (map) => {
    try {
        // Add source for GEOID particles
        if (!map.getSource('geoid-particles')) {
            map.addSource('geoid-particles', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });
        }

        // Add GEOID particle layer with enhanced visibility
        if (!map.getLayer('geoid-particles')) {
            map.addLayer({
                'id': 'geoid-particles',
                'type': 'circle',
                'source': 'geoid-particles',
                'paint': {
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        12, ['*', ['get', 'particleSize'], 2.5],  // Increased size
                        14, ['*', ['get', 'particleSize'], 3.0],
                        16, ['*', ['get', 'particleSize'], 3.5]
                    ],
                    'circle-color': '#4CAF50',
                    'circle-opacity': 0.9,  // Increased opacity
                    'circle-blur': 0.2,     // Reduced blur
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#00ff00',
                    'circle-stroke-opacity': 0.5
                }
            }, 'waterway-label');  // Make sure it's above other layers
        }

        console.log('✅ GEOID particle layer initialized');
    } catch (error) {
        console.error('❌ Error initializing GEOID particles:', error);
    }
};

// Add function to generate GEOID particles
export const generateGEOIDParticles = (map, geoIdFeatures) => {
    const features = [];
    
    if (!geoIdFeatures?.length) {
        return { type: 'FeatureCollection', features: [] };
    }

    geoIdFeatures.forEach(geoid => {
        if (!geoid.geometry?.coordinates?.[0]) return;
        
        const perimeter = geoid.geometry.coordinates[0];
        const particleCount = 30;
        const progress = (Date.now() * 0.001) % 1;

        for (let i = 0; i < particleCount; i++) {
            const offset = (i / particleCount + progress) % 1;
            const index = Math.floor(offset * (perimeter.length - 1));
            const nextIndex = (index + 1) % perimeter.length;
            
            const start = perimeter[index];
            const end = perimeter[nextIndex];
            
            const position = [
                start[0] + (end[0] - start[0]) * (offset % 1),
                start[1] + (end[1] - start[1]) * (offset % 1)
            ];

            features.push({
                type: 'Feature',
                properties: {
                    particleSize: 3,
                    opacity: 0.9,
                    color: '#4CAF50'  // Green for GEOID boundaries
                },
                geometry: {
                    type: 'Point',
                    coordinates: position
                }
            });
        }
    });

    return {
        type: 'FeatureCollection',
        features: features
    };
};

export const animateGEOIDParticles = ({ map, geoIdFeatures, isActive = true }) => {
    if (!geoIdFeatures?.length || !isActive) {
        stopGEOIDAnimation(map);
        return null;
    }

    try {
        // Clear any existing animation frame first
        if (window.geoIdAnimationFrame) {
            cancelAnimationFrame(window.geoIdAnimationFrame);
            window.geoIdAnimationFrame = null;
        }

        const features = [];
        const time = Date.now() * 0.0003;

        // Debug logging (remove or reduce frequency)
        if (time % 1 === 0) {  // Only log occasionally
            console.log(`🟢 Animating GEOID particles for ${geoIdFeatures.length} features`);
        }

        geoIdFeatures.forEach(geoid => {
            if (!geoid.geometry?.coordinates?.[0]) return;
            
            const coords = geoid.geometry.coordinates[0];
            if (!coords || coords.length < 2) return;

            const particleCount = 20; // Reduced for performance
            
            for (let i = 0; i < particleCount; i++) {
                const progress = (time + i * 0.1) % 1;
                const index = Math.floor(progress * (coords.length - 1));
                const nextIndex = (index + 1) % coords.length;

                // Add jitter for more organic movement
                const jitter = (Math.random() - 0.5) * 0.0001;

                const pos = [
                    coords[index][0] + (coords[nextIndex][0] - coords[index][0]) * (progress % 1) + jitter,
                    coords[index][1] + (coords[nextIndex][1] - coords[index][1]) * (progress % 1) + jitter
                ];

                features.push({
                    type: 'Feature',
                    properties: {
                        particleSize: 2,
                        opacity: 0.8,
                        color: '#4CAF50'
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: pos
                    }
                });
            }
        });

        const source = map.getSource('geoid-particles');
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features: features
            });
        }

        // Set up next animation frame only if still active
        if (isActive) {
            window.geoIdAnimationFrame = requestAnimationFrame(() => 
                animateGEOIDParticles({ map, geoIdFeatures, isActive })
            );
        }

        return window.geoIdAnimationFrame;

    } catch (error) {
        console.error('❌ GEOID Animation error:', error);
        if (window.geoIdAnimationFrame) {
            cancelAnimationFrame(window.geoIdAnimationFrame);
            window.geoIdAnimationFrame = null;
        }
        return null;
    }
};

export const stopGEOIDAnimation = (map) => {
    try {
        // Cancel animation frame first
        if (window.geoIdAnimationFrame) {
            cancelAnimationFrame(window.geoIdAnimationFrame);
            window.geoIdAnimationFrame = null;
        }

        // Clear particles
        const source = map.getSource('geoid-particles');
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features: []
            });
        }

        // Remove layers and sources
        if (map.getLayer('geoid-particles')) {
            map.removeLayer('geoid-particles');
        }
        if (map.getSource('geoid-particles')) {
            map.removeSource('geoid-particles');
        }

        console.log('✅ GEOID animation stopped and cleaned up');
    } catch (error) {
        console.error('❌ Error stopping GEOID animation:', error);
    }
};

export const transitionToGridView = (map) => {
    try {
        // First ensure GEOID animation is stopped and cleaned up
        stopGEOIDAnimation(map);

        // Then initialize power grid particles
        initializeParticleLayers(map);
        
        // Show and enhance 3D buildings
        if (map.getLayer('3d-buildings')) {
            map.setLayoutProperty('3d-buildings', 'visibility', 'visible');
            map.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', 0.8);
            map.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
                'case',
                ['boolean', ['feature-state', 'isHighlighted'], false],
                [
                    'interpolate',
                    ['linear'],
                    ['feature-state', 'poiCount'],
                    1, '#FFB74D',
                    5, '#FF4500'
                ],
                '#1a1a1a'
            ]);
        }

        console.log('🔄 Transitioned to power grid view');

    } catch (error) {
        console.error('❌ Error transitioning to grid view:', error);
    }
}; 