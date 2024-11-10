from typing import List, Dict, Any, Optional
import httpx
from atlas.core.config import AIConfig
from atlas.clients.base import BaseClient

class SerperClient(BaseClient):
    """Client for Serper search API."""
    
    def __init__(self, config: Optional[AIConfig] = None):
        if not config:
            raise ValueError("Config is required")
            
        # Check for empty or invalid API key
        if not getattr(config, 'serper_api_key', None) or config.serper_api_key.strip() == "":
            raise ValueError("Serper API key not found in config")
            
        super().__init__(config)
        self.api_key = config.serper_api_key
        self.base_url = "https://google.serper.dev/search"
    
    async def search(
        self,
        query: str,
        num_results: int = 10,
        country: str = "us",
        language: str = "en",
        **kwargs
    ) -> List[Dict[str, Any]]:
        """
        Perform a search query.
        
        Args:
            query: Search query string
            num_results: Number of results to return
            country: Country code for search
            language: Language code for search
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
            headers = {
                "X-API-KEY": self.api_key,
                "Content-Type": "application/json"
            }
            
            params = {
                "q": query,
                "num": num_results,
                "gl": country,
                "hl": language,
                **kwargs
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    json=params
                )
                
                if response.status_code != 200:
                    raise Exception(f"Serper request failed: {response.text}")
                    
                data = response.json()
                if "organic" not in data:
                    raise Exception("Invalid response format from Serper")
                    
                return data["organic"]
                
        except Exception as e:
            raise Exception(f"Serper request failed: {str(e)}") 