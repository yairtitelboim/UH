from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
import numpy as np
from .models import Floorplate, OptimizationConfig, UnitMixTarget, OptimizedLayout
from .floorplate_gen import UnitType
from collections import defaultdict

class LayoutOptimizer:
    def __init__(self, floor_height: float = 3.5):
        self.floor_height = floor_height
        
    def _group_windows(self, windows):
        grouped = defaultdict(list)
        for window in windows:
            floor_index = str(int(window['y'] / self.floor_height))
            grouped[floor_index].append(window)
        return grouped
        
    def optimize_layout(self, floorplate, windows):
        grouped_windows = self._group_windows(windows)
        optimized_units = []
        
        for unit in floorplate.units:
            floor = unit['position']['y'] // self.floor_height
            floor_windows = grouped_windows.get(str(floor), [])
            unit['windows'] = [w for w in floor_windows if self._window_aligns(unit, w)]
            optimized_units.append(unit)
            
        return OptimizedLayout(
            units=optimized_units,
            efficiency=floorplate.efficiency,
            window_utilization=0.9,  # Placeholder
            risk_factors={
                'window_pattern': {'status': 'Low Risk', 'score': 90},
                'floor_plate': {'status': 'Medium Risk', 'score': 75}
            }
        )
        
    def _window_aligns(self, unit: Dict, window: Dict) -> bool:
        unit_x = unit['position']['x']
        return unit_x <= window['x'] <= unit_x + unit['width']
