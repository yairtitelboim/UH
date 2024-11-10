import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from atlas.core.config import AIConfig
from atlas.clients.serper import SerperClient

@pytest.mark.asyncio
async def test_serper_none_config():
    """Test initialization with None config"""
    with pytest.raises(ValueError, match="Config is required"):
        SerperClient(config=None)

@pytest.mark.asyncio
async def test_serper_empty_config():
    """Test initialization with empty API key"""
    config = AIConfig()
    config.serper_api_key = ""
    with pytest.raises(ValueError, match="Serper API key not found in config"):
        SerperClient(config=config)

@pytest.mark.asyncio
async def test_serper_whitespace_key():
    """Test initialization with whitespace API key"""
    with pytest.raises(ValueError, match="Serper API key not found in config"):
        SerperClient(config=AIConfig(serper_api_key="   "))

@pytest.mark.asyncio
async def test_serper_empty_query():
    """Test search with empty query"""
    client = SerperClient(config=AIConfig(serper_api_key="test-key"))
    with pytest.raises(ValueError, match="Search query cannot be empty"):
        await client.search("")
    with pytest.raises(ValueError, match="Search query cannot be empty"):
        await client.search("   ")

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_serper_search_success(mock_client):
    """Test successful search request"""
    # Mock response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "organic": [
            {
                "title": "Result 1",
                "link": "http://example.com/1",
                "snippet": "Description 1"
            }
        ]
    }

    # Setup async mock
    mock_client_instance = AsyncMock()
    mock_client.return_value.__aenter__.return_value = mock_client_instance
    mock_client_instance.post.return_value = mock_response

    client = SerperClient(config=AIConfig(serper_api_key="test-key"))
    results = await client.search(
        query="test query",
        num_results=5,
        country="uk",
        language="en"
    )

    # Verify results
    assert len(results) == 1
    assert results[0]["title"] == "Result 1"
    assert results[0]["link"] == "http://example.com/1"
    
    # Verify request parameters
    call_kwargs = mock_client_instance.post.call_args[1]
    assert call_kwargs["headers"]["X-API-KEY"] == "test-key"
    assert call_kwargs["json"]["q"] == "test query"
    assert call_kwargs["json"]["num"] == 5
    assert call_kwargs["json"]["gl"] == "uk"
    assert call_kwargs["json"]["hl"] == "en"

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_serper_non_200_response(mock_client):
    """Test handling of non-200 response"""
    mock_response = MagicMock()
    mock_response.status_code = 400
    mock_response.text = "Bad Request"

    mock_client_instance = AsyncMock()
    mock_client.return_value.__aenter__.return_value = mock_client_instance
    mock_client_instance.post.return_value = mock_response

    client = SerperClient(config=AIConfig(serper_api_key="test-key"))
    with pytest.raises(Exception, match="Serper request failed: Bad Request"):
        await client.search("test query")

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_serper_invalid_response_format(mock_client):
    """Test handling of invalid response format"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"invalid": "format"}

    mock_client_instance = AsyncMock()
    mock_client.return_value.__aenter__.return_value = mock_client_instance
    mock_client_instance.post.return_value = mock_response

    client = SerperClient(config=AIConfig(serper_api_key="test-key"))
    with pytest.raises(Exception, match="Invalid response format from Serper"):
        await client.search("test query")

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_serper_connection_error(mock_client):
    """Test handling of connection error"""
    mock_client.return_value.__aenter__.side_effect = Exception("Connection error")

    client = SerperClient(config=AIConfig(serper_api_key="test-key"))
    with pytest.raises(Exception, match="Serper request failed: Connection error"):
        await client.search("test query")

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_serper_json_decode_error(mock_client):
    """Test handling of JSON decode error"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.side_effect = Exception("Invalid JSON")

    mock_client_instance = AsyncMock()
    mock_client.return_value.__aenter__.return_value = mock_client_instance
    mock_client_instance.post.return_value = mock_response

    client = SerperClient(config=AIConfig(serper_api_key="test-key"))
    with pytest.raises(Exception, match="Serper request failed: Invalid JSON"):
        await client.search("test query")
