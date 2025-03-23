# Houston Map Visualization Project

This project is an interactive map visualization focused on Houston, using Mapbox GL JS with React. It includes several data layers (GeoJSON) that can be toggled on/off to display various insights about the area.

## Project Overview

This application uses:
- **React** for the UI components and state management
- **Mapbox GL JS** for map rendering and layer management
- **GeoJSON data** stored in the public folder for various map layers
- **AI integration** to analyze and highlight insights on the map

## Documentation Guides

This project includes several guides to help you understand and extend the codebase:

1. [**Layers Guide**](./LAYERS_GUIDE.md) - Detailed explanation of map layers and how they work
2. [**AI Integration Guide**](./AI_INTEGRATION_GUIDE.md) - How the AI is integrated with the map
3. [**Tutorial: Adding a New Layer**](./TUTORIAL_ADD_LAYER.md) - Step-by-step tutorial for adding new map layers

## Getting Started

### Prerequisites
- Node.js (v14 or newer)
- npm or yarn
- Mapbox access token

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd Example_v01
```

2. Install dependencies
```bash
# For the main project
npm install

# For the remote React app
cd remote
npm install
```

3. Create a `.env` file in the root and remote directories with your Mapbox token:
```
REACT_APP_MAPBOX_TOKEN=your_mapbox_token_here
```

4. Start the development server
```bash
# Navigate to the remote directory
cd remote
npm start
```

### Cleanup Script

The project includes a cleanup script to remove unnecessary files:

```bash
chmod +x cleanup.sh
./cleanup.sh
```

## Project Structure

The project is organized as follows:

```
Example_v01/
├── atlas/                  # Python backend services
├── remote/                 # React frontend application
│   ├── public/             # Public assets and GeoJSON data files
│   ├── src/                # React source code
│   │   ├── components/     # React components
│   │   │   ├── Map/        # Map-related components
│   │   │   │   ├── hooks/  # React hooks for map functionality
│   │   │   │   ├── index.jsx # Main Map component
│   │   │   │   └── utils.js  # Utility functions for the map
│   │   ├── services/       # API services, including AI integration
│   │   ├── App.js          # Main React App component
│   │   └── index.js        # React entry point
│   └── package.json        # Frontend dependencies
└── README.md               # This file
```

## Key Components

### Main Entry Point (`remote/src/index.js`)

The application starts from `index.js` which renders the main `App` component that contains the map visualization.

### Map Component (`remote/src/components/Map/index.jsx`)

This is the central component that:
1. Initializes the Mapbox map
2. Manages the map state
3. Controls layer visibility
4. Handles user interactions

### Map Utilities (`remote/src/components/Map/utils.js`)

Contains helper functions for:
- Initializing map layers
- Computing data for visualizations
- Managing map animations
- Creating UI controls like layer toggles

### Map Hooks (`remote/src/components/Map/hooks/`)

Custom React hooks that encapsulate map functionality:
- `useMapAnimation.js`: Manages animation effects on the map
- `useCensusData.js`: Handles census data integration
- `useAINavigator.js`: Integrates AI analysis of map data

## Map Layers

The map uses several GeoJSON layers stored in the `remote/public/` directory:

- Houston census blocks
- Harvey flood data
- ZIP code boundaries
- And more

These layers can be toggled on/off using UI controls.

## Layer Toggle System

The application implements a toggle system that allows users to show/hide different map layers:

1. Toggle components are created in `utils.js` with the `createPOIToggle` function
2. Each toggle controls the visibility of a specific layer
3. The toggle state is managed with React state in the Map component

## How to Add a New Layer

For detailed steps on adding a new layer, see the [**Tutorial: Adding a New Layer**](./TUTORIAL_ADD_LAYER.md) guide.

## AI Integration

For detailed information on the AI integration, see the [**AI Integration Guide**](./AI_INTEGRATION_GUIDE.md).

## Additional Resources

- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/api/)
- [React Documentation](https://reactjs.org/docs/getting-started.html)
- [GeoJSON Specification](https://geojson.org/) 