import pytest
from unittest.mock import AsyncMock, Mock, patch
import sys
import os

# First, create all our mocks
mock_samgeo = Mock()
mock_samgeo.SAMGeo = Mock()
mock_samgeo.SAMGeo.return_value = Mock(
    segment=Mock(return_value={
        'height': 36.6,
        'width': 30.5,
        'length': 45.7
    }),
    analyze=Mock(return_value={
        'floor_count': 10,
        'floor_height': 3.5
    })
)

# Mock required external modules for PRISM
sys.modules['segment_geospatial'] = mock_samgeo
sys.modules['torch'] = Mock()
sys.modules['numpy'] = Mock()
sys.modules['ultralytics'] = Mock()

from atlas.prism.models import BuildingDimensions, Floorplate, OptimizedLayout

class MockPrismIntegration:
    def __init__(self, config):
        self.image_collector = Mock()
        self.dimension_analyzer = Mock()
        self.window_detector = Mock()
        self.floorplate_gen = Mock()
        self.layout_optimizer = Mock()
        self.visualizer = Mock()
        
        # Set up async mock returns
        self.dimension_analyzer.analyze_dimensions = AsyncMock()
        self.window_detector.detect_windows = AsyncMock()
        self.floorplate_gen.generate_floorplate = AsyncMock()
        self.layout_optimizer.optimize_layout = AsyncMock()
        self.visualizer.transform_for_frontend = AsyncMock()
        
    async def analyze_building(self, address: str):
        images = await self.image_collector.collect_images(address)
        dimensions = await self.dimension_analyzer.analyze_dimensions(images)
        windows = await self.window_detector.detect_windows(images['street_view'])
        floorplate = await self.floorplate_gen.generate_floorplate(dimensions)
        layout = await self.layout_optimizer.optimize_layout(floorplate, windows)
        viz_data = await self.visualizer.transform_for_frontend({
            'dimensions': dimensions,
            'windows': windows,
            'floorplate': floorplate,
            'optimized_layout': layout
        })
        return {
            'raw_data': {
                'dimensions': dimensions,
                'windows': windows,
                'floorplate': floorplate,
                'optimized_layout': layout
            },
            'visualization': viz_data
        }

# PRISM-specific fixtures
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
        'google_maps_api_key': 'test_google_key',
        'cache_dir': '/tmp/test_cache'
    }
    
    prism = MockPrismIntegration(mock_config)
    
    # Set up async mocks with coroutine return values
    async def mock_collect_images(*args):
        return mock_images
        
    prism.image_collector.collect_images = AsyncMock(side_effect=mock_collect_images)
    
    # Create async wrapper that accepts multiple arguments
    async def wrap_return(*args, **kwargs):
        # Get the mock that's currently being called
        current_mock = None
        frame = sys._getframe(1)
        if 'self' in frame.f_locals:
            current_mock = frame.f_locals['self']
        
        if current_mock:
            if hasattr(current_mock, 'return_value'):
                return current_mock.return_value
        return args[0] if args else None
        
    prism.dimension_analyzer.analyze_dimensions = AsyncMock(side_effect=wrap_return)
    prism.window_detector.detect_windows = AsyncMock(side_effect=wrap_return)
    prism.floorplate_gen.generate_floorplate = AsyncMock(side_effect=wrap_return)
    prism.layout_optimizer.optimize_layout = AsyncMock(side_effect=wrap_return)
    prism.visualizer.transform_for_frontend = AsyncMock(side_effect=wrap_return)
    
    return prism
