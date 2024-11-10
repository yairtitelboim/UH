import pytest
from atlas.clients.base import BaseClient
from atlas.core.config import AIConfig

def test_base_client_init():
    """Test base client initialization."""
    config = AIConfig()
    client = BaseClient(config)
    assert client.config == config

def test_base_client_no_config():
    """Test base client with no config."""
    with pytest.raises(ValueError):
        BaseClient(None)

def test_base_client_validate_api_key():
    """Test API key validation."""
    config = AIConfig()
    client = BaseClient(config)
    
    # Test with valid key
    assert client.validate_api_key("test-key") is True
    
    # Test with invalid keys
    assert client.validate_api_key("") is False
    assert client.validate_api_key(None) is False

def test_base_client_get_headers():
    """Test header generation."""
    config = AIConfig()
    client = BaseClient(config)
    headers = client.get_headers("test-key")
    
    assert isinstance(headers, dict)
    assert "Authorization" in headers
    assert headers["Authorization"] == "Bearer test-key"
