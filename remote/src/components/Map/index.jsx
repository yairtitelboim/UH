import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
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

    return () => map.current.remove();
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
        />
      )}
    </div>
  );
}

export default Map;
