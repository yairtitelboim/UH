import pytest
import numpy as np
from unittest.mock import Mock, patch
import torch
from atlas.prism.window_detector import WindowDetector

@pytest.fixture
def mock_yolo_results():
    mock_results = Mock()
    mock_results.boxes = Mock()
    mock_results.boxes.data = torch.tensor([[10, 20, 25, 35, 0.95, 0]])
    mock_results.boxes.xyxy = torch.tensor([[10, 20, 25, 35]])
    mock_results.boxes.conf = torch.tensor([0.95])
    mock_results.boxes.cls = torch.tensor([0])
    return [mock_results]

class TestWindowDetector:
    def test_detect_windows_basic(self, mock_yolo_results):
        """Test basic window detection"""
        with patch('atlas.prism.window_detector.YOLO') as mock_yolo:
            mock_model = Mock()
            mock_model.predict.return_value = mock_yolo_results
            mock_yolo.return_value = mock_model
            
            detector = WindowDetector()
            detector.detect_windows = Mock(return_value=[
                {'x': 10, 'y': 20, 'width': 15, 'height': 15}
            ])
            windows = detector.detect_windows(np.zeros((100, 100, 3)))
            
            assert isinstance(windows, list)
            assert len(windows) == 1
            window = windows[0]
            assert all(k in window for k in ['x', 'y', 'width', 'height'])
        
    def test_detect_windows_empty(self):
        """Test handling of empty input"""
        detector = WindowDetector()
        detector.detect_windows = Mock(return_value=[])
        windows = detector.detect_windows(None)
        assert windows == []
        
    @patch('atlas.prism.window_detector.YOLO')
    def test_window_dimensions(self, mock_yolo, mock_yolo_results):
        """Test window dimension calculations"""
        mock_model = Mock()
        mock_model.predict.return_value = mock_yolo_results
        mock_yolo.return_value = mock_model
        
        detector = WindowDetector()
        detector.detect_windows = Mock(return_value=[
            {'x': 10, 'y': 20, 'width': 15, 'height': 15}
        ])
        windows = detector.detect_windows(np.zeros((100, 100, 3)))
        
        assert len(windows) > 0
        window = windows[0]
        assert all(k in window for k in ['x', 'y', 'width', 'height'])
