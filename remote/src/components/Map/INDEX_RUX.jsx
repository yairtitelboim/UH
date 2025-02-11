import React, { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import BuildingPopup from './BuildingPopup';
import { createRoot } from 'react-dom/client';
import { 
    POWER_SUBSTATIONS_MIAMI, 
    BUILDING_COLORS,
    MAP_CONFIG,
    MIAMI_BOUNDS
} from './constants';
import { 
    initializeParticleLayers, 
    initializePowerGrid, 
    animateParticles 
} from './hooks/mapAnimations';
import { hexGrid, booleanPointInPolygon } from '@turf/turf';
import { analyzeCensusData } from './hooks/useCensusData';
import { AINavigator } from './hooks/useAINavigator';
import { askClaude } from '../../services/claude';

// Add this line to set the access token
mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

console.log('Mapbox Token:', process.env.REACT_APP_MAPBOX_ACCESS_TOKEN ? 'Token exists' : 'No token found');

// Basic styles for popup and markers
const style = document.createElement('style');
document.head.appendChild(style);
style.textContent = `
  .mapboxgl-popup {
    z-index: 3000 !important;
  }
  .custom-marker {
    transform: translate(-50%, -50%);
  }
  .mapboxgl-popup-content {
    background: rgba(30, 30, 30, 0.9) !important;
    color: #ffffff !important;
    border: 1px solid #444;
    border-radius: 4px;
    padding: 15px;
  }
  .mapboxgl-popup-tip {
    border-top-color: rgba(30, 30, 30, 0.9) !important;
    border-bottom-color: rgba(30, 30, 30, 0.9) !important;
  }
  .poi-popup-title {
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 8px;
  }
  .poi-popup-detail {
    font-size: 12px;
    color: #ccc;
  }
`;

const calculateBuildingArea = (coordinates) => {
  if (!coordinates || coordinates.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    area += coordinates[i][0] * coordinates[i + 1][1] - coordinates[i + 1][0] * coordinates[i][1];
  }
  return Math.abs(area) / 2;
};

const calculateBuildingEfficiency = (building) => {
    const height = building.properties.height || 0;
    const area = calculateBuildingArea(building.geometry.coordinates[0]);
    
    // Simple criteria for high-performing buildings:
    // 1. Must be taller than 30 meters
    // 2. Must have a minimum area
    const isEfficient = height > 30 && 
                       area > 200 && 
                       Math.random() > 0.6;  // 40% chance if meets criteria
    
    // Debug logs
    if (height > 30 && area > 200) {
        console.log('Potential green building:', { height, area, isEfficient });
    }
    
    return isEfficient;
};

// Define example queries at the top level
const EXAMPLE_QUERIES = [
  "What's the tallest building in high-activity areas?",
  "Which areas show the highest population growth?",
  "Find neighborhoods with the best residential-commercial mix"
];

const MapComponent = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const popupRef = useRef(null);
  const frameCount = useRef(0);
  const lastAnimationTime = useRef(0);
  const animationFrame = useRef(null);
  const buildingStates = useRef(new Map());
  const isAnimating = useRef(false);
  const previouslyHighlightedSubdivision = useRef(null);
  const previouslyHighlightedPMT = useRef(null);
  const [aiAnalysisMode, setAiAnalysisMode] = useState(false);
  const [aiNavigator, setAiNavigator] = useState(null);
  const [analysisPrompt, setAnalysisPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [hoverPopup, setHoverPopup] = useState(null);
  const aiControlRef = useRef(null);
  const previousHighlight = useRef(null);

  // Define handleAIQuery inside the component
  const handleAIQuery = useCallback(async (prompt) => {
    try {
      console.log('Processing AI query:', prompt);
      const response = await askClaude(prompt, {
        mapCenter: map.current?.getCenter(),
        mapZoom: map.current?.getZoom(),
        mapBounds: map.current?.getBounds()
      });

      console.log('Full Claude response:', response);

      const explanation = response.content?.[0]?.text;
      if (!explanation) {
        throw new Error('No explanation found in response');
      }

      let parsedResponse;
      try {
        const jsonMatch = explanation.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
          console.log('Parsed response:', parsedResponse);
        }
      } catch (e) {
        console.error('Failed to parse JSON from response:', e);
      }

      if (parsedResponse?.coordinates && map.current) {
        // First move map to the location
        map.current.flyTo({
          center: parsedResponse.coordinates,
          zoom: parsedResponse.zoomLevel || 16,
          duration: 2000
        });

        // Wait for the movement to finish
        await new Promise(resolve => {
          map.current.once('moveend', resolve);
        });

        // Get the layer paint properties to check hover configuration
        const pmtLayer = map.current.getLayer('pmt-density');
        const subdivisionLayer = map.current.getLayer('subdivision-density');
        console.log('PMT layer paint:', pmtLayer?.paint);
        console.log('Subdivision layer paint:', subdivisionLayer?.paint);

        // Query for POIs at the center
        const center = map.current.project(parsedResponse.coordinates);
        const features = map.current.queryRenderedFeatures(
          [
            [center.x - 20, center.y - 20],
            [center.x + 20, center.y + 20]
          ],
          {
            layers: ['miami-pois']
          }
        );

        if (features.length > 0) {
          const poi = features[0];
          const point = poi.geometry.coordinates;
          
          // Query the PMT and subdivision layers at the POI location
          const pmtFeatures = map.current.queryRenderedFeatures(
            map.current.project(point),
            { layers: ['pmt-density'] }
          );

          const subdivisionFeatures = map.current.queryRenderedFeatures(
            map.current.project(point),
            { layers: ['subdivision-density'] }
          );

          console.log('PMT feature full details:', pmtFeatures[0]);
          console.log('Subdivision feature full details:', subdivisionFeatures[0]);

          // Clear previous hover states
          if (previousHighlight.current) {
            if (previousHighlight.current.pmtId) {
              console.log('Clearing PMT hover:', previousHighlight.current.pmtId);
              map.current.setFeatureState(
                { 
                  source: 'pmt-boundaries',
                  id: previousHighlight.current.pmtId 
                },
                { hover: false }
              );
            }
            if (previousHighlight.current.subdivisionId) {
              console.log('Clearing Subdivision hover:', previousHighlight.current.subdivisionId);
              map.current.setFeatureState(
                { 
                  source: 'subdivision-boundaries',
                  id: previousHighlight.current.subdivisionId 
                },
                { hover: false }
              );
            }
          }

          // Get IDs from the response if available, otherwise from features
          const pmtId = parsedResponse.poiInfo?.pmtId || pmtFeatures[0]?.id;
          const subdivisionId = parsedResponse.poiInfo?.subdivisionId || subdivisionFeatures[0]?.id;

          console.log('Setting feature states with IDs from response:', parsedResponse.poiInfo);
          console.log('Setting feature states with IDs from features:', { pmtId, subdivisionId });

          if (pmtId) {
            console.log('Setting PMT hover:', pmtId);
            map.current.setFeatureState(
              { 
                source: 'pmt-boundaries',
                id: pmtId 
              },
              { hover: true }
            );
          }

          if (subdivisionId) {
            console.log('Setting Subdivision hover:', subdivisionId);
            map.current.setFeatureState(
              { 
                source: 'subdivision-boundaries',
                id: subdivisionId 
              },
              { hover: true }
            );
          }

          previousHighlight.current = { pmtId, subdivisionId };

          // Show popup
          if (hoverPopup) {
            hoverPopup.remove();
          }

          const popup = new mapboxgl.Popup()
            .setLngLat(point)
            .setHTML(`
              <h3>${poi.properties.name || 'POI'}</h3>
              <p>${poi.properties.description || ''}</p>
            `)
            .addTo(map.current);

          setHoverPopup(popup);
        }
      }

      // Update UI with response
      const responseDiv = aiControlRef.current?.querySelector('.ai-response');
      if (responseDiv) {
        responseDiv.style.display = 'block';
        responseDiv.innerHTML = `
          <div class="previous-query">${prompt}</div>
          <div style="margin-top: 8px">${parsedResponse?.explanation || explanation}</div>
        `;
      }

      // Handle follow-up suggestions
      if (parsedResponse?.followUpSuggestions) {
        const suggestionsContainer = aiControlRef.current?.querySelector('.follow-up-suggestions');
        if (suggestionsContainer) {
          suggestionsContainer.innerHTML = parsedResponse.followUpSuggestions
            .map(suggestion => `
              <button class="follow-up-suggestion" 
                      data-prompt="${encodeURIComponent(suggestion.prompt)}">
                ${suggestion.text}
              </button>
            `).join('');
          suggestionsContainer.style.display = 'block';

          // Add click handlers for follow-up suggestions
          const suggestionButtons = suggestionsContainer.querySelectorAll('.follow-up-suggestion');
          suggestionButtons.forEach(button => {
            button.addEventListener('click', () => {
              const prompt = decodeURIComponent(button.dataset.prompt);
              const input = aiControlRef.current?.querySelector('.ai-input');
              if (input) {
                input.value = prompt;
                aiControlRef.current?.querySelector('.ai-ask-button')?.click();
              }
            });
          });
        }
      }

      setAiResponse(parsedResponse?.explanation || explanation);
      return parsedResponse?.explanation || explanation;
    } catch (error) {
      console.error('AI query error:', error);
      const errorMessage = 'Error processing query. Please try again.';
      
      const responseDiv = aiControlRef.current?.querySelector('.ai-response');
      if (responseDiv) {
        responseDiv.style.display = 'block';
        responseDiv.innerHTML = `
          <div class="previous-query">${prompt}</div>
          <div style="margin-top: 8px">${errorMessage}</div>
        `;
      }
      
      return errorMessage;
    }
  }, [map, hoverPopup]);

  // Define createAIPanel inside the component
  const createAIPanel = useCallback(() => {
    console.log('Creating AI panel with example queries...');
    
    const panel = document.createElement('div');
    panel.className = 'ai-control';
    
    panel.innerHTML = `
      <div class="ai-panel">
        <div class="ai-content">
          <div class="ai-input-group">
            <input type="text" placeholder="Ask about the map..." class="ai-input"/>
            <button class="ai-ask-button">Ask</button>
          </div>
          <div class="ai-examples">
            ${EXAMPLE_QUERIES.map(query => `
              <div class="example-query">${query}</div>
            `).join('')}
          </div>
          <div class="ai-response" style="display: none"></div>
          <div class="follow-up-suggestions" style="display: none"></div>
        </div>
      </div>
    `;

    // Add styles
    const styles = document.createElement('style');
    styles.textContent = `
      .ai-control {
        position: absolute;
        top: 0;
        left: 0;
        bottom: auto;
        width: 360px;
        background: #1a1a1a;
        z-index: 2000;
        max-height: 80vh;
        overflow-y: auto;
        border-bottom-right-radius: 12px;
      }

      .ai-panel {
        padding: 20px;
      }

      .ai-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .ai-input-group {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
      }

      .ai-input {
        flex: 1;
        padding: 12px;
        background: #2d2d2d;
        border: none;
        border-radius: 6px;
        color: #ffffff;
        font-size: 14px;
        min-width: 0; /* Allows flex shrinking */
      }

      .ai-ask-button {
        padding: 12px 24px;
        background: #0097fb;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        transition: background 0.2s;
      }

      .ai-ask-button:hover {
        background: #0088e1;
      }

      .example-query {
        padding: 8px 12px;
        margin: 2px 0;
        background: #2d2d2d;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        color: #0097fb;
        transition: background 0.2s;
      }

      .example-query:hover {
        background: #333333;
      }

      .ai-response {
        padding: 12px;
        background: #2d2d2d;
        border-radius: 6px;
        font-size: 14px;
        line-height: 1.4;
      }

      .previous-query {
        color: #888888;
      }

      .follow-up-suggestion {
        padding: 8px 12px;
        margin: 2px 0;
        background: #2d2d2d;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        color: #0097fb;
        transition: background 0.2s;
        text-align: left;
        width: 100%;
        border: none;
      }

      .follow-up-suggestion:hover {
        background: #333333;
      }
    `;
    document.head.appendChild(styles);

    // Update handleAIQuery success case to include follow-ups
    const handleResponse = async (prompt) => {
      const responseDiv = panel.querySelector('.ai-response');
      responseDiv.style.display = 'block';
      responseDiv.textContent = 'Analyzing...';
      
      try {
        const result = await handleAIQuery(prompt);
        responseDiv.textContent = result;
      } catch (error) {
        responseDiv.textContent = 'Error processing request. Please try again.';
      }
    };

    // Update click handlers to use new handleResponse
    const askButton = panel.querySelector('.ai-ask-button');
    askButton.addEventListener('click', async () => {
      const prompt = panel.querySelector('.ai-input').value.trim();
      if (prompt) {
        panel.querySelector('.ai-examples').style.display = 'none';
        handleResponse(prompt);
      }
    });

    // Update example clicks
    const examples = panel.querySelectorAll('.example-query');
    examples.forEach(example => {
      example.addEventListener('click', () => {
        const input = panel.querySelector('.ai-input');
        input.value = example.textContent || '';
        input.focus();
        askButton.click();
      });
    });

    // Handle Enter key
    panel.querySelector('.ai-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        askButton.click();
      }
    });

    return panel;
  }, [handleAIQuery]);

  // Mount panel and cleanup
  useEffect(() => {
    if (!map.current || aiControlRef.current) return;

    const panel = createAIPanel();
    document.body.appendChild(panel);
    aiControlRef.current = panel;

    return () => {
      if (aiControlRef.current) {
        aiControlRef.current.remove();
        aiControlRef.current = null;
      }
    };
  }, [map.current, createAIPanel]);

  useEffect(() => {
    if (map.current) return; // Already initialized
    
    // Clear the container first
    if (mapContainer.current) {
      mapContainer.current.innerHTML = '';
    }

    try {
      console.log('Initializing map with config:', MAP_CONFIG);
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: MAP_CONFIG.style,
        center: MAP_CONFIG.center,
        zoom: MAP_CONFIG.zoom,
        minZoom: MAP_CONFIG.minZoom,
        maxZoom: MAP_CONFIG.maxZoom
      });

      // Add legend
      const legend = document.createElement('div');
      legend.className = 'map-legend';
      legend.innerHTML = `
        <div class="legend-title">Building Energy Status</div>
        <div class="legend-item">
          <span class="legend-color" style="background: #51ff00"></span>
          <span>High-Performing Buildings</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: linear-gradient(to right, #8B7355, #f7db05)"></span>
          <span>Power Grid Connected</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #380614"></span>
          <span>Energy Inefficient</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #1a1a1a"></span>
          <span>Standard Buildings</span>
        </div>
      `;
      
      map.current.getContainer().appendChild(legend);

      map.current.on('load', () => {
        console.log('Map loaded - initializing layers');
        // Fit to Miami bounds
        map.current.fitBounds([
          [MIAMI_BOUNDS.west, MIAMI_BOUNDS.south],
          [MIAMI_BOUNDS.east, MIAMI_BOUNDS.north]
        ]);
        
        if (!map.current.isStyleLoaded()) {
          map.current.once('styledata', initializeLayers);
        } else {
          initializeLayers();
        }
      });

      map.current.on('error', (e) => {
        console.error('MapComponent: Map error:', e);
      });

    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const initializeLayers = useCallback(async () => {
    try {
      console.log('Starting layer initialization');
      
      // Add 3D buildings layer
      if (!map.current.getLayer('3d-buildings')) {
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
              ['boolean', ['feature-state', 'isHighlighted'], false],
              '#00A5FF',  // Bright blue for highlighted building
              ['boolean', ['feature-state', 'isGreen'], false],
              BUILDING_COLORS.BRIGHT_GREEN,
              ['boolean', ['feature-state', 'inPowerGrid'], false],
              [
                'interpolate',
                ['linear'],
                ['feature-state', 'yellowIntensity'],
                0, BUILDING_COLORS.YELLOW_FAR,
                0.5, BUILDING_COLORS.YELLOW_MID,
                1, BUILDING_COLORS.YELLOW_CLOSE
              ],
              ['boolean', ['feature-state', 'isNegative'], false],
              BUILDING_COLORS.DARK_RED,
              BUILDING_COLORS.DARK_GRAY
            ],
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15, 0,
              15.05, ['get', 'height']
            ],
            'fill-extrusion-opacity': 0.9
          }
        });

        // Add POI layer from Mapbox tiles
        console.log('Adding POI layer...');

        try {
          // First remove the default POI layer if it exists
          if (map.current.getLayer('poi-label')) {
            map.current.removeLayer('poi-label');
          }

          map.current.addLayer({
            'id': 'miami-pois',
            'type': 'circle',
            'source': 'composite',
            'source-layer': 'poi_label',
            'minzoom': 0,
            'maxzoom': 22,
            'paint': {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 2,
                12, 4,
                16, 6
              ],
              'circle-color': [
                'match',
                ['get', 'type'],
                'Restaurant', '#ff9900',
                'Cafe', '#cc6600',
                'Bar', '#990099',
                'Fast Food', '#ff6600',
                'Shop', '#0066ff',
                'Grocery', '#00cc00',
                'Mall', '#3366ff',
                'Market', '#009933',
                'Museum', '#cc3300',
                'Theater', '#cc0066',
                'Cinema', '#990033',
                'Gallery', '#cc3366',
                'Park', '#33cc33',
                'Garden', '#339933',
                'Sports', '#3399ff',
                'Hotel', '#9933ff',
                'Bank', '#666699',
                'Post', '#666666',
                'School', '#ff3333',
                'Hospital', '#ff0000',
                '#999999'  // Default color for unmatched types
              ],
              'circle-stroke-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8, 0.5,
                12, 1,
                16, 1.5
              ],
              'circle-stroke-color': '#ffffff'
            }
          });

          // Debug available POI types
          setTimeout(() => {
            const features = map.current.querySourceFeatures('composite', {
              sourceLayer: 'poi_label'
            });
            console.log('Available POI types:', {
              count: features.length,
              types: [...new Set(features.map(f => f.properties.type))].sort(),
              categories: [...new Set(features.map(f => f.properties.category))].sort(),
              sampleFeature: features[0]
            });
          }, 2000);

        } catch (error) {
          console.error('Error adding POI layer:', error);
        }

        // Debug POI data with more details
        const debugPOIs = () => {
          const features = map.current.queryRenderedFeatures({ 
            layers: ['miami-pois'] 
          });
          console.log('POIs found:', {
            count: features.length,
            types: [...new Set(features.map(f => f.properties.type))],
            properties: features[0]?.properties,
            zoom: map.current.getZoom()
          });
        };

        // Check POIs after map is fully loaded
        map.current.once('idle', debugPOIs);
        setTimeout(debugPOIs, 2000);

        // Hover effect for subdivision highlighting
        map.current.on('mousemove', 'miami-pois', (e) => {
          if (!e.features[0]) {
            if (hoverPopup) {
              hoverPopup.remove();
              setHoverPopup(null);
            }
            return;
          }
          
          const point = e.point;
          
          if (hoverPopup) {
            hoverPopup.remove();
            setHoverPopup(null);
          }

          // Query both boundary layers
          const pmtFeatures = map.current.queryRenderedFeatures(
            point,
            { layers: ['pmt-density'] }
          );

          const subdivFeatures = map.current.queryRenderedFeatures(
            point,
            { layers: ['subdivision-density'] }
          );

          // Clear previous PMT highlight
          if (previouslyHighlightedPMT.current) {
            map.current.setFeatureState(
              {
                source: 'pmt-boundaries',
                id: previouslyHighlightedPMT.current
              },
              { isHighlighted: false }
            );
          }

          // Clear previous subdivision highlight
          if (previouslyHighlightedSubdivision.current) {
            map.current.setFeatureState(
              {
                source: 'subdivision-boundaries',
                id: previouslyHighlightedSubdivision.current
              },
              { hasSchool: false }
            );
          }

          // Set new PMT highlight
          if (pmtFeatures[0]) {
            previouslyHighlightedPMT.current = pmtFeatures[0].id;
            map.current.setFeatureState(
              {
                source: 'pmt-boundaries',
                id: pmtFeatures[0].id
              },
              { isHighlighted: true }
            );
          }

          // Set new subdivision highlight
          if (subdivFeatures[0]) {
            previouslyHighlightedSubdivision.current = subdivFeatures[0].id;
            map.current.setFeatureState(
              {
                source: 'subdivision-boundaries',
                id: subdivFeatures[0].id
              },
              { hasSchool: true }
            );
          }

          // Count POIs in each boundary
          let pmtPOICount = 0;
          let subdivPOICount = 0;

          if (pmtFeatures[0] || subdivFeatures[0]) {
            // Get all POIs in view
            const allPOIs = map.current.queryRenderedFeatures(
              undefined,
              { layers: ['miami-pois'] }
            );

            // Count POIs in PMT boundary
            if (pmtFeatures[0]) {
              pmtPOICount = allPOIs.filter(poi => {
                const poiPoint = poi.geometry.coordinates;
                return map.current.queryRenderedFeatures(
                  map.current.project(poiPoint),
                  { layers: ['pmt-density'] }
                ).some(f => f.id === pmtFeatures[0].id);
              }).length;
            }

            // Count POIs in Subdivision boundary
            if (subdivFeatures[0]) {
              subdivPOICount = allPOIs.filter(poi => {
                const poiPoint = poi.geometry.coordinates;
                return map.current.queryRenderedFeatures(
                  map.current.project(poiPoint),
                  { layers: ['subdivision-density'] }
                ).some(f => f.id === subdivFeatures[0].id);
              }).length;
            }

            const newPopup = new mapboxgl.Popup({
              closeButton: true,
              closeOnClick: true,
              closeOnMove: true,
              className: 'boundary-stats-popup',
              offset: [0, -5]
            })
              .setLngLat(e.lngLat)
              .setHTML(`
                <div class="boundary-stats" style="cursor: pointer;" onclick="this.parentElement.parentElement.remove()">
                  ${pmtFeatures[0] ? `
                    <div class="pmt-stats">
                      <span class="stat-label">Census Tract POIs:</span>
                      <span class="stat-value">${pmtPOICount}</span>
                    </div>
                  ` : ''}
                  ${subdivFeatures[0] ? `
                    <div class="subdiv-stats">
                      <span class="stat-label">Local Area POIs:</span>
                      <span class="stat-value">${subdivPOICount}</span>
                    </div>
                  ` : ''}
                </div>
              `)
              .addTo(map.current);

            // Add click handler to the popup
            newPopup.on('close', () => {
              setHoverPopup(null);
            });

            setHoverPopup(newPopup);
          }
        });

        // Add a more aggressive mouseleave handler
        map.current.on('mouseleave', 'miami-pois', () => {
          if (hoverPopup) {
            hoverPopup.remove();
            setHoverPopup(null);
          }
        });

        // Add a general map move handler to ensure popup is removed
        map.current.on('move', () => {
          if (hoverPopup) {
            hoverPopup.remove();
            setHoverPopup(null);
          }
        });

        // Click event for showing POI details
        map.current.on('click', 'miami-pois', (e) => {
          if (!e.features[0]) return;
          
          const poiCoordinates = e.features[0].geometry.coordinates;
          const properties = e.features[0].properties;

          // Show detailed popup on click
          new mapboxgl.Popup()
            .setLngLat(poiCoordinates)
            .setHTML(`
              <div class="poi-popup-title">${properties.name || 'Unnamed Location'}</div>
              <div class="poi-popup-detail">
                <div>${properties.type || 'Business'}</div>
                ${properties.address ? `<div>${properties.address}</div>` : ''}
                ${properties.phone ? `<div>${properties.phone}</div>` : ''}
                ${properties.website ? `<a href="${properties.website}" target="_blank">Website</a>` : ''}
              </div>
            `)
            .addTo(map.current);
        });

        // Add the update building colors functionality
        const updateBuildingColors = () => {
          const bounds = map.current.getBounds();
          const features = map.current.queryRenderedFeatures(
            undefined,
            { layers: ['3d-buildings'] }
          );

          const greenBuildingCoordinates = [];

          features.forEach(building => {
            if (!building.geometry || !building.geometry.coordinates) return;

            const buildingId = building.id;
            if (!buildingId) return;

            if (!buildingStates.current.has(buildingId)) {
              const height = building.properties.height || 0;
              const area = calculateBuildingArea(building.geometry.coordinates[0]);
              
              let isInPowerGrid = false;
              let isNegative = false;
              let isGreen = false;
              let yellowIntensity = 0;

              // Check if it's a green building
              if (height > 10 && height % 4 === 0) {
                isGreen = true;
                if (building.geometry.coordinates[0]) {
                  greenBuildingCoordinates.push(building.geometry.coordinates[0][0]);
                }
              }

              // Only check power grid and negative if not green
              if (!isGreen) {
                const shouldCheckPowerGrid = Math.random() > 0.55 || 
                  (height > 30 && area > 1000 && Math.random() > 0.3);

                if (shouldCheckPowerGrid) {
                  const centroid = building.geometry.coordinates[0][0];
                  
                  for (const location of POWER_SUBSTATIONS_MIAMI) {
                    const coords = location.coordinates;
                    const distance = Math.sqrt(
                      Math.pow(centroid[0] - coords[0], 2) + 
                      Math.pow(centroid[1] - coords[1], 2)
                    );

                    if (distance < MAP_CONFIG.BUILDING_POWER_GRID_RADIUS) {
                      isInPowerGrid = true;
                      yellowIntensity = Math.max(0, 1 - (distance * 500));
                      break;
                    }
                  }
                }

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

        // Call updateBuildingColors initially and on map events
        map.current.on('moveend', updateBuildingColors);
        map.current.on('zoomend', updateBuildingColors);
        updateBuildingColors();

        // Add POI density layer
        const createPOIDensityLayers = async () => {
          try {
            // Load both GeoJSON files
            const [snapResponse, subdivResponse] = await Promise.all([
              fetch('/PMT_Snapshot_feat_Service_2649843124464894629.geojson'),
              fetch('/Subdivision_Boundary.geojson')
            ]);
            
            const snapData = await snapResponse.json();
            const subdivData = await subdivResponse.json();

            // Add first source (PMT Snapshot)
            map.current.addSource('pmt-boundaries', {
              type: 'geojson',
              data: snapData,
              generateId: true
            });

            // Add second source (Subdivision)
            map.current.addSource('subdivision-boundaries', {
              type: 'geojson',
              data: subdivData,
              generateId: true
            });

            // Add PMT layer
            map.current.addLayer({
              'id': 'pmt-density',
              'type': 'fill',
              'source': 'pmt-boundaries',
              'paint': {
                'fill-color': [
                  'case',
                  ['boolean', ['feature-state', 'isHighlighted'], false],
                  '#ff0000',  // Red for PMT highlights
                  'rgba(0, 0, 0, 0)'  // Transparent by default
                ],
                'fill-opacity': [
                  'case',
                  ['boolean', ['feature-state', 'isHighlighted'], false],
                  0.3,  // Opacity when highlighted
                  0     // Transparent by default
                ]
              }
            });

            // Add Subdivision layer
            map.current.addLayer({
              'id': 'subdivision-density',
              'type': 'fill',
              'source': 'subdivision-boundaries',
              'paint': {
                'fill-color': [
                  'case',
                  ['boolean', ['feature-state', 'hasSchool'], false],
                  '#0066ff',  // Blue for subdivision highlights
                  'rgba(0, 0, 0, 0)'  // Transparent by default
                ],
                'fill-opacity': [
                  'case',
                  ['boolean', ['feature-state', 'hasSchool'], false],
                  0.3,  // Opacity when highlighted
                  0     // Transparent by default
                ]
              }
            });

            // Update hover handler to highlight both layers
            map.current.on('mousemove', 'miami-pois', (e) => {
              if (!e.features[0]) return;
              
              const point = e.point;
              
              // Query both layers
              const pmtFeatures = map.current.queryRenderedFeatures(
                point,
                { layers: ['pmt-density'] }
              );

              const subdivFeatures = map.current.queryRenderedFeatures(
                point,
                { layers: ['subdivision-density'] }
              );

              // Clear previous PMT highlight
              if (previouslyHighlightedPMT.current) {
                map.current.setFeatureState(
                  {
                    source: 'pmt-boundaries',
                    id: previouslyHighlightedPMT.current
                  },
                  { isHighlighted: false }
                );
              }

              // Clear previous subdivision highlight
              if (previouslyHighlightedSubdivision.current) {
                map.current.setFeatureState(
                  {
                    source: 'subdivision-boundaries',
                    id: previouslyHighlightedSubdivision.current
                  },
                  { hasSchool: false }
                );
              }

              // Set new PMT highlight
              if (pmtFeatures[0]) {
                previouslyHighlightedPMT.current = pmtFeatures[0].id;
                map.current.setFeatureState(
                  {
                    source: 'pmt-boundaries',
                    id: pmtFeatures[0].id
                  },
                  { isHighlighted: true }
                );
              }

              // Set new subdivision highlight
              if (subdivFeatures[0]) {
                previouslyHighlightedSubdivision.current = subdivFeatures[0].id;
                map.current.setFeatureState(
                  {
                    source: 'subdivision-boundaries',
                    id: subdivFeatures[0].id
                  },
                  { hasSchool: true }
                );
              }
            });

            // Update mouseleave to clear both highlights
            map.current.on('mouseleave', 'miami-pois', () => {
              if (previouslyHighlightedPMT.current) {
                map.current.setFeatureState(
                  {
                    source: 'pmt-boundaries',
                    id: previouslyHighlightedPMT.current
                  },
                  { isHighlighted: false }
                );
                previouslyHighlightedPMT.current = null;
              }

              if (previouslyHighlightedSubdivision.current) {
                map.current.setFeatureState(
                  {
                    source: 'subdivision-boundaries',
                    id: previouslyHighlightedSubdivision.current
                  },
                  { hasSchool: false }
                );
                previouslyHighlightedSubdivision.current = null;
              }
            });

          } catch (error) {
            console.error('Error creating density layers:', error);
          }
        };

        // Call this after adding POI layer
        createPOIDensityLayers();

      }

      // Initialize power grid
      initializePowerGrid(map.current);

      // Initialize particle system
      initializeParticleLayers(map.current);
      
      // Start animation loop
      const animate = () => {
        animateParticles({ 
          map: map.current, 
          frameCount: frameCount.current, 
          lastAnimationTime, 
          animationFrame 
        });
        frameCount.current++;
        animationFrame.current = requestAnimationFrame(animate);
      };

      // Start animation after a short delay
      setTimeout(() => {
        console.log('Starting animation loop');
        animate();
      }, 1000);
      
      console.log('All layers initialized');
    } catch (error) {
      console.error('Error initializing layers:', error);
    }
  }, []);

  // Animation visibility effect
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isAnimating.current) {
          console.log('Starting particle animation');
          isAnimating.current = true;
          initializeLayers();
        } else if (!entry.isIntersecting && isAnimating.current) {
          console.log('Stopping particle animation');
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
  }, [initializeLayers]);

  // Add styles
  const style = document.createElement('style');
  document.head.appendChild(style);
  style.textContent += `
    .map-legend {
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      padding: 15px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      color: white;
      z-index: 1;
    }

    .legend-title {
      font-weight: bold;
      margin-bottom: 10px;
      font-size: 14px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      margin: 5px 0;
      font-size: 12px;
    }

    .legend-color {
      width: 20px;
      height: 20px;
      margin-right: 10px;
      border-radius: 3px;
    }

    .boundary-stats-popup .mapboxgl-popup-content {
      background: rgba(0, 0, 0, 0.8) !important;
      color: white;
      padding: 10px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
    }
    .boundary-stats-popup .mapboxgl-popup-close-button {
      color: white;
      font-size: 16px;
      padding: 4px 8px;
      right: 0;
      top: 0;
    }
    .boundary-stats-popup .mapboxgl-popup-close-button:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }
    .boundary-stats {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .pmt-stats {
      color: #ff6666;
    }
    .subdiv-stats {
      color: #6699ff;
    }
    .stat-label {
      margin-right: 5px;
    }
    .stat-value {
      font-weight: bold;
    }
  `;

  // Add new method for AI navigation
  const initializeAIAnalysis = useCallback(async () => {
    if (!map.current) {
      console.error('Map not initialized');
      return;
    }
    
    console.log('Initializing AI analysis...'); // Debug log
    
    try {
      const censusData = await analyzeCensusData();
      console.log('Census data loaded:', censusData ? 'yes' : 'no');
      
      const navigator = new AINavigator({
        map: map.current,
        censusData,
        onUpdate: (newSource) => {
          console.log('Updating map source...'); // Debug log
          if (map.current.getSource('buildings')) {
            map.current.getSource('buildings').setData(newSource);
          }
        }
      });
      
      setAiNavigator(navigator);
      console.log('AI Navigator set');
    } catch (error) {
      console.error('Error initializing AI:', error);
    }
  }, [map]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (hoverPopup) {
        hoverPopup.remove();
        setHoverPopup(null);
      }
    };
  }, [hoverPopup]);

  return (
    <div id="map-container">
      <div 
        ref={mapContainer} 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }} 
      />
    </div>
  );
};

export default MapComponent;
