from typing import List, Dict, Any, Optional
import httpx
from atlas.core.config import AIConfig
from atlas.clients.base import BaseClient

class TavilyClient(BaseClient):
    """Client for Tavily API."""
    
    def __init__(self, config: Optional[AIConfig] = None):
        self.config = config
        self.api_key = config.tavily_api_key if config else None
        if not self.api_key:
            raise ValueError("Tavily API key not found in config")
            
        super().__init__(config)
        self.base_url = "https://api.tavily.com/search"

    async def _make_request(self, client: httpx.AsyncClient, headers: dict, params: dict) -> dict:
        """Make HTTP request to Tavily API"""
        response = await client.get(
            self.base_url,
            headers=headers,
            params=params
        )
        
        if response.status_code != 200:
            raise Exception(f"Tavily request failed: {response.text}")
            
        data = response.json()
        if "results" not in data:
            raise Exception("Invalid response format from Tavily")
            
        return data["results"]

    async def search(self, query: str) -> List[Dict[str, Any]]:
        """
        Search using Tavily API.
        """
        if not query or not query.strip():
            raise ValueError("Search query cannot be empty")
            
        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }
        
        params = {
            "q": query,
            "include_answer": "false",
            "include_raw": "false"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                return await self._make_request(client, headers, params)
        except Exception as e:
            raise Exception(f"Tavily request failed: {str(e)}")