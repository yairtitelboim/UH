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
async def integration(mock_config):
    # Mock all component dependencies
    with patch('atlas.prism.integration.ImageCollector') as mock_collector, \
         patch('atlas.prism.integration.DimensionAnalyzer') as mock_analyzer, \
         patch('atlas.prism.integration.WindowDetector') as mock_detector, \
         patch('atlas.prism.integration.FloorplateGenerator') as mock_gen, \
         patch('atlas.prism.integration.LayoutOptimizer') as mock_optimizer, \
         patch('atlas.prism.integration.PrismVisualizer') as mock_viz:
        
        integration = PrismIntegration(mock_config)
        integration.image_collector.collect_images = AsyncMock()
        return integration

@pytest.mark.asyncio
async def test_analyze_building_success(integration, mock_images):
    # Setup mock returns
    integration.image_collector.collect_images.return_value = mock_images
    integration.dimension_analyzer.analyze_dimensions.return_value = BuildingDimensions(
        width=30.0, length=45.0, height=40.0, 
        floor_height=3.5, floor_count=12
    )
    integration.window_detector.detect_windows.return_value = [
        {'x': 10, 'y': 20, 'width': 2}
    ]
    integration.floorplate_gen.generate_floorplate.return_value = Floorplate(
        width=30.0, length=45.0,
        core_width=12.2, core_depth=15.0,
        corridor_width=1.7,
        units=[],
        efficiency=0.82
    )
    
    result = await integration.analyze_building("123 Test St")
    
    # Verify the structure and content of the result
    assert 'raw_data' in result
    assert 'visualization' in result
    assert set(result['raw_data'].keys()) == {
        'dimensions', 'windows', 'floorplate', 'optimized_layout'
    }

@pytest.mark.asyncio
async def test_analyze_building_invalid_address(integration):
    integration.image_collector.collect_images.side_effect = ValueError("Invalid address")
    
    with pytest.raises(ValueError, match="Invalid address"):
        await integration.analyze_building("Invalid Address")

@pytest.mark.asyncio
async def test_analyze_building_missing_images(integration):
    integration.image_collector.collect_images.return_value = {}
    
    with pytest.raises(ValueError, match="Missing required image data"):
        await integration.analyze_building("123 Test St")

@pytest.mark.asyncio
async def test_component_interaction_order(integration, mock_images):
    # Setup spy objects to track call order
    calls = []
    
    def track_call(name):
        calls.append(name)
        return Mock()
    
    integration.image_collector.collect_images = AsyncMock(
        side_effect=lambda x: track_call('collect_images')
    )
    integration.dimension_analyzer.analyze_dimensions = Mock(
        side_effect=lambda x: track_call('analyze_dimensions')
    )
    integration.window_detector.detect_windows = Mock(
        side_effect=lambda x: track_call('detect_windows')
    )
    
    try:
        await integration.analyze_building("123 Test St")
    except:
        pass
    
    assert calls == ['collect_images', 'analyze_dimensions', 'detect_windows']
