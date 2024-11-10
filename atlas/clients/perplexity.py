from typing import Optional
from atlas.core.config import AIConfig
from atlas.clients.base import BaseClient

class PerplexityClient(BaseClient):
    """Client for Perplexity API."""
    
    def __init__(self, config: Optional[AIConfig] = None):
        super().__init__(config)
        if not config.perplexity_api_key:
            raise ValueError("Perplexity API key not found in config")
        self.api_key = config.perplexity_api_key
    
    async def complete(self, prompt: str) -> str:
        """Complete a prompt using Perplexity."""
        try:
            # Mock implementation for testing
            return f"Test response for: {prompt}"
        except Exception as e:
            raise Exception(f"Perplexity API error: {str(e)}")
        
        
        