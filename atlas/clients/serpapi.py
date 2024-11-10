from typing import List, Dict, Any, Optional
import httpx
from atlas.core.config import AIConfig
from atlas.clients.base import BaseClient

class SerpApiClient(BaseClient):
    """Client for SerpAPI search."""
    
    def __init__(self, config: Optional[AIConfig] = None):
        if not config:
            raise ValueError("Config is required")
            
        # Check for empty or invalid API key
        if not getattr(config, 'serpapi_api_key', None) or config.serpapi_api_key.strip() == "":
            raise ValueError("SerpAPI key not found in config")
            
        super().__init__(config)
        self.api_key = config.serpapi_api_key
        self.base_url = "https://serpapi.com/search"
    
    async def search(
        self,
        query: str,
        num_results: int = 10,
        **kwargs
    ) -> List[Dict[str, Any]]:
        """
        Perform a search query.
        
        Args:
            query: Search query string
            num_results: Number of results to return
            **kwargs: Additional search parameters
            
        Returns:
            List of search results
            
        Raises:
            ValueError: If query is empty
            Exception: If API request fails
        """
        if not query or not str(query).strip():
            raise ValueError("Search query cannot be empty")
            
        try:
            params = {
                "api_key": self.api_key,
                "q": query,
                "num": num_results,
                "engine": "google",
                **kwargs
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self.base_url,
                    params=params
                )
                
                if response.status_code != 200:
                    raise Exception(f"SerpAPI request failed: {response.text}")
                    
                data = response.json()
                if "organic_results" not in data:
                    raise Exception("Invalid response format from SerpAPI")
                    
                return data["organic_results"]
                
        except Exception as e:
            raise Exception(f"SerpAPI request failed: {str(e)}") 