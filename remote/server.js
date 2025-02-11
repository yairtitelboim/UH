const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Configure CORS for localhost:3000
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['POST', 'OPTIONS'],
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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log('Claude API Key exists:', !!process.env.CLAUDE_API_KEY);
}); 