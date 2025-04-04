"""
Runner for PRISM functional tests with coverage tracking
"""
import os
import sys
from pathlib import Path
import shutil

# Add project root to Python path before anything else
project_root = str(Path(__file__).parent.parent.parent)
sys.path.insert(0, project_root)

# Set environment variables before any imports
os.environ.update({
    'SKIP_METRICS': '1',
    'TEST_MODE': '1',
    'PYTEST_DISABLE_PLUGIN_AUTOLOAD': 'true',
    'GOOGLE_API_KEY': 'test_key'
})

import pytest
import logging
from coverage import Coverage
from datetime import datetime
import json

logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    """Run PRISM functional tests and track coverage results"""
    pytest_ini = Path("pytest.ini")
    pytest_ini_backup = None
    
    try:
        # Backup and remove pytest.ini if it exists
        if pytest_ini.exists():
            pytest_ini_backup = pytest_ini.with_suffix('.bak')
            shutil.move(str(pytest_ini), str(pytest_ini_backup))
        
        output_dir = Path("metrics/prism")
        output_dir.mkdir(exist_ok=True, parents=True)

        # Initialize coverage
        cov = Coverage(source=['atlas/prism'])
        cov.start()

        # Run tests
        args = [
            "-v",
            "--capture=no",
            "-p", "no:warnings",
            "--import-mode=importlib",
            "-p", "pytest_asyncio.plugin",
            "atlas/tests/test_prism/test_integration.py"
        ]
        
        code = pytest.main(args)
        
        # Generate coverage report
        cov.stop()
        cov.save()
        
        coverage_data = {}
        for filename in cov.get_data().measured_files():
            if 'atlas/prism' in filename:
                module = filename.split('/')[-1].replace('.py', '')
                analysis = cov.analysis2(filename)
                total_lines = len(analysis[1]) + len(analysis[2])  # covered + missing
                
                if total_lines > 0:
                    covered_lines = len(analysis[1])
                    coverage_percent = round((covered_lines / total_lines) * 100, 2)
                else:
                    covered_lines = 0
                    coverage_percent = 0.0
                    
                coverage_data[module] = {
                    'coverage': coverage_percent,
                    'covered_lines': covered_lines,
                    'total_lines': total_lines,
                    'missing_lines': analysis[2]
                }

        test_report = {
            "timestamp": datetime.now().isoformat(),
            "overall_coverage": round(cov.report(show_missing=False), 2),
            "components": coverage_data,
            "test_status": {
                "total": len(coverage_data),
                "covered": sum(1 for v in coverage_data.values() if v['coverage'] >= 80),
                "target": "80%"
            }
        }
        
        results_file = output_dir / f"coverage_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w') as f:
            json.dump(test_report, f, indent=2)
            
        return code

    except Exception as e:
        logger.error(f"Error running PRISM tests: {e}", exc_info=True)
        return 1
        
    finally:
        # Restore pytest.ini if it was backed up
        if pytest_ini_backup and pytest_ini_backup.exists():
            shutil.move(str(pytest_ini_backup), str(pytest_ini))

if __name__ == "__main__":
    sys.exit(main())