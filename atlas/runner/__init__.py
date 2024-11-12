"""Atlas tools package initialization"""
from .test_analysis import BenchmarkAnalyzer, main as analyze_benchmarks

__all__ = [
    'BenchmarkAnalyzer',
    'analyze_benchmarks'
]