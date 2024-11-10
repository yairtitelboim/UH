import pytest
from unittest.mock import patch, MagicMock
from atlas.core.config import AIConfig
from atlas.clients.tavily import TavilyClient

@pytest.mark.asyncio
async def test_tavily_none_config():
    with pytest.raises(ValueError, match="Tavily API key not found in config"):
        TavilyClient(config=None)

@pytest.mark.asyncio
async def test_tavily_empty_config():
    config = AIConfig()
    config.tavily_api_key = ""
    with pytest.raises(ValueError, match="Tavily API key not found in config"):
        TavilyClient(config=config)

@pytest.mark.asyncio
async def test_tavily_search():
    # Existing test...
    pass

@pytest.mark.asyncio
async def test_tavily_error_handling():
    # Existing test...
    pass

@pytest.mark.asyncio
async def test_tavily_empty_query():
    client = TavilyClient(config=AIConfig(tavily_api_key="test-key"))
    with pytest.raises(ValueError, match="Search query cannot be empty"):
        await client.search("")
    with pytest.raises(ValueError, match="Search query cannot be empty"):
        await client.search("   ")

@pytest.mark.asyncio
@patch('httpx.AsyncClient.get')
async def test_tavily_invalid_response_format(mock_get):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"some": "data"}  # Missing 'results' field
    mock_get.return_value = mock_response

    client = TavilyClient(config=AIConfig(tavily_api_key="test-key"))
    with pytest.raises(Exception, match="Invalid response format from Tavily"):
        await client.search("test query")

@pytest.mark.asyncio
@patch('httpx.AsyncClient.get')
async def test_tavily_connection_error(mock_get):
    mock_get.side_effect = Exception("Connection error")
    
    client = TavilyClient(config=AIConfig(tavily_api_key="test-key"))
    with pytest.raises(Exception):
        await client.search("test query")

@pytest.mark.asyncio
@patch('httpx.AsyncClient.get')
async def test_tavily_non_200_response(mock_get):
    """Test handling of non-200 response status code"""
    mock_response = MagicMock()
    mock_response.status_code = 400
    mock_response.text = "Bad Request"
    mock_get.return_value = mock_response

    client = TavilyClient(config=AIConfig(tavily_api_key="test-key"))
    with pytest.raises(Exception, match="Tavily request failed: Bad Request"):
        await client.search("test query")

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_tavily_json_decode_error(mock_client):
    """Test handling of invalid JSON response"""
    # Create a mock client instance
    mock_client_instance = MagicMock()
    mock_client.return_value.__aenter__.return_value = mock_client_instance
    
    # Make the get request raise an exception
    mock_client_instance.get.side_effect = Exception("Invalid JSON")

    client = TavilyClient(config=AIConfig(tavily_api_key="test-key"))
    with pytest.raises(Exception, match="Tavily request failed: Invalid JSON"):
        await client.search("test query")

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_tavily_context_manager_error(mock_client):
    """Test handling of context manager errors"""
    # Make the context manager raise an exception
    mock_client.return_value.__aenter__.side_effect = Exception("Context manager error")

    client = TavilyClient(config=AIConfig(tavily_api_key="test-key"))
    with pytest.raises(Exception, match="Tavily request failed: Context manager error"):
        await client.search("test query")

@pytest.mark.asyncio
async def test_tavily_request_method():
    """Test the _make_request method directly"""
    client = TavilyClient(config=AIConfig(tavily_api_key="test-key"))
    mock_client = MagicMock()
    mock_client.get.side_effect = Exception("Network error")
    
    with pytest.raises(Exception) as exc_info:
        await client._make_request(
            mock_client,
            headers={"Authorization": "Bearer test-key"},
            params={"q": "test"}
        )
    
    assert str(exc_info.value) == "Network error"

@pytest.mark.asyncio
async def test_tavily_make_request_success():
    """Test successful _make_request execution"""
    client = TavilyClient(config=AIConfig(tavily_api_key="test-key"))
    mock_client = MagicMock()
    
    # Mock successful response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "results": [
            {
                "title": "Test Result",
                "url": "http://example.com",
                "content": "Test content"
            }
        ]
    }
    
    # Create an awaitable that returns our mock response
    async def mock_get(*args, **kwargs):
        return mock_response
    
    # Assign the awaitable to the get method
    mock_client.get = mock_get
    
    result = await client._make_request(
        mock_client,
        headers={"Authorization": "Bearer test-key"},
        params={"q": "test"}
    )
    
    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0]["title"] == "Test Result"
