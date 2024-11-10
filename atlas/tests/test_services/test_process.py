import pytest
from unittest.mock import AsyncMock, patch
from atlas.services.process import PropertyProcessor
from atlas.core.config import AIConfig

@pytest.fixture
def processor():
    return PropertyProcessor(AIConfig())

@pytest.mark.asyncio
async def test_process_property_data():
    """Test property data processing."""
    processor = PropertyProcessor(AIConfig())
    
    test_data = {
        "address": "123 Main St",
        "price": 500000,
        "description": "Beautiful property"
    }
    
    result = await processor.process_property_data(test_data)
    assert isinstance(result, dict)
    assert "property_metrics" in result
    assert "market_data" in result
    assert "financial_metrics" in result

@pytest.mark.asyncio
async def test_extract_metrics():
    """Test metrics extraction."""
    processor = PropertyProcessor(AIConfig())
    
    test_text = """
    NOI: $50,000
    Cap Rate: 5.5%
    Occupancy: 95%
    """
    
    result = await processor.extract_metrics(test_text)
    assert isinstance(result, dict)
    assert "noi" in result
    assert "cap_rate" in result
    assert "occupancy" in result

@pytest.mark.asyncio
async def test_empty_data_handling():
    """Test handling of empty data."""
    processor = PropertyProcessor(AIConfig())
    
    result = await processor.process_property_data({})
    assert isinstance(result, dict)
    assert all(key in result for key in ["property_metrics", "market_data", "financial_metrics"])