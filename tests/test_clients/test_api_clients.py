import pytest
from unittest.mock import patch, MagicMock
from atlas.clients.base import BaseAPIClient
from atlas.core.config import AIConfig

@pytest.fixture
def mock_response():
    return MagicMock(
        status=200,
        json=MagicMock(return_value={"data": "test"})
    )

@pytest.mark.asyncio
async def test_rate_limiting():
    with patch('aiohttp.ClientSession') as mock_session:
        mock_session.return_value.__aenter__.return_value.request.return_value.__aenter__.return_value = MagicMock(
            status=429,
            headers={'Retry-After': '2'}
        )
        
        client = BaseAPIClient(AIConfig())
        with pytest.raises(Exception):
            await client._make_request('GET', 'http://test.com') 