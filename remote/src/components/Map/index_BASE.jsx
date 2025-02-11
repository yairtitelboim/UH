import React, { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import BuildingPopup from './BuildingPopup';
import { createRoot } from 'react-dom/client';

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
`;

const MapComponent = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    console.log('MapComponent: Initializing map');
    if (!map.current) {
      try {
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [-81.6557, 30.3322],
          zoom: 12,
          pitch: 45,
        });

        map.current.on('load', () => {
          console.log('MapComponent: Map loaded');
          // Initialize 3D building layer
          map.current.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'type': 'fill-extrusion',
            'minzoom': 12,
            'paint': {
              'fill-extrusion-color': '#aaa',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-opacity': 0.6
            }
          });

          // Simple building click handler for popup
          map.current.on('click', '3d-buildings', (e) => {
            if (e.features.length === 0) return;

            const coordinates = e.lngLat;
            const feature = e.features[0];

            // Create popup node
            const popupNode = document.createElement('div');
            const popupRoot = createRoot(popupNode);

            // Remove existing popup if any
            if (popupRef.current) popupRef.current.remove();

            // Render popup content
            popupRoot.render(
              <BuildingPopup
                feature={feature}
                onClose={() => popupRef.current?.remove()}
              />
            );

            // Create and store popup reference
            popupRef.current = new mapboxgl.Popup({
              closeButton: false,
              maxWidth: '300px'
            })
              .setLngLat(coordinates)
              .setDOMContent(popupNode)
              .addTo(map.current);
          });
        });

        map.current.on('error', (e) => {
          console.error('MapComponent: Map error:', e);
        });
      } catch (error) {
        console.error('MapComponent: Error creating map:', error);
      }
    }

    // Cleanup function
    return () => {
      console.log('MapComponent: Cleaning up map');
      if (map.current && map.current.remove) {
        try {
          // Remove popup if it exists
          if (popupRef.current) {
            popupRef.current.remove();
          }
          // Remove map instance
          map.current.remove();
        } catch (error) {
          console.error('Error during cleanup:', error);
        }
      }
      map.current = null;
    };
  }, []);

  return (
    <div 
      ref={mapContainer} 
      style={{ 
        width: '100%', 
        height: '100vh' 
      }} 
    />
  );
};

export default MapComponent;
