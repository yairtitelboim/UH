import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { polygon, buffer, length, polygonToLine } from '@turf/turf';
import { useMapLogic } from '../../../hooks/useMapLogic';
import { Building, Zap, Thermometer, HardDrive } from 'lucide-react';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

function Map({ onArticleUpdate }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  
  // Add state for layer toggles
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showPowerGrid, setShowPowerGrid] = useState(true);
  const [showCooling, setShowCooling] = useState(true);

  useEffect(() => {
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v10',
        center: [-98.5795, 39.8283],
        zoom: 3
      });

      // Add heatmap layer
      map.current.on('load', () => {
        map.current.addLayer({
          id: 'site-heat',
          type: 'heatmap',
          source: {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [] // Your site data here
            }
          },
          paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': 1,
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(33,102,172,0)',
              0.2, 'rgb(103,169,207)',
              0.4, 'rgb(209,229,240)',
              0.6, 'rgb(253,219,199)',
              0.8, 'rgb(239,138,98)',
              1, 'rgb(178,24,43)'
            ],
            'heatmap-radius': 30
          }
        });

        // Add custom markers with icons
        sites.forEach(site => {
          const el = document.createElement('div');
          el.className = 'marker';
          
          // Add site type icon
          const icon = document.createElement('i');
          icon.className = `site-icon ${site.type}`; // CSS classes for styling
          el.appendChild(icon);

          // Add indicator badges
          if (site.powerScore > 0.8) {
            const power = document.createElement('span');
            power.className = 'indicator power';
            el.appendChild(power);
          }

          if (site.coolingScore > 0.8) {
            const cooling = document.createElement('span');
            cooling.className = 'indicator cooling';
            el.appendChild(cooling);
          }

          new mapboxgl.Marker(el)
            .setLngLat([site.lng, site.lat])
            .addTo(map.current);
        });
      });
    }
  }, []);

  return (
    <div className="map-wrapper">
      <div ref={mapContainer} className="map" />
      <div className="layer-controls">
        <button onClick={() => setShowHeatmap(!showHeatmap)}>
          Toggle Heatmap
        </button>
        <button onClick={() => setShowPowerGrid(!showPowerGrid)}>
          Toggle Power Grid
        </button>
        <button onClick={() => setShowCooling(!showCooling)}>
          Toggle Cooling
        </button>
      </div>
    </div>
  );
}

export default Map;

