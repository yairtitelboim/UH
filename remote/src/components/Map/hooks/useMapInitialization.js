import { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { MAP_CONFIG } from '../constants';
import { formatWaterData, formatAIConsensusData } from '../components/PopupCards';
import { mockDisagreementData } from '../constants/mockData';

export const useMapInitialization = (map, mapContainer) => {
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

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
            'circle-radius': 3,
            'circle-color': '#0088cc',
            'circle-stroke-width': 1,
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
        
        // Create a single reference for the current popup
        let currentPopup = null;

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
            e.preventDefault(); // Prevent event from bubbling to other layers
            
            if (!e.features?.length) return;
            
            const feature = e.features[0];
            const props = feature.properties;

            // Remove any existing popup
            if (currentPopup) {
              currentPopup.remove();
              currentPopup = null;
            }

            // Create new popup
            currentPopup = new mapboxgl.Popup({
              closeButton: true,
              closeOnClick: false,
              className: 'custom-popup'
            })
              .setLngLat(e.lngLat)
              .setHTML(formatWaterData(props))
              .addTo(map.current);

            // Add event listener for when popup is closed
            currentPopup.on('close', () => {
              currentPopup = null;
            });
          });
        });

        // Add AI consensus layer
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
          if (e.features.length > 0) {
            map.current.getCanvas().style.cursor = 'pointer';
            const feature = e.features[0];
            const zipCode = feature.properties.Zip_Code;
            const modelData = feature.properties.model_data;
            
            // Remove existing popup if it exists
            if (aiConsensusPopup) {
              aiConsensusPopup.remove();
            }
            
            if (modelData && modelData.models) {  // Add null check for models
              aiConsensusPopup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false,
                className: 'ai-consensus-popup',
                maxWidth: '300px'
              })
                .setLngLat(e.lngLat)
                .setHTML(formatAIConsensusData(modelData))
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
  }, []);
}; 