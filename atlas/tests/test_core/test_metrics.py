import pytest
from prometheus_client import CollectorRegistry
from atlas.core.metrics import (
    create_metrics,
    setup_metrics,
    track_request,
    track_latency,
    track_api_error,
    PropertyMetricsExtractor
)

@pytest.fixture
def test_registry():
    """Create a new registry for each test."""
    return CollectorRegistry()

def test_track_request(test_registry):
    """Test request tracking."""
    metrics = create_metrics(test_registry)
    
    # Get initial sample
    samples = list(metrics['request_count'].collect()[0].samples)
    initial_count = sum(s.value for s in samples)
    
    # Track request
    metrics['request_count'].labels(
        method="GET",
        endpoint="/test",
        status=200
    ).inc()
    
    # Get updated sample
    samples = list(metrics['request_count'].collect()[0].samples)
    final_count = sum(s.value for s in samples)
    
    assert final_count > initial_count

def test_track_latency(test_registry):
    """Test latency tracking."""
    metrics = create_metrics(test_registry)
    
    # Get initial sample
    samples = list(metrics['request_latency'].collect()[0].samples)
    initial_count = sum(1 for s in samples if s.name.endswith('_count'))
    
    # Track latency
    metrics['request_latency'].labels(
        method="GET",
        endpoint="/test"
    ).observe(0.5)
    
    # Get updated sample
    samples = list(metrics['request_latency'].collect()[0].samples)
    final_count = sum(1 for s in samples if s.name.endswith('_count'))
    
    assert final_count > initial_count

def test_track_api_error(test_registry):
    """Test API error tracking."""
    metrics = create_metrics(test_registry)
    
    # Get initial sample
    samples = list(metrics['api_error_count'].collect()[0].samples)
    initial_count = sum(s.value for s in samples)
    
    # Track error
    metrics['api_error_count'].labels(
        service="test_service",
        error_type="connection_error"
    ).inc()
    
    # Get updated sample
    samples = list(metrics['api_error_count'].collect()[0].samples)
    final_count = sum(s.value for s in samples)
    
    assert final_count > initial_count

def test_property_metrics_extractor(test_registry):
    """Test property metrics extraction."""
    extractor = PropertyMetricsExtractor(test_registry)
    
    property_data = {
        "square_footage": 1500,
        "price": 300000,
        "type": "residential",
        "location": "New York"
    }
    
    metrics = extractor.extract_metrics(property_data)
    
    assert isinstance(metrics, dict)
    assert metrics["square_footage"] == 1500
    assert metrics["price_per_sqft"] == 200
    assert metrics["property_type"] == "residential"
    assert isinstance(metrics["location_score"], float)
    assert isinstance(metrics["investment_score"], float)

def test_property_metrics_error_handling(test_registry):
    """Test property metrics error handling."""
    extractor = PropertyMetricsExtractor(test_registry)
    
    with pytest.raises(ValueError):
        extractor.extract_metrics(None)

def test_property_metrics_tracking(test_registry):
    """Test property metrics tracking."""
    extractor = PropertyMetricsExtractor(test_registry)
    
    # Get initial sample
    samples = list(extractor.property_metrics.collect()[0].samples)
    initial_count = sum(s.value for s in samples)
    
    # Track analysis
    extractor.track_property_analysis("residential", "success")
    
    # Get updated sample
    samples = list(extractor.property_metrics.collect()[0].samples)
    final_count = sum(s.value for s in samples)
    
    assert final_count > initial_count

def test_setup_metrics():
    """Test metrics setup."""
    try:
        setup_metrics(port=9091)
    except Exception as e:
        pytest.fail(f"Failed to setup metrics: {str(e)}")
