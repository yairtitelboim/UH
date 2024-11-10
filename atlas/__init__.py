from typing import Dict, Optional
import logging
from datetime import datetime
from atlas.core.config import AIConfig
from atlas.core.logging import setup_logging
from atlas.core.metrics import setup_metrics, track_request, track_latency, track_api_error
from atlas.services.search import SearchService
from atlas.services.process import PropertyProcessor
from atlas.services.analyze import AnalysisService
from atlas.services.market_analysis import MarketAnalyzer
from atlas.clients.tavily import TavilyClient
from atlas.clients.perplexity import PerplexityClient
from atlas.clients.claude import ClaudeClient
from atlas.services.zoning import ZoningService

logger = logging.getLogger(__name__)

class ATLAS:
    def __init__(self, config: Optional[AIConfig] = None):
        self.config = config or AIConfig.from_env()
        setup_logging()
        
        self.search = SearchService(self.config)
        self.process = PropertyProcessor(self.config)
        self.analyze = AnalysisService(self.config)
        self.market_analysis = MarketAnalyzer(PerplexityClient(self.config))
        self.claude = ClaudeClient(self.config)
        
    async def analyze_property(self, address: str) -> Dict:
        logger.info(f"Starting analysis for property: {address}")
        
        zoning_data = await self.zoning.get_zoning_data(address)
        logger.info("Zoning data retrieval complete")
        
        search_results = await self.search.search_property(address)
        logger.info(f"Search complete: found {len(search_results.get('sources', []))} sources")
        
        processed_data = await self.process.process_documents(search_results['sources'])
        logger.info("Processing complete")
        
        analysis = await self.analyze.analyze_property(search_results, processed_data)
        logger.info("Analysis complete")
        
        building_data = {"address": address}  # Replace with actual building data
        market_analysis = await self.market_analysis.fetch_market_analysis(building_data)
        logger.info("Market analysis complete")
        
        return {
            "zoning_data": zoning_data,
            "search_results": search_results,
            "processed_data": processed_data,
            "analysis_results": analysis,
            "market_analysis": market_analysis,
            "metadata": {
                "address": address,
                "timestamp": datetime.now().isoformat()
            }
        }

__all__ = [
    'AIConfig',
    'setup_logging',
    'setup_metrics',
    'track_request',
    'track_latency',
    'track_api_error',
    'SearchService',
    'ZoningService',
    'PropertyProcessor',
    'AnalysisService',
    'MarketAnalyzer'
]