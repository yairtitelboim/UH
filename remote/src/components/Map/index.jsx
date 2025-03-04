import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAP_CONFIG } from './constants';
import { buildingLayers } from './constants/layerConfigs';
import { askClaude, parseClaudeResponse, LOADING_STEPS } from '../../services/claude';
import { MapContainer, LayerToggleContainer, LayerCollapseButton, ToggleButton } from './styles/MapStyles';
import AIChatPanel from './AIChatPanel';
import { useAIConsensusAnimation } from './hooks/useAIConsensusAnimation';
import { useMapInitialization } from './hooks/useMapInitialization';
import { PopupManager } from './components/PopupManager';
import { 
    highlightPOIBuildings,
    initializeRoadGrid
} from './utils';
import { createErcotPopup } from './intel';
import LayerToggle from './components/LayerToggle';
import { loadHarveyData } from './utils';
import { mockDisagreementData } from './constants/mockData';
import { ErcotManager } from './components/ErcotManager';

// Set mapbox access token
mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

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
  const [showMUDLayer, setShowMUDLayer] = useState(false);
  const [showHarveyData, setShowHarveyData] = useState(false);
  const [showSurfaceWater, setShowSurfaceWater] = useState(false);
  const [showWastewaterOutfalls, setShowWastewaterOutfalls] = useState(false);
  const [showZipCodes, setShowZipCodes] = useState(false);
  const [showZipFloodAnalysis, setShowZipFloodAnalysis] = useState(false);
  const [isLayerMenuCollapsed, setIsLayerMenuCollapsed] = useState(false);
  const [showAIConsensus, setShowAIConsensus] = useState(false);

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
  useMapInitialization(map, mapContainer);

  const ercotManagerRef = useRef(null);

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
        map.current.addLayer(buildingLayers.osmBuildings);

        // Add Mapbox 3D buildings layer
        map.current.addLayer(buildingLayers.mapboxBuildings);

        // Add click handler
        map.current.on('click', 'census-blocks', (e) => {
          if (!e.features?.length) return;
          
          const feature = e.features[0];
          const clickedId = feature.properties.OBJECTID;
          
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

    // Update bounds whenever the map moves
    const updateBounds = () => {
      const bounds = map.current.getBounds();
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

  return (
    <MapContainer>
      <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <PopupManager map={map} />
      <ErcotManager ref={ercotManagerRef} map={map} isErcotMode={isErcotMode} setIsErcotMode={setIsErcotMode} />
      
      <LayerToggle
        map={map}
        isLayerMenuCollapsed={isLayerMenuCollapsed}
        setIsLayerMenuCollapsed={setIsLayerMenuCollapsed}
        isErcotMode={isErcotMode}
        setIsErcotMode={setIsErcotMode}
        showRoadGrid={showRoadGrid}
        setShowRoadGrid={setShowRoadGrid}
        showMUDLayer={showMUDLayer}
        setShowMUDLayer={setShowMUDLayer}
        showHarveyData={showHarveyData}
        setShowHarveyData={setShowHarveyData}
        showSurfaceWater={showSurfaceWater}
        setShowSurfaceWater={setShowSurfaceWater}
        showWastewaterOutfalls={showWastewaterOutfalls}
        setShowWastewaterOutfalls={setShowWastewaterOutfalls}
        showZipCodes={showZipCodes}
        setShowZipCodes={setShowZipCodes}
        showZipFloodAnalysis={showZipFloodAnalysis}
        setShowZipFloodAnalysis={setShowZipFloodAnalysis}
        showAIConsensus={showAIConsensus}
        setShowAIConsensus={setShowAIConsensus}
        fetchErcotData={() => ercotManagerRef.current?.fetchErcotData()}
        loadHarveyData={loadHarveyData}
      />

      <AIChatPanel 
        messages={messages}
        setMessages={setMessages}
        isLoading={isLoading}
        loadingMessage={loadingMessage}
        inputValue={inputValue}
        setInputValue={setInputValue}
        handleQuestion={async (question) => {
          try {
            const response = await handleQuestion(question, {
              center: map.current.getCenter(),
              zoom: map.current.getZoom()
            });
            return response;
          } catch (error) {
            console.error('Error handling question:', error);
            return null;
          }
        }}
        map={map}
      />
    </MapContainer>
  );
};

export default MapComponent;

