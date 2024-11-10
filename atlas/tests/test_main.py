import pytest
from unittest.mock import Mock, patch
from atlas.main import PrismApp
from atlas.prism.dimension_analyzer import BuildingDimensions
from atlas.core.config import AIConfig

@pytest.fixture
def app_config():
    return AIConfig()

@pytest.fixture
def app(app_config):
    return PrismApp(app_config)

@pytest.fixture
def mock_analysis_result():
    return {
        'raw_data': {
            'dimensions': BuildingDimensions(
                width=30.5,
                length=45.7,
                height=36.6,
                floor_height=3.5,
                floor_count=10
            ),
            'windows': [
                {'x': 10, 'y': 20, 'width': 2, 'height': 1.5}
            ]
        },
        'visualization': {
            'metrics': {},
            'floorplan': {}
        }
    }

class TestPrismApp:
    async def test_initialize(self, app):
        """Test application initialization"""
        with patch.multiple('atlas.main',
                          PrismIntegration=Mock(),
                          CREAnalysisService=Mock(),
                          ZoningService=Mock()):
            await app.initialize()
            
            assert app.prism is not None
            assert app.cre_analyzer is not None
            assert app.zoning_service is not None
    
    async def test_analyze_property(self, app, mock_analysis_result):
        """Test property analysis flow"""
        with patch.multiple('atlas.main',
                          PrismIntegration=Mock(),
                          CREAnalysisService=Mock(),
                          ZoningService=Mock()):
            await app.initialize()
            
            # Setup mock returns
            async def mock_analyze(*args, **kwargs):
                return mock_analysis_result
            
            app.prism.analyze_building.side_effect = mock_analyze
            app.cre_analyzer.analyze_property.return_value = {
                'metrics': {'noi': 500000}
            }
            app.zoning_service.analyze_zoning.return_value = {
                'permitted_uses': ['office']
            }
            
            result = await app.analyze_property("123 Test St")
            
            assert 'building_analysis' in result
            assert 'market_analysis' in result
            assert 'zoning_analysis' in result
            
            # Verify service calls
            assert app.prism.analyze_building.called
            assert app.cre_analyzer.analyze_property.called
            assert app.zoning_service.analyze_zoning.called
    
    async def test_error_handling(self, app):
        """Test application error handling"""
        with patch.multiple('atlas.main',
                          PrismIntegration=Mock(),
                          CREAnalysisService=Mock(),
                          ZoningService=Mock()):
            await app.initialize()
            
            app.prism.analyze_building.side_effect = ValueError("Invalid address")
            
            with pytest.raises(ValueError):
                await app.analyze_property("")