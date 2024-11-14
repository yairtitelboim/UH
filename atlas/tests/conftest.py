import os
import sys
import pytest
from unittest.mock import patch
from atlas.core.config import AIConfig
import asyncio

# Add mock module to system path
sys.modules['samgeo'] = type('MockSamgeo', (), {
    'SAMModel': type('MockSAMModel', (), {
        '__init__': lambda *args, **kwargs: None,
        'segment': lambda *args: {
            'height': 36.6,
            'width': 30.5,
            'length': 45.7
        },
        'analyze': lambda *args: {
            'floor_count': 10,
            'floor_height': 3.5
        }
    })
})

@pytest.fixture(autouse=True)
def setup_test_env():
    """Setup test environment variables."""
    os.environ['OPENAI_API_KEY'] = 'test-key'
    os.environ['TAVILY_API_KEY'] = 'test-key'
    yield
    os.environ.pop('OPENAI_API_KEY', None)
    os.environ.pop('TAVILY_API_KEY', None)

def pytest_configure(config):
    config.addinivalue_line(
        "markers", "benchmark: mark test as a performance benchmark"
    )

@pytest.fixture(scope="session")
def event_loop_policy():
    """Override event loop policy for tests."""
    policy = asyncio.get_event_loop_policy()
    asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())
    return policy

@pytest.fixture
def event_loop(event_loop_policy):
    """Create an isolated event loop for each test case."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()

@pytest.fixture(autouse=True)
def setup_test_event_loop(event_loop):
    """Ensure each test has its own event loop."""
    asyncio.set_event_loop(event_loop)
  