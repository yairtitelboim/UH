from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from atlas.core.config import AIConfig

@dataclass
class ZoningRequirements:
    """Data class for zoning requirements."""
    height_limit: Optional[float] = None
    lot_coverage: Optional[float] = None
    setbacks: Dict[str, float] = None
    parking_requirements: Dict[str, Any] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "height_limit": self.height_limit,
            "lot_coverage": self.lot_coverage,
            "setbacks": self.setbacks or {},
            "parking_requirements": self.parking_requirements or {}
        }

@dataclass
class ZoningRestrictions:
    """Data class for zoning restrictions."""
    prohibited_uses: List[str] = None
    conditional_uses: List[str] = None
    special_conditions: Dict[str, Any] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "prohibited_uses": self.prohibited_uses or [],
            "conditional_uses": self.conditional_uses or [],
            "special_conditions": self.special_conditions or {}
        }

class ZoningService:
    """Service for handling zoning-related operations."""
    
    def __init__(self, config: AIConfig = None):
        self.config = config
        self._zoning_cache: Dict[str, Dict[str, Any]] = {}

    async def analyze_zoning(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze zoning data for a property.
        
        Args:
            data: Dictionary containing property data including zoning information
        
        Returns:
            Dictionary containing zoning analysis results
        """
        if not data:
            return {
                "zoning_analysis": {},
                "permitted_uses": [],
                "restrictions": {}
            }

        zoning_code = data.get("zoning_code", "")
        requirements = await self.get_zoning_requirements(zoning_code)
        
        analysis = self._analyze_compliance(data, requirements)
        permitted_uses = self._get_permitted_uses(zoning_code)
        restrictions = requirements.get("restrictions", {})

        return {
            "zoning_analysis": analysis,
            "permitted_uses": permitted_uses,
            "restrictions": restrictions
        }

    async def get_zoning_requirements(self, zoning_code: str) -> Dict[str, Any]:
        """
        Get requirements for a specific zoning code.
        
        Args:
            zoning_code: The zoning code to look up
            
        Returns:
            Dictionary containing zoning requirements and restrictions
        """
        if not zoning_code:
            return {
                "requirements": {},
                "restrictions": {}
            }

        # Check cache first
        if zoning_code in self._zoning_cache:
            return self._zoning_cache[zoning_code]

        # Create requirements based on zoning code
        requirements = ZoningRequirements(
            height_limit=self._get_height_limit(zoning_code),
            lot_coverage=self._get_lot_coverage(zoning_code),
            setbacks=self._get_setbacks(zoning_code),
            parking_requirements=self._get_parking_requirements(zoning_code)
        )

        restrictions = ZoningRestrictions(
            prohibited_uses=self._get_prohibited_uses(zoning_code),
            conditional_uses=self._get_conditional_uses(zoning_code),
            special_conditions=self._get_special_conditions(zoning_code)
        )

        result = {
            "requirements": requirements.to_dict(),
            "restrictions": restrictions.to_dict()
        }

        # Cache the result
        self._zoning_cache[zoning_code] = result
        return result

    def _analyze_compliance(self, data: Dict[str, Any], requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze if property complies with zoning requirements."""
        return {
            "compliant": True,  # Placeholder for actual compliance check
            "violations": [],
            "notes": []
        }

    def _get_permitted_uses(self, zoning_code: str) -> List[str]:
        """Get permitted uses for a zoning code."""
        # Placeholder implementation
        uses_map = {
            "R1": ["single_family_residential", "home_office"],
            "C1": ["retail", "office", "restaurant"],
            "": []
        }
        return uses_map.get(zoning_code, [])

    def _get_height_limit(self, zoning_code: str) -> Optional[float]:
        """Get height limit for a zoning code."""
        return {"R1": 35.0, "C1": 45.0}.get(zoning_code)

    def _get_lot_coverage(self, zoning_code: str) -> Optional[float]:
        """Get lot coverage limit for a zoning code."""
        return {"R1": 0.4, "C1": 0.6}.get(zoning_code)

    def _get_setbacks(self, zoning_code: str) -> Dict[str, float]:
        """Get setback requirements for a zoning code."""
        return {"front": 20.0, "back": 25.0, "sides": 10.0} if zoning_code else {}

    def _get_parking_requirements(self, zoning_code: str) -> Dict[str, Any]:
        """Get parking requirements for a zoning code."""
        return {"min_spaces": 2} if zoning_code else {}

    def _get_prohibited_uses(self, zoning_code: str) -> List[str]:
        """Get prohibited uses for a zoning code."""
        return ["industrial", "commercial"] if zoning_code.startswith("R") else []

    def _get_conditional_uses(self, zoning_code: str) -> List[str]:
        """Get conditional uses for a zoning code."""
        return ["daycare", "religious"] if zoning_code else []

    def _get_special_conditions(self, zoning_code: str) -> Dict[str, Any]:
        """Get special conditions for a zoning code."""
        return {"historic_district": True} if zoning_code else {}

# Make sure the class is available for import
__all__ = ['ZoningService']