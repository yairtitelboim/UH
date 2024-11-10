import pytest
from atlas.services.market_analysis import MarketAnalyzer
from atlas.core.config import AIConfig

@pytest.mark.asyncio
async def test_market_analyzer():
    """Test market analyzer service."""
    analyzer = MarketAnalyzer(AIConfig())
    result = await analyzer.analyze_market("New York")
    
    assert isinstance(result, dict)
    assert result["location"] == "New York"
    assert "market_score" in result
    assert "growth_potential" in result
    assert "risk_level" in result

@pytest.mark.asyncio
async def test_market_analyzer_error():
    """Test market analyzer error handling."""
    analyzer = MarketAnalyzer(AIConfig())
    
    with pytest.raises(ValueError) as exc_info:
        await analyzer.analyze_market(None)
    assert "Location is required" in str(exc_info.value)

@pytest.mark.asyncio
async def test_market_analyzer_invalid_location():
    """Test market analyzer with invalid location."""
    analyzer = MarketAnalyzer(AIConfig())
    
    with pytest.raises(ValueError):
        await analyzer.analyze_market("")
