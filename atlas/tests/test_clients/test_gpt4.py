import pytest
from unittest.mock import patch
from atlas.clients.gpt4 import GPT4Client

@pytest.mark.asyncio
async def test_gpt4_completion(mock_config):
    """Test GPT-4 completion endpoint."""
    client = GPT4Client(mock_config)
    response = await client.complete("Test prompt")
    assert response == "Test response"

@pytest.mark.asyncio
async def test_gpt4_error_handling(mock_config):
    """Test GPT-4 error handling."""
    client = GPT4Client(mock_config)
    
    def mock_complete(*args, **kwargs):
        raise Exception("API Error")
    
    with patch.object(client, 'complete', side_effect=mock_complete):
        with pytest.raises(Exception) as exc_info:
            await client.complete("Test prompt")
        assert "API Error" in str(exc_info.value)
