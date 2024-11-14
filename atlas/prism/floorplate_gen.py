from dataclasses import dataclass
from typing import List, Dict, Optional
import numpy as np
from .models import BuildingDimensions, Floorplate

@dataclass
class UnitType:
    name: str
    width: float
    depth: float
    min_windows: int
    max_units_per_floor: Optional[int] = None

class FloorplateGenerator:
    def __init__(self):
        self.unit_types = {
            'micro': UnitType('Micro Studio', 5.5, 9.1, 1, 6),
            'studio': UnitType('Studio', 6.1, 9.1, 2, 8),
            'one_bed': UnitType('1 Bedroom', 8.5, 9.1, 3, 6),
            'two_bed': UnitType('2 Bedroom', 11.0, 9.1, 4, 4)
        }
        
        self.min_core_size = 12.2  # 40ft minimum core size
        self.corridor_width = 1.7   # 5.5ft corridor
        
    def generate_floorplate(self, dimensions: BuildingDimensions) -> Floorplate:
        width = dimensions.width
        length = dimensions.length
        height = dimensions.height
        floor_height = dimensions.floor_height
        floor_count = dimensions.floor_count
        
        # Calculate core size (15-20% of floor area)
        floor_area = width * length
        core_area = floor_area * 0.17  # Target 17% core
        core_dims = self._calculate_core_dimensions(core_area)
        
        # Generate unit layout
        units = self._generate_unit_layout(
            width, length, 
            core_dims['width'], core_dims['length']
        )
        
        # Calculate efficiency
        net_area = sum(u['area'] for u in units)
        efficiency = net_area / floor_area
        
        return Floorplate(
            width=width,
            length=length,
            core_width=core_dims['width'],
            core_depth=core_dims['length'],
            corridor_width=self.corridor_width,
            units=units,
            efficiency=efficiency
        )
        
    def _calculate_core_dimensions(self, target_area: float) -> Dict[str, float]:
        # Start with square core
        side = np.sqrt(target_area)
        
        # Ensure minimum size
        width = max(side, self.min_core_size)
        length = target_area / width
        
        return {'width': width, 'length': length}
        
    def _generate_unit_layout(self, width: float, length: float, 
                            core_width: float, core_length: float) -> List[Dict]:
        # Available space on each side of core
        north_space = length - core_length - self.corridor_width
        south_space = length - core_length - self.corridor_width
        
        # Generate units for north and south wings
        north_units = self._place_units(width, north_space, 'north')
        south_units = self._place_units(width, south_space, 'south')
        
        return north_units + south_units
        
    def _place_units(self, width: float, depth: float, wing: str) -> List[Dict]:
        units = []
        remaining_width = width
        x_position = 0
        
        while remaining_width >= min(ut.width for ut in self.unit_types.values()):
            best_unit = self._select_best_unit(remaining_width, depth)
            if not best_unit:
                break
                
            units.append({
                'type': best_unit.name,
                'width': best_unit.width,
                'depth': best_unit.depth,
                'area': best_unit.width * best_unit.depth,
                'position': {'x': x_position, 'y': 0 if wing == 'north' else depth},
                'wing': wing
            })
            
            remaining_width -= best_unit.width
            x_position += best_unit.width
            
        return units
        
    def _select_best_unit(self, available_width: float, depth: float) -> Optional[UnitType]:
        suitable_units = [
            ut for ut in self.unit_types.values()
            if ut.width <= available_width and ut.depth <= depth
        ]
        
        if not suitable_units:
            return None
            
        # Select largest unit that fits
        return max(suitable_units, key=lambda u: u.width)

    async def generate_optimized_floorplate(self, dimensions: BuildingDimensions) -> Floorplate:
        """Generate optimized floorplate with retries"""
        floorplate = self.generate_floorplate(dimensions)
        
        # Optimize for efficiency
        if floorplate.efficiency < 0.75:
            # Try alternative core placement
            core_dims = self._calculate_core_dimensions(dimensions.width * dimensions.length * 0.15)
            units = self._generate_unit_layout(
                dimensions.width,
                dimensions.length,
                core_dims['width'],
                core_dims['length']
            )
            efficiency = sum(u['area'] for u in units) / (dimensions.width * dimensions.length)
            
            if efficiency > floorplate.efficiency:
                floorplate = Floorplate(
                    width=dimensions.width,
                    length=dimensions.length,
                    core_width=core_dims['width'],
                    core_depth=core_dims['length'],
                    corridor_width=self.corridor_width,
                    units=units,
                    efficiency=efficiency
                )
        
        return floorplate
