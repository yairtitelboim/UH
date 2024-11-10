from ultralytics import YOLO

class WindowDetector:
    def __init__(self):
        # Initialize the YOLO model with a specific model file
        self.yolo_model = YOLO('yolov8n.pt')  # Ensure you have the model file

    def detect_windows(self, image) -> list:
        # Use the YOLO model to detect windows
        return self.yolo_model(image, classes=[0])  # Assuming class 0 is 'window'
