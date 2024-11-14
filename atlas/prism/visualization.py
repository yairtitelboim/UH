from typing import Dict, List
import numpy as np
from .models import PhysicalMetric, OptimizedLayout, UnitMixMetric

class PrismVisualizer:
    async def transform_for_frontend(self, prism_data):
        return {
            'physical_metrics': await self._transform_metrics(prism_data),
            'unit_mix': await self._transform_unit_mix(prism_data),
            'floorplan': await self._transform_floorplan(prism_data),
            'risk_assessment': await self._transform_risk_assessment(prism_data)
        }
    
    def _transform_metrics(self, data) -> List[PhysicalMetric]:
        return [
            PhysicalMetric(
                metric='Floor Depth',
                actual=data['dimensions'].length,
                target=45.0,
                score=85,
                impact='high'
            ),
            PhysicalMetric(
                metric='Floor Efficiency',
                actual=data['optimized_layout'].efficiency,
                target=0.85,
                score=90,
                impact='medium'
            )
        ]
    
    def _transform_unit_mix(self, data) -> List[UnitMixMetric]:
        unit_counts = {}
        total_units = len(data['floorplate'].units)
        
        for unit in data['floorplate'].units:
            unit_counts[unit['type']] = unit_counts.get(unit['type'], 0) + 1
            
        return [
            UnitMixMetric(
                type=unit_type,
                count=count,
                percentage=count/total_units
            )
            for unit_type, count in unit_counts.items()
        ]
    
    def _transform_floorplan(self, data):
        return {
            'dimensions': {
                'width': data['dimensions'].width * 3.28084,  # Convert to feet
                'depth': data['dimensions'].length * 3.28084
            },
            'northWing': sorted(
                [self._transform_unit(u) for u in data['floorplate'].units if u['wing'] == 'north'],
                key=lambda x: x['x']
            )
        }
    
    def _transform_unit(self, unit):
        return {
            'type': unit['type'],
            'x': unit['position']['x'],
            'width': unit['width']
        }
    
    def _transform_risk_assessment(self, data):
        return [
            {
                'category': k,
                'status': v['status'],
                'score': v['score'],
                'detail': f"Risk level based on {k} analysis"
            }
            for k, v in data['optimized_layout'].risk_factors.items()
        ]
