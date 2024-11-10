import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from atlas.core.config import AIConfig
from atlas.clients.serpapi import SerpApiClient

@pytest.mark.asyncio
async def test_serpapi_none_config():
    """Test initialization with None config"""
    with pytest.raises(ValueError, match="Config is required"):
        SerpApiClient(config=None)

@pytest.mark.asyncio
async def test_serpapi_empty_config():
    """Test initialization with empty API key"""
    config = AIConfig()
    config.serpapi_api_key = ""
    with pytest.raises(ValueError, match="SerpAPI key not found in config"):
        SerpApiClient(config=config)

@pytest.mark.asyncio
async def test_serpapi_whitespace_key():
    """Test initialization with whitespace API key"""
    with pytest.raises(ValueError, match="SerpAPI key not found in config"):
        SerpApiClient(config=AIConfig(serpapi_api_key="   "))

@pytest.mark.asyncio
async def test_serpapi_empty_query():
    """Test search with empty query"""
    client = SerpApiClient(config=AIConfig(serpapi_api_key="test-key"))
    with pytest.raises(ValueError, match="Search query cannot be empty"):
        await client.search("")
    with pytest.raises(ValueError, match="Search query cannot be empty"):
        await client.search("   ")

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_serpapi_search_success(mock_client):
    """Test successful search request"""
    # Mock response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "organic_results": [
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
    mock_client_instance.get.return_value = mock_response

    client = SerpApiClient(config=AIConfig(serpapi_api_key="test-key"))
    results = await client.search(
        query="test query",
        num_results=5,
        engine="google_scholar"  # Testing additional kwargs
    )

    # Verify results
    assert len(results) == 1
    assert results[0]["title"] == "Result 1"
    assert results[0]["link"] == "http://example.com/1"
    
    # Verify request parameters
    call_kwargs = mock_client_instance.get.call_args[1]
    params = call_kwargs["params"]
    assert params["api_key"] == "test-key"
    assert params["q"] == "test query"
    assert params["num"] == 5
    assert params["engine"] == "google_scholar"

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_serpapi_non_200_response(mock_client):
    """Test handling of non-200 response"""
    mock_response = MagicMock()
    mock_response.status_code = 400
    mock_response.text = "Bad Request"

    mock_client_instance = AsyncMock()
    mock_client.return_value.__aenter__.return_value = mock_client_instance
    mock_client_instance.get.return_value = mock_response

    client = SerpApiClient(config=AIConfig(serpapi_api_key="test-key"))
    with pytest.raises(Exception, match="SerpAPI request failed: Bad Request"):
        await client.search("test query")

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_serpapi_invalid_response_format(mock_client):
    """Test handling of invalid response format"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"invalid": "format"}

    mock_client_instance = AsyncMock()
    mock_client.return_value.__aenter__.return_value = mock_client_instance
    mock_client_instance.get.return_value = mock_response

    client = SerpApiClient(config=AIConfig(serpapi_api_key="test-key"))
    with pytest.raises(Exception, match="Invalid response format from SerpAPI"):
        await client.search("test query")

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_serpapi_connection_error(mock_client):
    """Test handling of connection error"""
    mock_client.return_value.__aenter__.side_effect = Exception("Connection error")

    client = SerpApiClient(config=AIConfig(serpapi_api_key="test-key"))
    with pytest.raises(Exception, match="SerpAPI request failed: Connection error"):
        await client.search("test query")

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_serpapi_json_decode_error(mock_client):
    """Test handling of JSON decode error"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.side_effect = Exception("Invalid JSON")

    mock_client_instance = AsyncMock()
    mock_client.return_value.__aenter__.return_value = mock_client_instance
    mock_client_instance.get.return_value = mock_response

    client = SerpApiClient(config=AIConfig(serpapi_api_key="test-key"))
    with pytest.raises(Exception, match="SerpAPI request failed: Invalid JSON"):
        await client.search("test query")

@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_serpapi_additional_params(mock_client):
    """Test passing additional parameters"""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"organic_results": []}

    mock_client_instance = AsyncMock()
    mock_client.return_value.__aenter__.return_value = mock_client_instance
    mock_client_instance.get.return_value = mock_response

    client = SerpApiClient(config=AIConfig(serpapi_api_key="test-key"))
    await client.search(
        "test query",
        location="New York",
        device="mobile",
        custom_param="value"
    )

    # Verify all parameters were passed
    call_kwargs = mock_client_instance.get.call_args[1]
    params = call_kwargs["params"]
    assert params["location"] == "New York"
    assert params["device"] == "mobile"
    assert params["custom_param"] == "value"
    assert params["api_key"] == "test-key"
    assert params["q"] == "test query"
