import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { polygon, buffer, length, polygonToLine } from '@turf/turf';
import axios from 'axios';
import Typewriter from 'typewriter-effect';
import { FaCheck } from 'react-icons/fa'; // Import the check icon
import ZoningMetrics from '../../../src copy/components/ZoningMetrics';

// Add this near the top of your file, outside the Map component
window.handleBackToOriginal = null;

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const API_URL = 'https://evalv01-53aff151fb55.herokuapp.com';

function Map({ articles = [], onArticleUpdate }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-98.5795);
  const [lat, setLat] = useState(39.8283);
  const [zoom, setZoom] = useState(2);
  const [markerCount, setMarkerCount] = useState(0);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [popupCoordinates, setPopupCoordinates] = useState(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [showFloorPlan, setShowFloorPlan] = useState(false);
  const [buildingShape, setBuildingShape] = useState(null);
  const [popupContent, setPopupContent] = useState(null);
  const [isZoningView, setIsZoningView] = useState(false);
  const [popupWidth, setPopupWidth] = useState(445);
  const [popupHeight, setPopupHeight] = useState('85vh');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const popupRef = useRef(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validatedData, setValidatedData] = useState(null);
  const [validationScore, setValidationScore] = useState(null);
  const [lastValidationTime, setLastValidationTime] = useState(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showTypewriter, setShowTypewriter] = useState(false);
  const typewriterRef = useRef(null);
  const [isExistingDataExpanded, setIsExistingDataExpanded] = useState(false);
  const [matchedResults, setMatchedResults] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  const typewriterLines = [
    "Initiating AI-powered web search...",
    "Scanning real estate databases...",
    "Analyzing recent market trends...",
    "Compiling updated building information...",
    "Validating data against multiple sources..."
  ];

  const existingDataRef = useRef(null);
  const updatedDataRef = useRef(null);

  const handleScroll = (scrolledPane) => {
    const sourcePane = scrolledPane === 'existing' ? existingDataRef.current : updatedDataRef.current;
    const targetPane = scrolledPane === 'existing' ? updatedDataRef.current : existingDataRef.current;

    if (sourcePane && targetPane) {
      targetPane.scrollTop = sourcePane.scrollTop;
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

    // Wait for the map to load before adding sources and layers
    map.current.on('load', () => {
      // Add 3D building layer
      map.current.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#FF0000',
            '#aaa'
          ],
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            15.05, ['get', 'height']
          ],
          'fill-extrusion-base': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            15.05, ['get', 'min_height']
          ],
          'fill-extrusion-opacity': 0.6
        }
      });

      // Add markers source and layer
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

      // Add click event for markers
      map.current.on('click', 'markers', (e) => {
        if (e.features.length > 0) {
          const clickedArticle = articles.find(article => 
            article.location.address === e.features[0].properties.address
          );
          if (clickedArticle) {
            setSelectedArticle(clickedArticle);
            setPopupCoordinates(e.lngLat);
            map.current.flyTo({
              center: e.lngLat,
              zoom: 16,
              essential: true
            });
            highlightBuilding(e.lngLat.lng, e.lngLat.lat);
          }
        }
      });

      map.current.on('mouseenter', 'markers', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', 'markers', () => {
        map.current.getCanvas().style.cursor = '';
      });

      // Initial update of markers
      updateMarkers(articles);
    });

    return () => map.current.remove();
  }, []);

  // Separate useEffect for updating markers when articles change
  useEffect(() => {
    if (map.current && map.current.loaded()) {
      updateMarkers(articles);
    }
  }, [articles]);

  // Function to update markers
  const updateMarkers = (articles) => {
    if (!map.current || !map.current.getSource('markers')) return;

    const validArticles = articles.filter(article => 
      article && 
      article.location &&
      typeof article.location.latitude === 'number' && 
      typeof article.location.longitude === 'number' &&
      !isNaN(article.location.latitude) && 
      !isNaN(article.location.longitude)
    );

    const features = validArticles.map((article, index) => {
      const lat = article.location.latitude;
      const lng = article.location.longitude;
      const offset = index * 0.00005;

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng + offset, lat + offset]
        },
        properties: {
          address: article.location.address,
          title: article.title
        }
      };
    });

    map.current.getSource('markers').setData({
      type: 'FeatureCollection',
      features: features
    });

    if (validArticles.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      validArticles.forEach(article => {
        const lat = article.location.latitude;
        const lng = article.location.longitude;
        if (lat && lng) {
          bounds.extend([lng, lat]);
        }
      });
      map.current.fitBounds(bounds, { padding: 50 });
    }
  };

  const highlightBuilding = (lng, lat) => {
    if (selectedBuildingId) {
      map.current.setFeatureState(
        { source: 'composite', sourceLayer: 'building', id: selectedBuildingId },
        { selected: false }
      );
    }

    map.current.once('idle', () => {
      const point = map.current.project([lng, lat]);
      const width = 10;
      const height = 10;

      const features = map.current.queryRenderedFeatures(
        [
          [point.x - width / 2, point.y - height / 2],
          [point.x + width / 2, point.y + height / 2]
        ],
        { layers: ['3d-buildings'] }
      );

      if (features.length > 0) {
        const feature = features[0];
        setSelectedBuildingId(feature.id);
        map.current.setFeatureState(
          { source: 'composite', sourceLayer: 'building', id: feature.id },
          { selected: true }
        );

        // Highlight the block if in zoning view
        if (isZoningView) {
          highlightBlock(lng, lat);
        }
      }
    });
  };

  const highlightBlock = (lng, lat) => {
    const size = 0.001; // Adjust this value to change the size of the highlighted area
    const coordinates = [
      [lng - size, lat - size],
      [lng + size, lat - size],
      [lng + size, lat + size],
      [lng - size, lat + size],
      [lng - size, lat - size]
    ];

    if (map.current.getSource('block-highlight')) {
      map.current.removeLayer('block-highlight-layer');
      map.current.removeSource('block-highlight');
    }

    map.current.addSource('block-highlight', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        }
      }
    });

    map.current.addLayer({
      id: 'block-highlight-layer',
      type: 'fill',
      source: 'block-highlight',
      paint: {
        'fill-color': '#FF0000',
        'fill-opacity': 0.3
      }
    });
  };

  const closePopup = () => {
    setSelectedArticle(null);
    setPopupCoordinates(null);
    if (selectedBuildingId) {
      map.current.setFeatureState(
        { source: 'composite', sourceLayer: 'building', id: selectedBuildingId },
        { selected: false }
      );
      setSelectedBuildingId(null);
    }
  };

  const getBuildingShape = (lng, lat) => {
    if (!map.current) return null;

    const point = map.current.project([lng, lat]);
    const width = 10;
    const height = 10;

    const features = map.current.queryRenderedFeatures(
      [
        [point.x - width / 2, point.y - height / 2],
        [point.x + width / 2, point.y + height / 2]
      ],
      { layers: ['3d-buildings'] }
    );

    if (features.length > 0) {
      const closestBuilding = features[0];
      const shape = polygon(closestBuilding.geometry.coordinates);
      setBuildingShape(shape);
      return shape;
    }

    return null;
  };

  const extractBuildingCore = (shape) => {
    if (!shape) return null;
    return buffer(shape, -10, { units: 'meters' });
  };

  const calculatePerimeter = (shape) => {
    if (!shape) return 0;
    return length(polygonToLine(shape), { units: 'meters' });
  };

  const handleAnalysis = () => {
    if (!selectedArticle || !selectedArticle.location) return;

    const { latitude, longitude } = selectedArticle.location;
    const shape = getBuildingShape(longitude, latitude);

    if (shape) {
      const perimeter = calculatePerimeter(shape);
      const core = extractBuildingCore(shape);

      console.log('Building Perimeter:', perimeter.toFixed(2), 'meters');

      // Add the building shape to the map
      if (map.current.getSource('building-shape')) {
        map.current.removeLayer('building-shape-layer');
        map.current.removeSource('building-shape');
      }

      map.current.addSource('building-shape', {
        type: 'geojson',
        data: shape
      });

      map.current.addLayer({
        id: 'building-shape-layer',
        type: 'fill',
        source: 'building-shape',
        paint: {
          'fill-color': '#FF4136',
          'fill-opacity': 0.5
        }
      });

      // Add the building core to the map
      if (map.current.getSource('building-core')) {
        map.current.removeLayer('building-core-layer');
        map.current.removeSource('building-core');
      }

      map.current.addSource('building-core', {
        type: 'geojson',
        data: core
      });

      map.current.addLayer({
        id: 'building-core-layer',
        type: 'fill',
        source: 'building-core',
        paint: {
          'fill-color': '#4CAF50',
          'fill-opacity': 0.5
        }
      });

      // Fly to the building with a top-down view
      map.current.flyTo({
        center: [longitude, latitude],
        zoom: 19,
        pitch: 0,
        bearing: 0,
        essential: true,
        duration: 1000
      });

      // Fit the map to the building shape
      const bounds = new mapboxgl.LngLatBounds();
      shape.geometry.coordinates[0].forEach(coord => bounds.extend(coord));
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 19,
        duration: 1000
      });
    }

    setShowFloorPlan(!showFloorPlan);
  };

  const handleFinance = () => {
    if (!selectedArticle || !selectedArticle.financial_metrics) {
      console.log("No article selected or no financial metrics available");
      return;
    }

    console.log("Selected article:", selectedArticle);

    const financialMetrics = selectedArticle.financial_metrics;

    console.log("Financial metrics:", financialMetrics);

    const financialContent = `
      <div style="position: relative; padding-top: 30px;">
        <button onclick="window.handleBackToOriginal()" style="position: absolute; top: 0; left: 0; background: none; border: none; color: #fff; cursor: pointer; font-size: 20px; padding: 0; margin: 0;">←</button>
        <h3 style="color: #FF4136; margin: 0 0 20px 0; text-align: left;">Financial Information</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Acquisition Cost</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">
              <span style="background-color: #007bff; color: white; padding: 2px 5px; border-radius: 3px;">$${financialMetrics.acquisition_cost.total.toLocaleString()}</span>
              <br>
              <small>$${financialMetrics.acquisition_cost.per_sf}/sf</small>
            </td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Renovation Cost</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">
              <span style="background-color: #28a745; color: white; padding: 2px 5px; border-radius: 3px;">$${financialMetrics.renovation_cost.total.toLocaleString()}</span>
              <br>
              <small>$${financialMetrics.renovation_cost.per_sf}/sf</small>
            </td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Total Project Cost</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">
              <span style="background-color: #17a2b8; color: white; padding: 2px 5px; border-radius: 3px;">$${financialMetrics.total_project_cost.total.toLocaleString()}</span>
              <br>
              <small>$${financialMetrics.total_project_cost.per_sf}/sf</small>
            </td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Projected Revenue</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">
              Year 1: $${financialMetrics.projected_revenue.year_1.toLocaleString()}<br>
              Year 5: $${financialMetrics.projected_revenue.year_5.toLocaleString()}
            </td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Operating Expenses</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">
              Year 1: $${financialMetrics.operating_expenses.year_1.toLocaleString()}<br>
              Year 5: $${financialMetrics.operating_expenses.year_5.toLocaleString()}
            </td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Projected NOI</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">
              Year 1: $${financialMetrics.projected_noi.year_1.toLocaleString()}<br>
              Year 5: $${financialMetrics.projected_noi.year_5.toLocaleString()}<br>
              Year 6: $${financialMetrics.projected_noi.year_6.toLocaleString()}
            </td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Cash on Cash Return</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">
              Year 1: ${financialMetrics.cash_on_cash_return.year_1}%<br>
              Year 5: ${financialMetrics.cash_on_cash_return.year_5}%
            </td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Debt Service Coverage Ratio</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">
              Year 1: ${financialMetrics.debt_service_coverage_ratio.year_1}<br>
              Year 5: ${financialMetrics.debt_service_coverage_ratio.year_5}
            </td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Break-even Occupancy</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">${financialMetrics.break_even_occupancy}%</td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Estimated Stabilized Value</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">$${financialMetrics.estimated_stabilized_value.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Projected Equity Multiple</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">${financialMetrics.projected_equity_multiple}x</td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Internal Rate of Return (IRR)</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">${financialMetrics.internal_rate_of_return}%</td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Projected IRR</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">
              <span style="background-color: #ffc107; color: black; padding: 2px 5px; border-radius: 3px;">${financialMetrics.projected_irr}%</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Projected ROI</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">
              Year 1: ${financialMetrics.projected_roi.year_1}%<br>
              Year 5: ${financialMetrics.projected_roi.year_5}%
            </td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Projected Multiple</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">${financialMetrics.projected_multiple}x</td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Exit Cap Rate</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">${financialMetrics.exit_cap_rate}%</td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Gross Asset Value</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">
              <span style="background-color: #20c997; color: white; padding: 2px 5px; border-radius: 3px;">$${financialMetrics.gross_asset_value.total.toLocaleString()}</span>
              <br>
              <small>$${financialMetrics.gross_asset_value.per_sf}/sf</small>
            </td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Net Sale Proceeds</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">
              <span style="background-color: #6f42c1; color: white; padding: 2px 5px; border-radius: 3px;">$${financialMetrics.net_sale_proceeds.total.toLocaleString()}</span>
              <br>
              <small>$${financialMetrics.net_sale_proceeds.per_sf}/sf</small>
            </td>
          </tr>
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">Tax Incentives</td>
            <td style="padding: 5px; border-bottom: 1px solid #ddd;">
              ${financialMetrics.tax_incentives.map(incentive => `
                <p><strong>${incentive.type}:</strong> ${incentive.value}</p>
              `).join('')}
            </td>
          </tr>
        </table>
        <div style="height: 20px;"></div> <!-- Add extra space at the bottom -->
      </div>
    `;

    console.log("Financial content created");
    setPopupContent(financialContent);
    setIsZoningView(false);
    console.log("Popup content updated in state");

    // Center the map on the selected location and zoom in
    map.current.flyTo({
      center: [selectedArticle.location.longitude, selectedArticle.location.latitude],
      zoom: 17,
      duration: 1000
    });
  };

  const highlightFinancialArea = (lng, lat) => {
    // Remove existing financial highlight layer if it exists
    if (map.current.getLayer('financial-highlight')) {
      map.current.removeLayer('financial-highlight');
    }
    if (map.current.getSource('financial-highlight')) {
      map.current.removeSource('financial-highlight');
    }

    // Center the map on the selected location and zoom in
    map.current.flyTo({
      center: [lng, lat],
      zoom: 17,  // Adjust this value to get the desired zoom level
      duration: 1000  // Animation duration in milliseconds
    });
  };

  const highlightZoningArea = (lng, lat) => {
    const size = 0.002; // Adjust this value to change the size of the highlighted area
    const coordinates = [
      [lng - size, lat - size],
      [lng + size, lat - size],
      [lng + size, lat + size],
      [lng - size, lat + size],
      [lng - size, lat - size]
    ];

    if (map.current.getSource('zoning-highlight')) {
      map.current.removeLayer('zoning-highlight');
      map.current.removeSource('zoning-highlight');
    }

    map.current.addSource('zoning-highlight', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        }
      }
    });

    map.current.addLayer({
      id: 'zoning-highlight',
      type: 'fill',
      source: 'zoning-highlight',
      paint: {
        'fill-color': '#FF0000',
        'fill-opacity': 0.3,
        'fill-outline-color': '#FF0000'
      }
    });

    // Fit map to zoning area
    const bounds = coordinates.reduce((bounds, coord) => {
      return bounds.extend(coord);
    }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

    map.current.fitBounds(bounds, { padding: 50 });
  };

  const handleZoning = () => {
    if (!selectedArticle || !selectedArticle.regulatory_info) {
      console.log("No article selected or no regulatory info available");
      return;
    }

    console.log("Selected article:", selectedArticle);

    setIsZoningView(true); // Set zoning view to true
    setPopupContent(null); // Clear any existing popup content

    // Highlight the zoning area
    if (selectedArticle.location && selectedArticle.location.longitude && selectedArticle.location.latitude) {
      highlightZoningArea(selectedArticle.location.longitude, selectedArticle.location.latitude);
    } else {
      console.log("Unable to highlight zoning area: missing location data");
    }
  };

  const handleBackToOriginal = () => {
    setPopupContent(null);
    setIsZoningView(false);

    // Remove zoning highlight
    if (map.current.getLayer('zoning-highlight')) {
      map.current.removeLayer('zoning-highlight');
    }
    if (map.current.getSource('zoning-highlight')) {
      map.current.removeSource('zoning-highlight');
    }

    // Remove financial highlight
    if (map.current.getLayer('financial-highlight')) {
      map.current.removeLayer('financial-highlight');
    }
    if (map.current.getSource('financial-highlight')) {
      map.current.removeSource('financial-highlight');
    }

    // Re-highlight only the building
    if (selectedBuildingId) {
      map.current.setFeatureState(
        { source: 'composite', sourceLayer: 'building', id: selectedBuildingId },
        { selected: true }
      );
    }
  };

  // Set the global function when the component mounts
  useEffect(() => {
    window.handleBackToOriginal = handleBackToOriginal;
    return () => {
      window.handleBackToOriginal = null;
    };
  }, []);

  // Add this function to handle popup resizing
  const handlePopupResize = (widthChange, heightChange) => {
    setPopupWidth(prevWidth => Math.max(300, Math.min(800, prevWidth + widthChange)));
    setPopupHeight(prevHeight => {
      const currentHeight = parseInt(prevHeight);
      const newHeight = Math.max(30, Math.min(95, currentHeight + heightChange));
      return `${newHeight}vh`;
    });
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = popupRef.current.offsetWidth;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(300, Math.min(800, startWidth + deltaX));
      requestAnimationFrame(() => {
        setPopupWidth(newWidth);
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Add this useEffect hook to handle the ESC key press
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        setSelectedArticle(null);
      }
    };

    document.addEventListener('keydown', handleEscKey);

    // Cleanup function to remove the event listener
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, []);

  const calculateValidationScore = (original, updated) => {
    if (!original || !updated) {
      console.error('Invalid input for calculateValidationScore:', { original, updated });
      return 0;
    }

    let matchingFields = 0;
    let totalFields = 0;

    for (const key in original) {
      if (original.hasOwnProperty(key) && updated.hasOwnProperty(key)) {
        totalFields++;
        if (JSON.stringify(original[key]) === JSON.stringify(updated[key])) {
          matchingFields++;
        }
      }
    }

    return totalFields > 0 ? (matchingFields / totalFields) * 100 : 0;
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setShowTypewriter(true);
    setValidationError(null);

    const attemptValidation = async (attempt) => {
      try {
        console.log(`Sending validation request for: ${selectedArticle.location.address}, attempt ${attempt}`);
        console.log('API URL:', API_URL);  // Add this line
        const response = await axios.post(`${API_URL}/validate`, selectedArticle, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        console.log("Received response:", response);
        if (response.data && response.data.original && response.data.updated) {
          setValidatedData(response.data);
          const score = calculateValidationScore(response.data.original, response.data.updated);
          setValidationScore(score);
          setLastValidationTime(new Date().toLocaleString());
          setShowComparison(true);
          setRetryCount(0);
        } else {
          throw new Error('Invalid response data');
        }
      } catch (error) {
        console.error('Error validating data:', error);
        console.error('Error details:', error.response ? error.response.data : 'No response data');  // Add this line
        if (attempt < MAX_RETRIES) {
          console.log(`Retrying validation (${attempt + 1}/${MAX_RETRIES})...`);
          setRetryCount(attempt);
          await new Promise(resolve => setTimeout(resolve, 2000));
          await attemptValidation(attempt + 1);
        } else {
          setValidationError(`Validation failed after ${MAX_RETRIES} attempts. Please try again later.`);
        }
      }
    };

    await attemptValidation(1);

    setIsValidating(false);
    setShowTypewriter(false);
  };

  const handleMatchResults = async (event) => {
    event.preventDefault();
    console.log('Map: handleMatchResults called');

    try {
      const updatedDataWithOriginalLocation = {
        ...validatedData.updated,
        location: {
          ...validatedData.updated.location,
          latitude: selectedArticle.location.latitude,
          longitude: selectedArticle.location.longitude,
          address: selectedArticle.location.address
        },
        image_url: selectedArticle.image_url
      };

      console.log('Map: Sending request to /apply');
      const response = await axios.post(`${API_URL}/apply`, updatedDataWithOriginalLocation, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      
      console.log('Map: Received response from /apply:', response.data);
      if (response.data.status === 'success') {
        console.log('Map: Setting matchedResults to true');
        setMatchedResults(true);
        
        const updatedBuilding = response.data.updatedBuilding;
        
        console.log('Map: Updating validatedData');
        setValidatedData(prevState => ({
          original: selectedArticle,
          updated: updatedBuilding
        }));
        
        console.log('Map: Updating selectedArticle');
        setSelectedArticle(updatedBuilding);
        
        console.log('Map: Updating articles locally');
        const updatedArticles = articles.map(article => 
          article.location.address === updatedBuilding.location.address ? updatedBuilding : article
        );
        
        // Update markers
        updateMarkers(updatedArticles);
        
        console.log('Map: Setting timeout to reset matchedResults');
        setTimeout(() => {
          console.log('Map: Resetting matchedResults to false');
          setMatchedResults(false);
        }, 3000);
      } else {
        throw new Error('Server responded with non-success status');
      }
    } catch (error) {
      console.error('Map: Error matching results:', error);
      let errorMessage = 'Failed to match results. Please try again.';
      if (error.response) {
        console.error('Map: Error data:', error.response.data);
        console.error('Map: Error status:', error.response.status);
        errorMessage += ` Server responded with status ${error.response.status}.`;
      } else if (error.request) {
        console.error('Map: Error request:', error.request);
        errorMessage += ' No response received from server.';
      } else {
        console.error('Map: Error message:', error.message);
        errorMessage += ` Error: ${error.message}`;
      }
      console.log('Map: Setting error message:', errorMessage);
      setErrorMessage(errorMessage);
    }
    console.log('Map: handleMatchResults completed');
  };

  const countUpdatedItems = (original, updated) => {
    let count = 0;
    for (const key in updated) {
      if (JSON.stringify(original[key]) !== JSON.stringify(updated[key])) {
        count++;
      }
    }
    return count;
  };

  const toggleExistingData = () => {
    setIsExistingDataExpanded(!isExistingDataExpanded);
  };

  const renderJsonDiff = (original, updated) => {
    const allKeys = new Set([...Object.keys(original), ...Object.keys(updated)]);
    return Array.from(allKeys).map(key => {
      if (key === 'image_url') {
        // Skip comparison for image_url
        return (
          <div key={key} style={{ marginBottom: '5px' }}>
            <strong>{key}:</strong>{' '}
            <span style={{ color: '#888' }}>{JSON.stringify(original[key])}</span>
          </div>
        );
      }

      const originalValue = original[key];
      const updatedValue = updated[key];
      const isDifferent = JSON.stringify(originalValue) !== JSON.stringify(updatedValue);

      return (
        <div key={key} style={{ marginBottom: '5px' }}>
          <strong>{key}:</strong>{' '}
          {isDifferent ? (
            <>
              <span style={{ color: '#888' }}>{JSON.stringify(originalValue)}</span>
              {' → '}
              <span style={{ color: '#FF4136' }}>{JSON.stringify(updatedValue)}</span>
            </>
          ) : (
            <span style={{ color: '#888' }}>{JSON.stringify(originalValue)}</span>
          )}
        </div>
      );
    });
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      {selectedArticle && popupCoordinates && (
        <div 
          ref={popupRef}
          style={{
            position: 'absolute',
            left: '10px',
            top: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            padding: '10px',
            borderRadius: '5px',
            width: `${popupWidth}px`,
            maxHeight: '95vh',
            overflowY: 'auto',
            maxWidth: '90vw',
          }}
        >
          {/* Original popup content */}
          <h2 style={{ 
            color: '#FFFFFF', 
            marginTop: '0', 
            marginBottom: '10px',
            fontWeight: 'bold',
            fontSize: '1.2em'
          }}>
            {selectedArticle.location.address || 'N/A'}, {selectedArticle.location.neighborhood || ''} {selectedArticle.location.city || 'Unknown City'}, {selectedArticle.location.state || 'Unknown State'}
          </h2>
          <p style={{ 
            color: '#AAAAAA', 
            fontSize: '0.9em', 
            marginTop: '0', 
            marginBottom: '20px' 
          }}>
            Completion Date: {selectedArticle.completion_date || 'Unknown'}
          </p>
          {selectedArticle.image_url && (
            <img
              src={selectedArticle.image_url}
              alt={selectedArticle.title}
              style={{ maxWidth: '100%', height: 'auto', marginBottom: '20px' }}
            />
          )}
          <div style={{ display: 'flex', gap: '1px', marginBottom: '20px' }}>
            <button
              onClick={handleAnalysis}
              style={{
                backgroundColor: '#333',
                color: '#FFFFFF',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                flex: 1,
                transition: 'background-color 0.3s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#444'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#333'}
            >
              PLAN
            </button>
            <button
              onClick={handleFinance}
              style={{
                backgroundColor: '#333',
                color: '#FFFFFF',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                flex: 1,
                transition: 'background-color 0.3s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#444'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#333'}
            >
              FINANCE
            </button>
            <button
              onClick={handleZoning}
              style={{
                backgroundColor: '#333',
                color: '#FFFFFF',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                flex: 1,
                transition: 'background-color 0.3s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#444'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#333'}
            >
              ZONING
            </button>
          </div>

          {isZoningView ? (
            <ZoningMetrics />
          ) : (
            <>
              {/* Default view content */}
              <p>
                <i className="fas fa-exchange-alt" style={{ marginRight: '5px' }}></i>
                <strong>Adaptive Reuse:</strong> {selectedArticle.property_type || 'N/A'} to {selectedArticle.new_use || 'N/A'}
              </p>
              {selectedArticle.size && (
                <p>
                  <i className="fas fa-ruler-combined" style={{ marginRight: '5px' }}></i>
                  <strong>Project Size:</strong> {selectedArticle.size}
                </p>
              )}
              {selectedArticle.proposed_units && (
                <p>
                  <i className="fas fa-home" style={{ marginRight: '5px' }}></i>
                  <strong>Proposed Units:</strong> {selectedArticle.proposed_units}
                </p>
              )}
              {selectedArticle.stories && (
                <p>
                  <i className="fas fa-building" style={{ marginRight: '5px' }}></i>
                  <strong>Stories:</strong> {selectedArticle.stories}
                </p>
              )}
              {selectedArticle.cost && (
                <p>
                  <i className="fas fa-dollar-sign" style={{ marginRight: '5px' }}></i>
                  <strong>Estimated Cost:</strong> {selectedArticle.cost}
                </p>
              )}
              {selectedArticle.developer && (
                <p>
                  <i className="fas fa-hard-hat" style={{ marginRight: '5px' }}></i>
                  <strong>Developer:</strong> {selectedArticle.developer}
                </p>
              )}
              {selectedArticle.current_owner && (
                <p>
                  <i className="fas fa-user" style={{ marginRight: '5px' }}></i>
                  <strong>Current Owner:</strong> {selectedArticle.current_owner}
                </p>
              )}
              {selectedArticle.completion_date && (
                <p>
                  <i className="fas fa-calendar-check" style={{ marginRight: '5px' }}></i>
                  <strong>Expected Completion:</strong> {selectedArticle.completion_date}
                </p>
              )}
              {selectedArticle.expected_sale_completion && (
                <p>
                  <i className="fas fa-handshake" style={{ marginRight: '5px' }}></i>
                  <strong>Expected Sale Completion:</strong> {selectedArticle.expected_sale_completion}
                </p>
              )}
              {selectedArticle.market_trend && (
                <p>
                  <i className="fas fa-chart-line" style={{ marginRight: '5px' }}></i>
                  <strong>Market Trend:</strong> {selectedArticle.market_trend}
                </p>
              )}
              {selectedArticle.related_initiative && (
                <p>
                  <i className="fas fa-project-diagram" style={{ marginRight: '5px' }}></i>
                  <strong>Related Initiative:</strong> {selectedArticle.related_initiative}
                </p>
              )}
              {selectedArticle.broker && (
                <p>
                  <i className="fas fa-user-tie" style={{ marginRight: '5px' }}></i>
                  <strong>Broker:</strong> {selectedArticle.broker}
                </p>
              )}
            </>
          )}

          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(selectedArticle.title)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#FF0000', textDecoration: 'none', display: 'block', marginTop: '10px' }}
          >
            See more
          </a>

          {/* Validation button */}
          <button
            onClick={handleValidate}
            style={{
              backgroundColor: '#333',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              marginTop: '20px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#FF4136' }}>
              {isValidating ? `Validating... (Attempt ${retryCount + 1}/${MAX_RETRIES})` : 'Validate'}
            </span>
            {lastValidationTime && (
              <span style={{ 
                color: '#888', 
                fontSize: '12px', 
                marginTop: '5px' 
              }}>
                Last: {lastValidationTime}
              </span>
            )}
          </button>

          {validationError && (
            <div style={{
              backgroundColor: '#FF4136',
              color: 'white',
              padding: '10px',
              borderRadius: '5px',
              marginTop: '10px',
              fontSize: '14px'
            }}>
              {validationError}
            </div>
          )}

          {showTypewriter && !validationError && (
            <div style={{ 
              marginTop: '10px', 
              padding: '10px', 
              backgroundColor: '#222', 
              borderRadius: '5px',
              fontSize: '14px',
              color: '#4CAF50'
            }}>
              <Typewriter
                options={{
                  strings: typewriterLines,
                  autoStart: true,
                  loop: true,
                  delay: 15,
                  deleteSpeed: 5,
                }}
              />
            </div>
          )}

          {showComparison && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ color: '#FF4136' }}>Validation Results</h3>
              <p style={{ 
                fontSize: '18px', 
                fontWeight: 'bold', 
                color: '#fff', 
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center'
              }}>
                Validation Score: 
                <span style={{ color: '#4CAF50', marginLeft: '5px' }}>
                  {(validationScore || 100).toFixed(2)}%
                </span>
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: '48%' }}>
                  <h4 style={{ color: '#FF4136' }}>Existing Data</h4>
                  <div 
                    ref={existingDataRef}
                    onScroll={() => handleScroll('existing')}
                    style={{ 
                      backgroundColor: '#222',
                      color: '#fff',
                      padding: '10px',
                      borderRadius: '5px',
                      height: '300px',
                      overflowY: 'auto',
                      fontSize: '12px',
                      fontWeight: 'normal'
                    }}
                  >
                    {renderJsonDiff(validatedData.original, validatedData.updated)}
                  </div>
                </div>
                <div style={{ width: '48%' }}>
                  <h4 style={{ color: '#FF4136' }}>Updated Data</h4>
                  <div 
                    ref={updatedDataRef}
                    onScroll={() => handleScroll('updated')}
                    style={{ 
                      backgroundColor: '#222',
                      color: '#fff',
                      padding: '10px',
                      borderRadius: '5px',
                      height: '300px',
                      overflowY: 'auto',
                      fontSize: '12px',
                      fontWeight: 'normal'
                    }}
                  >
                    {renderJsonDiff(validatedData.original, validatedData.updated)}
                  </div>
                </div>
              </div>
              <button
                onClick={handleMatchResults}
                style={{
                  backgroundColor: '#000',
                  color: 'white',
                  border: '0.2px solid white',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  marginTop: '20px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Match Results
                {matchedResults && (
                  <FaCheck style={{ color: '#4CAF50', marginLeft: '10px' }} />
                )}
              </button>
              <p style={{
                color: '#888',
                fontSize: '12px',
                marginTop: '5px',
                textAlign: 'center'
              }}>
                {matchedResults ? 'Data matched successfully' : `${countUpdatedItems(validatedData.original, validatedData.updated)} items will be updated`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Map;