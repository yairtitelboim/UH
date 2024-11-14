from typing import Dict, List, Any
import asyncio
import logging
from atlas.core.config import AIConfig
from atlas.core.logging import setup_logging
from atlas.core.metrics_wrapper import track_api_error
from atlas.clients import TavilyClient, SerperClient, SerpApiClient

logger = logging.getLogger(__name__)

class SearchService:
    """Service for handling search operations."""
    
    def __init__(self, config: AIConfig):
        self.config = config
        self.tavily_client = TavilyClient(config)
        self.serper_client = SerperClient(config)
        self.serpapi_client = SerpApiClient(config)
        
    async def search_property(self, address: str) -> Dict:
        search_tasks = [
            self._fetch_news_articles(address),
            self._fetch_government_data(address),
            self._fetch_market_reports(address),
            self._fetch_property_records(address)
        ]
        
        results = await asyncio.gather(*search_tasks)
        return self._merge_results(results)
        
    async def _fetch_news_articles(self, address: str) -> Dict:
        # Use Tavily for recent news about property/area
        news_queries = [
            f"site:bizjournals.com {address} development",
            f"site:globest.com {address} office market",
            f"site:costar.com {address} transaction"
        ]
        return await self.tavily_client.search(news_queries)
        
    async def _fetch_government_data(self, address: str) -> Dict:
        # Use Serper for government sites
        gov_queries = [
            f"site:.gov {address} zoning",
            f"site:.gov {address} building permit",
            f"site:.gov {address} tax assessment"
        ]
        return await self.serper_client.search(gov_queries)
        
    async def _fetch_market_reports(self, address: str) -> Dict:
        # Use SerpAPI for broker reports
        market_queries = [
            f"site:cbre.com OR site:jll.com {self._extract_submarket(address)} office market report filetype:pdf",
            f"site:cushmanwakefield.com {self._extract_submarket(address)} market analysis filetype:pdf"
        ]
        return await self.serpapi_client.search(market_queries)

    def _merge_results(self, results: List[Dict]) -> Dict:
        """Merges and deduplicates results from different services"""
        merged = {
            "sources": [],
            "data_points": {},
            "confidence_scores": {}
        }
        
        for result in results:
            self._process_sources(result, merged)
            self._extract_data_points(result, merged)
            
        return merged

class CRESearchService(SearchService):
    """Enhanced search service for CRE-specific sources"""
    
    async def search_property(self, address: str) -> Dict:
        base_results = await super().search_property(address)
        cre_results = await self._search_cre_sources(address)
        return self._merge_cre_results(base_results, cre_results)
    
    async def _search_cre_sources(self, address: str) -> Dict:
        queries = {
            'comps': f"site:costar.com OR site:crexi.com {address} comparable sales",
            'market': f"site:cbre.com OR site:cushmanwakefield.com market report {self._extract_market(address)}",
            'tenants': f"site:dnb.com OR site:bloomberg.com tenant financial statements {address}"
        }
        
        results = {}
        for category, query in queries.items():
            result = await self._execute_cre_search(query)
            results[category] = result
            
        return results