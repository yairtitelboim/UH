import os
import sys
from pathlib import Path
import pytest
from datetime import datetime
import json
import logging
import tempfile
import asyncio
import pytest_asyncio

# Set SKIP_METRICS before any atlas imports
os.environ['SKIP_METRICS'] = '1'

logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def convert_scientific_notation(value):
    """Convert scientific notation to regular float"""
    try:
        if isinstance(value, str) and 'e' in value.lower():
            return float(value)
        return float(value)
    except (ValueError, TypeError):
        return 0.0

def parse_benchmark_stats(bench_data):
    """Parse benchmark data and extract stats"""
    try:
        stats = {k: convert_scientific_notation(v) for k, v in bench_data["stats"].items() 
                if isinstance(v, (int, float, str))}

        # Scale nanosecond values
        scale_keys = ['min', 'max', 'mean', 'stddev', 'median', 'iqr']
        stats = {
            k: (v * 1e9 if k in scale_keys else v)
            for k, v in stats.items()
        }

        # Handle outliers
        outliers = bench_data["stats"]["outliers"]
        if isinstance(outliers, str):
            mild, severe = outliers.split(";")
            outliers = {"mild": int(mild), "severe": int(severe)}

        return {
            "name": bench_data["name"],
            "status": "passed",
            "stats": {
                "min": round(stats.get("min", 0), 2),
                "max": round(stats.get("max", 0), 2),
                "mean": round(stats.get("mean", 0), 2),
                "stddev": round(stats.get("stddev", 0), 2),
                "median": round(stats.get("median", 0), 2),
                "iqr": round(stats.get("iqr", 0), 2),
                "rounds": int(stats.get("rounds", 0)),
                "iterations": int(stats.get("iterations", 1)),
                "ops": round(stats.get("ops", 0), 2),
                "outliers": outliers
            }
        }
    except Exception as e:
        logger.error(f"Error parsing benchmark data: {str(e)}")
        return {
            "name": bench_data.get("name", "unknown"),
            "status": "error",
            "stats": {}
        }

def format_number(value):
    """Format number for display"""
    try:
        value = float(value)
        if value >= 1e6:
            return f"{value/1e6:.2f}M"
        elif value >= 1e3:
            return f"{value/1e3:.2f}K"
        elif value >= 1:
            return f"{value:.2f}"
        else:
            return f"{value*1e9:.2f}n"
    except (TypeError, ValueError):
        return "0.00"

def get_pytest_config(temp_dir: Path) -> str:
    """Create pytest configuration"""
    return """
[pytest]
addopts = -v
python_files = test_*.py
python_functions = test_*
asyncio_mode = auto
markers = 
    benchmark: mark test as benchmark
required_plugins = 
    pytest-asyncio
    pytest-benchmark
filterwarnings =
    ignore::RuntimeWarning:asyncio.*:
    ignore::pytest.PytestUnhandledCoroutineWarning::
"""

def run_benchmarks():
    """Run benchmarks and save results"""
    try:
        output_dir = Path("metrics")
        output_dir.mkdir(exist_ok=True)

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_dir_path = Path(temp_dir)
            json_output = temp_dir_path / "bench.json"
            
            # Create pytest.ini with proper async settings
            ini_file = temp_dir_path / "pytest.ini"
            ini_file.write_text(get_pytest_config(temp_dir_path))

            # Run pytest with both sync and async test support
            args = [
                "atlas/tests/test_prism/test_benchmarks.py",
                "atlas/tests/test_prism/test_dimension_analyzer.py",
                "-v",
                "--benchmark-only",
                "-m", "benchmark",
                "--benchmark-min-rounds=100",
                "--benchmark-disable-gc",
                "--benchmark-warmup=off",
                f"--benchmark-json={json_output}",
                "-p", "no:cov",
                "--asyncio-mode=auto",
                "--capture=no",  # Show output for debugging
                "-c", str(ini_file)
            ]
            
            # Run tests with event loop policy that works better with pytest
            asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())
            
            code = pytest.main(args)

            # Process results if any tests ran
            if code in (0, 1, 5):  # 0: success, 1: failed tests, 5: no collection
                if json_output.exists():
                    with open(json_output) as f:
                        bench_data = json.load(f)

                    benchmarks = [
                        parse_benchmark_stats(bench)
                        for bench in bench_data.get("benchmarks", [])
                    ]

                    if not benchmarks:
                        logger.error("No benchmark results collected")
                        return 1

                    # Save results
                    timestamp = datetime.now()
                    results_file = output_dir / f"bench_{timestamp.strftime('%Y%m%d_%H%M%S')}.json"

                    data = {
                        "timestamp": timestamp.isoformat(),
                        "benchmarks": benchmarks,
                        "summary": {
                            "total_tests": len(benchmarks),
                            "completed": len([b for b in benchmarks if b["status"] == "passed"]),
                            "failed": len([b for b in benchmarks if b["status"] != "passed"])
                        }
                    }

                    with open(results_file, 'w') as f:
                        json.dump(data, f, indent=2)

                    # Print summary
                    logger.info("\nBenchmark Results:")
                    for bench in benchmarks:
                        if bench["stats"]:
                            stats = bench["stats"]
                            logger.info(f"\n{bench['name']}:")
                            logger.info(f"  Mean: {format_number(stats['mean'])} ns")
                            logger.info(f"  Min: {format_number(stats['min'])} ns")
                            logger.info(f"  Max: {format_number(stats['max'])} ns")
                            logger.info(f"  Ops/sec: {format_number(stats['ops'])}")
                            logger.info(f"  Rounds: {stats['rounds']}")
                            logger.info(f"  Outliers: {stats['outliers']['mild']} mild, {stats['outliers']['severe']} severe")

                    logger.info(f"\nResults saved to: {results_file}")
                    return 0
                else:
                    logger.error("No benchmark results found")
                    return 1
            else:
                logger.error(f"Pytest failed with exit code: {code}")
                return code

    except Exception as e:
        logger.error(f"Error running benchmarks: {e}", exc_info=True)
        return 1

if __name__ == "__main__":
    sys.exit(run_benchmarks())