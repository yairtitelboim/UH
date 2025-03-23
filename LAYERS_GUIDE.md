# Map Layers Guide

This document provides a detailed explanation of the map layers in the Houston Map Visualization project.

## Available GeoJSON Layers

The map includes the following GeoJSON data layers that can be toggled:

| Layer Name | File | Description |
|------------|------|-------------|
| Census Blocks | `houston-census-blocks.geojson` | Houston census block boundaries |
| Harvey Flood Data | `harvy1.geojson`, `harvy2.geojson` | Flood data from Hurricane Harvey |
| PMT Boundaries | `PMT_Snapshot_feat_Service_2649843124464894629.geojson` | PMT (Property Market Taxonomy) boundaries |
| Subdivision Boundaries | `Subdivision_Boundary.geojson` | Houston subdivision boundaries |
| ZIP Codes | `COH_ZIPCODES.geojson` | City of Houston ZIP code boundaries |
| MUD Districts | `MUD.geojson` | Municipal Utility Districts |
| Wastewater Outfalls | `Wastewater_Outfalls.geojson` | Wastewater discharge points |
| Surface Water | `Surface_Water.geojson` | Surface water features |
| Ground Water Wells | `Ground_Water_Well.geojson` | Ground water well locations |
| Buildings | `houston_buildings.geojson` | OpenStreetMap building data for Houston |

## How Layers Are Loaded

The map layers are loaded in several places in the codebase:

1. In the Map component's initialization effect (`remote/src/components/Map/index.jsx`)
2. In the `initializeMapLayers` function in `remote/src/components/Map/utils.js`
3. In specialized hooks like `useMapInitialization.js`

The basic pattern for loading a GeoJSON layer is:

```javascript
// 1. Fetch the GeoJSON data
const response = await fetch('/your-file.geojson');
const data = await response.json();

// 2. Add a source to the map
map.addSource('source-id', {
  type: 'geojson',
  data: data,
  generateId: true  // Optional, generates IDs automatically
});

// 3. Add a layer that uses the source
map.addLayer({
  'id': 'layer-id',
  'type': 'fill',  // Or 'line', 'circle', 'symbol', etc.
  'source': 'source-id',
  'paint': {
    // Paint properties control the appearance
    'fill-color': '#FF0000',
    'fill-opacity': 0.4,
    'fill-outline-color': '#000000'
  },
  'layout': {
    // Layout properties control visibility and other attributes
    'visibility': 'visible'  // or 'none' to hide initially
  }
});
```

## Layer Types

Mapbox supports several layer types that are used in this project:

- **fill**: For polygons like census blocks or ZIP codes
- **line**: For linear features like roads or pipelines
- **circle**: For point features like water wells
- **symbol**: For labeled points of interest
- **fill-extrusion**: For 3D buildings
- **heatmap**: For density visualizations

## Toggle System

The application includes a toggle system to show/hide layers. The toggle implementation is in `remote/src/components/Map/utils.js` in the `createPOIToggle` function.

Each toggle is created like this:

```javascript
const toggle = createPOIToggle(map, container, initialVisibility);
```

The toggle controls the layer visibility by calling:

```javascript
map.setLayoutProperty(
  'layer-id',
  'visibility',
  isVisible ? 'visible' : 'none'
);
```

## How to Add a New Layer

To add a new layer to the map:

1. Add your GeoJSON file to the `remote/public/` directory
2. In the Map component, add code to load your layer:

```javascript
// In a useEffect or initialization function:
const response = await fetch('/your-file.geojson');
const data = await response.json();

map.addSource('your-source-id', {
  type: 'geojson',
  data: data
});

map.addLayer({
  'id': 'your-layer-id',
  'type': 'fill',  // Choose appropriate type
  'source': 'your-source-id',
  'paint': {
    // Set appearance properties
  },
  'layout': {
    'visibility': 'visible'  // Initially visible
  }
});
```

3. Add a toggle for your layer:

```javascript
const yourLayerToggle = createPOIToggle(map, mapContainer, true);
```

4. Place the toggle in your UI by appending it to a container element

## Layer Styling

You can style layers using the `paint` properties. Common properties include:

- For fill layers:
  - `fill-color`: Color of the fill
  - `fill-opacity`: Transparency (0-1)
  - `fill-outline-color`: Color of the outline

- For line layers:
  - `line-color`: Color of the line
  - `line-width`: Width of the line
  - `line-opacity`: Transparency (0-1)

- For fill-extrusion (3D) layers:
  - `fill-extrusion-color`: Color of the 3D object
  - `fill-extrusion-height`: Height of the extrusion
  - `fill-extrusion-opacity`: Transparency (0-1)

## Layer Interactions

The map includes interactions with layers like:

- Highlighting on hover
- Showing information on click
- Feature state changes (like highlighting specific buildings)

To add interactions to your layer:

```javascript
// Add hover effect
map.on('mouseenter', 'your-layer-id', () => {
  map.getCanvas().style.cursor = 'pointer';
});

map.on('mouseleave', 'your-layer-id', () => {
  map.getCanvas().style.cursor = '';
});

// Add click handler
map.on('click', 'your-layer-id', (e) => {
  // Access the clicked feature
  const feature = e.features[0];
  
  // Show information about the feature
  new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML(`<h3>${feature.properties.name}</h3>`)
    .addTo(map);
});
```

## Troubleshooting

Common issues when working with map layers:

1. **Layer doesn't appear**: Check the visibility property and zoom level constraints
2. **GeoJSON data doesn't load**: Verify the file path and that the GeoJSON is valid
3. **Layer appears but isn't styled**: Check your paint properties
4. **Cannot interact with a layer**: Ensure you've set up the event listeners 