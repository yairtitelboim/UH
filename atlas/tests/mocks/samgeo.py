from unittest.mock import Mock

class SAMModel:
    def __init__(self, *args, **kwargs):
        self.segment = Mock(return_value={
            'height': 36.6,
            'width': 30.5,
            'length': 45.7
        })
        self.analyze = Mock(return_value={
            'floor_count': 10,
            'floor_height': 3.5
        })
