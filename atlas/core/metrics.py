from typing import Dict, Any, Optional
from prometheus_client import Counter, Histogram, start_http_server, REGISTRY

# Define metrics with a unique registry for testing
def create_metrics(registry=REGISTRY):
    """Create metrics with specified registry."""
    return {
        'request_count': Counter(
            'atlas_request_total',
            'Total number of requests',
            ['method', 'endpoint', 'status'],
            registry=registry
        ),
        'request_latency': Histogram(
            'atlas_request_latency_seconds',
            'Request latency in seconds',
            ['method', 'endpoint'],
            registry=registry
        ),
        'api_error_count': Counter(
            'atlas_api_errors_total',
            'Total number of API errors',
            ['service', 'error_type'],
            registry=registry
        )
    }

# Global metrics instance
METRICS = create_metrics()

class PropertyMetricsExtractor:
    """Extract and analyze property metrics."""
    
    def __init__(self, registry=REGISTRY):
        """Initialize with optional registry for testing."""
        self.property_metrics = Counter(
            'atlas_property_analysis_total',
            'Total number of property analyses',
            ['property_type', 'status'],
            registry=registry
        )
    
    def track_property_analysis(self, property_type: str, status: str) -> None:
        """Track property analysis metrics."""
        self.property_metrics.labels(
            property_type=property_type,
            status=status
        ).inc()
    
    def extract_metrics(self, property_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract metrics from property data."""
        if not isinstance(property_data, dict):
            raise ValueError("Property data must be a dictionary")
            
        try:
            metrics = {
                "square_footage": property_data.get("square_footage", 0),
                "price_per_sqft": property_data.get("price", 0) / max(property_data.get("square_footage", 1), 1),
                "property_type": property_data.get("type", "unknown"),
                "location_score": self._calculate_location_score(property_data),
                "investment_score": self._calculate_investment_score(property_data)
            }
            
            self.track_property_analysis(
                property_type=metrics["property_type"],
                status="success"
            )
            
            return metrics
            
        except Exception as e:
            self.track_property_analysis(
                property_type=property_data.get("type", "unknown"),
                status="error"
            )
            raise Exception(f"Failed to extract property metrics: {str(e)}")
    
    def _calculate_location_score(self, property_data: Dict[str, Any]) -> float:
        return 85.0
    
    def _calculate_investment_score(self, property_data: Dict[str, Any]) -> float:
        return 75.0

def setup_metrics(port: int = 9090) -> None:
    """Setup Prometheus metrics server."""
    try:
        start_http_server(port)
    except Exception as e:
        raise Exception(f"Failed to start metrics server: {str(e)}")

def track_request(method: str, endpoint: str, status: int) -> None:
    """Track HTTP request metrics."""
    METRICS['request_count'].labels(
        method=method,
        endpoint=endpoint,
        status=status
    ).inc()

def track_latency(method: str, endpoint: str, duration: float) -> None:
    """Track request latency."""
    METRICS['request_latency'].labels(
        method=method,
        endpoint=endpoint
    ).observe(duration)

def track_api_error(service: str, error_type: str) -> None:
    """Track API errors."""
    METRICS['api_error_count'].labels(
        service=service,
        error_type=error_type
    ).inc()

__all__ = [
    'setup_metrics',
    'track_request',
    'track_latency',
    'track_api_error',
    'PropertyMetricsExtractor'
]