import os
import sys
from pathlib import Path
import json
from datetime import datetime
import plotly.graph_objects as go
from collections import defaultdict
import logging
from typing import Dict, List, Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

class TestAnalyzer:
    """Analyzer for functional test results"""
    def __init__(self):
        self.root_dir = Path(__file__).parent.parent.parent
        self.metrics_dir = self.root_dir / 'metrics'

    def load_coverage_data(self) -> List[Dict]:
        """Load coverage data from JSON files"""
        try:
            print("Loading coverage data from:", self.metrics_dir / 'prism')
            coverage_files = list((self.metrics_dir / 'prism').glob('coverage_*.json'))
            
            if not coverage_files:
                raise FileNotFoundError("No coverage files found in metrics/prism directory")
                
            print(f"Found {len(coverage_files)} coverage files")
            
            # Parse coverage results from files
            coverage_data = self.parse_coverage_results(coverage_files)
            
            # Sort by timestamp
            coverage_data.sort(key=lambda x: x['timestamp'])
            
            print(f"Loaded {len(coverage_data)} coverage entries")
            return coverage_data
            
        except Exception as e:
            print(f"Error loading coverage data: {str(e)}")
            import traceback
            print(traceback.format_exc())
            raise

    def parse_coverage_results(self, result_files: List[Path]) -> List[Dict]:
        """Parse coverage results from JSON files"""
        coverage_data = []
        for file in sorted(result_files):
            with open(file) as f:
                data = json.load(f)
                coverage_data.append({
                    'timestamp': datetime.fromisoformat(data['timestamp']),
                    'overall': data['overall_coverage'],
                    'components': data['components']
                })
        return coverage_data

    def generate_coverage_card(self, component: str, data: Dict) -> str:
        """Generate coverage card HTML for a component"""
        try:
            coverage = data['coverage']
            color = 'success' if coverage >= 80 else 'warning' if coverage >= 50 else 'danger'
            
            return f"""
            <div class="col-md-4 mb-4">
                <div class="card">
                    <div class="card-body">
                        <h5>{component}</h5>
                        <div class="progress mb-3">
                            <div class="progress-bar bg-{color}" 
                                 role="progressbar" 
                                 style="width: {coverage}%">
                            </div>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span>{coverage}% coverage</span>
                            <span>{data['covered_lines']}/{data['total_lines']} lines</span>
                        </div>
                    </div>
                </div>
            </div>
            """
        except Exception as e:
            print(f"Error generating card for {component}: {str(e)}")
            print(f"Data received: {data}")
            raise

    def generate_coverage_trend(self, coverage_data: List[Dict]) -> str:
        """Generate coverage trend plot"""
        timestamps = [d['timestamp'] for d in coverage_data]
        overall = [d['overall'] for d in coverage_data]
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=timestamps, y=overall,
            mode='lines+markers',
            name='Overall Coverage'
        ))
        
        # Add component traces
        components = coverage_data[0]['components'].keys()
        for component in components:
            values = [d['components'][component]['coverage'] for d in coverage_data]
            fig.add_trace(go.Scatter(
                x=timestamps, y=values,
                mode='lines+markers',
                name=f'{component} Coverage'
            ))
            
        fig.update_layout(
            title='Coverage Trends',
            xaxis_title='Date',
            yaxis_title='Coverage %',
            plot_bgcolor='#2d2d2d',
            paper_bgcolor='#2d2d2d',
            font=dict(color='#fff'),
            yaxis=dict(
                gridcolor='#404040',
                zerolinecolor='#404040',
                range=[0, 100]
            ),
            xaxis=dict(
                gridcolor='#404040',
                zerolinecolor='#404040'
            )
        )
        
        return fig.to_html(full_html=False, include_plotlyjs=True)

    def generate_dashboard(self, coverage_data: List[Dict]) -> str:
        """Generate HTML dashboard for coverage results"""
        try:
            latest = coverage_data[-1]
            coverage = latest['overall']
            status_color = 'success' if coverage >= 80 else 'warning' if coverage >= 60 else 'danger'
            
            # Generate coverage cards first
            coverage_cards = []
            for component, data in latest['components'].items():
                card = self.generate_coverage_card(component, data)
                coverage_cards.append(card)
            
            # Generate trend plot
            trend_plot = self.generate_coverage_trend(coverage_data)
            
            # Calculate trends
            if len(coverage_data) > 1:
                previous = coverage_data[-2]['overall']
                trend = coverage - previous
                trend_icon = "↗️" if trend > 0 else "↘️" if trend < 0 else "→"
                trend_text = f"{abs(trend):.1f}% {trend_icon}"
            else:
                trend_text = "N/A"

            html = f"""<!DOCTYPE html>
<html>
<head>
    <title>PRISM Test Coverage Dashboard</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        :root {{
            --primary: #4299e1;
            --success: #48bb78;
            --warning: #ecc94b;
            --danger: #f56565;
            --bg-dark: #1a202c;
            --card-bg: #2d3748;
        }}
        
        body {{ 
            background: var(--bg-dark);
            color: #fff;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            min-height: 100vh;
        }}
        
        .dashboard-header {{
            background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
            padding: 2rem 0;
            margin-bottom: 2rem;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }}
        
        .card {{ 
            background: var(--card-bg);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 1rem;
            transition: all 0.3s ease;
            overflow: hidden;
        }}
        
        .card:hover {{
            transform: translateY(-5px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.2);
        }}
        
        .stat-card {{
            background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
            padding: 1.5rem;
            border-radius: 1rem;
            backdrop-filter: blur(10px);
        }}
        
        .progress {{ 
            height: 0.6rem;
            background: rgba(255,255,255,0.1);
            border-radius: 1rem;
            overflow: hidden;
        }}
        
        .progress-bar {{
            transition: width 1.5s cubic-bezier(0.4, 0, 0.2, 1);
            border-radius: 1rem;
        }}
        
        .gradient-text {{
            background: linear-gradient(135deg, #4299e1 0%, #667eea 100%);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            font-weight: bold;
        }}
        
        .trend-badge {{
            padding: 0.5rem 1rem;
            border-radius: 2rem;
            font-size: 0.9rem;
            font-weight: 500;
            background: rgba(255,255,255,0.1);
        }}
        
        .trend-up {{ color: var(--success); }}
        .trend-down {{ color: var(--danger); }}
        
        .component-card {{
            height: 100%;
            backdrop-filter: blur(10px);
        }}
        
        .component-card .card-body {{
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }}
        
        .status-badge {{
            padding: 0.25rem 1rem;
            border-radius: 2rem;
            font-size: 0.8rem;
            font-weight: 500;
        }}
        
        .bg-success {{ background: var(--success) !important; }}
        .bg-warning {{ background: var(--warning) !important; }}
        .bg-danger {{ background: var(--danger) !important; }}
        
        @keyframes slideIn {{
            from {{ 
                opacity: 0;
                transform: translateY(20px);
            }}
            to {{ 
                opacity: 1;
                transform: translateY(0);
            }}
        }}
        
        .animate-slide-in {{
            animation: slideIn 0.6s ease-out forwards;
        }}
        
        .delay-1 {{ animation-delay: 0.1s; }}
        .delay-2 {{ animation-delay: 0.2s; }}
        .delay-3 {{ animation-delay: 0.3s; }}
        
        .coverage-summary {{
            background: linear-gradient(135deg, rgba(66, 153, 225, 0.1) 0%, rgba(102, 126, 234, 0.1) 100%);
            border-radius: 1rem;
            padding: 2rem;
            margin-bottom: 2rem;
        }}
        
        .trend-chart {{
            background: rgba(255,255,255,0.05);
            border-radius: 1rem;
            padding: 1rem;
            margin-top: 2rem;
        }}
    </style>
</head>
<body>
    <div class="dashboard-header">
        <div class="container">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h1 class="gradient-text mb-0">PRISM Coverage</h1>
                    <p class="text-muted mb-0">
                        <i class="fas fa-clock me-2"></i>
                        Updated {latest['timestamp'].strftime('%Y-%m-%d %H:%M')}
                    </p>
                </div>
                <div class="trend-badge">
                    <i class="fas fa-chart-line me-2"></i>
                    {trend_text}
                </div>
            </div>
        </div>
    </div>

    <div class="container">
        <div class="coverage-summary animate-slide-in">
            <div class="row align-items-center">
                <div class="col-md-4 text-center">
                    <h2 class="gradient-text display-4 mb-0">{coverage:.1f}%</h2>
                    <p class="text-muted">Overall Coverage</p>
                </div>
                <div class="col-md-8">
                    <div class="progress" style="height: 1rem;">
                        <div class="progress-bar bg-{status_color}" 
                             role="progressbar" 
                             style="width: {coverage}%">
                        </div>
                    </div>
                    <div class="d-flex justify-content-between mt-2">
                        <small class="text-muted">Target: 80%</small>
                        <small class="text-muted">{len(latest['components'])} Components</small>
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            {''.join(coverage_cards)}
        </div>
        
        <div class="trend-chart animate-slide-in delay-3">
            <h4 class="mb-4">Coverage Trends</h4>
            {trend_plot}
        </div>
    </div>

    <script>
        // Enhanced animations
        document.addEventListener('DOMContentLoaded', function() {{
            // Animate progress bars
            setTimeout(() => {{
                document.querySelectorAll('.progress-bar').forEach(bar => {{
                    const width = bar.style.width;
                    bar.style.width = '0';
                    setTimeout(() => bar.style.width = width, 100);
                }});
            }}, 200);
            
            // Add scroll reveal effect
            const observer = new IntersectionObserver((entries) => {{
                entries.forEach(entry => {{
                    if (entry.isIntersecting) {{
                        entry.target.classList.add('animate-slide-in');
                    }}
                }});
            }}, {{ threshold: 0.1 }});
            
            document.querySelectorAll('.card').forEach(card => {{
                observer.observe(card);
            }});
        }});
    </script>
</body>
</html>"""
            return html
            
        except Exception as e:
            print(f"Error in generate_dashboard: {str(e)}")
            print("Latest data structure:", latest)
            import traceback
            print(traceback.format_exc())
            raise

    def run(self):
        """Run the analysis"""
        try:
            print("1. Starting analysis...")
            
            print("2. Loading coverage data...")
            coverage_data = self.load_coverage_data()
            print(f"3. Loaded {len(coverage_data)} coverage entries")
            
            print("4. Generating dashboard...")
            html = self.generate_dashboard(coverage_data)
            print("5. Dashboard generated")
            
            print("6. Writing to file...")
            output_path = Path('metrics/prism/dashboard.html')
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(html)
            print(f"\n✨ Dashboard generated successfully!")
            print(f"\n📊 View dashboard at:\nfile://{output_path.absolute()}")
            
        except Exception as e:
            print(f"\n❌ Error during analysis: {repr(str(e))}")
            import traceback
            print("\nFull traceback:")
            print(traceback.format_exc())
            raise

def main():
    """Entry point for test analysis"""
    try:
        print("Starting main function...")
        analyzer = TestAnalyzer()
        try:
            print("Running analyzer...")
            analyzer.run()
            print("Analysis completed successfully")
        except Exception as e:
            print("\n❌ Detailed error information:")
            import traceback
            print(traceback.format_exc())
            print(f"\nError message: {str(e)}")
            print(f"Error type: {type(e)}")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Analysis interrupted by user")
        sys.exit(1)
    except Exception as e:
        print("\n❌ Unexpected error in main:")
        import traceback
        print(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    main()