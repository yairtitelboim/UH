import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAP_CONFIG } from './constants';
import { askClaude, parseClaudeResponse, LOADING_STEPS } from '../../services/claude';
import styled from 'styled-components';
import AIChatPanel from './AIChatPanel';
import { useAIConsensusAnimation } from './hooks/useAIConsensusAnimation';
import { 
    highlightPOIBuildings,
    initializeRoadGrid,
    animateRoadGrid,
    stopRoadAnimation
} from './utils';
import { 
    initializeRoadParticles,
    animateRoadParticles,
    stopRoadParticles
} from './hooks/mapAnimations';
import { createErcotPopup } from './intel';
import * as turf from '@turf/turf';

// Set mapbox access token
mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const MapContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;

  .callout-annotation {
    cursor: default;
    
    &:hover {
      z-index: 2;
    }
  }

  .mapboxgl-marker {
    z-index: 1;
  }

  .custom-popup .mapboxgl-popup-content {
    background: none;
    padding: 0;
    border: none;
    box-shadow: none;
  }

  .custom-popup .mapboxgl-popup-close-button {
    color: white;
    font-size: 16px;
    padding: 4px 8px;
    right: 4px;
    top: 4px;
  }

  .custom-popup .mapboxgl-popup-tip {
    display: none;
  }

  /* Add custom styling for all popups */
  .mapboxgl-popup {
    z-index: 3;
  }

  .mapboxgl-popup-content {
    background: rgba(0, 0, 0, 0.85) !important;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px !important;
    padding: 16px !important;
    color: white !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
    backdrop-filter: blur(8px);
  }

  .mapboxgl-popup-tip {
    display: none;
  }

  .mapboxgl-popup-close-button {
    color: rgba(255, 255, 255, 0.6) !important;
    font-size: 18px !important;
    padding: 8px !important;
    right: 4px !important;
    top: 4px !important;
    
    &:hover {
      color: white !important;
      background: none !important;
    }
  }

  /* Specific styles for flood analysis popup */
  .flood-analysis-popup .mapboxgl-popup-content {
    background: rgba(0, 0, 0, 0.9) !important;
    border-color: rgba(77, 212, 172, 0.2) !important;
  }

  /* Specific styles for AI consensus popup */
  .ai-consensus-popup .mapboxgl-popup-content {
    background: rgba(0, 0, 0, 0.9) !important;
    border-color: rgba(255, 152, 0, 0.2) !important;
  }
`;

const LayerToggleContainer = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  padding: 10px;
  border-radius: 4px;
  z-index: 1;
  transition: transform 0.3s ease;
  transform: translateX(${props => props.$isCollapsed ? 'calc(100% + 10px)' : '0'});
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const LayerCollapseButton = styled.div`
  position: absolute;
  left: -32px;
  top: 10px;
  width: 32px;
  height: 32px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2;

  svg {
    width: 24px;
    height: 24px;
    fill: white;
    transform: rotate(${props => props.$isCollapsed ? '180deg' : '0deg'});
    transition: transform 0.3s ease;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.9);
  }
`;

const ToggleButton = styled.button`
  padding: 8px 12px;
  background: ${props => props.active ? '#2196F3' : '#666'};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 150px;
  text-align: left;
  transition: all 0.3s ease;

  &:hover {
    background: ${props => props.active ? '#1976D2' : '#777'};
  }
`;

// Mock data for AI disagreement - spread across different areas
const mockDisagreementData = {
  '77002': { // Downtown
    disagreement: 0.9,
    models: {
      'Model A': 12.5,
      'Model B': 8.2,
      'Model C': 15.1,
      'Model D': 9.8
    },
    confidence_range: '8.2-15.1 ft',
    primary_concern: 'Urban drainage capacity'
  },
  '77026': { // North
    disagreement: 0.85,
    models: {
      'Model A': 14.2,
      'Model B': 9.5,
      'Model C': 16.8,
      'Model D': 11.3
    },
    confidence_range: '9.5-16.8 ft',
    primary_concern: 'Bayou overflow risk'
  },
  '77087': { // Southeast
    disagreement: 0.95,
    models: {
      'Model A': 16.7,
      'Model B': 10.8,
      'Model C': 19.2,
      'Model D': 13.5
    },
    confidence_range: '10.8-19.2 ft',
    primary_concern: 'Multiple flood sources'
  },
  '77045': { // Southwest
    disagreement: 0.8,
    models: {
      'Model A': 11.3,
      'Model B': 7.8,
      'Model C': 13.9,
      'Model D': 9.2
    },
    confidence_range: '7.8-13.9 ft',
    primary_concern: 'Infrastructure limitations'
  },
  '77091': { // Northwest
    disagreement: 0.88,
    models: {
      'Model A': 13.6,
      'Model B': 9.1,
      'Model C': 15.8,
      'Model D': 10.7
    },
    confidence_range: '9.1-15.8 ft',
    primary_concern: 'Drainage system capacity'
  },
  '77015': { // East
    disagreement: 0.92,
    models: {
      'Model A': 15.4,
      'Model B': 10.2,
      'Model C': 17.9,
      'Model D': 12.6
    },
    confidence_range: '10.2-17.9 ft',
    primary_concern: 'Industrial area flooding'
  },
  '77062': { // Southeast/Clear Lake
    disagreement: 0.87,
    models: {
      'Model A': 12.8,
      'Model B': 8.5,
      'Model C': 14.7,
      'Model D': 10.1
    },
    confidence_range: '8.5-14.7 ft',
    primary_concern: 'Coastal surge impact'
  },
  '77040': { // Northwest
    disagreement: 0.83,
    models: {
      'Model A': 11.9,
      'Model B': 8.1,
      'Model C': 13.8,
      'Model D': 9.4
    },
    confidence_range: '8.1-13.8 ft',
    primary_concern: 'Creek overflow risk'
  }
};

const MapComponent = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const roadAnimationFrame = useRef(null);
  
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  const [inputValue, setInputValue] = useState('');
  const [isErcotMode, setIsErcotMode] = useState(false);
  const [showRoadGrid, setShowRoadGrid] = useState(false);
  const [showRoadParticles, setShowRoadParticles] = useState(true);
  const roadParticleAnimation = useRef(null);
  const [showMUDLayer, setShowMUDLayer] = useState(false);
  const [mapBounds, setMapBounds] = useState(null);
  const [showHarveyData, setShowHarveyData] = useState(false);
  const [showSurfaceWater, setShowSurfaceWater] = useState(false);
  const [showWastewaterOutfalls, setShowWastewaterOutfalls] = useState(false);
  const [showZipCodes, setShowZipCodes] = useState(false);
  const [showZipFloodAnalysis, setShowZipFloodAnalysis] = useState(false);
  const [showWaterwayBuffer, setShowWaterwayBuffer] = useState(false);
  const [isLayerMenuCollapsed, setIsLayerMenuCollapsed] = useState(false);
  const [showAIConsensus, setShowAIConsensus] = useState(false);
  const [activePopupType, setActivePopupType] = useState(null);
  const [currentPopup, setCurrentPopup] = useState(null);

  // Add these refs for drag functionality
  const isDraggingRef = useRef(false);
  const currentXRef = useRef(0);
  const currentYRef = useRef(0);
  const initialXRef = useRef(0);
  const initialYRef = useRef(0);
  const xOffsetRef = useRef(0);
  const yOffsetRef = useRef(0);
  const popupRef = useRef(null);

  const { initializeParticleLayer, generateParticles } = useAIConsensusAnimation(map, showAIConsensus, mockDisagreementData);

  useEffect(() => {
    if (map.current) {
      if (showRoadGrid) {
        initializeRoadGrid(map.current, {
          minzoom: 5,
          maxzoom: 22
        });
      } else {
        if (map.current.getLayer('road-grid')) {
          map.current.removeLayer('road-grid');
        }
      }
    }
  }, [showRoadGrid]);

  useEffect(() => {
    if (!map.current) return;

    const initializeParticles = async () => {
      try {
        // Wait for style to fully load
        if (!map.current.isStyleLoaded()) {
          await new Promise(resolve => {
            map.current.once('style.load', resolve);
          });
        }

        // Add a small delay to ensure all layers are available
        await new Promise(resolve => setTimeout(resolve, 500));

        if (showRoadParticles) {
          console.log('Starting road particles animation...');
          initializeRoadParticles(map.current);
          roadParticleAnimation.current = animateRoadParticles({ map: map.current });
        } else {
          if (roadParticleAnimation.current) {
            stopRoadParticles(map.current);
            cancelAnimationFrame(roadParticleAnimation.current);
            roadParticleAnimation.current = null;
          }
        }
      } catch (error) {
        console.error('Failed to initialize road particles:', error);
      }
    };

    // Initialize when map is ready
    if (map.current.loaded()) {
      initializeParticles();
    } else {
      map.current.once('load', initializeParticles);
    }

    return () => {
      if (roadParticleAnimation.current) {
        cancelAnimationFrame(roadParticleAnimation.current);
        roadParticleAnimation.current = null;
      }
    };
  }, [showRoadParticles]);

  const handleQuestion = async (question) => {
    setIsLoading(true);
    setMessages(prev => [...prev, { isUser: true, content: question }]);

    try {
      const bounds = map.current.getBounds();
      const mapBounds = {
        sw: bounds.getSouthWest(),
        ne: bounds.getNorthEast()
      };

      const response = await askClaude(question, {}, mapBounds);
      const parsedResponse = parseClaudeResponse(response);

      if (parsedResponse.mainText !== "Could not process the response. Please try again.") {
        setMessages(prev => [...prev, {
          isUser: false,
          content: parsedResponse
        }]);
        
        handleLLMResponse(parsedResponse);
      } else {
        throw new Error('Failed to parse response');
      }
    } catch (error) {
      console.error('Error in handleQuestion:', error);
      setMessages(prev => [...prev, {
        isUser: false,
        content: {
          mainText: "I apologize, but I encountered an error processing your request. Please try asking your question again.",
          poiInfo: null,
          followUps: []
        }
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_CONFIG.style,
      center: MAP_CONFIG.center,
      zoom: 1,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      pitch: 0
    });

    // Add water styling when the style loads
    map.current.on('style.load', async () => {
      // Wait for style to be fully loaded
      await new Promise(resolve => {
        if (map.current.isStyleLoaded()) {
          resolve();
        } else {
          map.current.once('styledata', resolve);
        }
      });

      // Style water in the base map layers
      const waterLayers = [
        'water',
        'water-shadow',
        'waterway',
        'water-depth',
        'water-pattern'
      ];

      waterLayers.forEach(layerId => {
        if (!map.current.getLayer(layerId)) return;

        try {
          const layer = map.current.getLayer(layerId);
          if (!layer) return;

          // Handle fill layers
          if (layer.type === 'fill') {
            map.current.setPaintProperty(layerId, 'fill-color', '#0088cc');
            map.current.setPaintProperty(layerId, 'fill-opacity', 0.8);
          }
          
          // Handle line layers
          if (layer.type === 'line') {
            map.current.setPaintProperty(layerId, 'line-color', '#0088cc');
            map.current.setPaintProperty(layerId, 'line-opacity', 0.8);
          }
        } catch (error) {
          console.warn(`Could not style water layer ${layerId}:`, error);
        }
      });

      // Create waterway buffer after styling water layers
      createWaterwayBuffer();

      // Style parks and green areas
      const parkLayers = [
        'landuse',
        'park',
        'park-label',
        'national-park',
        'natural',
        'golf-course',
        'pitch',
        'grass'
      ];

      parkLayers.forEach(layerId => {
        if (!map.current.getLayer(layerId)) return;

        try {
          const layer = map.current.getLayer(layerId);
          if (!layer) return;

          if (layer.type === 'fill') {
            map.current.setPaintProperty(layerId, 'fill-color', '#3a9688');
            map.current.setPaintProperty(layerId, 'fill-opacity', 0.4);
          }
          if (layer.type === 'symbol' && map.current.getPaintProperty(layerId, 'background-color') !== undefined) {
            map.current.setPaintProperty(layerId, 'background-color', '#3a9688');
          }
        } catch (error) {
          console.warn(`Could not style park layer ${layerId}:`, error);
        }
      });
    });

    const initializeMapLayers = async () => {
      try {
        if (!map.current.isStyleLoaded()) {
          await new Promise(resolve => map.current.once('style.load', resolve));
        }

        // Load census blocks
        const censusResponse = await fetch('/houston-census-blocks.geojson');
        const censusData = await censusResponse.json();
        
        map.current.addSource('census-blocks', {
          type: 'geojson',
          data: censusData
        });

        // Add census blocks layer - initially hidden
        map.current.addLayer({
          'id': 'census-blocks',
          'type': 'fill',
          'source': 'census-blocks',
          'paint': {
            'fill-color': '#FF0000',
            'fill-opacity': 0.4,
            'fill-outline-color': '#000000'
          },
          'layout': {
            'visibility': 'none'  // Start with layer hidden
          }
        });

        // Load our custom OSM building data
        const buildingsResponse = await fetch('/houston_buildings.geojson');
        const buildingsData = await buildingsResponse.json();
        
        map.current.addSource('custom-buildings', {
          type: 'geojson',
          data: buildingsData
        });

        // Add OSM buildings layer
        map.current.addLayer({
          'id': 'osm-buildings',
          'source': 'custom-buildings',
          'type': 'fill-extrusion',
          'minzoom': 0,
          'paint': {
            'fill-extrusion-color': '#1c1c1c',
            'fill-extrusion-height': [
              'case',
              ['has', 'height'],
              ['get', 'height'],
              50  // Default height if no height data
            ],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 1,
            'fill-extrusion-vertical-gradient': true,
            'fill-extrusion-ambient-occlusion-intensity': 0.6,
            'fill-extrusion-ambient-occlusion-radius': 3
          }
        });

        // Add Mapbox 3D buildings layer
        map.current.addLayer({
          'id': 'mapbox-buildings',
          'source': 'composite',
          'source-layer': 'building',
          'filter': ['==', 'extrude', 'true'],
          'type': 'fill-extrusion',
          'minzoom': 12,
          'paint': {
            'fill-extrusion-color': '#1c1c1c',
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
            'fill-extrusion-opacity': 1
          }
        });

        // Add click handler
        map.current.on('click', 'census-blocks', (e) => {
          if (!e.features?.length) return;
          
          const feature = e.features[0];
          const clickedId = feature.properties.OBJECTID;
          
          console.log('Block clicked:', {
            id: clickedId,
            price: feature.properties.price,
            mw: feature.properties.mw,
            isErcotMode
          });

          // Update opacity for all blocks - clicked one stays full opacity, others dim
          map.current.setPaintProperty('census-blocks', 'fill-opacity', [
            'case',
            ['==', ['get', 'OBJECTID'], clickedId],
            0.7,  // Keep full opacity for clicked block
            0.3   // Dim other blocks
          ]);

          // Always show popup when we have ERCOT data
          if (feature.properties.price !== undefined && feature.properties.mw !== undefined) {
            // Remove existing popups
            const existingPopups = document.getElementsByClassName('mapboxgl-popup');
            Array.from(existingPopups).forEach(popup => popup.remove());

            // Create and add the popup
            createErcotPopup(feature, e.lngLat).addTo(map.current);
          }
        });

        // Add MUD layer source and layer
        map.current.addSource('mud-districts', {
          type: 'geojson',
          data: '/MUD.geojson'
        });

        map.current.addLayer({
          'id': 'mud-districts',
          'type': 'fill',
          'source': 'mud-districts',
          'paint': {
            'fill-color': '#0080ff',
            'fill-opacity': 0.9,
            'fill-outline-color': '#0066cc'
          },
          'layout': {
            'visibility': 'none'  // Start hidden
          }
        });

        // Add Surface Water layers
        const [
          surfaceWaterResponse,
          surfaceWaterIntakeResponse,
          smallTribalAreasResponse,
          smallAreasResponse,
          pwsReservoirResponse,
          waterwellGridResponse,
          wastewaterOutfallsResponse,
          zipCodesResponse
        ] = await Promise.all([
          fetch('/Surface_Water.geojson'),
          fetch('/Surface_Water_Intake.geojson'),
          fetch('/small_tribal_areas.geojson'),
          fetch('/small_areas.geojson'),
          fetch('/PWS_Reservoir.geojson'),
          fetch('/Waterwell_Grid.geojson'),
          fetch('/Wastewater_Outfalls.geojson'),
          fetch('/COH_ZIPCODES.geojson')
        ]);
        
        const [
          surfaceWaterData,
          surfaceWaterIntakeData,
          smallTribalAreasData,
          smallAreasData,
          pwsReservoirData,
          waterwellGridData,
          wastewaterOutfallsData,
          zipCodesData
        ] = await Promise.all([
          surfaceWaterResponse.json(),
          surfaceWaterIntakeResponse.json(),
          smallTribalAreasResponse.json(),
          smallAreasResponse.json(),
          pwsReservoirResponse.json(),
          waterwellGridResponse.json(),
          wastewaterOutfallsResponse.json(),
          zipCodesResponse.json()
        ]);
        
        // Add all sources
        const sources = {
          'surface-water': surfaceWaterData,
          'surface-water-intake': surfaceWaterIntakeData,
          'small-tribal-areas': smallTribalAreasData,
          'small-areas': smallAreasData,
          'pws-reservoir': pwsReservoirData,
          'waterwell-grid': waterwellGridData,
          'wastewater-outfalls': wastewaterOutfallsData,
          'zipcodes': zipCodesData
        };

        Object.entries(sources).forEach(([id, data]) => {
          map.current.addSource(id, {
            type: 'geojson',
            data: data
          });
        });

        // Add Surface Water layer (main water bodies)
        map.current.addLayer({
          'id': 'surface-water',
          'type': 'fill',
          'source': 'surface-water',
          'paint': {
            'fill-color': '#00ffff',
            'fill-opacity': 0.9,
            'fill-outline-color': '#0088cc'
          },
          'layout': {
            'visibility': 'none'
          }
        });

        // Add Surface Water Intake points
        map.current.addLayer({
          'id': 'surface-water-intake',
          'type': 'circle',
          'source': 'surface-water-intake',
          'paint': {
            'circle-radius': 6,
            'circle-color': '#0088cc',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          },
          'layout': {
            'visibility': 'none'
          }
        });

        // Add Small Tribal Areas
        map.current.addLayer({
          'id': 'small-tribal-areas',
          'type': 'fill',
          'source': 'small-tribal-areas',
          'paint': {
            'fill-color': '#80cbc4',
            'fill-opacity': 0.3,
            'fill-outline-color': '#4db6ac'
          },
          'layout': {
            'visibility': 'none'
          }
        });

        // Add Small Areas
        map.current.addLayer({
          'id': 'small-areas',
          'type': 'fill',
          'source': 'small-areas',
          'paint': {
            'fill-color': '#90caf9',
            'fill-opacity': 0.3,
            'fill-outline-color': '#42a5f5'
          },
          'layout': {
            'visibility': 'none'
          }
        });

        // Add PWS Reservoir
        map.current.addLayer({
          'id': 'pws-reservoir',
          'type': 'fill',
          'source': 'pws-reservoir',
          'paint': {
            'fill-color': '#4dd0e1',
            'fill-opacity': 0.5,
            'fill-outline-color': '#00acc1'
          },
          'layout': {
            'visibility': 'none'
          }
        });

        // Add Waterwell Grid
        map.current.addLayer({
          'id': 'waterwell-grid',
          'type': 'circle',
          'source': 'waterwell-grid',
          'paint': {
            'circle-radius': 4,
            'circle-color': '#0277bd',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff'
          },
          'layout': {
            'visibility': 'none'
          }
        });

        // Add Wastewater Outfalls
        map.current.addLayer({
          'id': 'wastewater-outfalls',
          'type': 'circle',
          'source': 'wastewater-outfalls',
          'paint': {
            'circle-radius': 3,
            'circle-color': '#7b1fa2',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.8
          },
          'layout': {
            'visibility': 'none'
          }
        });

        // Add ZIP Codes layer
        map.current.addLayer({
          'id': 'zipcodes',
          'type': 'line',
          'source': 'zipcodes',
          'paint': {
            'line-color': '#666666',
            'line-width': 1,
            'line-opacity': 0.6
          },
          'layout': {
            'visibility': 'none'
          }
        });

        // Add ZIP Codes Flood Analysis layer
        map.current.addLayer({
          'id': 'zipcode-flood-analysis',
          'type': 'fill',
          'source': 'zipcodes',
          'paint': {
            'fill-color': [
              'case',
              ['has', 'flood_height'],
              [
                'interpolate',
                ['linear'],
                ['get', 'flood_height'],
                0, '#f7fbff',    // Very light blue for lowest heights
                2, '#9ecae1',    // Light blue
                4, '#4292c6',    // Medium blue
                6, '#2171b5',    // Deep blue
                8, '#084594'     // Very dark blue for highest heights
              ],
              '#404040'  // Dark gray for ZIP codes without measurements
            ],
            'fill-opacity': [
              'case',
              ['has', 'flood_height'],
              0.6,  // Changed from 0.7 to 0.5 for ZIP codes with flood data
              0.1   // Keep 0.1 for ZIP codes without measurements
            ]
          },
          'layout': {
            'visibility': 'none'
          }
        });

        // Add hover effects and popups for point layers
        const pointLayers = ['surface-water-intake', 'waterwell-grid', 'wastewater-outfalls'];
        
        pointLayers.forEach(layerId => {
          // Add hover effect
          map.current.on('mouseenter', layerId, () => {
            map.current.getCanvas().style.cursor = 'pointer';
          });

          map.current.on('mouseleave', layerId, () => {
            map.current.getCanvas().style.cursor = '';
          });

          // Add click handler for popup
          map.current.on('click', layerId, (e) => {
            if (!e.features?.length) return;
            
            const feature = e.features[0];
            const props = feature.properties;
            
            // Remove existing popups
            const existingPopups = document.getElementsByClassName('mapboxgl-popup');
            Array.from(existingPopups).forEach(popup => popup.remove());
            
            // Create HTML content from properties
            const htmlContent = Object.entries(props)
              .map(([key, value]) => {
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return `<strong>${formattedKey}:</strong> ${value || 'N/A'}`;
              })
              .join('<br>');
            
            new mapboxgl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(`<div style="color: black;">${htmlContent}</div>`)
              .addTo(map.current);
          });
        });

        // Remove the old static AI consensus layer code
        map.current.addLayer({
          'id': 'ai-consensus-particles',
          'type': 'circle',
          'source': 'zipcodes',
          'paint': {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 4,
              15, 6,
              20, 8
            ],
            'circle-color': [
              'interpolate',
              ['linear'],
              ['get', 'disagreement'],
              0.8, '#ff9800',
              0.85, '#f57c00',
              0.9, '#e65100',
              0.95, '#d84315'
            ],
            'circle-opacity': 0.95,
            'circle-blur': 0.2
          },
          'layout': {
            'visibility': 'none'
          }
        });

        // Update source data with mock AI disagreement values
        const zipSource = map.current.getSource('zipcodes');
        const zipData = zipSource._data;
        const updatedFeatures = zipData.features.map(feature => {
          const zipCode = feature.properties.Zip_Code;
          const modelData = mockDisagreementData[zipCode];
          return {
            ...feature,
            properties: {
              ...feature.properties,
              ai_disagreement: modelData?.disagreement || 0,
              model_data: modelData
            }
          };
        });

        zipSource.setData({
          type: 'FeatureCollection',
          features: updatedFeatures
        });

        // Add hover effect for AI consensus layer
        let aiConsensusPopup = null;
        
        map.current.on('mousemove', 'ai-consensus-analysis', (e) => {
          if (e.features.length > 0 && (!activePopupType || activePopupType === 'ai')) {
            map.current.getCanvas().style.cursor = 'pointer';
            const feature = e.features[0];
            const zipCode = feature.properties.Zip_Code;
            const modelData = feature.properties.model_data;
            
            // Remove existing popup if it exists
            if (aiConsensusPopup) {
              aiConsensusPopup.remove();
            }
            
            if (modelData && modelData.models) {  // Add null check for models
              const modelPredictions = Object.entries(modelData.models)
                .map(([model, value]) => `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: #888;">${model}:</span>
                    <span>${value} ft</span>
                  </div>
                `).join('');

              const disagreementColor = modelData.disagreement > 0.7 ? '#ff6b6b' : 
                                     modelData.disagreement > 0.4 ? '#ffd93d' : 
                                     '#4dd4ac';

              aiConsensusPopup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false,
                className: 'ai-consensus-popup',
                maxWidth: '300px'
              })
                .setLngLat(e.lngLat)
                .setHTML(`
                  <div style="
                    background: rgba(0, 0, 0, 0.9);
                    border-radius: 8px;
                    padding: 16px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                  ">
                    <div style="margin-bottom: 12px;">
                      <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">
                        ZIP Code: ${zipCode}
                      </div>
                      <div style="
                        font-size: 14px;
                        color: ${disagreementColor};
                        margin-bottom: 8px;
                      ">
                        Disagreement Level: ${(modelData.disagreement * 100).toFixed(1)}%
                      </div>
                    </div>
                    
                    <div style="
                      background: rgba(255, 255, 255, 0.05);
                      border-radius: 4px;
                      padding: 12px;
                      margin-bottom: 12px;
                      font-size: 13px;
                    ">
                      <div style="margin-bottom: 8px; color: #888;">Model Predictions:</div>
                      ${modelPredictions}
                    </div>

                    <div style="font-size: 13px; margin-bottom: 8px;">
                      <span style="color: #888;">Confidence Range:</span>
                      <span style="color: #4dd4ac;">${modelData.confidence_range}</span>
                    </div>

                    <div style="font-size: 13px;">
                      <span style="color: #888;">Primary Concern:</span>
                      <span style="color: #ff9966;">${modelData.primary_concern}</span>
                    </div>
                  </div>
                `)
                .addTo(map.current);
            } else {
              // Show a simpler popup for areas without model data
              aiConsensusPopup = new mapboxgl.Popup({
                closeButton: true,
                closeOnClick: false,
                className: 'ai-consensus-popup',
                maxWidth: '300px'
              })
                .setLngLat(e.lngLat)
                .setHTML(`
                  <div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">
                      ZIP Code: ${zipCode}
                    </div>
                    <div style="font-size: 14px; opacity: 0.7;">
                      No model predictions available
                    </div>
                  </div>
                `)
                .addTo(map.current);
            }
          }
        });

        map.current.on('mouseleave', 'ai-consensus-analysis', () => {
          map.current.getCanvas().style.cursor = '';
          if (aiConsensusPopup) {
            aiConsensusPopup.remove();
            aiConsensusPopup = null;
          }
        });

        map.current.setPaintProperty('zipcode-flood-analysis', 'fill-opacity', [
          'case',
          ['has', 'flood_height'],
          0.5,  // Changed from 0.7 to 0.5 for ZIP codes with flood data
          0.1   // Keep 0.1 for ZIP codes without measurements
        ]);
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    map.current.on('load', initializeMapLayers);
  }, [isErcotMode]);

  // Add cleanup effect for AI consensus animation
  useEffect(() => {
    if (!map.current) return;

    return () => {
      // Clean up AI consensus particles layer
      if (map.current.getLayer('ai-consensus-particles')) {
        map.current.removeLayer('ai-consensus-particles');
      }
      if (map.current.getSource('ai-consensus-particles')) {
        map.current.removeSource('ai-consensus-particles');
      }
    };
  }, []);

  const handleLLMResponse = (response) => {
    if (!map.current) return;

    const clearExistingElements = () => {
      const existingElements = document.querySelectorAll('.mapboxgl-popup, .callout-annotation, .mapboxgl-marker');
      existingElements.forEach(el => el.remove());
      
      if (map.current.getSource('area-highlights')) {
        map.current.getSource('area-highlights').setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    };

    clearExistingElements();

    if (response?.coordinates) {
      map.current.flyTo({
        center: response.coordinates,
        zoom: response.zoomLevel,
        duration: 1000
      });

      map.current.once('moveend', () => {
        map.current.once('idle', () => {
          highlightPOIBuildings(['restaurant', 'bar', 'nightclub'], '#FF4500');
          
          if (map.current) {
            map.current.setLayoutProperty('houston-pois', 'visibility', 'none');
          }
        });
      });
    }
  };

  const fetchErcotData = async () => {
    try {
      console.log('🔄 Loading ERCOT data...');
      setIsErcotMode(true);
      
      // Show the census blocks layer when entering ERCOT mode
      map.current.setLayoutProperty('census-blocks', 'visibility', 'visible');
      
      const response = await fetch('http://localhost:3001/api/ercot-data', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data?.data && map.current) {
        // Merge ERCOT data with census blocks
        const source = map.current.getSource('census-blocks');
        if (!source) {
          console.error('❌ Census blocks source not found');
          return;
        }

        const currentFeatures = source._data.features;
        const mergedFeatures = currentFeatures.map((feature, index) => {
          const ercotData = data.data[index % data.data.length];
          return {
            ...feature,
            properties: {
              ...feature.properties,
              price: ercotData.price,
              mw: ercotData.mw
            }
          };
        });

        // Update source data
        source.setData({
          type: 'FeatureCollection',
          features: mergedFeatures
        });

        // Set colors based on price
        const prices = data.data.map(d => d.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        map.current.setPaintProperty('census-blocks', 'fill-color', [
          'interpolate',
          ['linear'],
          ['get', 'price'],
          minPrice, '#006400',  // Deep green
          maxPrice, '#000080'   // Deep blue
        ]);

        map.current.setPaintProperty('census-blocks', 'fill-opacity', 0.7);
      }
    } catch (error) {
      console.error('❌ Error fetching ERCOT data:', error);
      setIsErcotMode(false);
    }
  };

  const clearErcotMode = () => {
    setIsErcotMode(false);
    if (map.current) {
      // Hide the census blocks layer when exiting ERCOT mode
      map.current.setLayoutProperty('census-blocks', 'visibility', 'none');
      
      // First remove the road layer if it exists
      if (map.current.getLayer('road-grid')) {
        stopRoadAnimation(roadAnimationFrame.current);
        map.current.removeLayer('road-grid');
      }
      
      // Then reset the census blocks
      map.current.setPaintProperty('census-blocks', 'fill-color', '#FF0000');
      map.current.setPaintProperty('census-blocks', 'fill-opacity', 0.4);
      
      // Reset road grid state
      setShowRoadGrid(false);
    }
  };

  const dragStart = (e) => {
    if (e.type === "mousedown") {
      isDraggingRef.current = true;
      initialXRef.current = e.clientX - xOffsetRef.current;
      initialYRef.current = e.clientY - yOffsetRef.current;
    } else if (e.type === "touchstart") {
      isDraggingRef.current = true;
      initialXRef.current = e.touches[0].clientX - xOffsetRef.current;
      initialYRef.current = e.touches[0].clientY - yOffsetRef.current;
    }
  };

  const dragEnd = () => {
    isDraggingRef.current = false;
    initialXRef.current = currentXRef.current;
    initialYRef.current = currentYRef.current;
  };

  const drag = (e) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      
      if (e.type === "mousemove") {
        currentXRef.current = e.clientX - initialXRef.current;
        currentYRef.current = e.clientY - initialXRef.current;
      } else if (e.type === "touchmove") {
        currentXRef.current = e.touches[0].clientX - initialXRef.current;
        currentYRef.current = e.touches[0].clientY - initialXRef.current;
      }

      xOffsetRef.current = currentXRef.current;
      yOffsetRef.current = currentYRef.current;
      
      if (popupRef.current) {
        popupRef.current.style.transform = 
          `translate3d(${currentXRef.current}px, ${currentYRef.current}px, 0)`;
      }
    }
  };

  useEffect(() => {
    if (!map.current) return;

    // Wait for map style to load
    map.current.once('style.load', () => {
      // Make 3D buildings solid
      const buildingLayers = [
        'building', // OSM buildings
        'building-extrusion', // Mapbox 3D buildings
        '3d-buildings' // Custom 3D buildings if any
      ];

      buildingLayers.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          // Update fill-extrusion-opacity for 3D buildings
          if (map.current.getPaintProperty(layerId, 'fill-extrusion-opacity') !== undefined) {
            map.current.setPaintProperty(layerId, 'fill-extrusion-opacity', 1);
          }
          // Update fill-opacity for 2D buildings
          if (map.current.getPaintProperty(layerId, 'fill-opacity') !== undefined) {
            map.current.setPaintProperty(layerId, 'fill-opacity', 1);
          }
        }
      });

      // Ensure buildings are rendered above other layers
      buildingLayers.forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.moveLayer(layerId);
        }
      });
    });
  }, []);

  useEffect(() => {
    if (!map.current) return;

    // Update bounds whenever the map moves
    const updateBounds = () => {
      const bounds = map.current.getBounds();
      setMapBounds({
        sw: bounds.getSouthWest(),
        ne: bounds.getNorthEast()
      });
      console.log('🗺️ Map bounds updated:', bounds.toString());
    };

    map.current.on('moveend', updateBounds);
    // Get initial bounds
    updateBounds();

    return () => {
      if (map.current) {
        map.current.off('moveend', updateBounds);
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current || !showHarveyData) return;

    const loadHarveyData = async () => {
      try {
        console.log('[ZIP Analysis] Starting flood analysis...');
        
        // Load both Harvey datasets
        const [harvey1Response, harvey2Response] = await Promise.all([
          fetch('/harvy1.geojson'),
          fetch('/harvy2.geojson')
        ]);
        
        const harvey1Data = await harvey1Response.json();
        const harvey2Data = await harvey2Response.json();
        
        console.log('[ZIP Analysis] Harvey data loaded:', {
          harvey1Count: harvey1Data.features?.length || harvey1Data.length,
          harvey2Count: harvey2Data.features?.length || harvey2Data.length
        });

        // Combine and process the data
        const allMeasurements = [
          ...(harvey1Data.features || harvey1Data).map(m => ({
            ...m,
            source: 'harvey1'
          })),
          ...(harvey2Data.features || harvey2Data).map(m => ({
            ...m,
            source: 'harvey2'
          }))
        ];

        // Add ZIP code flood analysis
        if (showZipFloodAnalysis) {
          console.log('[ZIP Analysis] Processing', allMeasurements.length, 'total measurements');
          const zipSource = map.current.getSource('zipcodes');
          const zipData = zipSource._data;
          const zipMeasurements = new Map();
          const zipAverages = new Map();

          // Process each ZIP code
          for (let i = 0; i < zipData.features.length; i++) {
            const zip = zipData.features[i];
            // Check for Zip_Code property
            const zipCode = zip.properties?.Zip_Code;

            if (!zipCode) {
              console.log(`[ZIP Analysis] Missing ZIP code for feature ${i}, properties:`, zip.properties);
              continue;
            }

            try {
              // Validate geometry
              if (!zip.geometry || !zip.geometry.coordinates || !zip.geometry.coordinates[0]) {
                console.log(`[ZIP Analysis] Invalid geometry for ZIP ${zipCode}`);
                continue;
              }

              // Validate polygon has enough points
              const coordinates = zip.geometry.coordinates[0];
              if (!Array.isArray(coordinates) || coordinates.length < 4) {
                console.log(`[ZIP Analysis] Insufficient points for ZIP ${zipCode}`);
                continue;
              }

              // Create a bounding box for the ZIP code area
              const bbox = turf.bbox(zip);
              console.log(`[ZIP Analysis] Processing ZIP ${zipCode}, bbox:`, bbox);

              // Find measurements within the bounding box
              const measurementsInZip = allMeasurements.filter(m => {
                const point = [
                  parseFloat(m.longitude_dd || m.geometry?.coordinates?.[0]),
                  parseFloat(m.latitude_dd || m.geometry?.coordinates?.[1])
                ];
                return !isNaN(point[0]) && !isNaN(point[1]) &&
                       point[0] >= bbox[0] && point[0] <= bbox[2] && 
                       point[1] >= bbox[1] && point[1] <= bbox[3];
              });

              console.log(`[ZIP Analysis] Found ${measurementsInZip.length} measurements in ZIP ${zipCode}`);

              if (measurementsInZip.length > 0) {
                // Process valid heights
                const validHeights = measurementsInZip
                  .map(m => {
                    const height = parseFloat(m.peak_stage || m.properties?.peak_stage);
                    const isValid = !isNaN(height) && height >= 0 && height <= 200; // Add reasonable max height
                    if (!isValid) {
                      console.log(`[ZIP Analysis] Invalid height in ZIP ${zipCode}:`, height);
                    }
                    return isValid ? height : null;
                  })
                  .filter(height => height !== null);

                if (validHeights.length > 0) {
                  const avgFloodHeight = validHeights.reduce((sum, height) => sum + height, 0) / validHeights.length;
                  zipMeasurements.set(zipCode, measurementsInZip);
                  zipAverages.set(zipCode, avgFloodHeight);
                  console.log(`[ZIP Analysis] ZIP ${zipCode}: avg height ${avgFloodHeight.toFixed(2)} from ${validHeights.length} valid measurements`);
                  console.log(`[ZIP Analysis] Height distribution for ZIP ${zipCode}:`, validHeights);
                }
              }
            } catch (error) {
              console.error(`[ZIP Analysis] Error processing ZIP ${zipCode}:`, error);
            }
          }

          // Calculate min/max heights for color scale
          const heights = Array.from(zipAverages.values());
          
          // Set default values if no valid heights
          const minHeight = heights.length > 0 ? Math.min(...heights) : 0;
          const maxHeight = heights.length > 0 ? Math.max(...heights) : 10;
          
          console.log('[ZIP Analysis] Height range:', { 
            minHeight, 
            maxHeight,
            numberOfZipsWithData: heights.length,
            heightDistribution: {
              '0-2ft': heights.filter(h => h <= 2).length,
              '2-4ft': heights.filter(h => h > 2 && h <= 4).length,
              '4-6ft': heights.filter(h => h > 4 && h <= 6).length,
              '6-8ft': heights.filter(h => h > 6 && h <= 8).length,
              '8+ft': heights.filter(h => h > 8).length
            }
          });

          // Update features with flood height data
          const updatedZipFeatures = zipData.features.map(zip => {
            const zipCode = zip.properties?.Zip_Code;
            const floodHeight = zipAverages.get(zipCode);
            console.log(`[ZIP Analysis] Setting flood height for ZIP ${zipCode}:`, floodHeight);
            return {
              ...zip,
              properties: {
                ...zip.properties,
                flood_height: floodHeight !== undefined ? floodHeight : null,
                measurement_count: (zipMeasurements.get(zipCode) || []).length
              }
            };
          });

          // Update source data
          zipSource.setData({
            type: 'FeatureCollection',
            features: updatedZipFeatures
          });

          // Update the layer paint properties with the actual data range
          const colorScale = minHeight === maxHeight ? [
            'case',
            ['has', 'flood_height'],
            '#4292c6',  // Use a single medium blue color when all values are the same
            '#404040'   // Dark gray for ZIP codes without measurements
          ] : [
            'case',
            ['has', 'flood_height'],
            [
              'interpolate',
              ['linear'],
              ['get', 'flood_height'],
              minHeight, '#f7fbff',    // Very light blue for lowest heights
              minHeight + (maxHeight - minHeight) * 0.25, '#9ecae1',    // Light blue
              minHeight + (maxHeight - minHeight) * 0.5, '#4292c6',    // Medium blue
              minHeight + (maxHeight - minHeight) * 0.75, '#2171b5',    // Deep blue
              maxHeight, '#084594'     // Very dark blue for highest heights
            ],
            '#404040'  // Dark gray for ZIP codes without measurements
          ];

          console.log('[ZIP Analysis] Setting color scale:', {
            minHeight,
            maxHeight,
            stops: [
              { height: minHeight, color: '#f7fbff' },
              { height: minHeight + (maxHeight - minHeight) * 0.25, color: '#9ecae1' },
              { height: minHeight + (maxHeight - minHeight) * 0.5, color: '#4292c6' },
              { height: minHeight + (maxHeight - minHeight) * 0.75, color: '#2171b5' },
              { height: maxHeight, color: '#084594' }
            ]
          });

          map.current.setPaintProperty('zipcode-flood-analysis', 'fill-color', colorScale);
          console.log('[ZIP Analysis] Paint property updated');

          // Fix the event listener handling
          // Remove existing event listeners if they exist
          map.current.off('mousemove', 'zipcode-flood-analysis');
          map.current.off('mouseleave', 'zipcode-flood-analysis');

          let currentPopup = null;

          // Add new event listeners
          map.current.on('mousemove', 'zipcode-flood-analysis', (e) => {
            if (e.features.length > 0) {
              map.current.getCanvas().style.cursor = 'pointer';
              const feature = e.features[0];
              const zipCode = feature.properties.Zip_Code;
              const floodHeight = feature.properties.flood_height;
              const measurementCount = feature.properties.measurement_count || 0;

              // Remove any existing popup
              if (currentPopup) {
                currentPopup.remove();
              }

              // Create new popup
              currentPopup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false,
                className: 'flood-analysis-popup'
              })
                .setLngLat(e.lngLat)
                .setHTML(`
                  <div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">
                      ZIP Code: ${zipCode}
                    </div>
                    <div style="font-size: 14px; margin-bottom: 4px;">
                      <span style="opacity: 0.7;">Average Flood Height:</span>
                      <span style="color: #4dd4ac; margin-left: 4px;">
                        ${floodHeight !== undefined && floodHeight !== null ? 
                          `${Number(floodHeight).toFixed(2)} ft` : 
                          'No data'}
                      </span>
                    </div>
                    <div style="font-size: 14px;">
                      <span style="opacity: 0.7;">Total Measurements:</span>
                      <span style="color: #4dd4ac; margin-left: 4px;">${measurementCount}</span>
                    </div>
                  </div>
                `)
                .addTo(map.current);
            }
          });

          map.current.on('mouseleave', 'zipcode-flood-analysis', () => {
            map.current.getCanvas().style.cursor = '';
            if (currentPopup) {
              currentPopup.remove();
              currentPopup = null;
            }
          });

          map.current.setPaintProperty('zipcode-flood-analysis', 'fill-opacity', [
            'case',
            ['has', 'flood_height'],
            0.5,  // Changed from 0.7 to 0.5 for ZIP codes with flood data
            0.1   // Keep 0.1 for ZIP codes without measurements
          ]);
        }

        // Move wastewater outfalls layer to the front
        if (map.current.getLayer('wastewater-outfalls')) {
          map.current.moveLayer('wastewater-outfalls');
        }

        // Move waterway layer to the front
        if (map.current.getLayer('waterway')) {
          map.current.moveLayer('waterway');
        }

        // Move 3D building layers to the very top
        const buildingLayers = [
          'osm-buildings',
          'mapbox-buildings',
          'building',
          'building-extrusion',
          '3d-buildings'
        ];

        buildingLayers.forEach(layerId => {
          if (map.current.getLayer(layerId)) {
            map.current.moveLayer(layerId);
          }
        });

      } catch (error) {
        console.error('[ZIP Analysis] Error in loadHarveyData:', error);
      }
    };

    loadHarveyData();
  }, [showHarveyData]);

  async function createWaterwayBuffer() {
    try {
      // Check if map is loaded
      if (!map.current.isStyleLoaded()) {
        console.log('[Waterway Buffer] Waiting for style to load...');
        await new Promise(resolve => {
          map.current.once('style.load', resolve);
        });
      }

      // Get the waterway features
      console.log('[Waterway Buffer] Querying waterway features...');
      
      // Get viewport bounds
      const bounds = map.current.getBounds();
      const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ];
      console.log('[Waterway Buffer] Current viewport bounds:', bbox);

      // Try to get features using both methods
      const renderedFeatures = map.current.queryRenderedFeatures(
        undefined,
        { layers: ['waterway'] }
      );
      
      const sourceFeatures = map.current.querySourceFeatures('composite', {
        sourceLayer: 'waterway'
      });

      console.log('[Waterway Buffer] Found features:', {
        renderedFeatures: renderedFeatures.length,
        sourceFeatures: sourceFeatures.length
      });

      let waterwayFeatures = [];
      
      // Use rendered features if available, otherwise try source features
      if (renderedFeatures.length > 0) {
        waterwayFeatures = renderedFeatures;
        console.log('[Waterway Buffer] Using rendered features');
      } else if (sourceFeatures.length > 0) {
        waterwayFeatures = sourceFeatures;
        console.log('[Waterway Buffer] Using source features');
      } else {
        console.log('[Waterway Buffer] No features found in either query');
        return;
      }

      // Log sample feature for debugging
      if (waterwayFeatures.length > 0) {
        console.log('[Waterway Buffer] Sample feature:', waterwayFeatures[0]);
      }

      // Create a FeatureCollection from the waterway features
      const waterwayCollection = {
        type: 'FeatureCollection',
        features: waterwayFeatures.map(f => ({
          type: 'Feature',
          geometry: f.geometry,
          properties: f.properties
        }))
      };

      console.log('[Waterway Buffer] Creating buffer with features:', {
        featureCount: waterwayCollection.features.length,
        sampleGeometry: waterwayCollection.features[0]?.geometry
      });

      // Create buffer (1000 feet = approximately 0.2 miles)
      const buffered = turf.buffer(waterwayCollection, 0.2, { units: 'miles' });
      console.log('[Waterway Buffer] Buffer created:', {
        type: buffered.type,
        featureCount: buffered.features.length,
        sampleGeometry: buffered.features[0]?.geometry
      });

      // Remove existing source and layer if they exist
      if (map.current.getSource('waterway-buffer')) {
        if (map.current.getLayer('waterway-buffer')) {
          map.current.removeLayer('waterway-buffer');
        }
        map.current.removeSource('waterway-buffer');
      }

      // Add the buffered source
      map.current.addSource('waterway-buffer', {
        type: 'geojson',
        data: buffered
      });

      // Add the buffered layer with increased opacity
      map.current.addLayer({
        'id': 'waterway-buffer',
        'type': 'fill',
        'source': 'waterway-buffer',
        'paint': {
          'fill-color': '#0088cc',
          'fill-opacity': 0.5,
          'fill-outline-color': '#0066cc'
        },
        'layout': {
          'visibility': 'none'
        }
      });

      console.log('[Waterway Buffer] Successfully created buffer layer');
    } catch (error) {
      console.error('[Waterway Buffer] Error creating buffer:', error);
    }
  }

  return (
    <MapContainer>
      <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      
      <LayerToggleContainer $isCollapsed={isLayerMenuCollapsed}>
        <LayerCollapseButton 
          onClick={() => setIsLayerMenuCollapsed(!isLayerMenuCollapsed)}
          $isCollapsed={isLayerMenuCollapsed}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
          </svg>
        </LayerCollapseButton>

        <ToggleButton 
          active={isErcotMode}
          onClick={isErcotMode ? clearErcotMode : fetchErcotData}
          style={{ height: '32px', padding: '0 12px', fontSize: '14px', marginBottom: '8px' }}
        >
          {isErcotMode ? 'Disable ERCOT' : 'Enable ERCOT'}
        </ToggleButton>

        <ToggleButton 
          active={showRoadGrid}
          onClick={() => setShowRoadGrid(!showRoadGrid)}
          style={{ height: '32px', padding: '0 12px', fontSize: '14px' }}
        >
          {showRoadGrid ? 'Hide Roads' : 'Show Roads'}
        </ToggleButton>

        <ToggleButton 
          active={showRoadParticles}
          onClick={() => setShowRoadParticles(!showRoadParticles)}
          style={{ height: '32px', padding: '0 12px', fontSize: '14px', marginBottom: '8px' }}
        >
          {showRoadParticles ? 'Hide Flow' : 'Show Flow'}
        </ToggleButton>

        <ToggleButton 
          active={showMUDLayer}
          onClick={() => {
            setShowMUDLayer(!showMUDLayer);
            map.current.setLayoutProperty(
              'mud-districts',
              'visibility',
              !showMUDLayer ? 'visible' : 'none'
            );
          }}
          style={{ height: '32px', padding: '0 12px', fontSize: '14px', marginBottom: '8px' }}
        >
          {showMUDLayer ? 'Hide MUDs' : 'Show MUDs'}
        </ToggleButton>

        <ToggleButton 
          active={showHarveyData}
          onClick={() => {
            console.log('Harvey data button clicked, current state:', showHarveyData);
            setShowHarveyData(!showHarveyData);
            if (!showHarveyData) {
              console.log('Enabling Harvey data visualization');
              map.current.setLayoutProperty('census-blocks', 'visibility', 'visible');
            } else {
              console.log('Disabling Harvey data visualization');
              map.current.setLayoutProperty('census-blocks', 'visibility', 'none');
              // Remove any existing popups
              const existingPopups = document.getElementsByClassName('mapboxgl-popup');
              Array.from(existingPopups).forEach(popup => popup.remove());
            }
          }}
          style={{ height: '32px', padding: '0 12px', fontSize: '14px', marginBottom: '8px' }}
        >
          {showHarveyData ? 'Hide Harvey Data' : 'Show Harvey Data'}
        </ToggleButton>

        <ToggleButton 
          active={showSurfaceWater}
          onClick={() => {
            setShowSurfaceWater(!showSurfaceWater);
            // List of water-related layers (excluding wastewater outfalls)
            const waterLayers = [
              'surface-water',
              'surface-water-intake',
              'small-tribal-areas',
              'small-areas',
              'pws-reservoir',
              'waterwell-grid'
            ];
            
            // Toggle visibility for water layers
            waterLayers.forEach(layerId => {
              map.current.setLayoutProperty(
                layerId,
                'visibility',
                !showSurfaceWater ? 'visible' : 'none'
              );
            });
          }}
          style={{ height: '32px', padding: '0 12px', fontSize: '14px', marginBottom: '8px' }}
        >
          {showSurfaceWater ? 'Hide Water Layers' : 'Show Water Layers'}
        </ToggleButton>

        <ToggleButton 
          active={showWastewaterOutfalls}
          onClick={() => {
            setShowWastewaterOutfalls(!showWastewaterOutfalls);
            map.current.setLayoutProperty(
              'wastewater-outfalls',
              'visibility',
              !showWastewaterOutfalls ? 'visible' : 'none'
            );
          }}
          style={{ height: '32px', padding: '0 12px', fontSize: '14px', marginBottom: '8px' }}
        >
          {showWastewaterOutfalls ? 'Hide Outfalls' : 'Show Outfalls'}
        </ToggleButton>

        <ToggleButton 
          active={showZipCodes}
          onClick={() => {
            setShowZipCodes(!showZipCodes);
            map.current.setLayoutProperty(
              'zipcodes',
              'visibility',
              !showZipCodes ? 'visible' : 'none'
            );
          }}
          style={{ height: '32px', padding: '0 12px', fontSize: '14px', marginBottom: '8px' }}
        >
          {showZipCodes ? 'ZIP Codes' : 'ZIP Codes'}
        </ToggleButton>

        <ToggleButton 
          active={showZipFloodAnalysis}
          onClick={() => {
            setShowZipFloodAnalysis(!showZipFloodAnalysis);
            map.current.setLayoutProperty(
              'zipcode-flood-analysis',
              'visibility',
              !showZipFloodAnalysis ? 'visible' : 'none'
            );
            if (!showZipFloodAnalysis) {
              if (!showHarveyData) {
                setShowHarveyData(true);
              }
            }
          }}
          style={{ height: '32px', padding: '0 12px', fontSize: '14px', marginBottom: '8px' }}
        >
          {showZipFloodAnalysis ? 'Flood Analysis' : 'Flood Analysis'}
        </ToggleButton>

        <ToggleButton 
          active={showAIConsensus}
          onClick={() => {
            setShowAIConsensus(!showAIConsensus);
            if (!showAIConsensus) {
              // Initialize particle layer if it doesn't exist
              if (!map.current.getLayer('ai-consensus-particles')) {
                initializeParticleLayer();
              }
              map.current.setLayoutProperty('ai-consensus-particles', 'visibility', 'visible');
            } else {
              map.current.setLayoutProperty('ai-consensus-particles', 'visibility', 'none');
            }
          }}
          style={{ height: '32px', padding: '0 12px', fontSize: '14px', marginBottom: '8px' }}
        >
          {showAIConsensus ? 'AI Consensus' : ' AI Consensus'}
        </ToggleButton>

        <ToggleButton 
          active={showWaterwayBuffer}
          onClick={async () => {
            console.log('[Waterway Buffer] Button clicked, current state:', showWaterwayBuffer);
            const visibility = !showWaterwayBuffer ? 'visible' : 'none';
            
            if (!map.current) {
              console.log('[Waterway Buffer] Map not initialized');
              return;
            }

            // Wait for style to load if needed
            if (!map.current.isStyleLoaded()) {
              console.log('[Waterway Buffer] Waiting for style to load...');
              await new Promise(resolve => {
                map.current.once('style.load', resolve);
              });
            }
            
            const hasLayer = map.current.getLayer('waterway-buffer');
            console.log('[Waterway Buffer] Layer exists:', hasLayer);
            
            if (!hasLayer) {
              console.log('[Waterway Buffer] Creating waterway buffer...');
              await createWaterwayBuffer();
            }
            
            if (map.current.getLayer('waterway-buffer')) {
              console.log('[Waterway Buffer] Setting visibility to:', visibility);
              setShowWaterwayBuffer(!showWaterwayBuffer);
              map.current.setLayoutProperty('waterway-buffer', 'visibility', visibility);
            } else {
              console.log('[Waterway Buffer] Layer still not found after creation attempt');
            }
          }}
          style={{ height: '32px', padding: '0 12px', fontSize: '14px', marginBottom: '8px' }}
        >
          {showWaterwayBuffer ? 'Waterway Buffer' : 'Waterway Buffer'}
        </ToggleButton>
      </LayerToggleContainer>

      <AIChatPanel 
        messages={messages}
        setMessages={setMessages}
        isLoading={isLoading}
        loadingMessage={loadingMessage}
        inputValue={inputValue}
        setInputValue={setInputValue}
        handleQuestion={async (question) => {
          console.log('🤔 Question received:', question);
          console.log('📍 Current map state:', {
            center: map.current.getCenter(),
            zoom: map.current.getZoom(),
            bounds: mapBounds
          });

          // Get visible layers for context
          const visibleLayers = map.current.getStyle().layers
            .filter(layer => map.current.getLayoutProperty(layer.id, 'visibility') === 'visible')
            .map(layer => layer.id);
          console.log('👁️ Visible layers:', visibleLayers);

          try {
            const response = await handleQuestion(question, {
              mapBounds,
              visibleLayers,
              center: map.current.getCenter(),
              zoom: map.current.getZoom()
            });
            console.log('✅ Response received:', response);
            return response;
          } catch (error) {
            console.error('❌ Error handling question:', error);
            return null;
          }
        }}
        map={map}
      />
    </MapContainer>
  );
};

export default MapComponent;

