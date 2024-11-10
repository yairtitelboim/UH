import pytest
import numpy as np
from unittest.mock import Mock, AsyncMock
from atlas.prism.dimension_analyzer import DimensionAnalyzer
from atlas.prism.models import BuildingDimensions

@pytest.fixture
def mock_sam_model():
    mock = Mock()
    mock.segment = Mock()
    return mock

@pytest.fixture
def analyzer(mock_sam_model):
    analyzer = DimensionAnalyzer()
    analyzer.sam_model = mock_sam_model
    return analyzer

@pytest.fixture
def mock_images():
    return {
        'satellite': {
            'image': np.zeros((100, 100)),
            'metadata': {'scale': 0.5}
        },
        'street_view': {
            'image': np.zeros((200, 100)),
            'metadata': {'height': 35.0}
        }
    }

@pytest.mark.asyncio
async def test_analyze_dimensions_missing_images(analyzer):
    with pytest.raises(ValueError, match="Missing required image data"):
        await analyzer.analyze_dimensions({})

@pytest.mark.asyncio
async def test_analyze_dimensions_invalid_images(analyzer):
    with pytest.raises(ValueError, match="Invalid image data"):
        await analyzer.analyze_dimensions({
            'satellite': {},
            'street_view': {}
        })

@pytest.mark.asyncio
async def test_analyze_dimensions_success(analyzer, mock_images):
    # Mock SAM model responses
    analyzer.sam_model.segment.side_effect = [
        np.ones((50, 40)),  # Building mask
        np.ones((10, 10))   # Reference object mask
    ]
    
    dimensions = await analyzer.analyze_dimensions(mock_images)
    
    assert isinstance(dimensions, BuildingDimensions)
    assert dimensions.width > 0
    assert dimensions.length > 0
    assert dimensions.height > 0
    assert dimensions.floor_height > 0
    assert dimensions.floor_count > 0

@pytest.mark.asyncio
async def test_analyze_street_view_no_windows(analyzer, mock_images):
    # Test fallback behavior when no windows are detected
    street_dims = await analyzer._analyze_street_view(mock_images['street_view'])
    
    assert street_dims['height'] == 7.0  # 2 floors * 3.5m
    assert street_dims['floor_height'] == 3.5
    assert street_dims['floor_count'] == 2

@pytest.mark.asyncio
async def test_calculate_scale_no_references(analyzer):
    # Test fallback scale when no reference objects found
    scale = await analyzer._calculate_scale(np.zeros((100, 100)))
    assert scale == 0.5

@pytest.mark.asyncio
async def test_detect_window_rows(analyzer):
    # Create test image with simulated window rows
    image = np.zeros((200, 100))
    image[50:60, :] = 1  # First window row
    image[100:110, :] = 1  # Second window row
    
    window_rows = analyzer._detect_window_rows(image)
    
    assert len(window_rows) == 2
    assert window_rows[0] in range(50, 60)
    assert window_rows[1] in range(100, 110)
