import { useEffect, useCallback } from 'react';
import { handleBuildingClick, handlePMTClick } from '../handlers/mapEventHandlers';
import { setupAnimation } from '../utils';

export const useMapInitialization = (map, currentFilter, highlightedBuildingsData) => {
    useEffect(() => {
        if (!map.current) return;

        const handlePMTMouseLeave = () => {
            if (map.current && currentFilter.current) {
                map.current.setFilter('pmt-boundaries', currentFilter.current);
            }
        };

        // Set up event listeners
        map.current.on('click', 'pmt-boundaries', (e) => 
            handlePMTClick(e, map.current, currentFilter)
        );
        
        map.current.on('click', '3d-buildings', (e) => 
            handleBuildingClick(e, map.current, highlightedBuildingsData)
        );
        
        map.current.on('mouseleave', 'pmt-boundaries', handlePMTMouseLeave);

        map.current.on('load', () => {
            setupAnimation(map.current);
        });

        // Cleanup function
        return () => {
            if (map.current) {
                map.current.off('click', 'pmt-boundaries');
                map.current.off('click', '3d-buildings');
                map.current.off('mouseleave', 'pmt-boundaries');
            }
        };
    }, [map.current]);
}; 