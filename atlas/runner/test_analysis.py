import os
import sys
from pathlib import Path
import json
from datetime import datetime
import jinja2
import plotly.graph_objects as go
from collections import defaultdict
import logging
from typing import Dict, List, Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

class BenchmarkAnalyzer:
    """Analyzer for benchmark results"""
    def __init__(self):
        self.root_dir = Path(__file__).parent.parent.parent
        self.metrics_dir = self.root_dir / 'metrics'

    def load_benchmark_files(self) -> List[Dict]:
        """Load and sort benchmark files"""
        benchmark_files = sorted(self.metrics_dir.glob('bench_*.json'))
        results = []
        
        for file in benchmark_files:
            try:
                with open(file) as f:
                    data = json.load(f)
                    data['file_date'] = datetime.fromisoformat(data['timestamp'])
                    results.append(data)
            except Exception as e:
                logger.error(f"Error loading {file}: {e}")
                
        return sorted(results, key=lambda x: x['file_date'])

    @staticmethod
    def format_time(ns: float) -> str:
        """Format nanoseconds into human readable time"""
        if ns >= 1_000_000:  # ms
            return f"{ns/1_000_000:.2f}ms"
        elif ns >= 1_000:  # μs
            return f"{ns/1_000:.2f}μs"
        else:
            return f"{ns:.2f}ns"

    @staticmethod
    def format_ops(ops: float) -> str:
        """Format operations/second in human readable format"""
        if ops >= 1_000_000:
            return f"{ops/1_000_000:.2f}M ops/s"
        elif ops >= 1_000:
            return f"{ops/1_000:.2f}K ops/s"
        else:
            return f"{ops:.2f} ops/s"

    def generate_dashboard(self, data: List[Dict]) -> str:
        """Generate HTML dashboard"""
        latest_results = data[-1].get('benchmarks', [])
        
        # Generate score cards
        score_cards = []
        for result in latest_results:
            score_cards.append(self.generate_score_card(result))
            
        # Generate timeline plot
        timeline_plot = self.generate_timeline_plot(data)
        
        # Generate summary stats
        summary_stats = self.calculate_summary_stats(latest_results)
        
        template = self.get_dashboard_template()
        return jinja2.Template(template).render(
            score_cards=''.join(score_cards),
            timeline_plot=timeline_plot,
            summary=summary_stats,
            timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        )

    def generate_score_card(self, result: Dict) -> str:
        """Generate a single score card"""
        stats = result.get('stats', {})
        
        # Calculate performance score
        mean = stats.get('mean', 0)
        ops = stats.get('ops', 0)
        perf_score = self.calculate_performance_score(mean, ops)
        
        # Calculate stability score
        stability_score = self.calculate_stability_score(stats)
        
        return f"""
        <div class="score-card">
            <div class="card-header">
                <h3>{result['name']}</h3>
                <div class="status status-{result['status']}">{result['status'].upper()}</div>
            </div>
            <div class="metrics">
                <div class="metric">
                    <label>Mean Time</label>
                    <value>{self.format_time(mean)}</value>
                </div>
                <div class="metric">
                    <label>Operations/sec</label>
                    <value>{self.format_ops(ops)}</value>
                </div>
                <div class="metric">
                    <label>Performance Score</label>
                    <value class="score score-{self.get_score_class(perf_score)}">{perf_score}%</value>
                </div>
                <div class="metric">
                    <label>Stability Score</label>
                    <value class="score score-{self.get_score_class(stability_score)}">{stability_score}%</value>
                </div>
            </div>
            <div class="details">
                <div>Rounds: {stats.get('rounds', 0)}</div>
                <div>Outliers: {stats.get('outliers', {}).get('mild', 0)} mild, {stats.get('outliers', {}).get('severe', 0)} severe</div>
            </div>
        </div>
        """

    def generate_timeline_plot(self, data: List[Dict]) -> str:
        """Generate timeline plot"""
        fig = go.Figure()
        
        # Collect data for each test
        test_data = defaultdict(lambda: {'dates': [], 'means': [], 'ops': []})
        
        for entry in data:
            date = entry['file_date']
            for test in entry.get('benchmarks', []):
                name = test['name']
                stats = test.get('stats', {})
                
                test_data[name]['dates'].append(date)
                test_data[name]['means'].append(stats.get('mean', 0))
                test_data[name]['ops'].append(stats.get('ops', 0))
        
        # Create traces
        for name, values in test_data.items():
            fig.add_trace(go.Scatter(
                x=values['dates'],
                y=values['ops'],
                name=name,
                mode='lines+markers',
                hovertemplate='%{y:.2f} ops/sec<br>%{x|%Y-%m-%d %H:%M}<extra></extra>'
            ))
        
        fig.update_layout(
            template='plotly_dark',
            title='Performance Over Time',
            xaxis_title='Date',
            yaxis_title='Operations per Second',
            showlegend=True,
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0.1)',
            font=dict(color='white')
        )
        
        return fig.to_html(include_plotlyjs=False, full_html=False)

    def calculate_summary_stats(self, results: List[Dict]) -> Dict:
        """Calculate summary statistics"""
        total = len(results)
        passed = sum(1 for r in results if r['status'] == 'passed')
        
        means = []
        ops_rates = []
        for result in results:
            stats = result.get('stats', {})
            if stats:
                means.append(stats.get('mean', 0))
                ops_rates.append(stats.get('ops', 0))
        
        return {
            'total_tests': total,
            'passed_tests': passed,
            'failed_tests': total - passed,
            'pass_rate': round(passed / total * 100 if total > 0 else 0, 1),
            'avg_mean': self.format_time(sum(means) / len(means)) if means else 'N/A',
            'avg_ops': self.format_ops(sum(ops_rates) / len(ops_rates)) if ops_rates else 'N/A'
        }

    @staticmethod
    def calculate_performance_score(mean: float, ops: float) -> float:
        """Calculate performance score"""
        if mean < 1000:  # Async operations (<1μs)
            return min(100, ops / 2_000_000 * 100)
        elif mean < 50000:  # CPU operations (<50μs)
            return min(100, ops / 50_000 * 100)
        else:  # Memory operations
            return min(100, ops / 10_000 * 100)

    @staticmethod
    def calculate_stability_score(stats: Dict) -> float:
        """Calculate stability score"""
        rounds = stats.get('rounds', 0)
        if not rounds:
            return 0
            
        outliers = stats.get('outliers', {})
        mild = outliers.get('mild', 0)
        severe = outliers.get('severe', 0)
        
        return round(100 - (mild + severe * 2) / rounds * 100, 1)

    @staticmethod
    def get_score_class(score: float) -> str:
        """Get CSS class for score"""
        if score >= 80:
            return 'high'
        elif score >= 50:
            return 'medium'
        return 'low'

    @staticmethod
    def get_dashboard_template() -> str:
        """Get dashboard HTML template"""
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Benchmark Dashboard</title>
            <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
            <style>
                body {
                    font-family: system-ui, -apple-system, sans-serif;
                    background: #1a1a1a;
                    color: #ffffff;
                    margin: 0;
                    padding: 20px;
                }
                
                h1, h2 {
                    color: #00ff9d;
                    margin-bottom: 20px;
                }
                
                .dashboard {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                
                .score-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                    margin-bottom: 40px;
                }
                
                .score-card {
                    background: #2d2d2d;
                    border-radius: 10px;
                    padding: 20px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }
                
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                
                .card-header h3 {
                    margin: 0;
                    color: #00ff9d;
                }
                
                .metrics {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 15px;
                }
                
                .metric {
                    background: #222;
                    padding: 10px;
                    border-radius: 5px;
                }
                
                .metric label {
                    display: block;
                    color: #888;
                    font-size: 0.9em;
                    margin-bottom: 5px;
                }
                
                .metric value {
                    display: block;
                    font-size: 1.1em;
                    font-weight: bold;
                }
                
                .score-high { color: #00ff9d; }
                .score-medium { color: #ffd700; }
                .score-low { color: #ff4444; }
                
                .status {
                    padding: 5px 10px;
                    border-radius: 5px;
                    font-size: 0.9em;
                    font-weight: bold;
                }
                
                .status-passed { background: #00ff9d; color: #000; }
                .status-failed { background: #ff4444; color: #fff; }
                
                .details {
                    color: #888;
                    font-size: 0.9em;
                }
                
                .plot-container {
                    background: #2d2d2d;
                    border-radius: 10px;
                    padding: 20px;
                    margin-bottom: 40px;
                }
                
                .summary {
                    background: #2d2d2d;
                    border-radius: 10px;
                    padding: 20px;
                }
                
                .timestamp {
                    color: #888;
                    font-size: 0.9em;
                    text-align: right;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="dashboard">
                <h1>Benchmark Dashboard</h1>
                
                <div class="score-cards">
                    {{ score_cards | safe }}
                </div>
                
                <div class="plot-container">
                    {{ timeline_plot | safe }}
                </div>
                
                <div class="summary">
                    <h2>Summary</h2>
                    <div class="metrics">
                        <div class="metric">
                            <label>Total Tests</label>
                            <value>{{ summary.total_tests }}</value>
                        </div>
                        <div class="metric">
                            <label>Pass Rate</label>
                            <value class="score-{{ 'high' if summary.pass_rate >= 80 else 'medium' if summary.pass_rate >= 50 else 'low' }}">
                                {{ summary.pass_rate }}%
                            </value>
                        </div>
                        <div class="metric">
                            <label>Average Response Time</label>
                            <value>{{ summary.avg_mean }}</value>
                        </div>
                        <div class="metric">
                            <label>Average Operations/sec</label>
                            <value>{{ summary.avg_ops }}</value>
                        </div>
                    </div>
                </div>
                
                <div class="timestamp">
                    Generated: {{ timestamp }}
                </div>
            </div>
        </body>
        </html>
        """

    def analyze_benchmarks(self):
        """Main analysis function"""
        logger.info("\n🔍 Atlas Benchmark Analysis Dashboard Generator")
        logger.info("=" * 50)
        
        logger.info(f"\n📂 Checking metrics directory: {self.metrics_dir}")
        
        if not self.metrics_dir.exists():
            logger.error("❌ No metrics directory found")
            logger.error("\nTo generate metrics, run:")
            logger.error("  ./venv_fresh/bin/python -m atlas.tools.run_benchmarks")
            return
            
        data = self.load_benchmark_files()
        if not data:
            logger.error("❌ No benchmark files found")
            logger.error("\nTo generate benchmarks, run:")
            logger.error("  ./venv_fresh/bin/python -m atlas.tools.run_benchmarks")
            return

        logger.info(f"✅ Found {len(data)} benchmark files")
        
        latest = data[-1]
        total_tests = len(latest.get('benchmarks', []))
        passed_tests = len([b for b in latest.get('benchmarks', []) if b.get('status') == 'passed'])
        
        logger.info("\n📊 Latest Benchmark Summary:")
        logger.info(f"   • Total Tests: {total_tests}")
        logger.info(f"   • Passed: {passed_tests}")
        logger.info(f"   • Failed: {total_tests - passed_tests}")
        
        logger.info("\n🎨 Generating dashboard...")
        dashboard_dir = self.metrics_dir / 'dashboard'
        
        try:
            dashboard_dir.mkdir(exist_ok=True)
            output_file = dashboard_dir / 'dashboard.html'
            
            dashboard = self.generate_dashboard(data)
            with open(output_file, 'w') as f:
                f.write(dashboard)
                
            logger.info("✅ Dashboard generated successfully")
            logger.info("\n🌐 View your dashboard:")
            logger.info(f"   file://{output_file.absolute()}")
            logger.info("\nOr open with command:")
            logger.info(f"   open {output_file}")
            
            # Print quick summary
            logger.info("\n📈 Performance Overview:")
            for bench in latest.get('benchmarks', []):
                stats = bench.get('stats', {})
                if stats:
                    name = bench['name'].replace('test_', '')
                    ops = stats.get('ops', 0)
                    mean = stats.get('mean', 0)
                    logger.info(f"   • {name:25} {self.format_time(mean):>10} ({self.format_ops(ops)})")
            
            logger.info("\n✨ Dashboard is ready for viewing!")
            
        except Exception as e:
            logger.error(f"\n❌ Error generating dashboard: {e}")
            raise

def check_dependencies() -> bool:
    """Check if required packages are installed"""
    required = {
        'plotly': 'plotly',
        'jinja2': 'jinja2'
    }
    missing = []
    
    for package, install_name in required.items():
        try:
            __import__(package)
        except ImportError:
            missing.append(install_name)
    
    if missing:
        logger.error("\n❌ Missing required packages:")
        logger.error("   " + ", ".join(missing))
        logger.error("\nInstall with:")
        logger.error(f"   pip install {' '.join(missing)}")
        return False
    return True

def main():
    """Entry point for benchmark analysis"""
    try:
        # Check dependencies first
        if not check_dependencies():
            sys.exit(1)
            
        analyzer = BenchmarkAnalyzer()
        analyzer.analyze_benchmarks()
        
    except KeyboardInterrupt:
        logger.info("\n⚠️  Analysis interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n❌ Error during analysis: {e}")
        logger.error("\nFor detailed error information, run with:")
        logger.error("   python -m atlas.tools.test_analysis --debug")
        sys.exit(1)

if __name__ == "__main__":
    main()