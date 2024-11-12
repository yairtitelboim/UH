import os

# Define dummy metrics classes and functions first
class DummyMetric:
    def inc(self, *args, **kwargs): pass
    def observe(self, *args, **kwargs): pass

def start_http_server(*args, **kwargs): pass

# Initialize with dummy metrics
request_counter = DummyMetric()
latency_histogram = DummyMetric()
api_error_counter = DummyMetric()

def setup_metrics(): pass
def track_request(*args, **kwargs): pass
def track_latency(*args, **kwargs): pass
def track_api_error(*args, **kwargs): pass

# Only try to use real metrics if not explicitly skipped
if not os.getenv('SKIP_METRICS'):
    try:
        from prometheus_client import Counter, Histogram, start_http_server, REGISTRY
        
        # Real metrics setup
        request_counter = Counter(
            'atlas_requests_total',
            'Total number of requests processed'
        )

        latency_histogram = Histogram(
            'atlas_request_latency_seconds',
            'Request latency in seconds'
        )

        api_error_counter = Counter(
            'atlas_api_errors_total',
            'Total number of API errors'
        )

        def setup_metrics():
            start_http_server(8000)

        def track_request():
            request_counter.inc()

        def track_latency(duration):
            latency_histogram.observe(duration)

        def track_api_error():
            api_error_counter.inc()

    except ImportError:
        pass  # Keep using dummy implementations if import fails