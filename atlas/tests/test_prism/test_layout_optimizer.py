import pytest
from atlas.prism.layout_optimizer import LayoutOptimizer
from atlas.prism.models import Floorplate

@pytest.fixture
def optimizer():
    return LayoutOptimizer()

def test_group_windows(optimizer):
    optimizer = LayoutOptimizer(floor_height=3.5)
    test_windows = [
        {'x': 10, 'y': 3.5},   # Floor 1 (index 1)
        {'x': 20, 'y': 7.0},   # Floor 2 (index 2)
        {'x': 30, 'y': 3.5}    # Floor 1 (index 1)
    ]
    
    grouped = optimizer._group_windows(test_windows)
    
    # Windows at y=3.5 should be grouped in floor 1
    # Windows at y=7.0 should be grouped in floor 2
    assert len(grouped) == 2
    assert len(grouped['1']) == 2  # Two windows on first floor
    assert len(grouped['2']) == 1  # One window on second floor

def test_window_alignment(optimizer):
    unit = {
        'position': {'x': 10},
        'width': 5
    }
    window = {'x': 12}
    assert optimizer._window_aligns(unit, window)
    
    window = {'x': 20}
    assert not optimizer._window_aligns(unit, window)
