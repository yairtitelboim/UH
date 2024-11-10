import pytest
from typing import Dict, Any
from atlas.services.zoning import ZoningService
from atlas.core.config import AIConfig

@pytest.fixture
def zoning_service():
    return ZoningService(AIConfig())

@pytest.fixture
def sample_zoning_data() -> Dict[str, Any]:
    return {
        "address": "123 Main St",
        "zoning_code": "R1",
        "lot_size": 5000,
        "building_height": 35,
        "setbacks": {
            "front": 20,
            "back": 25,
            "sides": 10
        }
    }

@pytest.mark.asyncio
async def test_analyze_zoning_basic(zoning_service):
    """Test basic zoning analysis with minimal data."""
    test_data = {
        "address": "123 Main St",
        "zoning_code": "R1"
    }
    result = await zoning_service.analyze_zoning(test_data)
    assert isinstance(result, dict)
    assert "permitted_uses" in result
    assert isinstance(result["permitted_uses"], list)
    assert "restrictions" in result
    assert "zoning_analysis" in result

@pytest.mark.asyncio
async def test_analyze_zoning_complete(zoning_service, sample_zoning_data):
    """Test zoning analysis with complete property data."""
    result = await zoning_service.analyze_zoning(sample_zoning_data)
    assert isinstance(result, dict)
    assert all(key in result for key in ["zoning_analysis", "permitted_uses", "restrictions"])
    assert isinstance(result["permitted_uses"], list)
    assert isinstance(result["restrictions"], dict)
    assert isinstance(result["zoning_analysis"], dict)

@pytest.mark.asyncio
async def test_analyze_zoning_empty_data(zoning_service):
    """Test zoning analysis with empty data."""
    result = await zoning_service.analyze_zoning({})
    assert isinstance(result, dict)
    assert all(key in result for key in ["zoning_analysis", "permitted_uses", "restrictions"])
    assert result["permitted_uses"] == []
    assert result["restrictions"] == {}
    assert result["zoning_analysis"] == {}

@pytest.mark.asyncio
async def test_get_zoning_requirements_basic(zoning_service):
    """Test basic zoning requirements retrieval."""
    result = await zoning_service.get_zoning_requirements("R1")
    assert isinstance(result, dict)
    assert "requirements" in result
    assert "restrictions" in result

@pytest.mark.asyncio
async def test_get_zoning_requirements_detailed(zoning_service):
    """Test detailed zoning requirements retrieval."""
    result = await zoning_service.get_zoning_requirements("C1")
    assert isinstance(result, dict)
    assert all(key in result for key in ["requirements", "restrictions"])
    assert isinstance(result["requirements"], dict)
    assert isinstance(result["restrictions"], dict)

@pytest.mark.asyncio
async def test_get_zoning_requirements_invalid_code(zoning_service):
    """Test zoning requirements retrieval with invalid zoning code."""
    result = await zoning_service.get_zoning_requirements("")
    assert isinstance(result, dict)
    assert result["requirements"] == {}
    assert result["restrictions"] == {}

@pytest.mark.asyncio
async def test_analyze_zoning_with_requirements(zoning_service, sample_zoning_data):
    """Test zoning analysis with requirements integration."""
    zoning_result = await zoning_service.analyze_zoning(sample_zoning_data)
    requirements_result = await zoning_service.get_zoning_requirements(sample_zoning_data["zoning_code"])
    
    assert isinstance(zoning_result, dict)
    assert isinstance(requirements_result, dict)
    assert all(key in zoning_result for key in ["zoning_analysis", "permitted_uses", "restrictions"])
    assert all(key in requirements_result for key in ["requirements", "restrictions"])

@pytest.mark.asyncio
async def test_service_initialization():
    """Test service initialization with different configs."""
    # Test with no config
    service1 = ZoningService()
    assert service1.config is None
    
    # Test with empty config
    service2 = ZoningService(AIConfig())
    assert isinstance(service2.config, AIConfig)
    
    # Test with custom config
    custom_config = AIConfig()
    service3 = ZoningService(custom_config)
    assert service3.config is custom_config