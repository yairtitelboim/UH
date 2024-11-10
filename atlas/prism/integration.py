from typing import Dict
from .models import BuildingDimensions, Floorplate
from .image_collector import ImageCollector
from .dimension_analyzer import DimensionAnalyzer
from .window_detector import WindowDetector
from .floorplate_gen import FloorplateGenerator
from .layout_optimizer import LayoutOptimizer
from .visualization import PrismVisualizer

class PrismIntegration:
    def __init__(self, config):
        self.image_collector = ImageCollector(config)
        self.dimension_analyzer = DimensionAnalyzer()
        self.window_detector = WindowDetector()
        self.floorplate_gen = FloorplateGenerator()
        self.layout_optimizer = LayoutOptimizer()
        self.visualizer = PrismVisualizer()

    async def analyze_building(self, address: str) -> Dict:
        # Collect images
        images = await self.image_collector.collect_images(address)
        
        # Analyze dimensions
        dimensions = self.dimension_analyzer.analyze_dimensions(images)
        
        # Detect windows
        windows = self.window_detector.detect_windows(images['street_view'])
        
        # Generate floorplate
        floorplate = self.floorplate_gen.generate_floorplate(dimensions)
        
        # Optimize layout
        optimized_layout = self.layout_optimizer.optimize_layout(floorplate, windows)
        
        # Transform for frontend
        visualization_data = self.visualizer.transform_for_frontend({
            'dimensions': dimensions,
            'windows': windows,
            'floorplate': floorplate,
            'optimized_layout': optimized_layout
        })
        
        return {
            'raw_data': {
                'dimensions': dimensions,
                'windows': windows,
                'floorplate': floorplate,
                'optimized_layout': optimized_layout
            },
            'visualization': visualization_data
        }
