from typing import Optional, Dict
from atlas.core.config import AIConfig


class BaseClient:
    """Base class for API clients."""
    
    def __init__(self, config: Optional[AIConfig] = None):
        if not config:
            raise ValueError("Config is required")
        self.config = config
    
    def validate_api_key(self, api_key: Optional[str]) -> bool:
        """Validate API key."""
        return bool(api_key and isinstance(api_key, str))
    
    def get_headers(self, api_key: str) -> Dict[str, str]:
        """Get request headers."""
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
