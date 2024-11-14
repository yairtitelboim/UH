import pytest
from unittest.mock import AsyncMock, Mock, patch
from atlas.prism.models import BuildingDimensions, Floorplate, OptimizedLayout
from atlas.prism.integration import PrismIntegration

@pytest.mark.asyncio
async def test_analyze_building_dimension_analyzer_error(prism, mock_images):
    """Test handling of DimensionAnalyzer errors"""
    prism.image_collector.collect_images.return_value = mock_images
    prism.dimension_analyzer.analyze_dimensions.side_effect = ValueError("Failed to analyze dimensions")
    
    with pytest.raises(ValueError, match="Failed to analyze dimensions"):
        await prism.analyze_building("123 Test St")

@pytest.mark.asyncio
async def test_analyze_building_window_detector_error(prism, mock_images):
    """Test handling of WindowDetector errors"""
    prism.image_collector.collect_images.return_value = mock_images
    prism.dimension_analyzer.analyze_dimensions.return_value = BuildingDimensions(
        width=30.0, length=45.0, height=40.0, 
        floor_height=3.5, floor_count=12
    )
    prism.window_detector.detect_windows.side_effect = RuntimeError("Window detection failed")
    
    with pytest.raises(RuntimeError, match="Window detection failed"):
        await prism.analyze_building("123 Test St")

@pytest.mark.asyncio
async def test_analyze_building_floorplate_error(prism, mock_images):
    """Test handling of FloorplateGenerator errors"""
    prism.image_collector.collect_images.return_value = mock_images
    prism.dimension_analyzer.analyze_dimensions.return_value = BuildingDimensions(
        width=30.0, length=45.0, height=40.0, 
        floor_height=3.5, floor_count=12
    )
    prism.window_detector.detect_windows.return_value = [{'x': 10, 'y': 20, 'width': 2}]
    prism.floorplate_gen.generate_floorplate.side_effect = ValueError("Invalid dimensions")
    
    with pytest.raises(ValueError, match="Invalid dimensions"):
        await prism.analyze_building("123 Test St")

@pytest.mark.asyncio
async def test_analyze_building_layout_optimizer_error(prism, mock_images):
    """Test handling of LayoutOptimizer errors"""
    prism.image_collector.collect_images.return_value = mock_images
    prism.dimension_analyzer.analyze_dimensions.return_value = BuildingDimensions(
        width=30.0, length=45.0, height=40.0, 
        floor_height=3.5, floor_count=12
    )
    prism.window_detector.detect_windows.return_value = [{'x': 10, 'y': 20, 'width': 2}]
    prism.layout_optimizer.optimize_layout.side_effect = RuntimeError("Layout optimization failed")
    
    with pytest.raises(RuntimeError, match="Layout optimization failed"):
        await prism.analyze_building("123 Test St")

@pytest.mark.asyncio
async def test_analyze_building_success(prism, mock_images):
    dimensions = BuildingDimensions(
        width=30.0, length=40.0, height=35.0,
        floor_height=3.5, floor_count=10
    )
    
    floorplate = Floorplate(
        width=30.0, length=40.0,
        core_width=12.2, core_depth=12.2,
        corridor_width=1.7, units=[], efficiency=0.85
    )
    
    optimized_layout = OptimizedLayout(
        units=[], efficiency=0.85,
        window_utilization=0.9,
        risk_factors={'window_pattern': {'status': 'Low Risk', 'score': 90}}
    )
    
    prism.dimension_analyzer.analyze_dimensions.return_value = dimensions
    prism.window_detector.detect_windows.return_value = []
    prism.floorplate_gen.generate_floorplate.return_value = floorplate
    prism.layout_optimizer.optimize_layout.return_value = optimized_layout
    
    result = await prism.analyze_building("123 Test St")
    
    assert 'raw_data' in result
    assert 'visualization' in result
    assert result['raw_data']['dimensions'] == dimensions
    assert result['raw_data']['floorplate'] == floorplate
    assert result['raw_data']['optimized_layout'] == optimized_layout
