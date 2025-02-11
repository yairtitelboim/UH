import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import PropTypes from 'prop-types';
import { mapStyles } from './styles';
import { useParticleSystem } from '../../hooks/useParticleSystem';
import { useBuildingInteraction } from '../../hooks/useBuildingInteraction';
import { generateMockData } from './utils';
import { 
  DC_BOUNDS, 
  POWER_SUBSTATIONS, 
  POWER_HOTSPOTS
} from './constants';

const MapComponent = ({ onArticleUpdate = () => {}, articles = [] }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [buildingData, setBuildingData] = useState(null);
  const [cogentActive, setCogentActive] = useState(false);
  
  // Get building interaction hooks
  const { 
    handleBuildingClick, 
    currentFloatingCard, 
    currentRoot 
  } = useBuildingInteraction(map, onArticleUpdate);
  
  // Get particle system hooks
  const { 
    generateParticles, 
    createCogentParticles, 
    animate, 
    animationFrame: particleAnimationFrame 
  } = useParticleSystem(map);

  const handleCogentClick = useCallback(() => {
    console.log('Cogent clicked in Map component');
    
    if (!map.current) {
        console.log('Map not initialized');
        return;
    }

    try {
      // ... rest of the code ...

      if (particleAnimationFrame.current) {
        cancelAnimationFrame(particleAnimationFrame.current);
      }

      // ... rest of the code ...
    } catch (error) {
      console.error('Error in handleCogentClick:', error);
    }
  }, [cogentActive, createCogentParticles]);

  useEffect(() => {
    // ... existing code ...

    return () => {
      if (particleAnimationFrame.current) {
        cancelAnimationFrame(particleAnimationFrame.current);
      }
      if (currentFloatingCard.current) {
        currentFloatingCard.current.remove();
      }
      if (currentRoot.current) {
        currentRoot.current.unmount();
      }
      if (map.current) {
        map.current.remove();
      }
    };
  }, [animate, generateParticles, handleBuildingClick, onArticleUpdate]);

  // ... rest of the component ...
};

MapComponent.propTypes = {
  onArticleUpdate: PropTypes.func,
  articles: PropTypes.array
};

export default MapComponent;



