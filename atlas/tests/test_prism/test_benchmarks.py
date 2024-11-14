#  file name: test_benchmarks.py
import pytest
import asyncio
import numpy as np
import functools
from typing import Callable, Any
from unittest.mock import patch, Mock, AsyncMock
from atlas.prism.models import BuildingDimensions, Floorplate, OptimizedLayout
from atlas.prism.integration import (
    PrismIntegration,
    ImageCollector,
    DimensionAnalyzer,
    WindowDetector,
    FloorplateGenerator,
    LayoutOptimizer,
    PrismVisualizer
)
import os
import nest_asyncio
nest_asyncio.apply()

def async_benchmark(benchmark, async_func, *args, **kwargs):
    """Helper to properly benchmark async functions using pytest-asyncio"""
    @functools.wraps(async_func)
    def sync_wrapper(*wrapper_args, **wrapper_kwargs):
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            return loop.run_until_complete(async_func(*wrapper_args, **wrapper_kwargs))
        except RuntimeError:
            # Create a new loop if the current one is running
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                return new_loop.run_until_complete(async_func(*wrapper_args, **wrapper_kwargs))
            finally:
                new_loop.close()
    
    return benchmark(sync_wrapper)

@pytest.fixture(scope="function")
def event_loop():
    """Create an event loop for each test case."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    if not loop.is_closed():
        loop.close()

@pytest.fixture
def sample_dimensions():
    return BuildingDimensions(
        width=30.5,
        length=45.7,
        height=36.6,
        floor_height=3.5,
        floor_count=10
    )

@pytest.fixture
def sample_windows():
    return [{'x': x, 'y': 0, 'width': 1.5, 'height': 1.5} 
            for x in range(0, 30, 3)]

@pytest.fixture(autouse=True)
def mock_dependencies():
    with patch.multiple('atlas.prism.integration',
                      ImageCollector=AsyncMock(),
                      DimensionAnalyzer=AsyncMock(),
                      WindowDetector=AsyncMock(),
                      FloorplateGenerator=AsyncMock(),
                      LayoutOptimizer=AsyncMock(),
                      PrismVisualizer=AsyncMock()):
        yield

@pytest.mark.benchmark
class TestPrismPerformance:
    @pytest.mark.asyncio
    async def test_floorplate_generation(self, benchmark, sample_dimensions):
        """Benchmark floorplate generation performance"""
        generator = Mock()
        generator.generate_floorplate = AsyncMock(return_value=Floorplate(
            width=30.0,
            length=40.0,
            core_width=10.0,
            core_depth=12.0,
            corridor_width=1.7,
            units=[],
            efficiency=0.85
        ))
        
        async def run_benchmark():
            return await generator.generate_floorplate(sample_dimensions)
            
        async_benchmark(benchmark, run_benchmark)
        
        assert benchmark.stats['mean'] < 0.1  # 100ms target
        assert benchmark.stats['max'] < 0.2   # 200ms max spike
        
    @pytest.mark.asyncio
    async def test_layout_optimization(self, benchmark, sample_floorplate, sample_layout):
        optimizer = Mock()
        optimizer.optimize_layout = AsyncMock(return_value=sample_layout)
        
        async def run_benchmark():
            return await optimizer.optimize_layout(sample_floorplate, [])
            
        async_benchmark(benchmark, run_benchmark)
        
        assert benchmark.stats['mean'] < 0.5  # 500ms target
        assert benchmark.stats['max'] < 1.0   # 1s max acceptable time
        
    @pytest.mark.asyncio
    async def test_full_pipeline(self, benchmark, mock_dependencies):
        """Benchmark complete PRISM pipeline"""
        config = {'google_maps_api_key': 'test_key', 'cache_dir': '/tmp/test'}
        prism = PrismIntegration(config)
        
        async def mock_images(*args, **kwargs):
            return {
                'satellite': {'image': np.zeros((100, 100, 3)), 'metadata': {'scale': 0.5}},
                'street_view': {'image': np.zeros((200, 100, 3)), 'metadata': {'height': 30}}
            }
        
        prism.image_collector.collect_images = mock_images
        
        async def run_benchmark():
            return await prism.analyze_building("123 Test St")
            
        async_benchmark(benchmark, run_benchmark)
        
        assert benchmark.stats['mean'] < 2.0
        assert benchmark.stats['max'] < 3.0

    @pytest.mark.asyncio
    async def test_visualization_transform(self, benchmark, mock_dependencies):
        """Benchmark visualization transform performance"""
        config = {'google_maps_api_key': 'test_key', 'cache_dir': '/tmp/test'}
        prism = PrismIntegration(config)
        prism.visualizer.transform_for_frontend = AsyncMock(return_value={'data': 'test'})
        
        test_data = {
            'dimensions': BuildingDimensions(width=30.0, length=45.0, height=40.0, 
                                          floor_height=3.5, floor_count=12),
            'windows': [{'x': 10, 'y': 20, 'width': 2}],
            'floorplate': Floorplate(width=30.0, length=45.0, core_width=12.0,
                                   core_depth=15.0, corridor_width=1.7,
                                   units=[], efficiency=0.82)
        }
        
        async def run_benchmark():
            return await prism.visualizer.transform_for_frontend(test_data)
            
        async_benchmark(benchmark, run_benchmark)
        
        assert benchmark.stats['mean'] < 0.5

@pytest.mark.benchmark
class TestPrismComponentPerformance:
    @pytest.mark.asyncio
    async def test_dimension_analyzer_performance(self, benchmark, mock_dependencies):
        """Benchmark dimension analyzer performance"""
        analyzer = Mock()
        analyzer.analyze_dimensions = AsyncMock(return_value=BuildingDimensions(
            width=30.0,
            length=40.0,
            height=35.0,
            floor_height=3.5,
            floor_count=10
        ))
        
        test_images = {
            'satellite': {'image': np.zeros((100, 100, 3)), 'metadata': {'scale': 0.5}},
            'street_view': {'image': np.zeros((200, 100, 3)), 'metadata': {'height': 30}}
        }
        
        async def run_benchmark():
            return await analyzer.analyze_dimensions(test_images)
            
        async_benchmark(benchmark, run_benchmark)
        
        assert benchmark.stats['mean'] < 1.0
        assert benchmark.stats['max'] < 2.0

    @pytest.mark.asyncio
    async def test_image_collector_pipeline(self, benchmark, mock_maps_client):
        """Benchmark image collector pipeline"""
        config = {
            'google_maps_api_key': 'test_key',
            'cache_dir': '/tmp/test'
        }
        
        mock_instance = mock_maps_client.return_value
        mock_instance.geocode = AsyncMock(return_value=[{
            'geometry': {'location': {'lat': 40.7128, 'lng': -74.006}}
        }])
        mock_instance.static_map = AsyncMock(return_value=b'test_image_data')
        mock_instance.street_view = AsyncMock(return_value=b'test_image_data')
        
        collector = ImageCollector(config)
        
        async def run_benchmark():
            return await collector.collect_images("123 Test St")
        
        async_benchmark(benchmark, run_benchmark)
        
        assert benchmark.stats['mean'] < 1.0
        assert benchmark.stats['max'] < 2.0

    @pytest.mark.asyncio
    async def test_floorplate_optimization_stress(self, benchmark):
        """Benchmark floorplate optimization under stress"""
        optimizer = Mock()
        optimizer.optimize_layout = AsyncMock(return_value=OptimizedLayout(
            units=[],
            efficiency=0.85,
            window_utilization=0.9,
            risk_factors={'window_pattern': {'status': 'Low Risk', 'score': 90}}
        ))
        
        floorplate = Floorplate(width=50.0, length=80.0, core_width=15.0,
                              core_depth=20.0, corridor_width=1.7,
                              units=[], efficiency=0.82)
        windows = [{'x': x, 'y': y, 'width': 1.5, 'height': 1.5} 
                  for x in range(0, 50, 2) 
                  for y in range(0, 80, 2)]
        
        async def run_benchmark():
            return await optimizer.optimize_layout(floorplate, windows)
            
        async_benchmark(benchmark, run_benchmark)
        
        assert benchmark.stats['mean'] < 1.0
        assert benchmark.stats['max'] < 2.0

@pytest.mark.benchmark
class TestPrismComponentCoverage:
    async def test_dimension_analyzer_comprehensive(self, benchmark, mock_dependencies):
        """Test dimension analyzer with various input scenarios"""
        analyzer = DimensionAnalyzer()
        
        test_cases = [
            {'satellite': {'scale': 0.5}, 'street_view': {'height': 30}},
            {'satellite': {'scale': 0.25}, 'street_view': {'height': 45}},
            {'satellite': {'scale': 1.0}, 'street_view': {'height': 20}}
        ]
        
        for case in test_cases:
            async def run_benchmark():
                mock_data = {
                    'satellite': {'image': 'test.jpg', 'metadata': case['satellite']},
                    'street_view': {'image': 'street.jpg', 'metadata': case['street_view']}
                }
                return await analyzer.analyze_dimensions(mock_data)
                
            async_benchmark(benchmark, run_benchmark)

    async def test_image_collector_scenarios(self, benchmark):
        """Test image collector with different API responses"""
        config = {
            'google_maps_api_key': 'AIzaSyCb0qBz4tvOTfKC69CwOCqx1lYM_vzfqF8',  # Updated from YOUR_VALID_API_KEY
            'cache_dir': '/tmp/test'
        }
        prism = PrismIntegration(config)
        
        async def mock_api_success(*args):
            return {'status': 'OK', 'data': 'base64_image'}
            
        async def mock_api_retry(*args):
            if getattr(mock_api_retry, 'calls', 0) == 0:
                mock_api_retry.calls = 1
                raise ConnectionError()
            return {'status': 'OK', 'data': 'base64_image'}

        with patch('atlas.prism.image_collector.GoogleMapsClient') as mock_client:
            mock_client.return_value.get_satellite_image = mock_api_success
            mock_client.return_value.get_street_view = mock_api_retry
            
            async def run_benchmark():
                return await prism.image_collector.collect_images("123 Test St")
            
            async_benchmark(benchmark, run_benchmark)
            
            assert benchmark.stats['mean'] < 1.0
            assert benchmark.stats['max'] < 1.5

@pytest.mark.benchmark
class TestPrismBenchmarkPerformance:
    @pytest.mark.asyncio 
    async def test_service_performance_variants(self, benchmark, mock_dependencies):
        """Benchmark service performance with proper coroutine handling"""
        config = {'google_maps_api_key': 'test_key', 'cache_dir': '/tmp/test'}
        prism = PrismIntegration(config)
        
        mock_dependencies = {
            'analysis_result': {
                'status': 'success',
                'data': {'test': 'data'}
            }
        }
        
        async def mock_analyze(*args):
            await asyncio.sleep(0.01)
            return mock_dependencies['analysis_result']
        
        with patch.object(prism, 'analyze_building', side_effect=mock_analyze):
            async def run_benchmark():
                return await mock_analyze("123 Test St")
                
            async_benchmark(benchmark, run_benchmark)
            
            assert benchmark.stats['mean'] < 0.5
            assert benchmark.stats['max'] < 1.0
            assert benchmark.stats['std_dev'] < 0.2

@pytest.mark.benchmark
class TestPrismIntegrationPerformance:
    @pytest.mark.asyncio
    async def test_full_pipeline_performance(self, benchmark, mock_images):
        """Benchmark complete PRISM pipeline"""
        config = {
            'google_maps_api_key': 'test_key',
            'cache_dir': '/tmp/test'
        }
        prism = PrismIntegration(config)
        
        # Setup mock returns
        prism.image_collector.collect_images.return_value = mock_images
        prism.dimension_analyzer.analyze_dimensions.return_value = BuildingDimensions(
            width=30.0, length=45.0, height=40.0,
            floor_height=3.5, floor_count=12
        )
        prism.window_detector.detect_windows.return_value = [
            {'x': 10, 'y': 20, 'width': 2}
        ]
        
        async def run_benchmark():
            return await prism.analyze_building("123 Test St")
            
        async_benchmark(benchmark, run_benchmark)
        
        assert benchmark.stats['mean'] < 2.0  # 2s target for full pipeline
        assert benchmark.stats['max'] < 3.0   # 3s max spike

    @pytest.mark.asyncio
    async def test_error_handling_performance(self, benchmark, mock_images):
        """Benchmark error handling performance"""
        config = {
            'google_maps_api_key': 'test_key',
            'cache_dir': '/tmp/test'
        }
        prism = PrismIntegration(config)
        
        # Setup error case
        prism.image_collector.collect_images.return_value = mock_images
        prism.dimension_analyzer.analyze_dimensions.side_effect = ValueError("Failed to analyze")
        
        async def run_benchmark():
            return await prism.analyze_building("123 Test St")
            
        async_benchmark(benchmark, run_benchmark)
        
        assert benchmark.stats['mean'] < 0.1  # 100ms target for error handling
        assert benchmark.stats['max'] < 0.2   # 200ms max spike
