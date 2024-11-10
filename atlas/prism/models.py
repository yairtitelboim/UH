from dataclasses import dataclass
from typing import List, Dict, Optional

@dataclass
class BuildingDimensions:
    width: float
    length: float
    height: float
    floor_height: float
    floor_count: int

@dataclass
class Floorplate:
    width: float
    length: float
    core_width: float
    core_depth: float
    corridor_width: float
    units: List[Dict[str, any]]
    efficiency: float

@dataclass
class OptimizationConfig:
    min_window_distance: float = 1.2
    target_efficiency: float = 0.82
    min_unit_depth: float = 7.6
    max_corner_premium: float = 0.15
    min_window_ratio: float = 0.85

@dataclass
class UnitMixTarget:
    studio_ratio: float = 0.35
    one_bed_ratio: float = 0.45
    two_bed_ratio: float = 0.20

@dataclass
class OptimizedLayout:
    units: List[Dict]
    efficiency: float
    window_utilization: float
    risk_factors: Dict

@dataclass
class PhysicalMetric:
    metric: str
    actual: float
    target: float
    score: int
    impact: str

@dataclass
class UnitMixMetric:
    type: str
    count: int
    percentage: float
