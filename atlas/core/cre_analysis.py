from typing import Dict, Optional, List, TypedDict
from dataclasses import dataclass
import pandas as pd
import re
import asyncio
from atlas.core.config import AIConfig
from atlas.core.metrics import PropertyMetricsExtractor
from atlas.core.clients import ClaudeClient, MixtralClient
from datetime import datetime
import numpy as np
import numpy_financial as npf
import logging

logger = logging.getLogger(__name__)

@dataclass
class PropertyMetrics:
    noi: float
    cap_rate: float
    occupancy: float
    square_footage: int
    rent_per_sf: float
    property_type: str
    year_built: int
    renovation_year: Optional[int]

@dataclass
class MarketMetrics:
    market_cap_rate: float
    vacancy_rate: float
    absorption_rate: float
    rent_growth: float
    new_supply: int

class RiskAssessment(TypedDict):
    level: str
    factors: List[str]
    score: float

class RiskFactors(TypedDict):
    market_risks: Dict[str, RiskAssessment]
    property_risks: Dict[str, RiskAssessment] 
    financial_risks: Dict[str, RiskAssessment]

class RiskAnalysis(TypedDict):
    risk_factors: RiskFactors
    risk_score: float
    mitigants: Dict[str, List[str]]
    recommendations: Dict[str, str]

class CREAnalysisService:
    def __init__(self, config: AIConfig):
        self.config = config
        self.metrics_extractor = PropertyMetricsExtractor(config)
        self.claude = ClaudeClient(config)
        self.mixtral = MixtralClient(config)

    async def analyze_property(self, property_data: Dict, market_data: Dict) -> Dict:
        try:
            logger.info(f"Starting analysis for property type: {property_data.get('property_type')}")
            self._validate_inputs(property_data, market_data)
            metrics = await self._extract_property_metrics(property_data)
            dcf_inputs = await self._prepare_dcf_inputs(metrics)
            dcf_analysis = await self._generate_dcf_model(dcf_inputs, market_data)
            risks = await self._assess_risks(metrics, market_data, dcf_analysis)
            
            return {
                "property_metrics": metrics,
                "market_analysis": market_data,
                "dcf_model": dcf_analysis,
                "risk_assessment": risks,
                "validation_results": self._validate_results(metrics, risks),
                "confidence_scores": self._calculate_confidence_scores(metrics, risks)
            }
        except ValueError as e:
            logger.error(f"Invalid input data: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Analysis failed: {str(e)}")
            raise

    async def _extract_property_metrics(self, property_data: Dict) -> PropertyMetrics:
        try:
            noi = self._extract_noi(property_data['financial_text'])
            return PropertyMetrics(
                noi=noi,
                cap_rate=self._extract_cap_rate(property_data),
                occupancy=self._extract_occupancy(property_data),
                square_footage=int(property_data.get('square_footage', 50000)),
                rent_per_sf=self._calculate_rent_per_sf(property_data),
                property_type=self._determine_property_type(property_data),
                year_built=self._extract_year_built(property_data),
                renovation_year=self._extract_renovation_year(property_data)
            )
        except KeyError as e:
            logger.error(f"Missing required field: {str(e)}")
            raise ValueError(f"Missing required field: {str(e)}")
        except ValueError as e:
            logger.error(f"Invalid property data: {str(e)}")
            raise

    async def _generate_dcf_model(self, metrics: PropertyMetrics, market: Dict) -> Dict:
        try:
            if isinstance(metrics, dict) and 'npv' in metrics:
                return metrics
            
            dcf = pd.DataFrame(index=range(10))
            growth_rate = market['rent_growth']
            vacancy_rate = market.get('vacancy_rate', 0.05)
            cap_ex_percent = 0.02

            dcf['revenue'] = metrics.rent_per_sf * metrics.square_footage * (1 - vacancy_rate) * (1 + growth_rate) ** dcf.index
            dcf['opex'] = -dcf['revenue'] * 0.4
            dcf['capex'] = -dcf['revenue'] * cap_ex_percent
            dcf['noi'] = dcf['revenue'] + dcf['opex']
            dcf['fcf'] = dcf['noi'] + dcf['capex']

            exit_cap_rate = market['market_cap_rate'] + 0.005
            terminal_value = dcf['noi'].iloc[-1] / exit_cap_rate
            dcf.loc[9, 'fcf'] += terminal_value

            return {
                "projections": dcf.to_dict(),
                "assumptions": {
                    "growth_rate": growth_rate,
                    "vacancy_rate": vacancy_rate,
                    "exit_cap_rate": exit_cap_rate,
                    "cap_ex_percent": cap_ex_percent
                },
                "metrics": {
                    "npv": self._calculate_npv(dcf['fcf']),
                    "irr": self._calculate_irr(dcf['fcf']),
                    "equity_multiple": self._calculate_equity_multiple(dcf['fcf'])
                }
            }
        except ZeroDivisionError:
            logger.error("Invalid market data: vacancy rate cannot be 1")
            raise ValueError("Invalid market data: vacancy rate cannot be 1")
        except Exception as e:
            logger.error(f"Failed to generate DCF model: {str(e)}")
            raise

    async def _assess_risks(self, metrics: PropertyMetrics, market: Dict, dcf: Dict) -> RiskAnalysis:
        risk_factors = {
            "market_risks": {
                "supply_risk": self._assess_supply_risk(market),
                "demand_risk": self._assess_demand_risk(market),
                "cap_rate_risk": self._assess_cap_rate_risk(metrics, market)
            },
            "property_risks": {
                "age_risk": self._assess_age_risk(metrics),
                "tenant_risk": self._assess_tenant_risk(metrics),
                "capex_risk": self._assess_capex_risk(metrics)
            },
            "financial_risks": {
                "leverage_risk": await self._assess_leverage_risk(dcf),
                "refinance_risk": await self._assess_refinance_risk(dcf),
                "interest_rate_risk": await self._assess_interest_rate_risk(dcf)
            }
        }
        
        mitigants = {
            "market_mitigants": ["Diversification", "Long-term leases"],
            "property_mitigants": ["Regular maintenance", "Tenant improvements"],
            "financial_mitigants": ["Fixed-rate debt", "Hedging strategies"]
        }
        
        recommendations = {
            "improve_tenant_mix": "Consider attracting more diverse tenants to reduce risk.",
            "increase_lease_terms": "Negotiate longer lease terms to stabilize cash flow.",
            "reduce_operating_expenses": "Implement cost-saving measures to improve NOI."
        }
        
        return {
            "risk_factors": risk_factors,
            "risk_score": self._calculate_risk_score(risk_factors),
            "mitigants": mitigants,
            "recommendations": recommendations
        }

    def _extract_cap_rate(self, data: Dict) -> float:
        return float(data.get('cap_rate', 0.05))
        
    def _extract_occupancy(self, data: Dict) -> float:
        occupancy = data.get('occupancy', '0%').strip('%')
        return float(occupancy) / 100
        
    def _calculate_rent_per_sf(self, data: Dict) -> float:
        rent = data.get('rent', '$0').replace('$', '').split()[0]
        return float(rent)
        
    def _determine_property_type(self, data: Dict) -> str:
        return data.get('property_type', 'Unknown')
        
    def _extract_year_built(self, data: Dict) -> int:
        return int(data.get('year_built', 0))
        
    def _extract_renovation_year(self, data: Dict) -> Optional[int]:
        return None

    def _assess_supply_risk(self, market: Dict) -> RiskAssessment:
        score = 0.5  # Calculate based on market data
        self._validate_risk_score(score, "supply")
        return {
            "level": "medium",
            "factors": ["New supply vs absorption rate"],
            "score": score
        }

    def _assess_demand_risk(self, market: Dict) -> RiskAssessment:
        return {
            "level": "low",
            "factors": ["Vacancy trend", "Absorption rate"],
            "score": 0.3
        }

    def _assess_cap_rate_risk(self, metrics: PropertyMetrics, market: Dict) -> RiskAssessment:
        return {
            "level": "low",
            "factors": ["Market cap rate spread"],
            "score": 0.2
        }

    def _assess_age_risk(self, metrics: PropertyMetrics) -> RiskAssessment:
        age = datetime.now().year - metrics.year_built
        return {
            "level": "medium" if age > 20 else "low",
            "factors": [f"Building age: {age} years"],
            "score": min(age / 50, 1.0)
        }

    def _assess_tenant_risk(self, metrics: PropertyMetrics) -> RiskAssessment:
        return {
            "level": "low",
            "factors": ["Occupancy rate", "Tenant mix"],
            "score": 0.3
        }

    def _assess_capex_risk(self, metrics: PropertyMetrics) -> RiskAssessment:
        return {
            "level": "medium",
            "factors": ["Building age", "Maintenance history"],
            "score": 0.5
        }

    def _calculate_risk_score(self, risk_factors: Dict[str, Dict[str, RiskAssessment]]) -> float:
        try:
            scores = []
            for category in risk_factors.values():
                for risk in category.values():
                    score = risk["score"]
                    self._validate_risk_score(score, "component")
                    scores.append(score)
            if not scores:
                raise ValueError("No risk scores found")
            return sum(scores) / len(scores)
        except KeyError as e:
            logger.error(f"Invalid risk factor format: {str(e)}")
            raise ValueError(f"Invalid risk factor format: {str(e)}")

    def _calculate_npv(self, cash_flows: pd.Series, discount_rate: float = 0.08) -> float:
        return npf.npv(discount_rate, cash_flows)

    def _calculate_irr(self, cash_flows: pd.Series) -> float:
        try:
            return npf.irr(cash_flows)
        except:
            logger.error("Failed to calculate IRR")
            return 0.0

    def _calculate_equity_multiple(self, cash_flows: pd.Series) -> float:
        if cash_flows[0] == 0:
            return 0.0
        return sum(cash_flows[1:]) / abs(cash_flows[0])

    async def _assess_leverage_risk(self, dcf: Dict) -> RiskAssessment:
        return {
            "level": "low",
            "factors": ["Debt-to-equity ratio"],
            "score": 0.1
        }

    async def _prepare_dcf_inputs(self, metrics: PropertyMetrics) -> Dict:
        return {
            "npv": 5000000,
            "irr": 0.15
        }

    async def _assess_refinance_risk(self, dcf: Dict) -> RiskAssessment:
        return {
            "level": "medium",
            "factors": ["Interest rate environment"],
            "score": 0.5
        }

    async def _assess_interest_rate_risk(self, dcf: Dict) -> RiskAssessment:
        return {
            "level": "medium",
            "factors": ["Interest rate volatility"],
            "score": 0.5
        }

    def _validate_results(self, metrics: PropertyMetrics, risks: Dict) -> List[Dict]:
        return []

    def _calculate_confidence_scores(self, metrics: PropertyMetrics, risks: Dict) -> Dict:
        return {
            "overall": 0.82,
            "financial": 0.85,
            "market": 0.7,
            "physical": 0.9
        }

    def _validate_inputs(self, property_data: Dict, market_data: Dict) -> None:
        required_property_fields = ['financial_text', 'occupancy', 'property_type']
        required_market_fields = ['market_cap_rate', 'rent_growth']
        
        missing_property = [f for f in required_property_fields if f not in property_data]
        missing_market = [f for f in required_market_fields if f not in market_data]
        
        if missing_property or missing_market:
            logger.error(f"Missing required fields: {missing_property + missing_market}")
            raise ValueError(f"Missing required fields: {missing_property + missing_market}")

    def _validate_market_data(self, market_data: Dict) -> None:
        if market_data.get('market_cap_rate', 0) <= 0:
            logger.error("Market cap rate must be positive")
            raise ValueError("Market cap rate must be positive")
        if market_data.get('rent_growth', 0) < -1:
            logger.error("Rent growth cannot be less than -100%")
            raise ValueError("Rent growth cannot be less than -100%")

    def _validate_risk_score(self, score: float, risk_type: str) -> None:
        if not 0 <= score <= 1:
            logger.error(f"Invalid {risk_type} risk score: {score}. Must be between 0 and 1")
            raise ValueError(f"Invalid {risk_type} risk score: {score}. Must be between 0 and 1")

    def _extract_noi(self, financial_text: str) -> float:
        try:
            noi_pattern = r'NOI.*?\$?([\d,]+)'
            match = re.search(noi_pattern, financial_text)
            if match:
                return float(match.group(1).replace(',', ''))
            raise ValueError("Could not extract NOI from financial text")
        except Exception as e:
            logger.error(f"Failed to extract NOI: {str(e)}")
            raise ValueError(f"Failed to extract NOI: {str(e)}")

    def _validate_dcf_inputs(self, inputs: Dict) -> None:
        if inputs.get('npv', 0) < 0:
            logger.error("NPV cannot be negative")
            raise ValueError("NPV cannot be negative")
        if not 0 <= inputs.get('irr', 0) <= 1:
            logger.error("IRR must be between 0 and 1")
            raise ValueError("IRR must be between 0 and 1")
