import pytest
from atlas.prism.layout_optimizer import LayoutOptimizer
from atlas.prism.models import Floorplate, OptimizedLayout

@pytest.fixture
def optimizer():
    return LayoutOptimizer(floor_height=3.5)

@pytest.fixture
def sample_floorplate():
    return Floorplate(
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
                'type': 'Studio',
                'width': 6.1,
                'depth': 9.1,
                'area': 55.51,
                'position': {'x': 6.1, 'y': 0},
                'wing': 'north'
            }
        ],
        efficiency=0.85
    )

@pytest.fixture
def sample_windows():
    return [
        {'x': 3.0, 'y': 0.0},  # Ground floor
        {'x': 9.0, 'y': 0.0},  # Ground floor
        {'x': 3.0, 'y': 3.5},  # Second floor
        {'x': 9.0, 'y': 3.5}   # Second floor
    ]

def test_group_windows(optimizer, sample_windows):
    result = optimizer._group_windows(sample_windows)
    
    assert len(result) == 2
    assert len(result['0']) == 2  # Ground floor
    assert len(result['1']) == 2  # Second floor
    
    # Check window positions
    assert result['0'][0]['x'] == 3.0
    assert result['0'][1]['x'] == 9.0
    assert result['1'][0]['x'] == 3.0
    assert result['1'][1]['x'] == 9.0

def test_window_aligns(optimizer):
    unit = {'position': {'x': 0.0}, 'width': 6.1}
    
    # Window within unit bounds
    assert optimizer._window_aligns(unit, {'x': 3.0})
    
    # Window at left edge
    assert optimizer._window_aligns(unit, {'x': 0.0})
    
    # Window at right edge
    assert optimizer._window_aligns(unit, {'x': 6.1})
    
    # Window outside bounds
    assert not optimizer._window_aligns(unit, {'x': -1.0})
    assert not optimizer._window_aligns(unit, {'x': 7.0})

def test_optimize_layout(optimizer, sample_floorplate, sample_windows):
    result = optimizer.optimize_layout(sample_floorplate, sample_windows)
    
    assert isinstance(result, OptimizedLayout)
    assert len(result.units) == 2
    
    # Check window assignments
    assert len(result.units[0]['windows']) == 1  # First unit should have one window
    assert len(result.units[1]['windows']) == 1  # Second unit should have one window
    
    # Check efficiency and metrics
    assert result.efficiency == sample_floorplate.efficiency
    assert result.window_utilization == 0.9
    assert len(result.risk_factors) == 2
    
    # Check risk factors
    assert result.risk_factors['window_pattern']['status'] == 'Low Risk'
    assert result.risk_factors['window_pattern']['score'] == 90
    assert result.risk_factors['floor_plate']['status'] == 'Medium Risk'
    assert result.risk_factors['floor_plate']['score'] == 75

def test_optimize_layout_no_windows(optimizer, sample_floorplate):
    result = optimizer.optimize_layout(sample_floorplate, [])
    
    assert isinstance(result, OptimizedLayout)
    assert len(result.units) == 2
    
    # Check that units have no windows
    assert len(result.units[0]['windows']) == 0
    assert len(result.units[1]['windows']) == 0

def test_optimize_layout_empty_floorplate(optimizer, sample_windows):
    empty_floorplate = Floorplate(
        width=30.0,
        length=40.0,
        core_width=12.2,
        core_depth=12.2,
        corridor_width=1.7,
        units=[],
        efficiency=0.85
    )
    
    result = optimizer.optimize_layout(empty_floorplate, sample_windows)
    
    assert isinstance(result, OptimizedLayout)
    assert len(result.units) == 0
    assert result.efficiency == empty_floorplate.efficiency
