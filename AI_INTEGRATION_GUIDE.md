# AI Integration Guide

This document explains how AI, specifically Anthropic's Claude, is integrated into the Houston Map Visualization project to provide insights and analysis of geographic data.

## Overview

The application uses Claude AI to:

1. Analyze map data and provide insights about areas in Houston
2. Respond to user questions about visible map features
3. Help navigate to areas of interest
4. Identify patterns in data layers

## Architecture

The AI integration is structured in three main parts:

1. **Frontend Services** (`remote/src/services/claude.js`): Handles communication with the Claude API
2. **Backend Proxy** (`remote/server.js`): Proxies requests to Claude's API to protect the API key
3. **Analysis Components** (`atlas/clients/claude.py`): For more complex backend analysis

### Key Components

#### Frontend Claude Service

The main interface for AI interactions is implemented in `remote/src/services/claude.js`:

```javascript
// Function to send questions to Claude
export const askClaude = async (prompt, context = {}, mapBounds = null) => {
  // Build context with map data
  // Send request to backend proxy
  // Process and return the response
};

// Function to parse Claude's response
export const parseClaudeResponse = (response) => {
  // Extract structured data from Claude's response
};

// Handle user questions about the map
export const handlePanelQuestion = async (question, map, setMessages, setIsLoading) => {
  // Process question with map context
  // Update UI with response
};
```

#### AI Navigator Hook

The `useAINavigator` hook (`remote/src/components/Map/hooks/useAINavigator.js`) connects AI capabilities to the map:

```javascript
export class AINavigator {
  // Process user queries about the map
  async handlePrompt(prompt) {
    // Send to Claude with map context
    // Visualize the response on the map
  }
  
  // Build enhanced prompts with map context
  buildEnhancedPrompt(prompt, queryType, context) {
    // Add map data to make the prompt more effective
  }
  
  // Parse and visualize Claude's response on the map
  parseAndVisualizeResponse(response, queryType) {
    // Extract locations, layers to toggle, etc.
    // Apply changes to the map
  }
}
```

## Configuration

To use the AI features, you need to set up API keys:

1. Create a Claude API key from [Anthropic's Console](https://console.anthropic.com/)
2. Add it to your `.env` file:

```
CLAUDE_API_KEY=your_api_key_here
```

## How the AI Integration Works

### 1. Sending Map Context to Claude

When a user asks a question, the application:

1. Captures the current map state (viewport, visible layers, selected features)
2. Constructs a prompt that includes this context
3. Sends the prompt to Claude via the backend proxy

Example context object:

```javascript
{
  center: {lng: -95.3698, lat: 29.7604},  // Houston coordinates
  zoom: 12,
  bounds: [[-95.5, 29.6], [-95.2, 29.9]],
  layers: ["census-blocks", "flood-zones"],
  visibleFeatures: [...]  // Features in the current viewport
}
```

### 2. Structured Responses

Claude returns structured responses that the application can interpret:

```json
{
  "explanation": "Based on the flood data, I can see that...",
  "poiInfo": {
    "floodProne": ["77002", "77007"],
    "stats": {
      "averageDepth": 3.2,
      "affectedBuildings": 450
    }
  },
  "followUpSuggestions": [
    "Show me the most affected ZIP codes",
    "Compare flooding to building density"
  ]
}
```

### 3. Visualizing Insights

The application processes these responses to:

- Show popups with information
- Highlight features on the map
- Toggle relevant layers
- Navigate to points of interest

## Adding New AI Features

To extend the AI capabilities:

1. **Add a new prompt type** in `useAINavigator.js`:

```javascript
// In the buildEnhancedPrompt method
if (queryType === 'YOUR_NEW_ANALYSIS_TYPE') {
  return `Analyze the ${context.features.length} features in view and identify patterns in ${yourSpecificData}...`;
}
```

2. **Add a new visualization handler** in the `parseAndVisualizeResponse` method:

```javascript
if (queryType === 'YOUR_NEW_ANALYSIS_TYPE') {
  // Process the AI response
  // Apply visualization to the map
}
```

3. **Add a new UI element** to trigger your analysis:

```jsx
<button 
  onClick={() => navigator.processQuery(
    "Analyze this area", 
    "YOUR_NEW_ANALYSIS_TYPE", 
    mapContext
  )}
>
  New Analysis
</button>
```

## Best Practices

1. **Optimize Context**: Only include relevant data in the context to avoid token limits
2. **Structured Prompts**: Use consistent prompt formats for reliable parsing
3. **Error Handling**: Always handle potential AI service disruptions gracefully
4. **User Feedback**: Provide loading indicators during API calls

## Troubleshooting

Common issues:

1. **API Key Issues**: Ensure your `.env` file contains a valid `CLAUDE_API_KEY`
2. **Response Parsing Errors**: Check the format of your prompts and ensure consistent response formats
3. **Rate Limiting**: Handle API rate limits with appropriate retries and backoff
4. **Context Size**: Reduce context size if you hit token limits 