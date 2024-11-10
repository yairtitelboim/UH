import pytest
from unittest.mock import patch, MagicMock
from atlas.core.config import AIConfig
from atlas.clients.unstructured import UnstructuredClient

@pytest.mark.asyncio
async def test_unstructured_none_config():
    with pytest.raises(ValueError, match="Config is required"):
        UnstructuredClient(config=None)

@pytest.mark.asyncio
async def test_unstructured_empty_config():
    config = AIConfig()
    config.unstructured_api_key = ""
    with pytest.raises(ValueError, match="Unstructured API key not found in config"):
        UnstructuredClient(config=config)

@pytest.mark.asyncio
async def test_unstructured_whitespace_key():
    with pytest.raises(ValueError, match="Unstructured API key not found in config"):
        UnstructuredClient(config=AIConfig(unstructured_api_key="   "))

@pytest.mark.asyncio
@patch('httpx.AsyncClient.post')
async def test_unstructured_extract_text_success(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {"text": "Extracted text 1"},
        {"text": "Extracted text 2"}
    ]
    mock_post.return_value = mock_response

    client = UnstructuredClient(config=AIConfig(unstructured_api_key="test-key"))
    result = await client.extract_text("test file content")

    assert result == "Extracted text 1\nExtracted text 2"
    mock_post.assert_called_once()

@pytest.mark.asyncio
@patch('httpx.AsyncClient.post')
async def test_unstructured_empty_file(mock_post):
    client = UnstructuredClient(config=AIConfig(unstructured_api_key="test-key"))
    with pytest.raises(ValueError, match="File content cannot be empty"):
        await client.extract_text("")
    with pytest.raises(ValueError, match="File content cannot be empty"):
        await client.extract_text("   ")

@pytest.mark.asyncio
@patch('httpx.AsyncClient.post')
async def test_unstructured_file_error(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 400
    mock_response.text = "Invalid file format"
    mock_post.return_value = mock_response

    client = UnstructuredClient(config=AIConfig(unstructured_api_key="test-key"))
    with pytest.raises(Exception, match="Unstructured request failed: Invalid file format"):
        await client.extract_text("test content")

@pytest.mark.asyncio
@patch('httpx.AsyncClient.post')
async def test_unstructured_invalid_response(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    # Test with non-list response to trigger the actual error
    mock_response.json.return_value = {"not_a_list": "data"}
    mock_post.return_value = mock_response

    client = UnstructuredClient(config=AIConfig(unstructured_api_key="test-key"))
    with pytest.raises(Exception, match="Invalid response format from Unstructured"):
        await client.extract_text("test content")

@pytest.mark.asyncio
@patch('httpx.AsyncClient.post')
async def test_unstructured_empty_response(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = []
    mock_post.return_value = mock_response

    client = UnstructuredClient(config=AIConfig(unstructured_api_key="test-key"))
    result = await client.extract_text("test content")
    assert result == ""

@pytest.mark.asyncio
@patch('httpx.AsyncClient.post')
async def test_unstructured_connection_error(mock_post):
    mock_post.side_effect = Exception("Connection error")
    
    client = UnstructuredClient(config=AIConfig(unstructured_api_key="test-key"))
    with pytest.raises(Exception, match="Unstructured request failed: Connection error"):
        await client.extract_text("test content")
