"""
Central setup for all test mocks and configurations
Must be imported before any other atlas imports
"""
import sys
from unittest.mock import Mock, MagicMock
from types import ModuleType
import os

# Set test environment variables
os.environ.update({
    'SKIP_METRICS': '1',
    'TEST_MODE': '1',
    'PYTEST_DISABLE_PLUGIN_AUTOLOAD': 'true',
    'GOOGLE_API_KEY': 'test_key'
})

class MockModule(ModuleType):
    def __getattr__(self, key):
        return MagicMock()

# Mock all external dependencies
mocks = {
    'httpx': Mock(),
    'segment_geospatial': Mock(),
    'torch': Mock(),
    'numpy': Mock(),
    'ultralytics': Mock(),
    'atlas.services': MockModule('atlas.services'),
    'atlas.clients': MockModule('atlas.clients'),
    'atlas.clients.base': MockModule('atlas.clients.base'),
    'atlas.clients.tavily': MockModule('atlas.clients.tavily'),
    'atlas.clients.serper': MockModule('atlas.clients.serper'),
    'atlas.clients.serpapi': MockModule('atlas.clients.serpapi')
}

# Install mocks into sys.modules
for name, mock in mocks.items():
    sys.modules[name] = mock
    # Handle parent modules
    parts = name.split('.')
    for i in range(1, len(parts)):
        parent = '.'.join(parts[:i])
        if parent not in sys.modules:
            sys.modules[parent] = MockModule(parent)
