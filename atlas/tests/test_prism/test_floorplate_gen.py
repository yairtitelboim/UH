import pytest
from atlas.prism.floorplate_gen import FloorplateGenerator
from atlas.prism.models import BuildingDimensions

@pytest.fixture
def generator():
    return FloorplateGenerator()

def test_calculate_core_dimensions(generator):
    core_dims = generator._calculate_core_dimensions(200.0)
    assert core_dims['width'] >= generator.min_core_size
    assert abs(core_dims['width'] * core_dims['length'] - 200.0) < 0.1

def test_generate_unit_layout(generator):
    units = generator._generate_unit_layout(
        width=50.0,
        length=40.0,
        core_width=15.0,
        core_length=12.0
    )
    assert len(units) > 0
    for unit in units:
        assert 'type' in unit
        assert 'width' in unit
        assert 'position' in unit
        assert unit['position']['x'] >= 0

def test_select_best_unit(generator):
    best_unit = generator._select_best_unit(10.0, 9.1)
    assert best_unit is not None
    assert best_unit.width <= 10.0
    assert best_unit.depth <= 9.1
