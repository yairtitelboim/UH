from dataclasses import dataclass
from unittest.mock import Mock

@dataclass
class BuildingDimensions:
    width: float = 30.5
    length: float = 45.7
    height: float = 36.6
    floor_height: float = 3.5
    floor_count: int = 10

# Create mock before any imports
mock_samgeo = Mock()
mock_samgeo.SAMModel = Mock(return_value=Mock(
    segment=Mock(return_value={
        'height': 36.6,
        'width': 30.5,
        'length': 45.7
    }),
    analyze=Mock(return_value={
        'floor_count': 10,
        'floor_height': 3.5
    })
))
