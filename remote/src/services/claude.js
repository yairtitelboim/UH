import axios from 'axios';

// Add export to the MOCK_RESPONSES declaration
export const MOCK_RESPONSES = {
  "Find high-energy, high-connectivity zones in Miami": {
    content: [{
      text: JSON.stringify({
        action: "showMultipleLocations",
        locations: [
          {
            name: "Brickell",
            coordinates: [-80.1998, 25.7650],
            description: "Miami's financial district",
            icons: {
              square: true,
              chart: true,
              circle: true
            },
            callout: {
              title: "Brickell",
              details: [
                "Capacity: 85.2% • Growth: +12.4%",
                "Mixed-use development • High density zone"
              ]
            }
          },
          {
            name: "South Beach",
            coordinates: [-80.13, 25.7865],
            description: "Dense urban area",
            icons: {
              square: true,
              chart: true,
              circle: true
            },
            callout: {
              title: "South Beach",
              details: [
                "Capacity: 73.8% • Growth: +9.2%",
                "Entertainment district • Tourism zone"
              ]
            }
          },
          {
            name: "Wynwood",
            coordinates: [-80.2000, 25.8050],
            description: "Creative district",
            icons: {
              square: true,
              chart: true,
              circle: true
            },
            callout: {
              title: "Wynwood",
              details: [
                "Capacity: 68.5% • Growth: +15.7%",
                "Arts & Tech district • Cultural zone"
              ]
            }
          }
        ],
        viewBounds: {
          sw: [-80.30, 25.75],
          ne: [-80.10, 25.79]
        },
        preGraphText: "I've analyzed Miami's energy consumption patterns and broadband infrastructure. Let's examine how these metrics have evolved over the past five years, focusing on Brickell and South Beach.",
        postGraphText: "The data reveals an interesting pattern: Brickell has emerged as Miami's premier high-energy zone, reaching a 92 on our infrastructure index by 2023 - notably higher than both the Miami metro average and national benchmarks. While South Beach maintains strong metrics with an 88 index score, Brickell's trajectory indicates it's becoming Miami's leading hub for energy consumption and connectivity.\n\nBoth areas demonstrate exceptional infrastructure development, showing significant growth since 2020 and now operating well above typical urban levels. Which area would you like to explore in detail?",
        followUpSuggestions: [],
        quickActions: [
          {
            text: "Demographic Stats",
            prompt: "SHOW_BRICKELL_DEMOGRAPHICS",
            icon: "📊",
            description: "Income, age, education data"
          },
          {
            text: "Historical Trends",
            prompt: "SHOW_BRICKELL_HISTORY",
            icon: "📈",
            description: "Development since 2010"
          },
          {
            text: "AI Predictions",
            prompt: "SHOW_BRICKELL_FORECAST",
            icon: "🔮",
            description: "Growth forecast 2024-2025"
          }
        ]
      })
    }]
  },
  "ZOOM_TO_BRICKELL": {
    content: [{
      text: JSON.stringify({
        action: "navigate",
        coordinates: [-80.1918, 25.7650],
        zoomLevel: 16,
        poiInfo: {
          pmtId: "brickell_pmt",
          subdivisionId: "brickell_main",
          poiCount: 45,
          poiTypes: ["substation", "transformer", "solar_array", "smart_meter"]
        },
        preGraphText: "As we analyze the infrastructure data, Brickell stands out as Miami's premier energy hub. Let's examine the power distribution network that makes this possible.",
        postGraphText: "The data reveals an impressive power infrastructure network, with over 45 critical nodes in this district alone. The area's modernization has attracted major investments in smart grid technology and renewable energy systems.",
        quickActions: [
          {
            text: "Power Grid Analysis",
            prompt: "SHOW_BRICKELL_POWER",
            icon: "⚡",
            description: "Energy distribution network"
          },
          {
            text: "Historical Trends",
            prompt: "SHOW_BRICKELL_HISTORY",
            icon: "📈",
            description: "Infrastructure evolution"
          },
          {
            text: "AI Predictions",
            prompt: "SHOW_BRICKELL_FORECAST",
            icon: "🔮",
            description: "Capacity forecast 2024-2025"
          }
        ],
        followUpSuggestions: [
          {
            text: "Show smart grid coverage",
            prompt: "SHOW_SMART_GRID_BRICKELL"
          },
          {
            text: "View renewable installations",
            prompt: "SHOW_RENEWABLE_ENERGY"
          },
          {
            text: "Compare to South Beach grid",
            prompt: "COMPARE_GRID_INFRASTRUCTURE"
          }
        ]
      })
    }]
  },
  "SHOW_BRICKELL_DINING": {
    content: [{
      text: JSON.stringify({
        action: "navigate",
        coordinates: [-80.1918, 25.7650],
        zoomLevel: 16,
        poiInfo: {
          pmtId: "brickell_pmt",
          subdivisionId: "brickell_main",
          poiCount: 45,
          poiTypes: ["substation", "transformer", "solar_array", "smart_meter"]
        },
        preGraphText: "Analyzing Brickell's power infrastructure... As Miami's financial hub, Brickell represents one of the most sophisticated urban power grids in Florida. The district combines traditional infrastructure with cutting-edge smart grid technology and renewable energy solutions. Let's examine the current state of its power distribution network and real-time consumption patterns.",
        postGraphText: "I've highlighted the major power distribution nodes in Brickell. The area features:\n\n" +
                      "• 45+ smart grid nodes\n" +
                      "• 8 power substations\n" +
                      "• 12 high-capacity transformers\n" +
                      "• 15+ renewable energy installations\n\n" +
                      "The orange highlights indicate energy hotspots, with brighter colors showing higher power consumption.",
        followUpSuggestions: [
          {
            text: "Show peak demand zones",
            prompt: "SHOW_PEAK_DEMAND_BRICKELL"
          },
          {
            text: "View grid resilience data",
            prompt: "SHOW_GRID_RESILIENCE"
          },
          {
            text: "Compare to South Beach",
            prompt: "COMPARE_POWER_INFRASTRUCTURE"
          }
        ],
        quickActions: [
          {
            text: "High Capacity Zones",
            prompt: "FILTER_HIGH_CAPACITY",
            icon: "⚡",
            description: "Areas with peak power demand"
          },
          {
            text: "Smart Grid Network",
            prompt: "FILTER_SMART_GRID",
            icon: "🔌",
            description: "Connected infrastructure"
          },
          {
            text: "Performance Metrics",
            prompt: "SHOW_METRICS",
            icon: "📊",
            description: "Real-time energy analytics"
          }
        ]
      })
    }]
  },
  "SHOW_BRICKELL_DEMOGRAPHICS": {
    content: [{
      text: JSON.stringify({
        action: "showDemographics",
        preGraphText: "Here's a demographic breakdown of Brickell:",
        postGraphText: "Brickell's population has grown significantly:\n\n" +
                      "• Current Population: 32,547\n" +
                      "• Median Age: 34\n" +
                      "• Household Income: $121,500\n" +
                      "• Population Density: 27,890/sq mi\n" +
                      "• Growth Rate: +12.4% (2023)\n\n" +
                      "This makes it one of Miami's fastest-growing urban cores.",
        quickActions: [
          {
            text: "Compare to South Beach",
            prompt: "COMPARE_GRID_METRICS",
            icon: "↗",
            description: "Area comparison"
          },
          {
            text: "Show Growth Trends",
            prompt: "SHOW_GRID_GROWTH",
            icon: "📈",
            description: "Historical data"
          },
          {
            text: "Future Forecast",
            prompt: "SHOW_FUTURE_TRENDS",
            icon: "🔮",
            description: "2024 projections"
          }
        ]
      })
    }]
  },
  "SHOW_BRICKELL_POWER": {
    content: [{
      text: JSON.stringify({
        action: "showPowerGrid",
        coordinates: [-80.1918, 25.765],
        zoomLevel: 16,
        preGraphText: "Analyzing Brickell's power infrastructure...",
        postGraphText: "I've highlighted the major power distribution nodes in Brickell...",
        quickActions: [
          {
            text: "High Capacity Zones",
            prompt: "FILTER_HIGH_CAPACITY",
            icon: "⚡"
          },
          {
            text: "Smart Grid Network",
            prompt: "FILTER_SMART_GRID",
            icon: "🔌"
          }
        ]
      })
    }]
  },
  "SHOW_GRID_GROWTH": {
    content: [{
      text: JSON.stringify({
        action: "showGridGrowth",
        preGraphText: "Let's analyze Brickell's power grid growth patterns over the past 5 years. We'll look at both capacity expansion and smart grid adoption rates.",
        postGraphText: "The data reveals two key trends:\n\n" +
                      "• Grid Capacity has grown by 47% since 2019, driven by new development\n" +
                      "• Smart Grid adoption accelerated in 2022, now covering 45% of the network\n\n" +
                      "This growth pattern suggests Brickell is leading Miami's power infrastructure modernization.",
        graphs: [
          {
            title: "Power Grid Capacity Growth",
            data: [
              { year: '2019', capacity: 580, smart: 150, baseline: 500 },
              { year: '2020', capacity: 620, smart: 200, baseline: 520 },
              { year: '2021', capacity: 680, smart: 280, baseline: 540 },
              { year: '2022', capacity: 780, smart: 390, baseline: 560 },
              { year: '2023', capacity: 850, smart: 425, baseline: 580 }
            ],
            dataKeys: ['capacity', 'smart', 'baseline'],
            labels: ['Total Capacity (MW)', 'Smart Grid (MW)', 'Baseline Need']
          },
          {
            title: "Infrastructure Distribution",
            data: [
              { name: 'Smart Meters', value: 45 },
              { name: 'Automated Switches', value: 28 },
              { name: 'Energy Storage', value: 15 },
              { name: 'Traditional', value: 12 }
            ]
          }
        ],
        quickActions: [
          {
            text: "Compare to South Beach",
            prompt: "COMPARE_GRID_METRICS",
            icon: "⚡",
            description: "Infrastructure comparison"
          },
          {
            text: "Future Projections",
            prompt: "SHOW_GRID_FORECAST",
            icon: "📈",
            description: "2024-2025 forecast"
          }
        ]
      })
    }]
  },
  "SHOW_FUTURE_TRENDS": {
    content: [{
      text: JSON.stringify({
        action: "showGraphs",
        preGraphText: "Here's our AI forecast for Brickell's energy infrastructure needs:",
        graphs: [
          {
            data: [
              { month: 'Jan', value: 850, name: 'Baseline' },
              { month: 'Mar', value: 870, name: 'Baseline' },
              { month: 'May', value: 900, name: 'Baseline' },
              { month: 'Jul', value: 950, name: 'Baseline' },
              { month: 'Sep', value: 980, name: 'Baseline' },
              { month: 'Nov', value: 1000, name: 'Baseline' }
            ],
            type: 'line',
            color: '#1E88E5'
          },
          {
            data: [
              { month: 'Jan', value: 880, name: 'Scenario 1' },
              { month: 'Mar', value: 910, name: 'Scenario 1' },
              { month: 'May', value: 950, name: 'Scenario 1' },
              { month: 'Jul', value: 1020, name: 'Scenario 1' },
              { month: 'Sep', value: 1060, name: 'Scenario 1' },
              { month: 'Nov', value: 1100, name: 'Scenario 1' }
            ],
            type: 'line',
            color: '#42A5F5'
          }
        ],
        postGraphText: "The blue lines show projected energy demand under different growth scenarios.",
        followUpSuggestions: [
          {
            text: "How does the Smart Grid optimize power distribution?",
            prompt: "SHOW_SMART_OPTIMIZATION"
          },
          {
            text: "Show Smart Grid sensor network coverage",
            prompt: "SHOW_SENSOR_COVERAGE"
          },
          {
            text: "What AI systems manage the Smart Grid?",
            prompt: "SHOW_SMART_GRID_AI"
          }
        ]
      })
    }]
  },
  "SHOW_SMART_GRID_IMPACT": {
    text: "Based on our analysis, smart grid adoption could lead to significant cost savings...",
    action: 'showCostAnalysis'
  },
  "SHOW_SUSTAINABILITY_FORECAST": {
    text: "Here's how Brickell's sustainability metrics are projected to evolve...",
    action: 'showSustainability'
  },
  "SHOW_GRID_DENSITY": {
    content: [{
      text: JSON.stringify({
        action: "navigate",
        coordinates: [-80.1918, 25.7650],
        zoomLevel: 16,
        poiInfo: {
          pmtId: "brickell_pmt",
          subdivisionId: "brickell_main",
          poiCount: 45,
          poiTypes: ["substation", "transformer", "solar_array", "smart_meter"],
          typeFollowUps: [
            {
              text: "Show substation distribution network",
              prompt: "SHOW_SUBSTATION_NETWORK"
            },
            {
              text: "View transformer load capacity",
              prompt: "VIEW_TRANSFORMER_CAPACITY"
            },
            {
              text: "Explore solar array efficiency",
              prompt: "EXPLORE_SOLAR_EFFICIENCY"
            },
            {
              text: "Analyze smart meter data patterns",
              prompt: "ANALYZE_SMART_METERS"
            }
          ]
        },
        preGraphText: "Analyzing Brickell's power grid density... The district features one of the most sophisticated urban power networks in Florida, with multiple layers of infrastructure supporting its high-energy demands.",
        postGraphText: "Key findings about Brickell's power grid density:\n\n" +
                      "• Peak Density: 45+ power nodes per square mile\n" +
                      "• Smart Grid Coverage: 85% of district\n" +
                      "• Redundancy Level: N+2 backup systems\n" +
                      "• Growth Capacity: 35% additional headroom\n\n" +
                      "The highlighted zones show areas of highest power infrastructure concentration, with brighter colors indicating greater density of smart grid nodes.",
        followUpSuggestions: [
          {
            text: "Analyze power distribution by node type",
            prompt: "SHOW_NODE_DISTRIBUTION"
          },
          {
            text: "View smart meter coverage map",
            prompt: "SHOW_SMART_METER_MAP"
          },
          {
            text: "Show transformer load balancing",
            prompt: "SHOW_TRANSFORMER_LOADS"
          },
          {
            text: "Display solar array integration",
            prompt: "SHOW_SOLAR_INTEGRATION"
          }
        ],
        quickActions: [
          {
            text: "Infrastructure Map",
            prompt: "SHOW_INFRASTRUCTURE_MAP",
            icon: "🔌",
            description: "View power grid layout"
          },
          {
            text: "Load Analysis",
            prompt: "SHOW_LOAD_ANALYSIS",
            icon: "📊",
            description: "Current usage patterns"
          },
          {
            text: "Growth Forecast",
            prompt: "SHOW_DENSITY_FORECAST",
            icon: "📈",
            description: "Future capacity needs"
          }
        ],
        zoomOutButton: {
          text: "Zoom out to view full district",
          action: "zoomOut"
        }
      })
    }]
  },
  "VIEW_TRANSFORMER_CAPACITY": {
    content: [{
      text: "hi hi"
    }]
  }
};

console.log("Mock response structure:", JSON.parse(MOCK_RESPONSES["Find high-energy, high-connectivity zones in Miami"].content[0].text));

// Increase back to original 2.5 seconds for better animation flow
const simulateDelay = () => new Promise(resolve => setTimeout(resolve, 2500));

// For quick actions, we can make it even faster (0.75 seconds)
const simulateQuickActionDelay = () => new Promise(resolve => setTimeout(resolve, 750));

// For quick graph actions, make it super fast (250ms)
const simulateGraphActionDelay = () => new Promise(resolve => setTimeout(resolve, 250));

// Add this new constant for loading states
export const LOADING_STEPS = [
  {
    icon: "🗺️",
    text: "Querying Miami-Dade GIS Database...",
    delay: 300
  },
  {
    icon: "🏢",
    text: "Accessing Local Business Registry 2024...",
    delay: 400
  },
  {
    icon: "🍽️",
    text: "Scanning Restaurant & Bar Permits...",
    delay: 500
  },
  {
    icon: "📊",
    text: "Loading Census Tract Demographics...",
    delay: 600
  },
  {
    icon: "🚇",
    text: "Checking Miami Transit Authority Data...",
    delay: 700
  },
  {
    icon: "📱",
    text: "Processing Social Activity Heatmaps...",
    delay: 800
  },
  {
    icon: "🏗️",
    text: "Analyzing Urban Development Records...",
    delay: 900
  },
  {
    icon: "📍",
    text: "Compiling Points of Interest...",
    delay: 1000
  }
];

// Add this constant for the Brickell callout response
const BRICKELL_CALLOUT_RESPONSE = {
  content: [{
    text: JSON.stringify({
      action: "showMultipleLocations",
      preGraphText: "As we saw in the economic trends, Brickell has emerged as Miami's premier dining destination. Let's take a closer look at what makes this area special.",
      postGraphText: "The data shows a remarkable concentration of high-end establishments, with over 45 restaurants and bars in this district alone. The area's rapid growth has attracted both Michelin-starred chefs and innovative local restaurateurs.",
      quickActions: [
        {
          text: "Demographic Stats",
          prompt: "SHOW_BRICKELL_DEMOGRAPHICS",
          icon: "📊",
          description: "Income, age, education data"
        },
        {
          text: "Historical Trends",
          prompt: "SHOW_BRICKELL_HISTORY",
          icon: "📈",
          description: "Development since 2010"
        },
        {
          text: "AI Predictions",
          prompt: "SHOW_BRICKELL_FORECAST",
          icon: "🔮",
          description: "Growth forecast 2024-2025"
        }
      ],
      followUpSuggestions: [
        {
          text: "Analyze power consumption trends",
          prompt: "ANALYZE_POWER_TRENDS"
        },
        {
          text: "Show infrastructure upgrades",
          prompt: "SHOW_INFRASTRUCTURE_UPDATES"
        },
        {
          text: "View digital connectivity map",
          prompt: "VIEW_CONNECTIVITY_MAP"
        }
      ]
    })
  }]
};

export const askClaude = async (prompt, context = {}, mapBounds = null) => {
  console.log('Using mock response for development');
  
  // Use fastest delay for graph-only actions
  if (prompt === 'SHOW_GRID_GROWTH' || prompt === 'COMPARE_GRID_METRICS') {
    await simulateGraphActionDelay();
  } else if (prompt.startsWith('SHOW_') || prompt.startsWith('COMPARE_')) {
    await simulateQuickActionDelay();
  } else {
    await simulateDelay();
  }
  
  if (prompt === "ZOOM_TO_BRICKELL") {
    return BRICKELL_CALLOUT_RESPONSE;
  }

  // Check if we have a mock response for this prompt
  if (MOCK_RESPONSES[prompt]) {
    console.log('Mock Response:', JSON.stringify(MOCK_RESPONSES[prompt], null, 2));
    return MOCK_RESPONSES[prompt];
  }

  console.log('Sending request to Claude API via local proxy...');
  
  const PROXY_URL = 'http://localhost:8080/proxy';
  const API_URL = 'https://api.anthropic.com/v1/messages';
  
  // Create a strict geographic context
  const boundsContext = mapBounds ? 
    `CRITICAL GEOGRAPHIC CONSTRAINTS:
     1. You MUST ONLY analyze the area within these exact coordinates:
        Southwest: [${mapBounds.sw.lng}, ${mapBounds.sw.lat}]
        Northeast: [${mapBounds.ne.lng}, ${mapBounds.ne.lat}]
     2. This is in Miami, Florida. Never suggest locations outside Miami.
     3. Any coordinates you return MUST be within these bounds.
     4. If you cannot find relevant POIs within these bounds, say so - do not suggest other areas.` 
    : 'Stay within Miami, Florida bounds.';
  
  const response = await axios({
    method: 'post',
    url: `${PROXY_URL}?url=${encodeURIComponent(API_URL)}`,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.REACT_APP_CLAUDE_API_KEY
    },
    data: {
      model: "claude-3-sonnet-20240229",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `You are a Miami-specific map navigation assistant. You MUST follow these rules:
                  1. ${boundsContext}
                  2. Never suggest locations outside Miami, Florida
                  3. Only analyze POIs and features visible in the current map view
                  4. If asked about areas outside the current view, respond with "Please navigate to that area first"

                  Current context: ${JSON.stringify(context)}
                  User request: ${prompt}
                  
                  Return a JSON object in this exact format:
                  {
                    "action": "navigate",
                    "coordinates": [longitude, latitude], // MUST be within current bounds
                    "zoomLevel": 16,
                    "explanation": "Explanation about visible Miami locations only",
                    "poiInfo": {
                      "pmtId": "ID of visible PMT boundary",
                      "subdivisionId": "ID of visible subdivision boundary",
                      "poiCount": "number of POIs in visible area",
                      "poiTypes": ["types of POIs found in visible area"]
                    },
                    "followUpSuggestions": [
                      {
                        "text": "suggestion about visible Miami areas only",
                        "prompt": "prompt about visible Miami areas only"
                      },
                      {
                        "text": "suggestion about visible Miami areas only",
                        "prompt": "prompt about visible Miami areas only"
                      },
                      {
                        "text": "suggestion about visible Miami areas only",
                        "prompt": "prompt about visible Miami areas only"
                      }
                    ]
                  }

                  IMPORTANT VALIDATION:
                  1. Before returning coordinates, verify they fall within the given bounds
                  2. All suggestions must reference only Miami locations
                  3. Only include POIs that are currently visible on the map
                  4. If no relevant data exists in the current view, say so instead of suggesting other areas`
      }]
    },
    timeout: 10000,
    withCredentials: true
  });

  // Validate response coordinates are within bounds
  const responseData = response.data;
  if (responseData?.content?.[0]?.text) {
    try {
      const parsed = JSON.parse(responseData.content[0].text);
      if (parsed.coordinates) {
        const [lng, lat] = parsed.coordinates;
        if (mapBounds && (
            lng < mapBounds.sw.lng || lng > mapBounds.ne.lng ||
            lat < mapBounds.sw.lat || lat > mapBounds.ne.lat
        )) {
          throw new Error('Coordinates outside bounds');
        }
      }
    } catch (e) {
      console.error('Invalid coordinates returned:', e);
      // Return a fallback response staying within bounds
      return {
        content: [{
          text: JSON.stringify({
            action: "navigate",
            coordinates: [mapBounds.sw.lng + (mapBounds.ne.lng - mapBounds.sw.lng)/2,
                        mapBounds.sw.lat + (mapBounds.ne.lat - mapBounds.sw.lat)/2],
            zoomLevel: 16,
            explanation: "Analyzing the center of your current view. Please adjust the map to see other areas.",
            poiInfo: {
              poiCount: 0,
              poiTypes: []
            },
            followUpSuggestions: [
              {
                text: "Zoom out to see more of the area",
                prompt: "What's visible in this wider area?"
              }
            ]
          })
        }]
      };
    }
  }

  return responseData;
};

export const parseClaudeResponse = (response) => {
  try {
    if (response?.content?.[0]?.text) {
      const parsed = JSON.parse(response.content[0].text);
      console.log('Parsed response:', parsed);

      return {
        action: parsed.action,
        preGraphText: parsed.preGraphText,
        postGraphText: parsed.postGraphText,
        coordinates: parsed.coordinates,
        zoomLevel: parsed.zoomLevel,
        locations: parsed.locations,
        viewBounds: parsed.viewBounds,
        poiInfo: parsed.poiInfo,
        followUps: parsed.followUpSuggestions,
        quickActions: parsed.quickActions,
        zoomOutButton: parsed.zoomOutButton
      };
    }

    if (response?.content) {
      return {
        preGraphText: response.content,
        postGraphText: null,
        poiInfo: null,
        followUps: [],
        quickActions: null
      };
    }

    throw new Error('Unexpected response format');
  } catch (e) {
    console.error("Error parsing response:", e);
    return {
      preGraphText: "Could not process the response. Please Please try again.",
      postGraphText: null,
      poiInfo: null,
      followUps: [],
      quickActions: null
    };
  }
};

export const handleQuestion = async (prompt, context, mapBounds) => {
  // Check if we have a mock response for this prompt
  if (prompt === 'VIEW_TRANSFORMER_CAPACITY') {
    console.log('Using mock response for development');
    return {
      content: [{
        text: "hi hi"
      }]
    };
  }

  if (MOCK_RESPONSES[prompt]) {
    console.log('Using mock response for development');
    return MOCK_RESPONSES[prompt];
  }

  // ... (existing code)
}; 