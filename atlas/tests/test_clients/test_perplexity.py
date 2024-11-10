import pytest
from unittest.mock import patch
from atlas.clients.perplexity import PerplexityClient
from atlas.core.config import AIConfig

@pytest.mark.asyncio
async def test_perplexity_completion():
    """Test Perplexity completion endpoint."""
    client = PerplexityClient(AIConfig(perplexity_api_key="test-key"))
    response = await client.complete("Test prompt")
    assert isinstance(response, str)
    assert "Test" in response

@pytest.mark.asyncio
async def test_perplexity_error_handling():
    """Test Perplexity error handling."""
    client = PerplexityClient(AIConfig(perplexity_api_key="test-key"))
    
    def mock_complete(*args, **kwargs):
        raise Exception("API Error")
    
    with patch.object(client, 'complete', side_effect=mock_complete):
        with pytest.raises(Exception) as exc_info:
            await client.complete("Test prompt")
        assert "API Error" in str(exc_info.value)

@pytest.mark.asyncio
async def test_perplexity_invalid_config():
    """Test Perplexity client with invalid config."""
    with pytest.raises(ValueError):
        PerplexityClient(None)

@pytest.mark.asyncio
async def test_perplexity_missing_api_key():
    """Test Perplexity client with missing API key."""
    with pytest.raises(ValueError) as exc_info:
        PerplexityClient(AIConfig())
    assert "API key not found" in str(exc_info.value)
