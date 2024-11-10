from samgeo import SAMModel
import numpy as np
from typing import Dict, Any
from .models import BuildingDimensions

class DimensionAnalyzer:
    def __init__(self):
        self.sam_model = SAMModel()
        self.reference_objects = {
            'parking_spot': 2.5,  # meters
            'car_length': 4.5,    # meters
            'sidewalk': 1.5,      # meters
            'lane_width': 3.7     # meters
        }
        
    async def analyze_dimensions(self, images: Dict[str, Any]) -> BuildingDimensions:
        """Analyze building dimensions from satellite and street view images."""
        if not images or 'satellite' not in images or 'street_view' not in images:
            raise ValueError("Missing required image data")
            
        if not images['satellite'].get('image') or not images['street_view'].get('image'):
            raise ValueError("Invalid image data")

        satellite_dims = await self._analyze_satellite(images['satellite'])
        street_dims = await self._analyze_street_view(images['street_view'])
        
        return BuildingDimensions(
            width=satellite_dims['width'],
            length=satellite_dims['length'],
            height=street_dims['height'],
            floor_height=street_dims['floor_height'],
            floor_count=street_dims['floor_count']
        )

    async def _analyze_satellite(self, satellite_data: Dict[str, Any]) -> Dict[str, float]:
        """Analyze satellite image for building footprint dimensions."""
        scale = await self._calculate_scale(satellite_data['image'])
        building_mask = self.sam_model.segment(satellite_data['image'], 'building')
        
        # Get pixel dimensions
        rows = np.any(building_mask, axis=1)
        cols = np.any(building_mask, axis=0)
        height = np.sum(rows)
        width = np.sum(cols)
        
        return {
            'width': width * scale,
            'length': height * scale
        }

    async def _analyze_street_view(self, street_data: Dict[str, Any]) -> Dict[str, float]:
        """Analyze street view image for building height and floor count."""
        window_rows = self._detect_window_rows(street_data['image'])
        floor_count = len(window_rows)
        
        if floor_count < 2:
            # Fallback to metadata or default values
            floor_count = max(2, int(street_data['metadata']['height'] / 3.5))
            floor_height = 3.5
        else:
            # Calculate average floor height from window positions
            floor_heights = np.diff(window_rows)
            floor_height = float(np.mean(floor_heights))
            # Convert pixel height to meters using metadata scale
            floor_height = floor_height * (street_data['metadata']['height'] / street_data['image'].shape[0])

        total_height = floor_count * floor_height
        
        return {
            'height': total_height,
            'floor_height': floor_height,
            'floor_count': floor_count
        }

    async def _calculate_scale(self, image: np.ndarray) -> float:
        """Calculate scale factor using reference objects."""
        reference_objects = await self._detect_reference_objects(image)
        
        scales = []
        for obj_type, mask in reference_objects.items():
            if mask is not None and np.any(mask):
                pixel_length = float(max(np.sum(mask, axis=0).max(), np.sum(mask, axis=1).max()))
                real_length = self.reference_objects[obj_type]
                scales.append(real_length / pixel_length)
        
        if not scales:
            # Fallback to default scale if no reference objects found
            return 0.5
            
        return float(np.median(scales))

    async def _detect_reference_objects(self, image: np.ndarray) -> Dict[str, np.ndarray]:
        """Detect reference objects in the image."""
        detected_objects = {}
        for obj_type in self.reference_objects.keys():
            mask = self.sam_model.segment(image, obj_type)
            if mask is not None and np.any(mask):
                detected_objects[obj_type] = mask
        return detected_objects

    def _detect_window_rows(self, image: np.ndarray) -> np.ndarray:
        """Detect horizontal rows of windows in the facade."""
        # Convert to binary image if not already
        if len(image.shape) > 2:
            image = np.mean(image, axis=2)
        binary = image > np.mean(image)
        
        # Get horizontal projection
        projection = np.sum(binary, axis=1)
        
        # Find peaks in projection (window rows)
        window_rows = []
        threshold = np.mean(projection) + np.std(projection)
        
        for i in range(1, len(projection) - 1):
            if (projection[i] > threshold and 
                projection[i] > projection[i-1] and 
                projection[i] > projection[i+1]):
                window_rows.append(i)
        
        return np.array(window_rows)
