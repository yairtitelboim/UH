import pytest
import time
from statistics import mean, stdev
from unittest.mock import Mock, patch
from atlas.main import PrismApp
from atlas.core.config import AIConfig
from atlas.prism.dimension_analyzer import BuildingDimensions
from .test_prism.test_benchmarks import PrismBenchmark
import asyncio

@pytest.fixture
def app_config():
    return AIConfig()

@pytest.fixture
def benchmark():
    return PrismBenchmark(samples=50)

@pytest.fixture
def mock_analysis_result():
    return {
        'raw_data': {
            'dimensions': BuildingDimensions(
                width=30.5,
                length=45.7,
                height=36.6,
                floor_height=3.5,
                floor_count=10
            ),
            'windows': [
                {'x': 10, 'y': 20, 'width': 2, 'height': 1.5}
            ]
        },
        'visualization': {
            'metrics': {},
            'floorplan': {}
        }
    }

@pytest.mark.benchmark
class TestMainAppPerformance:
    async def test_initialization_time(self, benchmark, app_config):
        """Benchmark application initialization performance"""
        with patch.multiple('atlas.main',
                          PrismIntegration=Mock(),
                          CREAnalysisService=Mock(),
                          ZoningService=Mock()):
            app = PrismApp(app_config)
            result = await benchmark.run_benchmark(
                "App Initialization",
                app.initialize
            )
            assert result.mean_time < 0.1
            assert result.max_time < 0.2
            
            # Verify service initialization
            assert app.prism is not None
            assert app.cre_analyzer is not None
            assert app.zoning_service is not None

    async def test_property_analysis_pipeline(self, benchmark, app_config, mock_analysis_result):
        """Benchmark complete property analysis pipeline"""
        with patch.multiple('atlas.main',
                          PrismIntegration=Mock(),
                          CREAnalysisService=Mock(),
                          ZoningService=Mock()):
            app = PrismApp(app_config)
            await app.initialize()
            
            # Setup detailed mock responses following pattern from test_main.py startLine: 57, endLine: 67
            async def mock_analyze(*args, **kwargs):
                return mock_analysis_result
            async def mock_market_analysis(*args, **kwargs):
                return {
                    'metrics': {'noi': 500000},
                    'market_data': {'vacancy_rate': 0.05},
                    'comparables': [{'address': '456 Test Ave', 'price': 1000000}]
                }
            async def mock_zoning_analysis(*args, **kwargs):
                return {
                    'permitted_uses': ['office', 'retail'],
                    'max_height': 100,
                    'far': 10.0,
                    'setbacks': {'front': 10, 'side': 5}
                }
            
            app.prism.analyze_building.side_effect = mock_analyze
            app.cre_analyzer.analyze_property.side_effect = mock_market_analysis
            app.zoning_service.analyze_zoning.side_effect = mock_zoning_analysis
            
            result = await benchmark.run_benchmark(
                "Property Analysis Pipeline",
                app.analyze_property,
                "123 Test St"
            )
            
            # Verify comprehensive results
            assert result.mean_time < 2.0
            assert result.max_time < 3.0
            assert result.std_dev < 1.0  # Check consistency

    async def test_error_handling(self, benchmark, app_config):
        """Benchmark error handling performance"""
        with patch.multiple('atlas.main',
                          PrismIntegration=Mock(),
                          CREAnalysisService=Mock(),
                          ZoningService=Mock()):
            app = PrismApp(app_config)
            await app.initialize()
            
            # Test multiple error scenarios
            errors = [
                ValueError("Invalid address"),
                RuntimeError("Service unavailable"),
                KeyError("Missing required data")
            ]
            
            for error in errors:
                app.prism.analyze_building.side_effect = error
                
                async def error_test():
                    try:
                        await app.analyze_property("123 Test St")
                    except Exception as e:
                        return {'error': str(e), 'type': e.__class__.__name__}
                
                result = await benchmark.run_benchmark(
                    f"Error Handling - {error.__class__.__name__}",
                    error_test
                )
                
                assert result.mean_time < 0.5
                assert result.max_time < 1.0

    async def test_full_pipeline_with_services(self, benchmark, app_config, mock_analysis_result):
        """Benchmark complete pipeline including all services"""
        with patch.multiple('atlas.main',
                          PrismIntegration=Mock(),
                          CREAnalysisService=Mock(),
                          ZoningService=Mock()):
            app = PrismApp(app_config)
            await app.initialize()
            
            # Mock async functions following pattern from test_benchmarks.py startLine: 124, endLine: 129
            async def mock_analyze(*args, **kwargs):
                return mock_analysis_result
            
            async def mock_market_analysis(*args, **kwargs):
                return {
                    'metrics': {'noi': 500000},
                    'market_data': {'vacancy_rate': 0.05},
                    'comparables': [{'address': '456 Test Ave', 'price': 1000000}]
                }
                
            async def mock_zoning_analysis(*args, **kwargs):
                return {
                    'permitted_uses': ['office', 'retail'],
                    'max_height': 100,
                    'far': 10.0,
                    'setbacks': {'front': 10, 'side': 5}
                }
            
            app.prism.analyze_building.side_effect = mock_analyze
            app.cre_analyzer.analyze_property.side_effect = mock_market_analysis
            app.zoning_service.analyze_zoning.side_effect = mock_zoning_analysis
            
            result = await benchmark.run_benchmark(
                "Full Pipeline With Services",
                app.analyze_property,
                "123 Test St"
            )
            
            assert result.mean_time < 2.0
            assert result.max_time < 3.0
            assert result.std_dev < 1.0

    async def test_concurrent_requests(self, benchmark, app_config, mock_analysis_result):
        """Benchmark concurrent request handling"""
        with patch.multiple('atlas.main',
                          PrismIntegration=Mock(),
                          CREAnalysisService=Mock(),
                          ZoningService=Mock()):
            app = PrismApp(app_config)
            await app.initialize()
            
            async def mock_analyze(*args, **kwargs):
                return mock_analysis_result
            async def mock_market_analysis(*args, **kwargs):
                return {'market_data': {}}
            async def mock_zoning_analysis(*args, **kwargs):
                return {'zoning_data': {}}
            
            app.prism.analyze_building.side_effect = mock_analyze
            app.cre_analyzer.analyze_property.side_effect = mock_market_analysis
            app.zoning_service.analyze_zoning.side_effect = mock_zoning_analysis
            
            async def run_concurrent_requests():
                tasks = [
                    app.analyze_property(f"{i} Test St")
                    for i in range(5)
                ]
                await asyncio.gather(*tasks)
            
            result = await benchmark.run_benchmark(
                "Concurrent Requests",
                run_concurrent_requests
            )
            
            assert result.mean_time < 4.0  # Allow more time for concurrent processing
            assert result.max_time < 6.0
            assert result.std_dev < 2.0

    async def test_service_initialization_variants(self, benchmark, app_config):
        """Benchmark different service initialization scenarios"""
        test_configs = [
            {'prism_only': True},
            {'cre_only': True},
            {'zoning_only': True},
            {'all_services': True}
        ]
        
        for config in test_configs:
            with patch.multiple('atlas.main',
                              PrismIntegration=Mock(),
                              CREAnalysisService=Mock(),
                              ZoningService=Mock()):
                app = PrismApp(app_config)
                
                result = await benchmark.run_benchmark(
                    f"Init - {list(config.keys())[0]}",
                    app.initialize
                )
                
                assert result.mean_time < 0.2
                assert result.max_time < 0.3
                assert result.std_dev < 0.1

    async def test_service_error_recovery(self, benchmark, app_config, mock_analysis_result):
        """Benchmark service error recovery performance"""
        with patch.multiple('atlas.main',
                          PrismIntegration=Mock(),
                          CREAnalysisService=Mock(),
                          ZoningService=Mock()):
            app = PrismApp(app_config)
            await app.initialize()
            
            # Create a stateful mock that fails once then succeeds
            call_count = 0
            async def mock_with_retry(*args, **kwargs):
                nonlocal call_count
                if call_count == 0:
                    call_count += 1
                    raise ConnectionError("Temporary failure")
                return mock_analysis_result

            app.prism.analyze_building.side_effect = mock_with_retry
            app.cre_analyzer.analyze_property.return_value = {'market_data': {}}
            app.zoning_service.analyze_zoning.return_value = {'zoning_data': {}}
            
            async def retry_test():
                try:
                    await app.analyze_property("123 Test St")
                    return True
                except Exception as e:
                    return False

            result = await benchmark.run_benchmark(
                "Error Recovery",
                retry_test
            )
            
            assert result.mean_time < 3.0
            assert result.max_time < 4.0
            assert result.std_dev < 1.5

    async def test_service_performance_variants(self, benchmark, app_config, mock_analysis_result):
        """Benchmark different service performance scenarios"""
        with patch.multiple('atlas.main',
                          PrismIntegration=Mock(),
                          CREAnalysisService=Mock(),
                          ZoningService=Mock()):
            app = PrismApp(app_config)
            await app.initialize()
            
            # Following pattern from test_property_analysis_pipeline
            # Reference: startLine: 71, endLine: 89
            async def mock_analyze(*args, **kwargs):
                await asyncio.sleep(0.1)  # Simulate processing time
                return mock_analysis_result
                
            async def mock_market_analysis(*args, **kwargs):
                await asyncio.sleep(0.05)
                return {'market_data': {}, 'metrics': {'noi': 500000}}
                
            async def mock_zoning_analysis(*args, **kwargs):
                await asyncio.sleep(0.03)
                return {'zoning_data': {}, 'permitted_uses': ['office']}
            
            app.prism.analyze_building.side_effect = mock_analyze
            app.cre_analyzer.analyze_property.side_effect = mock_market_analysis
            app.zoning_service.analyze_zoning.side_effect = mock_zoning_analysis
            
            # Test individual service performance
            for service_name, service_func in [
                ("PRISM Analysis", app.prism.analyze_building),
                ("Market Analysis", app.cre_analyzer.analyze_property),
                ("Zoning Analysis", app.zoning_service.analyze_zoning)
            ]:
                result = await benchmark.run_benchmark(
                    service_name,
                    service_func,
                    "123 Test St"
                )
                
                assert result.mean_time < 1.0
                assert result.max_time < 1.5
                assert result.std_dev < 0.5

            # Print detailed performance report
            self.print_benchmark_report(benchmark)

    def print_benchmark_report(self, benchmark):
        """Print detailed benchmark results with statistics"""
        print("\nMain App Performance Benchmark Report")
        print("-" * 80)
        
        # Calculate aggregate statistics
        total_time = sum(r.mean_time for r in benchmark.results)
        avg_time = total_time / len(benchmark.results)
        max_std_dev = max(r.std_dev for r in benchmark.results)
        
        print(f"\nAggregate Statistics:")
        print(f"  Total Pipeline Time: {total_time*1000:.2f}ms")
        print(f"  Average Operation Time: {avg_time*1000:.2f}ms")
        print(f"  Maximum Std Dev: {max_std_dev*1000:.2f}ms")
        
        # Individual results
        for result in benchmark.results:
            print(f"\n{result.name}:")
            print(f"  Mean Time: {result.mean_time*1000:.2f}ms")
            print(f"  Std Dev:   {result.std_dev*1000:.2f}ms")
            print(f"  Min Time:  {result.min_time*1000:.2f}ms")
            print(f"  Max Time:  {result.max_time*1000:.2f}ms")
            print(f"  Samples:   {result.samples}")
