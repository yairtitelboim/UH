from typing import Dict
from atlas.core.config import AIConfig

class PropertyMetricsExtractor:
    def __init__(self, config: AIConfig):
        self.config = config
        
    async def extract_metrics(self, data: Dict) -> Dict:
        metrics = {
            "physical": await self._extract_physical_metrics(data),
            "financial": await self._extract_financial_metrics(data),
            "market": await self._extract_market_metrics(data),
            "confidence_scores": {}
        }
        
        # Calculate confidence scores for each metric
        metrics["confidence_scores"] = self._calculate_confidence(metrics)
        return metrics
        
    def _extract_physical_metrics(self, data: Dict) -> Dict:
        patterns = {
            "floor_depth": r'(\d+)\s*(?:ft|foot|feet)\s*(?:depth|deep)',
            "window_line": r'(\d+)%?\s*window\s*line',
            "ceiling_height": r'(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*ceiling',
            "floor_plate": r'(\d+,?\d*)\s*(?:sf|square\s*feet)\s*floor\s*plate'
        }
        
        return self._extract_with_patterns(data, patterns)
