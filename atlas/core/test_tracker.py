from dataclasses import dataclass
from datetime import datetime
import json
import os
from typing import Dict, List, Optional

@dataclass
class TestResult:
    timestamp: str
    total_tests: int
    passed_tests: int
    failed_tests: int
    execution_time: float
    coverage_percentage: float
    coverage_by_module: Dict[str, float]
    warnings: List[str]
    
class TestTracker:
    def __init__(self, log_dir: str = "test_logs"):
        self.log_dir = log_dir
        os.makedirs(log_dir, exist_ok=True)
        
    def log_results(self, result: TestResult):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"test_run_{timestamp}.json"
        
        data = {
            "timestamp": result.timestamp,
            "metrics": {
                "total_tests": result.total_tests,
                "passed_tests": result.passed_tests,
                "failed_tests": result.failed_tests,
                "execution_time": result.execution_time,
                "coverage": {
                    "total": result.coverage_percentage,
                    "by_module": result.coverage_by_module
                }
            },
            "warnings": result.warnings
        }
        
        with open(os.path.join(self.log_dir, filename), 'w') as f:
            json.dump(data, f, indent=2)
