from typing import List, Dict, Any, Optional
import httpx
from atlas.core.config import AIConfig
from atlas.clients.base import BaseClient

class UnstructuredClient(BaseClient):
    """Client for Unstructured API."""
    
    def __init__(self, config: Optional[AIConfig] = None):
        if not config:
            raise ValueError("Config is required")
            
        if not getattr(config, 'unstructured_api_key', None) or config.unstructured_api_key.strip() == "":
            raise ValueError("Unstructured API key not found in config")
            
        super().__init__(config)
        self.api_key = config.unstructured_api_key
        self.base_url = "https://api.unstructured.io/general/v0/general"
    
    async def extract_text(self, content: str) -> str:
        """
        Extract text from file content.
        
        Args:
            content: File content as string
            
        Returns:
            Extracted text
            
        Raises:
            ValueError: If content is empty
            Exception: If API request fails
        """
        if not content or not str(content).strip():
            raise ValueError("File content cannot be empty")
            
        try:
            headers = {
                "accept": "application/json",
                "unstructured-api-key": self.api_key
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    json={"content": content}
                )
                
                if response.status_code != 200:
                    raise Exception(f"Unstructured request failed: {response.text}")
                    
                data = response.json()
                if not isinstance(data, list):
                    raise Exception("Invalid response format from Unstructured")
                    
                return "\n".join(item.get("text", "") for item in data)
                
        except Exception as e:
            raise Exception(f"Unstructured request failed: {str(e)}") 