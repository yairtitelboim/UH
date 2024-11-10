import pytest
from atlas.core.cre_analysis import CREAnalysisService, PropertyMetrics, MarketMetrics
from atlas.core.config import AIConfig
from atlas.core.metrics import MetricsAnalyzer

@pytest.fixture
def config():
    return AIConfig()

@pytest.fixture
def cre_service(config):
    return CREAnalysisService(config)

@pytest.fixture
def sample_property_data():
    return {
        "financial_text": "The property has an NOI of $500,000",
        "property_text": "Building size: 50,000 square feet",
        "year_built": "2010",
        "property_type": "Office",
        "occupancy": "95%",
        "rent": "$30 per square foot"
    }

@pytest.fixture
def sample_market_data():
    return {
        "market_cap_rate": 0.05,
        "vacancy_rate": 0.07,
        "rent_growth": 0.03,
        "absorption_rate": 50000,
        "new_supply": 100000
    }

@pytest.mark.asyncio
async def test_extract_property_metrics(cre_service, sample_property_data):
    metrics = await cre_service._extract_property_metrics(sample_property_data)
    assert isinstance(metrics, PropertyMetrics)
    assert metrics.noi == 500000
    assert metrics.square_footage == 50000
    assert metrics.property_type == "Office"
    assert metrics.year_built == 2010

@pytest.mark.asyncio
async def test_generate_dcf_model(cre_service):
    metrics = PropertyMetrics(
        noi=500000,
        cap_rate=0.05,
        occupancy=0.95,
        square_footage=50000,
        rent_per_sf=30,
        property_type="Office",
        year_built=2010,
        renovation_year=None
    )
    
    market_data = {
        "market_cap_rate": 0.05,
        "vacancy_rate": 0.07,
        "rent_growth": 0.03
    }
    
    dcf = await cre_service._generate_dcf_model(metrics, market_data)
    assert "projections" in dcf
    assert "assumptions" in dcf
    assert "metrics" in dcf
    assert dcf["assumptions"]["growth_rate"] == 0.03

@pytest.mark.asyncio
async def test_assess_risks(cre_service):
    metrics = PropertyMetrics(
        noi=500000,
        cap_rate=0.05,
        occupancy=0.95,
        square_footage=50000,
        rent_per_sf=30,
        property_type="Office",
        year_built=2010,
        renovation_year=None
    )
    
    market_data = {
        "market_cap_rate": 0.05,
        "vacancy_rate": 0.07,
        "rent_growth": 0.03
    }
    
    dcf_data = {
        "metrics": {
            "npv": 5000000,
            "irr": 0.15
        }
    }
    
    risks = await cre_service._assess_risks(metrics, market_data, dcf_data)
    assert "risk_factors" in risks
    assert "risk_score" in risks
    assert "mitigants" in risks
    assert "recommendations" in risks

@pytest.mark.asyncio
async def test_analyze_property_full_flow(cre_service, sample_property_data, sample_market_data):
    result = await cre_service.analyze_property(sample_property_data, sample_market_data)
    
    assert "property_metrics" in result
    assert "market_analysis" in result
    assert "dcf_model" in result
    assert "risk_assessment" in result

@pytest.mark.asyncio
async def test_metrics_with_incomplete_data():
    partial_data = {
        "tax_assessment": {"value": 10000000},
        "market_indicators": {
            "avg_rent_sf": 45,
            "vacancy_rate": 0.08
        }
    }
    
    analyzer = MetricsAnalyzer(config)
    result = await analyzer.derive_noi_estimate(partial_data)
    
    assert "estimated_value" in result
    assert "confidence_score" in result
    assert "evidence" in result
    assert 0 <= result["confidence_score"] <= 1.0 

@pytest.mark.asyncio
async def test_extract_property_metrics_missing_field():
    cre_service = CREAnalysisService(AIConfig())
    property_data = {}  # Missing required fields
    
    with pytest.raises(ValueError, match="Missing required field"):
        await cre_service._extract_property_metrics(property_data)

@pytest.mark.asyncio
async def test_extract_property_metrics_invalid_data():
    cre_service = CREAnalysisService(AIConfig())
    property_data = {
        'financial_text': 'Invalid NOI data',
        'occupancy': 'not a number',
        'property_type': 'Office'
    }
    
    with pytest.raises(ValueError, match="Invalid property data"):
        await cre_service._extract_property_metrics(property_data)

@pytest.mark.asyncio
async def test_validate_dcf_inputs():
    cre_service = CREAnalysisService(AIConfig())
    
    # Test negative NPV
    with pytest.raises(ValueError, match="NPV cannot be negative"):
        cre_service._validate_dcf_inputs({"npv": -1000, "irr": 0.1})
    
    # Test invalid IRR
    with pytest.raises(ValueError, match="IRR must be between 0 and 1"):
        cre_service._validate_dcf_inputs({"npv": 1000, "irr": 1.5})

def test_validate_market_data():
    cre_service = CREAnalysisService(AIConfig())
    
    # Test invalid cap rate
    with pytest.raises(ValueError, match="Market cap rate must be positive"):
        cre_service._validate_market_data({"market_cap_rate": 0, "rent_growth": 0.03})
    
    # Test invalid rent growth
    with pytest.raises(ValueError, match="Rent growth cannot be less than -100%"):
        cre_service._validate_market_data({"market_cap_rate": 0.05, "rent_growth": -1.5})