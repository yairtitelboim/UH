import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { createErcotPopup } from '../intel';

export const ErcotManager = forwardRef(({ map, isErcotMode, setIsErcotMode }, ref) => {
  useEffect(() => {
    if (!map.current) return;

    // Add click handler for census blocks
    const handleCensusBlockClick = (e) => {
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
    };

    // Add the click handler
    map.current.on('click', 'census-blocks', handleCensusBlockClick);

    // Cleanup function
    return () => {
      if (map.current) {
        map.current.off('click', 'census-blocks', handleCensusBlockClick);
      }
    };
  }, [map, isErcotMode]);

  const clearErcotMode = () => {
    setIsErcotMode(false);
    if (map.current) {
      // Hide the census blocks layer when exiting ERCOT mode
      map.current.setLayoutProperty('census-blocks', 'visibility', 'none');
      
      // First remove the road layer if it exists
      if (map.current.getLayer('road-grid')) {
        map.current.removeLayer('road-grid');
      }
      
      // Then reset the census blocks
      map.current.setPaintProperty('census-blocks', 'fill-color', '#FF0000');
      map.current.setPaintProperty('census-blocks', 'fill-opacity', 0.4);
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

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    fetchErcotData,
    clearErcotMode
  }));

  return null; // This component doesn't render anything
}); 