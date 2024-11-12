from typing import Dict, Any
from atlas.core.config import AIConfig
from atlas.core.metrics_wrapper import track_api_error, track_latency
from atlas.services.metrics import PropertyMetricsExtractor

class AnalysisService:
    """Service for analyzing property data."""
    
    def __init__(self, config: AIConfig = None):
        self.config = config
        self.metrics_extractor = PropertyMetricsExtractor()
    
    async def analyze_property(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze property data."""
        return {
            "analysis": {},
            "metrics": self.metrics_extractor.extract_metrics(str(data))
        }

__all__ = ['AnalysisService']