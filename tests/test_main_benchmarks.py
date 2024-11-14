import pytest
import asyncio
import time

def test_cpu_operation(benchmark):
    def cpu_work():
        result = 0
        for i in range(1000):
            result += i * i
        return result
    
    result = benchmark.pedantic(
        cpu_work,
        iterations=1,
        rounds=100
    )

def test_memory_operation(benchmark):
    def memory_work():
        data = [i for i in range(10000)]
        return sum(data)
        
    benchmark(memory_work)

@pytest.mark.asyncio
async def test_async_operation(benchmark):
    async def async_work():
        await asyncio.sleep(0.001)
        return True
    
    # Use pedantic for more accurate async measurements
    await benchmark.pedantic(
        async_work,
        iterations=1,
        rounds=100,
        warmup_rounds=0
    )