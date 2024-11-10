import pytest
import numpy as np
from atlas.prism.floorplate_gen import FloorplateGenerator, UnitType
from atlas.prism.models import BuildingDimensions, Floorplate

@pytest.fixture
def generator():
    return FloorplateGenerator()

@pytest.fixture
def sample_dimensions():
    return BuildingDimensions(
        width=30.0,
        length=40.0,
        height=35.0,
        floor_height=3.5,
        floor_count=10
    )

def test_calculate_core_dimensions(generator):
    core_dims = generator._calculate_core_dimensions(200.0)
    
    assert isinstance(core_dims, dict)
    assert 'width' in core_dims
    assert 'length' in core_dims
    assert core_dims['width'] >= generator.min_core_size
    assert abs(core_dims['width'] * core_dims['length'] - 200.0) < 0.1

def test_select_best_unit(generator):
    # Test with sufficient space
    best_unit = generator._select_best_unit(12.0, 10.0)
    assert isinstance(best_unit, UnitType)
    assert best_unit.name == '2 Bedroom'  # Should select largest unit that fits
    
    # Test with limited width
    best_unit = generator._select_best_unit(7.0, 10.0)
    assert best_unit.name == 'Studio'
    
    # Test with insufficient space
    best_unit = generator._select_best_unit(4.0, 10.0)
    assert best_unit is None

def test_place_units(generator):
    units = generator._place_units(30.0, 9.1, 'north')
    
    assert isinstance(units, list)
    assert len(units) > 0
    
    # Check unit properties
    for unit in units:
        assert 'type' in unit
        assert 'width' in unit
        assert 'depth' in unit
        assert 'area' in unit
        assert 'position' in unit
        assert 'wing' in unit
        assert unit['position']['y'] == 0  # North wing
        assert unit['depth'] <= 9.1

def test_generate_unit_layout(generator):
    layout = generator._generate_unit_layout(30.0, 40.0, 12.2, 12.2)
    
    assert isinstance(layout, list)
    north_units = [u for u in layout if u['wing'] == 'north']
    south_units = [u for u in layout if u['wing'] == 'south']
    
    assert len(north_units) > 0
    assert len(south_units) > 0
    
    # Check unit positions
    for unit in north_units:
        assert unit['position']['y'] == 0
    for unit in south_units:
        assert unit['position']['y'] > 0

def test_generate_floorplate(generator, sample_dimensions):
    floorplate = generator.generate_floorplate(sample_dimensions)
    
    assert isinstance(floorplate, Floorplate)
    assert floorplate.width == sample_dimensions.width
    assert floorplate.length == sample_dimensions.length
    assert floorplate.core_width >= generator.min_core_size
    assert floorplate.corridor_width == generator.corridor_width
    assert 0.6 <= floorplate.efficiency <= 0.9  # Reasonable efficiency range
    
    # Check unit placement
    total_area = sum(u['area'] for u in floorplate.units)
    floor_area = sample_dimensions.width * sample_dimensions.length
    assert total_area / floor_area == floorplate.efficiency

def test_generate_floorplate_small_building(generator):
    small_dims = BuildingDimensions(
        width=15.0,  # Very narrow building
        length=20.0,
        height=35.0,
        floor_height=3.5,
        floor_count=10
    )
    
    floorplate = generator.generate_floorplate(small_dims)
    assert isinstance(floorplate, Floorplate)
    assert len(floorplate.units) > 0  # Should still fit at least one unit
