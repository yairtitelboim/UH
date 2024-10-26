import { useRef } from 'react';
import mapboxgl from 'mapbox-gl';

export const useMapLogic = (mapContainer, articles, onArticleUpdate) => {
  const map = useRef(null);

  const initializeMap = () => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v10',
      center: [-98.5795, 39.8283],
      zoom: 2,
      pitch: 45,
      bearing: 0
    });

    map.current.on('load', () => {
      // Add layers and sources
    });
  };

  const updateMarkers = (articles) => {
    // Update markers logic
  };

  return { initializeMap, updateMarkers };
};
