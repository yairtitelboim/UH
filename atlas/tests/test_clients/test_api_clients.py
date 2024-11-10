import pytest
from unittest.mock import AsyncMock, patch
from atlas.clients.base import BaseAPIClient
from atlas.core.config import AIConfig

@pytest.fixture
def api_client():
    return BaseAPIClient(AIConfig())

@pytest.mark.asyncio
async def test_rate_limiting(api_client):
    # Create a response that properly simulates the context manager
    mock_response = AsyncMock()
    mock_response.status = 429
    
    # Create a session that returns our response
    mock_session = AsyncMock()
    mock_session.__aenter__.return_value = mock_session
    mock_session.request.return_value.__aenter__.return_value = mock_response
    
    with patch('aiohttp.ClientSession', return_value=mock_session):
        with pytest.raises(Exception, match="Rate limit exceeded"):
            await api_client.request("GET", "http://test.com")
