import pytest
from atlas.prism.visualization import PrismVisualizer
from atlas.prism.models import (
    BuildingDimensions, 
    Floorplate, 
    OptimizedLayout,
    PhysicalMetric,
    UnitMixMetric
)

@pytest.fixture
def visualizer():
    return PrismVisualizer()

@pytest.fixture
def sample_data():
    dimensions = BuildingDimensions(
        width=30.0,
        length=40.0,
        height=35.0,
        floor_height=3.5,
        floor_count=10
    )
    
    floorplate = Floorplate(
        width=30.0,
        length=40.0,
        core_width=12.2,
        core_depth=12.2,
        corridor_width=1.7,
        units=[
            {
                'type': 'Studio',
                'width': 6.1,
                'depth': 9.1,
                'area': 55.51,
                'position': {'x': 0, 'y': 0},
                'wing': 'north'
            },
            {
                'type': '1 Bedroom',
                'width': 8.5,
                'depth': 9.1,
                'area': 77.35,
                'position': {'x': 6.1, 'y': 0},
                'wing': 'south'
            }
        ],
        efficiency=0.85
    )
    
    return {
        'dimensions': dimensions,
        'floorplate': floorplate,
        'optimized_layout': OptimizedLayout(
            units=floorplate.units,
            efficiency=0.85,
            window_utilization=0.9,
            risk_factors={
                'window_pattern': {'status': 'Low Risk', 'score': 90},
                'floor_plate': {'status': 'Medium Risk', 'score': 75}
            }
        ),
        'windows': []
    }

def test_transform_floorplan(visualizer, sample_data):
    result = visualizer._transform_floorplan(sample_data)
    
    assert 'dimensions' in result
    assert 'northWing' in result
    
    # Check unit conversion to feet
    assert result['dimensions']['width'] == pytest.approx(sample_data['dimensions'].width * 3.28084)
    assert result['dimensions']['depth'] == pytest.approx(sample_data['dimensions'].length * 3.28084)
    
    # Check north wing units
    north_units = result['northWing']
    assert len(north_units) == 1  # Only one north unit in sample data
    assert north_units[0]['type'] == 'Studio'
    assert north_units[0]['x'] == 0
    assert north_units[0]['width'] == 6.1

def test_transform_unit(visualizer):
    unit = {
        'type': 'Studio',
        'width': 6.1,
        'depth': 9.1,
        'position': {'x': 0, 'y': 0},
        'wing': 'north'
    }
    
    result = visualizer._transform_unit(unit)
    
    assert result['type'] == 'Studio'
    assert result['x'] == 0
    assert result['width'] == 6.1

def test_transform_risk_assessment(visualizer, sample_data):
    risks = visualizer._transform_risk_assessment(sample_data)
    
    assert len(risks) == 2
    
    window_risk = next(r for r in risks if r['category'] == 'window_pattern')
    assert window_risk['status'] == 'Low Risk'
    assert window_risk['score'] == 90
    assert 'detail' in window_risk
    
    floor_risk = next(r for r in risks if r['category'] == 'floor_plate')
    assert floor_risk['status'] == 'Medium Risk'
    assert floor_risk['score'] == 75
