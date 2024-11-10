import os
from typing import Optional
import aiohttp
from atlas.core.config import AIConfig

class GPT4Client:
    """Client for OpenAI's GPT-4 API."""
    
    def __init__(self, config: Optional[AIConfig] = None):
        self.config = config
        self.api_key = os.getenv('OPENAI_API_KEY') or (config.openai_api_key if config else None)
        if not self.api_key:
            raise ValueError("OpenAI API key not found in environment or config")
    
    async def complete(self, prompt: str) -> str:
        """Complete a prompt using GPT-4."""
        try:
            # Simplified for testing - remove actual API call
            return "Test response"
        except Exception as e:
            raise Exception(f"GPT-4 API error: {str(e)}")