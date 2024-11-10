import time
from typing import Dict, Optional
from dataclasses import dataclass
import logging
from prometheus_client import Counter, Histogram

@dataclass
class APIMetrics:
    request_count: Counter
    request_latency: Histogram
    error_count: Counter

class TelemetryManager:
    def __init__(self):
        self.api_metrics = {
            'tavily': APIMetrics(
                request_count=Counter('tavily_requests_total', 'Total Tavily API requests'),
                request_latency=Histogram('tavily_request_latency_seconds', 'Tavily API latency'),
                error_count=Counter('tavily_errors_total', 'Total Tavily API errors')
            ),
            # Add other API metrics here
        }
        
    def track_request(self, api_name: str, duration: float, status_code: int):
        if metrics := self.api_metrics.get(api_name):
            metrics.request_count.inc()
            metrics.request_latency.observe(duration)
            if status_code >= 400:
                metrics.error_count.inc()
