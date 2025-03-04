const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const app = express();

// Configure CORS for localhost:3000
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/claude', async (req, res) => {
  console.log('Received request for Claude API');
  
  if (!process.env.CLAUDE_API_KEY) {
    console.error('Missing Claude API key');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    console.log('Forwarding request to Claude API...');
    const response = await axios({
      method: 'post',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-beta': 'messages-2023-12-15',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      data: req.body
    });

    console.log('Received response from Claude');
    res.json(response.data);
  } catch (error) {
    console.error('Claude API error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data
    });
  }
});

// Update ERCOT endpoint
app.get('/api/ercot-data', async (req, res) => {
  console.log('Server: Starting ERCOT data fetch...');
  
  const scriptPath = path.join(__dirname, 'public', 'Ercot.py');
  console.log('Server: Python script path:', scriptPath);
  
  const python = spawn('python', [scriptPath]);
  let dataString = '';

  python.stdout.on('data', (data) => {
    dataString += data.toString();
    console.log('Server: Python stdout:', data.toString());
  });

  python.stderr.on('data', (data) => {
    console.error('Server: Python stderr:', data.toString());
  });

  python.on('error', (error) => {
    console.error('Server: Python process error:', error);
    res.status(500).json({
      error: 'Failed to start Python process',
      details: error.message
    });
  });

  python.on('close', (code) => {
    console.log('Server: Python process completed with code:', code);
    
    if (code !== 0) {
      console.error('Server: Python process exited with code:', code);
      return res.status(500).json({
        error: 'Python process failed',
        code: code
      });
    }
    
    try {
      // Find and parse just the JSON data
      const jsonStart = dataString.indexOf('{');
      const jsonEnd = dataString.lastIndexOf('}') + 1;
      const jsonStr = dataString.slice(jsonStart, jsonEnd);
      
      console.log('Server: Raw JSON string:', jsonStr);
      
      const data = JSON.parse(jsonStr);
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid data structure');
      }

      // Ensure all prices are positive and in a realistic range
      data.data = data.data.map(point => ({
        ...point,
        price: Math.max(20, Math.min(1000, point.price)),
        mw: Math.max(0, point.mw)
      }));

      console.log('Server: Processed ERCOT data:', {
        points: data.data.length,
        priceRange: {
          min: Math.min(...data.data.map(d => d.price)),
          max: Math.max(...data.data.map(d => d.price))
        },
        mwRange: {
          min: Math.min(...data.data.map(d => d.mw)),
          max: Math.max(...data.data.map(d => d.mw))
        }
      });

      res.json(data);
    } catch (error) {
      console.error('Server: Data processing error:', error);
      console.error('Server: Raw data string:', dataString);
      res.status(500).json({ 
        error: 'Failed to process ERCOT data',
        details: error.message,
        rawData: dataString
      });
    }
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log('Claude API Key exists:', !!process.env.CLAUDE_API_KEY);
}); 