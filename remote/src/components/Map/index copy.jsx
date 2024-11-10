import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { polygon, buffer, length, polygonToLine } from '@turf/turf'; // Import necessary Turf.js functions
import { useMapLogic } from '../../hooks/useMapLogic';
import BuildingPopup from './BuildingPopup';
import dcData from './DC.json'; // Import the JSON data

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

function Map({ onArticleUpdate }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const articles = dcData; // Use the imported JSON data

  const {
    lng, lat, zoom, selectedArticle, popupCoordinates, handleMapLoad, updateMarkers,
    handleValidate, handleMatchResults, showComparison, validationError, isValidating,
    retryCount, MAX_RETRIES, lastValidationTime, showTypewriter, matchedResults,
    validatedData, validationScore
  } = useMapLogic(map, mapContainer, articles, onArticleUpdate);

  // Define the onClose function to hide the popup
  const handleClosePopup = () => {
    onArticleUpdate(null); // Assuming onArticleUpdate is used to update the selected article
  };

  // Define constants for clarity
  const FLOOR_HEIGHT = 10; // feet per floor
  const BUFFER_SIZE = -20; // feet
  const BUFFER_UNITS = 'feet';
  const METERS_TO_FEET = 3.28084; // conversion factor

  const handleShowInterior = () => {
    if (!selectedArticle || !selectedArticle.location) return;

    const { latitude, longitude } = selectedArticle.location;
    console.log("Selected Article Location:", latitude, longitude);

    const buildingShape = getBuildingShape(longitude, latitude);
    if (buildingShape) {
      console.log("Building Shape:", buildingShape);

      const interiorBuffer = buffer(buildingShape, BUFFER_SIZE, { units: BUFFER_UNITS });
      console.log("Interior Buffer:", interiorBuffer);

      if (map.current.getSource('interior-highlight')) {
        map.current.removeLayer('interior-highlight-layer');
        map.current.removeSource('interior-highlight');
      }

      map.current.addSource('interior-highlight', {
        type: 'geojson',
        data: interiorBuffer
      });

      map.current.addLayer({
        id: 'interior-highlight-layer',
        type: 'fill',
        source: 'interior-highlight',
        paint: {
          'fill-color': '#4CAF50',
          'fill-opacity': 0.5
        }
      });

      map.current.flyTo({
        center: [longitude, latitude],
        zoom: 19,
        pitch: 0,
        bearing: 0,
        essential: true,
        duration: 1000
      });

      const bounds = new mapboxgl.LngLatBounds();
      buildingShape.geometry.coordinates[0].forEach(coord => bounds.extend(coord));
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 19,
        duration: 1000
      });
    }
  };

  const getBuildingShape = (lng, lat) => {
    if (!map.current) return null;

    const point = map.current.project([lng, lat]);
    const width = 10;
    const height = 10;

    console.log("Querying building features at:", { lng, lat, point });

    const features = map.current.queryRenderedFeatures(
      [
        [point.x - width / 2, point.y - height / 2],
        [point.x + width / 2, point.y + height / 2]
      ],
      { layers: ['building'] }
    );

    console.log("Found features:", features);

    if (features.length > 0) {
      const closestBuilding = features[0];
      console.log("Closest building:", closestBuilding);
      
      const buildingHeight = closestBuilding.properties.height || 
                           (closestBuilding.properties.levels * 3) || // 3 meters per level
                           30; // default height if no data available
      
      return {
        type: 'Feature',
        properties: {
          height: buildingHeight,
          base_height: closestBuilding.properties.min_height || 0
        },
        geometry: closestBuilding.geometry
      };
    }

    return null;
  };

  const cleanupFloorLayers = () => {
    if (!map.current) return;
    
    try {
      const style = map.current.getStyle();
      if (!style) return;

      // Remove layers first
      style.layers.forEach(layer => {
        if (layer.id.includes('floor-') || layer.id.includes('building-')) {
          if (map.current.getLayer(layer.id)) {
            map.current.removeLayer(layer.id);
          }
        }
      });

      // Then remove sources
      ['building-shell', 'floor-buffer'].forEach(sourceId => {
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });

      console.log("Successfully cleaned up all layers and sources");
    } catch (error) {
      console.error("Error in cleanup:", error);
    }
  };

  const handleAnalysis = () => {
    if (!selectedArticle || !selectedArticle.location) return;

    const { latitude, longitude } = selectedArticle.location;
    console.log("1. Starting analysis at:", latitude, longitude);

    const buildingShape = getBuildingShape(longitude, latitude);
    if (buildingShape) {
      try {
        cleanupFloorLayers();

        const buildingHeightMeters = buildingShape.properties.height || 30;
        const FLOOR_HEIGHT_METERS = 3;
        const BUFFER_SIZE = -2;
        const numberOfFloors = Math.ceil(buildingHeightMeters / FLOOR_HEIGHT_METERS);

        setTimeout(() => {
          // Add building shell with very low opacity
          map.current.addSource('building-shell', {
            type: 'geojson',
            data: buildingShape
          });

          map.current.addLayer({
            id: 'building-shell-layer',
            type: 'fill-extrusion',
            source: 'building-shell',
            paint: {
              'fill-extrusion-color': '#FF4136',
              'fill-extrusion-opacity': 0.05, // Much more transparent
              'fill-extrusion-height': buildingHeightMeters,
              'fill-extrusion-base': 0,
              'fill-extrusion-vertical-gradient': true
            }
          });

          // Create buffered shape
          const bufferedShape = buffer(buildingShape, BUFFER_SIZE, { units: 'meters' });
          
          map.current.addSource('floor-buffer', {
            type: 'geojson',
            data: bufferedShape
          });

          // Add floor outlines for each level
          for (let floor = 0; floor <= numberOfFloors; floor++) {
            const heightMeters = floor * FLOOR_HEIGHT_METERS;
            
            // Add outer floor outline (white)
            map.current.addLayer({
              id: `floor-line-${floor}`,
              type: 'fill-extrusion',
              source: 'building-shell',
              paint: {
                'fill-extrusion-color': '#ffffff',
                'fill-extrusion-opacity': 0.8,
                'fill-extrusion-height': heightMeters + 0.1,
                'fill-extrusion-base': heightMeters,
                'fill-extrusion-vertical-gradient': true
              }
            });

            // Add inner floor outline (green)
            map.current.addLayer({
              id: `floor-buffer-${floor}`,
              type: 'fill-extrusion',
              source: 'floor-buffer',
              paint: {
                'fill-extrusion-color': '#4CAF50',
                'fill-extrusion-opacity': 0.6,
                'fill-extrusion-height': heightMeters + 0.1,
                'fill-extrusion-base': heightMeters,
                'fill-extrusion-vertical-gradient': true
              }
            });

            console.log(`Added floor ${floor} at height ${heightMeters}m`);
          }

          // Camera adjustments
          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 18.5,
            pitch: 60,
            bearing: 45,
            essential: true,
            duration: 1000
          });

        }, 100);

      } catch (error) {
        console.error("Error in analysis:", error);
      }
    }
  };

  useEffect(() => {
    if (map.current) return; // initialize map only once
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v10',
      center: [lng, lat],
      zoom: zoom,
      pitch: 45,
      bearing: 0
    });

    map.current.on('load', () => {
      map.current.addSource('markers', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      map.current.addLayer({
        id: 'markers',
        type: 'circle',
        source: 'markers',
        paint: {
          'circle-radius': 6,
          'circle-color': '#FF4136'
        }
      });

      handleMapLoad();
    });

    return () => {
      cleanupFloorLayers();
      map.current.remove();
    };
  }, []);

  useEffect(() => {
    if (map.current && map.current.loaded()) {
      updateMarkers(articles);
    }
  }, [articles]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      {selectedArticle && popupCoordinates && (
        <BuildingPopup
          selectedArticle={selectedArticle}
          popupCoordinates={popupCoordinates}
          handleValidate={handleValidate}
          handleMatchResults={handleMatchResults}
          showComparison={showComparison}
          validationError={validationError}
          isValidating={isValidating}
          retryCount={retryCount}
          MAX_RETRIES={MAX_RETRIES}
          lastValidationTime={lastValidationTime}
          showTypewriter={showTypewriter}
          matchedResults={matchedResults}
          validatedData={validatedData}
          validationScore={validationScore}
          onClose={handleClosePopup}
          onShowInterior={handleShowInterior}
          handleAnalysis={handleAnalysis}
        />
      )}
    </div>
  );
}

export default Map;

