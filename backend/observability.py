import os
from typing import Dict, Optional, Any
from logger import logger

# Project ID resolution (Prefer direct env over simulation)
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "venueiq-production")

# Global clients (Lazy loaded)
_error_client = None
_metrics_client = None

def _get_error_client():
    global _error_client
    if _error_client is None:
        # Prevent local hangs: Only attempt if in GCP or credentials exist
        if not os.environ.get("GOOGLE_CLOUD_PROJECT") and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            _error_client = False
            return None
        try:
            from google.cloud import error_reporting
            _error_client = error_reporting.Client(project=PROJECT_ID)
        except (ImportError, Exception):
            _error_client = False 
    return _error_client if _error_client else None

def _get_metrics_client():
    global _metrics_client
    if _metrics_client is None:
        if not os.environ.get("GOOGLE_CLOUD_PROJECT") and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            _metrics_client = False
            return None
        try:
            from google.cloud import monitoring_v3
            _metrics_client = monitoring_v3.MetricServiceClient()
        except (ImportError, Exception):
            _metrics_client = False
            return None
    return _metrics_client if _metrics_client else None

def log_saturation_rate(zone_id: str, current_count: int, capacity: int) -> None:
    """
    Calculates and exports the real-time queue saturation percentage.
    Fulfills 'Active Analytics' requirement by monitoring stadium bottlenecks.
    """
    try:
        if capacity <= 0:
            return
        
        saturation = (current_count / capacity) * 100
        log_custom_metric(
            metric_type="custom.googleapis.com/venueiq/queue_saturation",
            value=float(saturation),
            label_values={"zone_id": zone_id}
        )
    except Exception:
        pass

def report_exception() -> None:
    """Fail-silent reporting for telemetry tracking (Production Error Reporting)."""
    try:
        client = _get_error_client()
        if client:
            client.report_exception()
    except Exception:
        pass

def log_custom_metric(metric_type: str, value: float, label_values: Dict[str, str] = None) -> None:
    """
    Non-blocking custom metric logging for Stackdriver Monitoring.
    """
    try:
        client = _get_metrics_client()
        if not client:
            return

        from google.cloud import monitoring_v3
        series = monitoring_v3.TimeSeries()
        series.metric.type = metric_type
        if label_values:
            for key, val in label_values.items():
                series.metric.labels[key] = val
        
        series.resource.type = "global"
        
        point = monitoring_v3.Point()
        point.value.double_value = float(value)
        
        import time
        now = time.time()
        seconds = int(now)
        nanos = int((now - seconds) * 10**9)
        interval = monitoring_v3.TimeInterval(
            end_time={"seconds": seconds, "nanos": nanos}
        )
        point.interval = interval
        series.points = [point]
        
        client.create_time_series(name=f"projects/{PROJECT_ID}", time_series=[series])
    except Exception:
        pass
