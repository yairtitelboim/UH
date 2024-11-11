import pytest
from datetime import datetime
from .test_tracker import TestTracker, TestResult

def pytest_configure(config):
    config.test_tracker = TestTracker()

def pytest_terminal_summary(terminalreporter, exitstatus, config):
    stats = terminalreporter.stats
    
    total = len(stats.get('passed', [])) + len(stats.get('failed', []))
    passed = len(stats.get('passed', []))
    failed = len(stats.get('failed', []))
    
    # Get coverage data
    try:
        coverage = config.pluginmanager.get_plugin('_cov')
        total_coverage = coverage.cov.get_total_report().pc_covered
        coverage_by_module = {
            name: report.pc_covered 
            for name, report in coverage.cov.get_data().items()
            if 'atlas/prism' in name
        }
    except:
        total_coverage = 0
        coverage_by_module = {}
    
    # Collect warnings
    warnings = [
        str(warning.message) 
        for warning in stats.get('warnings', [])
    ]
    
    result = TestResult(
        timestamp=datetime.now().isoformat(),
        total_tests=total,
        passed_tests=passed, 
        failed_tests=failed,
        execution_time=terminalreporter._sessionstarttime.timestamp(),
        coverage_percentage=total_coverage,
        coverage_by_module=coverage_by_module,
        warnings=warnings
    )
    
    config.test_tracker.log_results(result)
