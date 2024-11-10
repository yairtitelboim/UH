import pytest
from unittest.mock import Mock, AsyncMock, patch
import numpy as np
from atlas.prism.integration import PrismIntegration
from atlas.prism.dimension_analyzer import BuildingDimensions
from atlas.prism.floorplate_gen import Floorplate

@pytest.fixture
def mock_config():
    return {
        'google_maps_api_key': 'test_key'
    }

@pytest.fixture
def mock_images():
    return {
        'satellite': {
            'image': np.zeros((100, 100, 3)),
            'metadata': {'scale': 0.5}
        },
        'street_view': {
            'image': np.zeros((200, 100, 3)),
            'metadata': {'height': 30}
        }
    }

@pytest.fixture
async def prism(mock_config):
    # Reference initialization code from atlas/prism/integration.py (lines 10-16)
    with patch.multiple('atlas.prism.integration',
                       ImageCollector=Mock(),
                       DimensionAnalyzer=Mock(),
                       WindowDetector=Mock(),
                       FloorplateGenerator=Mock(),
                       LayoutOptimizer=Mock(),
                       PrismVisualizer=Mock()):
        
        integration = PrismIntegration(mock_config)
        integration.image_collector.collect_images = AsyncMock()
        return integration

@pytest.mark.asyncio
async def test_analyze_building_success(prism, mock_images):
    # Setup mock returns
    prism.image_collector.collect_images.return_value = mock_images
    prism.dimension_analyzer.analyze_dimensions.return_value = BuildingDimensions(
        width=30.0, length=45.0, height=40.0, 
        floor_height=3.5, floor_count=12
    )
    prism.window_detector.detect_windows.return_value = [
        {'x': 10, 'y': 20, 'width': 2}
    ]
    prism.floorplate_gen.generate_floorplate.return_value = Floorplate(
        width=30.0, length=45.0,
        core_width=12.2, core_depth=15.0,
        corridor_width=1.7,
        units=[],
        efficiency=0.82
    )
    
    result = await prism.analyze_building("123 Test St")
    
    assert 'raw_data' in result
    assert 'visualization' in result
    assert set(result['raw_data'].keys()) == {
        'dimensions', 'windows', 'floorplate', 'optimized_layout'
    }

@pytest.mark.asyncio
async def test_analyze_building_invalid_address(prism):
    prism.image_collector.collect_images.side_effect = ValueError("Invalid address")
    
    with pytest.raises(ValueError, match="Invalid address"):
        await prism.analyze_building("Invalid Address")

@pytest.mark.asyncio
async def test_analyze_building_missing_images(prism):
    prism.image_collector.collect_images.return_value = {}
    
    with pytest.raises(ValueError, match="Missing required image data"):
        await prism.analyze_building("123 Test St")
