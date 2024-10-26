import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapLogic } from '../../hooks/useMapLogic';import BuildingPopup from './BuildingPopup';
import ValidationPanel from './ValidationPanel';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

function Map({ articles = [], onArticleUpdate }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const {
    lng, lat, zoom, selectedArticle, popupCoordinates, handleMapLoad, handleArticleClick,
    handleBackToOriginal, handleValidate, handleMatchResults, showComparison, validationError,
    isValidating, retryCount, MAX_RETRIES, lastValidationTime, showTypewriter, matchedResults,
    validatedData, validationScore, updateMarkers
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

    map.current.on('load', () => handleMapLoad());

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
          handleBackToOriginal={handleBackToOriginal}
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
