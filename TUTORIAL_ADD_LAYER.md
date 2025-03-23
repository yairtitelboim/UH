# Tutorial: Adding a New Map Layer

This step-by-step tutorial will guide you through the process of adding a new map layer to the Houston Map Visualization project. We'll create a simple "Points of Interest" layer as an example.

## Prerequisites

Before starting, make sure you have:
- The project set up and running locally
- A GeoJSON file to add as a layer (or you can create one)
- Basic understanding of React and Mapbox GL JS

## Step 1: Prepare Your GeoJSON Data

Let's create a simple GeoJSON file for points of interest in Houston.

1. Create a new file called `houston_poi.geojson` in the `remote/public/` directory with this content:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Houston Museum of Natural Science",
        "type": "museum",
        "description": "Major science museum with exhibits on natural science, space, and more."
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-95.3901, 29.7221]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Space Center Houston",
        "type": "attraction",
        "description": "Visitor center for NASA's Johnson Space Center."
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-95.0988, 29.5519]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "Buffalo Bayou Park",
        "type": "park",
        "description": "Urban park with trails, bike paths, and recreational areas."
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-95.3863, 29.7615]
      }
    }
  ]
}
```

## Step 2: Modify the Map Component

Now, let's add the code to load and display this layer. We'll edit the main Map component:

1. Open `remote/src/components/Map/index.jsx`

2. Find the section where other layers are initialized (look for a `useEffect` with map initialization)

3. Add the following code inside that effect, after other layer initializations:

```javascript
// Load POI data
const loadPOILayer = async () => {
  try {
    // Fetch the GeoJSON file
    const response = await fetch('/houston_poi.geojson');
    const poiData = await response.json();
    
    // Add the source
    map.current.addSource('houston-poi', {
      type: 'geojson',
      data: poiData
    });
    
    // Add a circle layer for the points
    map.current.addLayer({
      'id': 'houston-poi-circles',
      'type': 'circle',
      'source': 'houston-poi',
      'paint': {
        'circle-radius': 8,
        'circle-color': [
          'match',
          ['get', 'type'],
          'museum', '#FF8C00',   // Orange for museums
          'attraction', '#1E90FF', // Blue for attractions
          'park', '#228B22',     // Green for parks
          '#888888'              // Default gray
        ],
        'circle-opacity': 0.8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFFFFF'
      }
    });
    
    // Add a symbol layer for labels
    map.current.addLayer({
      'id': 'houston-poi-labels',
      'type': 'symbol',
      'source': 'houston-poi',
      'layout': {
        'text-field': ['get', 'name'],
        'text-size': 12,
        'text-offset': [0, 1.5],
        'text-anchor': 'top'
      },
      'paint': {
        'text-color': '#333',
        'text-halo-color': '#FFF',
        'text-halo-width': 1
      }
    });
    
    console.log('POI layer loaded successfully');
  } catch (error) {
    console.error('Error loading POI layer:', error);
  }
};

// Call the function
loadPOILayer();
```

## Step 3: Add a Toggle for the Layer

Now, let's add a toggle to show/hide the POI layer:

1. Find the section where other toggles are defined in the same file or in a separate component

2. Add the following code to create a toggle:

```javascript
// Create a toggle for POI layer
const [poiVisible, setPoiVisible] = useState(true); // Add this at the top with other state variables

// Add this in the JSX part of your component:
<div className="map-control poi-toggle">
  <label className="toggle-label">
    <input
      type="checkbox"
      checked={poiVisible}
      onChange={(e) => {
        const visible = e.target.checked;
        setPoiVisible(visible);
        
        // Toggle the visibility of both POI layers
        if (map.current) {
          map.current.setLayoutProperty(
            'houston-poi-circles',
            'visibility',
            visible ? 'visible' : 'none'
          );
          map.current.setLayoutProperty(
            'houston-poi-labels',
            'visibility',
            visible ? 'visible' : 'none'
          );
        }
      }}
    />
    <span>Points of Interest</span>
  </label>
</div>
```

## Step 4: Add Interaction with the POI Layer

Let's add a popup that shows when users click on a POI:

```javascript
// Add this inside the useEffect after map initialization
map.current.on('click', 'houston-poi-circles', (e) => {
  // Get the clicked feature
  const feature = e.features[0];
  
  // Create popup content
  const popupContent = `
    <div class="poi-popup">
      <h3>${feature.properties.name}</h3>
      <p><strong>Type:</strong> ${feature.properties.type}</p>
      <p>${feature.properties.description}</p>
    </div>
  `;
  
  // Create and add the popup
  new mapboxgl.Popup()
    .setLngLat(feature.geometry.coordinates)
    .setHTML(popupContent)
    .addTo(map.current);
});

// Change cursor to pointer when hovering over POI
map.current.on('mouseenter', 'houston-poi-circles', () => {
  map.current.getCanvas().style.cursor = 'pointer';
});

// Change cursor back when leaving POI
map.current.on('mouseleave', 'houston-poi-circles', () => {
  map.current.getCanvas().style.cursor = '';
});
```

## Step 5: Add Some CSS Styling

Add some CSS styles to make your POI layer look nice:

1. Open your CSS file (or create a new one if needed)

2. Add the following styles:

```css
.poi-toggle {
  position: absolute;
  top: 10px;
  right: 10px;
  background: white;
  padding: 10px;
  border-radius: 4px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  z-index: 1;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.poi-popup h3 {
  margin-top: 0;
  margin-bottom: 8px;
  color: #333;
}

.poi-popup p {
  margin: 0 0 8px;
  font-size: 14px;
}
```

## Step 6: Test Your New Layer

1. Start the development server if it's not running:

```bash
cd remote
npm start
```

2. Open your browser and navigate to the application

3. You should see your POI markers on the map, and you can toggle their visibility using the checkbox

4. Click on a POI to see the popup with details

## Step 7: Refine Your Layer (Optional)

Here are some ways to enhance your layer:

### Add layer filtering:

```javascript
// Add buttons to filter POIs by type
<div className="poi-filters">
  <button onClick={() => filterPOIs('all')}>All</button>
  <button onClick={() => filterPOIs('museum')}>Museums</button>
  <button onClick={() => filterPOIs('attraction')}>Attractions</button>
  <button onClick={() => filterPOIs('park')}>Parks</button>
</div>

// Add this function to your component
const filterPOIs = (type) => {
  if (!map.current) return;
  
  if (type === 'all') {
    // Show all POIs
    map.current.setFilter('houston-poi-circles', null);
    map.current.setFilter('houston-poi-labels', null);
  } else {
    // Filter by type
    const filter = ['==', ['get', 'type'], type];
    map.current.setFilter('houston-poi-circles', filter);
    map.current.setFilter('houston-poi-labels', filter);
  }
};
```

### Animate the POIs on load:

```javascript
// Add animation when the POIs load
const animatePOIs = () => {
  let start;
  
  function animate(timestamp) {
    if (!start) start = timestamp;
    const progress = (timestamp - start) / 1000;
    
    // Animate the size of circles for 1 second
    if (progress < 1) {
      map.current.setPaintProperty(
        'houston-poi-circles',
        'circle-radius',
        ['interpolate', ['linear'], ['zoom'], 
          10, progress * 8,
          16, progress * 12
        ]
      );
      requestAnimationFrame(animate);
    } else {
      // Set final size
      map.current.setPaintProperty(
        'houston-poi-circles',
        'circle-radius',
        ['interpolate', ['linear'], ['zoom'], 
          10, 8,
          16, 12
        ]
      );
    }
  }
  
  requestAnimationFrame(animate);
};

// Call this after adding the layer
animatePOIs();
```

## Conclusion

Congratulations! You've successfully added a new map layer to the Houston Map Visualization project. You can use this same approach to add other types of data layers:

- Polygon layers (like neighborhoods, districts)
- Line layers (like roads, transit routes)
- Heatmap layers (for density visualization)
- 3D extrusion layers (for buildings, terrain)

The key steps are always the same:
1. Prepare your GeoJSON data
2. Add a source to the map
3. Add one or more layers that use the source
4. Add interactivity and styling
5. Create toggles or other UI controls 