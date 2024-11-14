import pytest
import numpy as np
from unittest.mock import patch, Mock
from atlas.prism.dimension_analyzer import DimensionAnalyzer

@pytest.mark.asyncio
async def test_analyze_dimensions_basic(mock_images):
    analyzer = DimensionAnalyzer()
    
    with patch.object(analyzer, '_analyze_satellite') as mock_satellite, \
         patch.object(analyzer, '_analyze_street_view') as mock_street:
            
        mock_satellite.return_value = {'width': 30.0, 'length': 45.0}
        mock_street.return_value = {
            'height': 40.0,
            'floor_height': 3.5,
            'floor_count': 12
        }
        
        dimensions = await analyzer.analyze_dimensions(mock_images)
        assert dimensions.width == 30.0
        assert dimensions.length == 45.0
        assert dimensions.height == 40.0

def test_detect_window_rows():
    analyzer = DimensionAnalyzer()
    
    # Create test image with correct shape
    test_image = np.zeros((200, 100))  # 2D array instead of 3D
    test_image[50:60, 20:80] = 1.0
    test_image[120:130, 20:80] = 1.0
    
    window_rows = analyzer._detect_window_rows(test_image)
    
    assert len(window_rows) == 2
    assert 50 <= window_rows[0] <= 60  # First row
    assert 120 <= window_rows[1] <= 130  # Second row

@pytest.mark.benchmark
@pytest.mark.asyncio
async def test_analyze_dimensions_performance(benchmark, mock_images):
    analyzer = DimensionAnalyzer()
    
    with patch.object(analyzer, '_analyze_satellite') as mock_satellite, \
         patch.object(analyzer, '_analyze_street_view') as mock_street:
            
        mock_satellite.return_value = {'width': 30.0, 'length': 45.0}
        mock_street.return_value = {
            'height': 40.0,
            'floor_height': 3.5,
            'floor_count': 12
        }
        
        result = await benchmark.pedantic(
            analyzer.analyze_dimensions,
            args=(mock_images,),
            iterations=1,
            rounds=100
        )
        
        # Performance assertions
        assert benchmark.stats['mean'] < 0.2  # 200ms target
        assert benchmark.stats['max'] < 0.3   # 300ms max spike

@pytest.mark.benchmark
def test_window_detection_performance(benchmark):
    analyzer = DimensionAnalyzer()
    
    # Create test image
    test_image = np.zeros((200, 100))
    test_image[50:60, 20:80] = 1.0
    test_image[120:130, 20:80] = 1.0
    
    benchmark(analyzer._detect_window_rows, test_image)
    
    # Performance assertions
    assert benchmark.stats['mean'] < 0.05  # 50ms target
    assert benchmark.stats['max'] < 0.1    # 100ms max spike
