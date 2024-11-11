import pytest
import time
import asyncio
from statistics import mean, stdev
from dataclasses import dataclass
from typing import List, Dict, Callable
import numpy as np
from atlas.prism.integration import PrismIntegration
from atlas.prism.dimension_analyzer import BuildingDimensions
from atlas.prism.floorplate_gen import Floorplate, FloorplateGenerator
from atlas.prism.layout_optimizer import LayoutOptimizer, OptimizedLayout
from unittest.mock import patch
from .mocks import mock_samgeo
from unittest.mock import Mock
from atlas.prism.image_collector import ImageCollector
import os
from unittest.mock import AsyncMock

@dataclass
class BenchmarkResult:
    name: str
    mean_time: float
    std_dev: float
    min_time: float
    max_time: float
    samples: int

class PrismBenchmark:
    def __init__(self, samples: int = 100):
        self.samples = samples
        self.results = []
    
    async def run_benchmark(self, name: str, func: Callable, *args) -> BenchmarkResult:
        timings = []
        
        for _ in range(self.samples):
            start = time.perf_counter()
            if asyncio.iscoroutinefunction(func) or asyncio.iscoroutine(func):
                await func(*args)
            elif callable(func):
                result = func(*args)
                if asyncio.iscoroutine(result):
                    await result
            end = time.perf_counter()
            timings.append(end - start)
            
        result = BenchmarkResult(
            name=name,
            mean_time=mean(timings),
            std_dev=stdev(timings),
            min_time=min(timings),
            max_time=max(timings),
            samples=self.samples  # Fixed: using self.samples instead of undefined 's'
        )
        self.results.append(result)
        return result

@pytest.fixture
def benchmark():
    return PrismBenchmark()


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
                      ImageCollector=Mock(),
                      DimensionAnalyzer=Mock(),
                      WindowDetector=Mock(),
                      FloorplateGenerator=Mock(),
                      LayoutOptimizer=Mock(),
                      PrismVisualizer=Mock()):
        yield

@pytest.mark.benchmark
class TestPrismPerformance:
    async def test_floorplate_generation(self, benchmark, sample_dimensions):
        """Benchmark floorplate generation performance"""
        generator = FloorplateGenerator()
        result = await benchmark.run_benchmark(
            "Floorplate Generation",
            generator.generate_floorplate,
            sample_dimensions
        )
        
        # Performance targets based on frontend requirements
        assert result.mean_time < 0.1  # 100ms max for good UX
        assert result.max_time < 0.2   # 200ms max spike
        
    async def test_layout_optimization(self, benchmark, sample_dimensions):
        """Benchmark layout optimization performance"""
        generator = FloorplateGenerator()
        optimizer = LayoutOptimizer()
        
        floorplate = generator.generate_floorplate(sample_dimensions)
        windows = [{'x': x, 'y': 0, 'width': 1.5, 'height': 1.5} 
                  for x in range(0, 30, 3)]
        
        result = await benchmark.run_benchmark(
            "Layout Optimization",
            optimizer.optimize_layout,
            floorplate,
            windows
        )
        
        assert result.mean_time < 0.5  # 500ms target for optimization
        assert result.max_time < 1.0   # 1s max acceptable time
        
    async def test_full_pipeline(self, benchmark, mock_dependencies):
        """Benchmark complete PRISM pipeline"""
        config = {
            'google_maps_api_key': os.environ.get('GOOGLE_API_KEY'),
            'cache_dir': '/tmp/test'
        }
        prism = PrismIntegration(config)
        
        # Setup mock returns as coroutines
        async def mock_images(*args, **kwargs):
            return {
                'satellite': 'test.jpg',
                'street_view': 'street.jpg'
            }
            
        # Mock the coroutine factory instead of the coroutine itself
        prism.image_collector.collect_images = mock_images
        prism.dimension_analyzer.analyze_dimensions.return_value = BuildingDimensions(
            width=30.5,
            length=45.7,
            height=36.6,
            floor_height=3.5,
            floor_count=10
        )
        prism.window_detector.detect_windows.return_value = []
        
        result = await benchmark.run_benchmark(
            "Complete Pipeline",
            prism.analyze_building,
            "123 Test St"
        )
        
        assert result.mean_time < 2.0  # 2s target for full analysis
        assert result.max_time < 3.0   # 3s max acceptable time
        
    async def test_visualization_transform(self, benchmark, mock_dependencies):
        """Benchmark visualization data transformation"""
        config = {
            'google_maps_api_key': os.environ.get('GOOGLE_API_KEY'),
            'cache_dir': '/tmp/test'
        }
        prism = PrismIntegration(config)
        
        # Setup test data
        dimensions = BuildingDimensions(
            width=30.5,
            length=45.7,
            height=36.6,
            floor_height=3.5,
            floor_count=10
        )
        floorplate = Floorplate(
            width=30.5,
            length=45.7,
            core_width=12.2,
            core_depth=10.0,
            corridor_width=1.7,
            units=[],
            efficiency=0.82
        )
        
        prism_data = {
            'dimensions': dimensions,
            'windows': [],
            'floorplate': floorplate,
            'optimized_layout': {
                'units': [],
                'efficiency': 0.82,
                'window_utilization': 0.9,
                'risk_factors': {
                    'window_pattern': {'status': 'Low Risk', 'score': 90},
                    'floor_plate': {'status': 'Medium Risk', 'score': 75}
                }
            }
        }
        
        result = await benchmark.run_benchmark(
            "Visualization Transform",
            prism.visualizer.transform_for_frontend,
            prism_data
        )
        
        # Frontend rendering requirements
        assert result.mean_time < 0.05  # 50ms target for transforms
        assert result.max_time < 0.1    # 100ms max acceptable time

    def print_benchmark_report(self, benchmark):
        print("\nPRISM Performance Benchmark Report")
        print("-" * 80)
        for result in benchmark.results:
            print(f"\n{result.name}:")
            print(f"  Mean Time: {result.mean_time*1000:.2f}ms")
            print(f"  Std Dev:   {result.std_dev*1000:.2f}ms")
            print(f"  Min Time:  {result.min_time*1000:.2f}ms")
            print(f"  Max Time:  {result.max_time*1000:.2f}ms")
            print(f"  Samples:   {result.samples}")

@pytest.mark.benchmark
class TestPrismComponentPerformance:
    async def test_dimension_analyzer_performance(self, benchmark, mock_dependencies):
        """Benchmark dimension analyzer performance"""
        config = {
            'google_maps_api_key': os.environ.get('GOOGLE_API_KEY'),
            'cache_dir': '/tmp/test'
        }
        prism = PrismIntegration(config)
        
        # Following pattern from test_benchmarks.py startLine: 124, endLine: 129
        async def mock_image_data(*args, **kwargs):
            return {
                'satellite': {'image': 'test.jpg', 'metadata': {'scale': 0.5}},
                'street_view': {'image': 'street.jpg', 'metadata': {'height': 30}}
            }
        
        prism.image_collector.collect_images = mock_image_data
        
        result = await benchmark.run_benchmark(
            "Dimension Analysis",
            prism.dimension_analyzer.analyze_dimensions,
            mock_image_data()
        )
        
        assert result.mean_time < 0.2
        assert result.max_time < 0.3
        assert result.std_dev < 0.1

    @pytest.mark.asyncio
    async def test_image_collector_pipeline(self, benchmark):
        config = {
            'google_maps_api_key': 'AIzaSyCb0qBz4tvOTfKC69CwOCqx1lYM_vzfqF8',
            'cache_dir': '/tmp/test'
        }

        collector = ImageCollector(config)

        # Create the mock image data
        mock_image_data = b'\x89PNG\r\n...'  # Your PNG data here
        
        # Mock geocode response
        mock_geocode_result = [{'geometry': {'location': {'lat': 40.7128, 'lng': -74.0060}}}]

        # Mock the external API calls
        with patch('atlas.prism.image_collector.GoogleMapsClient') as mock_client:
            mock_instance = mock_client.return_value
            # Set up the mocks to return the image data directly
            mock_instance.static_map = AsyncMock(return_value=mock_image_data)
            mock_instance.street_view = AsyncMock(return_value=mock_image_data)
            mock_instance.geocode = AsyncMock(return_value=mock_geocode_result)

            # Initialize the collector with our mock
            collector.client = mock_instance
            
            result = await collector.collect_images("123 Test St")

    async def test_floorplate_optimization_stress(self, benchmark, sample_dimensions):
        """Benchmark floorplate generation under stress conditions"""
        generator = FloorplateGenerator()
        optimizer = LayoutOptimizer()
        
        # Following pattern from test_benchmarks.py startLine: 152, endLine: 171
        test_cases = [
            {'width': 30.5, 'length': 45.7, 'complexity': 'low'},
            {'width': 60.0, 'length': 80.0, 'complexity': 'medium'},
            {'width': 100.0, 'length': 120.0, 'complexity': 'high'}
        ]
        
        for case in test_cases:
            dimensions = BuildingDimensions(
                width=case['width'],
                length=case['length'],
                height=36.6,
                floor_height=3.5,
                floor_count=10
            )
            
            result = await benchmark.run_benchmark(
                f"Floorplate Optimization ({case['complexity']})",
                generator.generate_optimized_floorplate,
                dimensions
            )
            
            assert result.mean_time < 1.0
            assert result.max_time < 2.0
            assert result.std_dev < 0.5

    def print_detailed_report(self, benchmark):
        """Print detailed performance report with statistics"""
        # Following pattern from test_benchmarks.py startLine: 198, endLine: 207
        print("\nPRISM Component Performance Report")
        print("-" * 80)
        
        total_time = sum(r.mean_time for r in benchmark.results)
        avg_time = total_time / len(benchmark.results)
        
        print(f"\nAggregate Statistics:")
        print(f"  Total Pipeline Time: {total_time*1000:.2f}ms")
        print(f"  Average Component Time: {avg_time*1000:.2f}ms")
        
        for result in benchmark.results:
            print(f"\n{result.name}:")
            print(f"  Mean Time: {result.mean_time*1000:.2f}ms")
            print(f"  Std Dev:   {result.std_dev*1000:.2f}ms")
            print(f"  Min Time:  {result.min_time*1000:.2f}ms")
            print(f"  Max Time:  {result.max_time*1000:.2f}ms")
            print(f"  Samples:   {result.samples}")

@pytest.mark.benchmark
class TestPrismComponentCoverage:
    async def test_dimension_analyzer_comprehensive(self, benchmark, mock_dependencies):
        """Test dimension analyzer with various input scenarios"""
        config = {
            'google_maps_api_key': os.environ.get('GOOGLE_API_KEY'),
            'cache_dir': '/tmp/test'
        }
        prism = PrismIntegration(config)
        
        test_cases = [
            {'satellite': {'scale': 0.5}, 'street_view': {'height': 30}},
            {'satellite': {'scale': 0.25}, 'street_view': {'height': 45}},
            {'satellite': {'scale': 1.0}, 'street_view': {'height': 20}}
        ]
        
        for case in test_cases:
            async def mock_image_data(*args):
                return {
                    'satellite': {'image': 'test.jpg', 'metadata': case['satellite']},
                    'street_view': {'image': 'street.jpg', 'metadata': case['street_view']}
                }
            
            prism.image_collector.collect_images = mock_image_data
            
            result = await benchmark.run_benchmark(
                f"Dimension Analysis - Scale {case['satellite']['scale']}",
                prism.dimension_analyzer.analyze_dimensions,
                mock_image_data()
            )
            
            assert result.mean_time < 0.2
            assert result.max_time < 0.3

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
            
            result = await benchmark.run_benchmark(
                "Image Collection with Retry",
                prism.image_collector.collect_images,
                "123 Test St"
            )
            
            assert result.mean_time < 1.0
            assert result.max_time < 1.5

    async def test_floorplate_optimization_comprehensive(self):
        dimensions = BuildingDimensions(
            width=30.0, length=45.0,
            height=40.0, floor_height=3.5,
            floor_count=12
        )
        
        generator = FloorplateGenerator()
        floorplate = generator.generate_floorplate(dimensions)
        
        # Test the non-async optimization logic
        optimizer = LayoutOptimizer()
        windows = [{'x': 10, 'y': 3.5}, {'x': 20, 'y': 7.0}]
        
        result = optimizer.optimize_layout(floorplate, windows)
        
        assert isinstance(result, OptimizedLayout)
        assert result.efficiency > 0
        assert len(result.units) >= 0

async def run_service(func, *args):
    return await func(*args)

@pytest.mark.benchmark
class TestPrismBenchmarkPerformance:
    async def test_service_performance_variants(self, benchmark, mock_dependencies):
        """Benchmark service performance with proper coroutine handling"""
        config = {
            'google_maps_api_key': os.environ.get('GOOGLE_API_KEY'),
            'cache_dir': '/tmp/test'
        }
        prism = PrismIntegration(config)
        
        # Define mock dependencies
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
            result = await benchmark.run_benchmark(
                "Service Performance",
                run_service,
                prism.analyze_building,
                "123 Test St"
            )
            
            assert result.mean_time < 0.5
            assert result.max_time < 1.0
            assert result.std_dev < 0.2

@pytest.mark.asyncio
class TestImageCollector:
    @pytest.fixture
    def mock_maps_client(self):
        with patch('atlas.prism.image_collector.GoogleMapsClient', autospec=True) as mock:
            # Return the mock class itself, not an instance
            yield mock

    @pytest.fixture
    def config(self):
        return {
            'google_maps_api_key': 'test_key',
            'cache_dir': '/tmp/test'
        }

    async def test_collect_images_all_types(self, config, mock_maps_client):
        """Test collecting all image types including 45deg views"""
        # Setup mock instance
        mock_instance = mock_maps_client.return_value
        mock_instance.geocode = AsyncMock(return_value=[{
            'geometry': {'location': {'lat': 40.7128, 'lng': -74.006}}
        }])
        mock_instance.static_map = AsyncMock(return_value=b'\x89PNG\r\n...')
        mock_instance.street_view = AsyncMock(return_value=b'\x89PNG\r\n...')

        collector = ImageCollector(config)
        result = await collector.collect_images("123 Test St", include_45deg=True)
        
        assert 'satellite' in result
        assert 'street_view' in result
        assert '45deg' in result

    async def test_collect_images_invalid_cache_dir(self, config, mock_maps_client):
        """Test handling of invalid cache directory"""
        config['cache_dir'] = '/nonexistent/directory'
        
        # Setup mock instance
        mock_instance = mock_maps_client.return_value
        mock_instance.geocode = AsyncMock(return_value=[{
            'geometry': {'location': {'lat': 40.7128, 'lng': -74.006}}
        }])
        mock_instance.static_map = AsyncMock(side_effect=Exception("Permission denied"))

        collector = ImageCollector(config)
        with pytest.raises(Exception, match="Cannot access cache directory"):
            await collector.collect_images("123 Test St")

    async def test_collect_images_rate_limit(self, config, mock_maps_client):
        """Test handling of API rate limiting"""
        # Setup mock instance
        mock_instance = mock_maps_client.return_value
        mock_instance.geocode = AsyncMock(return_value=[{
            'geometry': {'location': {'lat': 40.7128, 'lng': -74.006}}
        }])
        mock_instance.static_map = AsyncMock(side_effect=Exception("OVER_QUERY_LIMIT"))

        collector = ImageCollector(config)
        with pytest.raises(Exception, match="Rate limit exceeded"):
            await collector.collect_images("123 Test St")

    async def test_collect_images_retry_logic(self, config, mock_maps_client):
        """Test retry logic for failed requests"""
        fail_count = 0

        async def mock_static_map(*args, **kwargs):
            nonlocal fail_count
            if fail_count < 2:
                fail_count += 1
                raise Exception("Temporary failure")
            return b'\x89PNG\r\n...'

        # Setup mock instance
        mock_instance = mock_maps_client.return_value
        mock_instance.geocode = AsyncMock(return_value=[{
            'geometry': {'location': {'lat': 40.7128, 'lng': -74.006}}
        }])
        mock_instance.static_map = AsyncMock(side_effect=mock_static_map)
        mock_instance.street_view = AsyncMock(return_value=b'\x89PNG\r\n...')

        collector = ImageCollector(config)
        result = await collector.collect_images("123 Test St")
        assert 'satellite' in result
        assert 'street_view' in result

    @pytest.fixture(autouse=True)
    def cleanup(self):
        # Cleanup any test files after each test
        yield
        if os.path.exists('/tmp/test'):
            import shutil
            shutil.rmtree('/tmp/test')
