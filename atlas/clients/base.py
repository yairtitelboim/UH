from typing import Any, Dict, Optional
import httpx
import asyncio
from urllib.parse import urljoin
from abc import ABC, abstractmethod

__all__ = ['BaseClient', 'BaseAPIClient']

class BaseClient(ABC):
    """Base class for API clients"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.Client()
        
    @abstractmethod
    def search(self, query: str, **kwargs) -> Dict[str, Any]:
        """Execute search query"""
        pass
        
    def __del__(self):
        self.client.close()


class BaseAPIClient:
    """Base class for API clients with common functionality"""
    
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url
        self.api_key = api_key
        self._client = httpx.AsyncClient()
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self._client.aclose()
        
    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request with error handling"""
        url = urljoin(self.base_url, endpoint)
        
        # Add API key if provided
        headers = kwargs.pop('headers', {})
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
            
        try:
            response = await self._client.request(method, url, headers=headers, **kwargs)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise Exception(f"API request failed: {str(e)}")
