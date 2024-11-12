import pytest
import asyncio
import time
from unittest.mock import patch, Mock, AsyncMock
import os

def test_cpu_operation(benchmark):
    def cpu_intensive():
        result = 0
        for i in range(1000):
            result += i * i
        return result
    
    benchmark.pedantic(cpu_intensive, iterations=100, rounds=100)

def test_memory_operation(benchmark):
    def memory_intensive():
        data = [i for i in range(10000)]
        return sum(data)
    
    benchmark.pedantic(memory_intensive, iterations=100, rounds=100)

@pytest.mark.asyncio
async def test_async_operation(benchmark):
    async def async_operation():
        await asyncio.sleep(0.001)
        return 42
    
    await benchmark.pedantic(async_operation, iterations=100, rounds=100)

@pytest.mark.asyncio
@patch('atlas.prism.image_collector.GoogleMapsClient')
@patch('atlas.prism.integration.PrismIntegration')
async def test_prism_service_performance(mock_prism, mock_maps, benchmark):
    """Benchmark service performance with mocked dependencies"""
    mock_prism.return_value.analyze_building = AsyncMock(
        return_value={'status': 'success', 'data': {'test': 'data'}}
    )
    
    async def run_service():
        await asyncio.sleep(0.01)  # Simulate some work
        return await mock_prism.return_value.analyze_building("123 Test St")
            
    await benchmark.pedantic(run_service, iterations=50, rounds=50)
