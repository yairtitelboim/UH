import pytest
from unittest.mock import AsyncMock, Mock, patch
from atlas.prism.integration import PrismIntegration
from atlas.prism.models import BuildingDimensions, Floorplate, OptimizedLayout

@pytest.fixture
def mock_images():
    return {
        'satellite': {'image': 'mock_satellite_image'},
        'street_view': {'image': 'mock_street_view_image'}
    }

@pytest.fixture
def mock_google_client():
    with patch('atlas.prism.image_collector.GoogleMapsClient') as mock:
        yield mock

@pytest.fixture
def prism(mock_google_client, mock_images):
    mock_config = {
        'api_key': 'test_key',
        'google_maps_api_key': 'test_google_key'
    }
    
    # Create mock objects
    mock_image_collector = Mock()
    mock_image_collector.collect_images = AsyncMock(return_value=mock_images)
    
    # Initialize PrismIntegration
    prism = PrismIntegration(mock_config)
    
    # Replace real components with mocks
    prism.image_collector = mock_image_collector
    prism.dimension_analyzer.analyze_dimensions = Mock(return_value=BuildingDimensions(
        width=30.0,
        length=40.0,
        height=35.0,
        floor_height=3.5,
        floor_count=10
    ))
    prism.window_detector.detect_windows = Mock(return_value=[])
    prism.floorplate_gen.generate_floorplate = Mock(return_value=Floorplate(
        width=30.0,
        length=40.0,
        core_width=10.0,
        core_depth=12.0,
        corridor_width=1.7,
        units=[],
        efficiency=0.85
    ))
    prism.layout_optimizer.optimize_layout = Mock(return_value=OptimizedLayout(
        units=[],
        efficiency=0.85,
        window_utilization=0.9,
        risk_factors={'window_pattern': {'status': 'Low Risk', 'score': 90}}
    ))
    
    return prism
