from typing import Dict, List
import logging
import pdfplumber
from atlas.clients.unstructured import UnstructuredClient
from atlas.core.config import AIConfig
import asyncio
from atlas.core.metrics_wrapper import track_api_error, track_request

logger = logging.getLogger(__name__)

class ProcessingService:
    def __init__(self, config: AIConfig):
        self.pdf_processor = PDFProcessor()
        self.unstructured_client = UnstructuredClient(config)

    async def process_documents(self, sources: List[Dict]) -> Dict:
        processed_data = {
            "physical_metrics": await self._extract_physical_metrics(sources),
            "financial_metrics": await self._extract_financial_metrics(sources),
            "market_metrics": await self._extract_market_metrics(sources)
        }
        
        # Use Unstructured API for PDF processing
        pdf_sources = [s for s in sources if s['type'] == 'pdf']
        if pdf_sources:
            pdf_data = await self._process_pdfs(pdf_sources)
            processed_data.update(pdf_data)
            
        return processed_data
        
    async def _process_pdfs(self, pdf_sources: List[Dict]) -> Dict:
        tasks = []
        for source in pdf_sources:
            if 'market_report' in source['tags']:
                tasks.append(self._extract_market_report_data(source))
            elif 'government_doc' in source['tags']:
                tasks.append(self._extract_government_data(source))
                
        results = await asyncio.gather(*tasks)
        return self._merge_pdf_results(results)

class PDFProcessor:
    def __init__(self):
        self.metrics_patterns = {
            'square_footage': r'(\d+,?\d*)\s*(?:square\s*feet|sq\s*ft|sf)',
            'far': r'far\s*(?:of)?\s*([\d.]+)',
            # Your existing patterns
        }

    async def process(self, pdf_url: str) -> Dict:
        """Tiered PDF processing approach"""
        try:
            with pdfplumber.open(pdf_url) as pdf:
                basic_data = self._extract_basic_metrics(pdf)
                
            if self._needs_enhanced_processing(basic_data):
                enhanced_data = await self._process_with_unstructured(pdf_url)
                return self._merge_results(basic_data, enhanced_data)
                
            return basic_data
            
        except Exception as e:
            logger.error(f"PDF processing error: {e}")
            return {}

class PropertyProcessor:
    def __init__(self, config=None):
        self.config = config
        
    async def process_property_data(self, data: dict) -> dict:
        # Implementation
        return {
            "property_metrics": {},
            "market_data": {},
            "financial_metrics": {}
        }
        
    async def extract_metrics(self, text: str) -> dict:
        return {
            "noi": None,
            "cap_rate": None,
            "occupancy": None
        }