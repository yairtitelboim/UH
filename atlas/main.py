from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from atlas.core.config import AIConfig
from atlas.services.search import SearchService
from atlas.services.zoning import ZoningService
from atlas.services.process import PropertyProcessor
from atlas.services.market_analysis import MarketAnalyzer
from atlas.prism.integration import PrismIntegration
from atlas.core.cre_analysis import CREAnalysisService

def create_app() -> FastAPI:
    """Create FastAPI application."""
    app = FastAPI(title="Atlas API")
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    @app.get("/")
    async def root():
        return {"status": "ok"}
        
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={"error": str(exc)}
        )
    
    return app

def setup_app() -> FastAPI:
    """Setup FastAPI application with configuration."""
    app = create_app()
    app.config = AIConfig()
    return app

async def init_services(app: FastAPI):
    """Initialize application services."""
    app.search_service = SearchService(app.config)
    app.zoning_service = ZoningService(app.config)
    app.property_processor = PropertyProcessor(app.config)
    app.market_analyzer = MarketAnalyzer(app.config)

class PrismApp:
    def __init__(self, config: AIConfig):
        self.config = config
        self.prism = None
        self.cre_analyzer = None
        self.zoning_service = None
        
    async def initialize(self):
        """Initialize all services"""
        self.prism = PrismIntegration(self.config)
        self.cre_analyzer = CREAnalysisService(self.config)
        self.zoning_service = ZoningService(self.config)
        
    async def analyze_property(self, address: str):
        """Run complete property analysis"""
        if not self.prism:
            await self.initialize()
            
        building_analysis = await self.prism.analyze_building(address)
        market_analysis = await self.cre_analyzer.analyze_property(address)
        zoning_analysis = await self.zoning_service.analyze_zoning(address)
        
        return {
            'building_analysis': building_analysis,
            'market_analysis': market_analysis,
            'zoning_analysis': zoning_analysis
        }
        
    async def handle_error(self, error: Exception):
        """Handle and log errors"""
        # Add error handling logic here
        return {'error': str(error), 'type': error.__class__.__name__}
