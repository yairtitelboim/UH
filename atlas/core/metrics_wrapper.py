import os

# Default dummy implementations
def setup_metrics(): pass
def track_request(*args, **kwargs): pass
def track_latency(*args, **kwargs): pass
def track_api_error(*args, **kwargs): pass

# Only try to import real metrics if explicitly enabled
if not os.getenv('SKIP_METRICS'):
    try:
        from .metrics import setup_metrics, track_request, track_latency, track_api_error
    except ImportError:
        pass  # Keep using dummy functions if import fails
