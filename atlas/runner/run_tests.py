from pathlib import Path
import sys
import os

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.parent)
sys.path.insert(0, project_root)

# Set environment variables before any imports
os.environ['SKIP_METRICS'] = '1'
os.environ['GOOGLE_API_KEY'] = 'test_key'
os.environ['TEST_MODE'] = '1'
os.environ['PYTEST_DISABLE_PLUGIN_AUTOLOAD'] = 'true'

# Mock required modules before any atlas imports
from unittest.mock import Mock
sys.modules['httpx'] = Mock()
sys.modules['segment_geospatial'] = Mock()
sys.modules['torch'] = Mock()
sys.modules['numpy'] = Mock()
sys.modules['ultralytics'] = Mock()

import pytest
import logging
from coverage import Coverage
from datetime import datetime
import json

logger = logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_prism_tests():
    """Run PRISM functional tests and track coverage results"""
    try:
        output_dir = Path("metrics/prism")
        output_dir.mkdir(exist_ok=True, parents=True)

        # Initialize coverage
        cov = Coverage(source=['atlas/prism'])
        cov.start()

        # Run only PRISM functional tests
        args = [
            "-v",
            "--capture=no",
            "-p", "no:warnings",
            "--import-mode=importlib",
            "atlas/tests/test_prism/test_integration.py"
        ]
        
        code = pytest.main(args)
        
        # Stop coverage and generate report
        cov.stop()
        cov.save()
        
        # Get coverage data and save report
        coverage_data = {}
        for filename in cov.get_data().measured_files():
            if 'atlas/prism' in filename:
                module = filename.split('/')[-1].replace('.py', '')
                coverage_data[module] = cov.analysis2(filename)

        test_report = {
            "timestamp": datetime.now().isoformat(),
            "overall_coverage": cov.report(show_missing=False),
            "components": coverage_data
        }
        
        results_file = output_dir / f"coverage_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w') as f:
            json.dump(test_report, f, indent=2)
            
        return code
        
    except Exception as e:
        logger.error(f"Error running PRISM tests: {e}", exc_info=True)
        return 1

if __name__ == "__main__":
    sys.exit(run_prism_tests())