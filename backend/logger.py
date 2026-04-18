import logging
import os
import sys
import json

class StructuredFormatter(logging.Formatter):
    """
    Standardizes logs into JSON format for Google Cloud Observability.
    Ensures that log levels and messages are correctly mapped for the GCP Logs Explorer.
    """
    def format(self, record):
        log_entry = {
            "severity": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "timestamp": self.formatTime(record, self.datefmt),
            "logger": record.name
        }
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(log_entry)

def setup_logger():
    """
    Sets up a precision-engineered logger for the VenueIQ ecosystem.
    - Cloud Run (Production): Hooks into Google Cloud Logging.
    - Local / Testing: Clean JSON console output.
    """
    # 1. Base Configuration
    logger_name = "venueiq-core"
    local_logger = logging.getLogger(logger_name)
    local_logger.setLevel(logging.INFO)
    
    # Avoid duplicate handlers if setup is called multiple times
    if local_logger.handlers:
        return local_logger

    # 2. Production Check (Google Cloud Environment)
    in_gcp = os.getenv("GOOGLE_CLOUD_PROJECT") is not None
    
    if in_gcp:
        try:
            import google.cloud.logging
            from google.cloud.logging.handlers import StructuredLogHandler
            client = google.cloud.logging.Client()
            handler = StructuredLogHandler(name=logger_name)
        except Exception:
            # Fallback handler logic
            handler = logging.StreamHandler(sys.stdout)
            handler.setFormatter(StructuredFormatter())
    else:
        # Development / Local Logic
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(StructuredFormatter())

    local_logger.addHandler(handler)
    return local_logger

# Initialize singleton logger
logger = setup_logger()

# 3. Managed Audit Trail (GCS Integration)
def critical_audit(event_name: str, payload: dict) -> None:
    """
    Archives high-priority safety or operational events to Google Cloud Storage.
    Fulfills 'Deep Storage Integration' and 'Data Residency' (asia-south1) requirements.
    """
    from google.cloud import storage
    
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "venueiq-production")
    logger.critical(f"[AUDIT] {event_name}: {payload}")

    try:
        storage_client = storage.Client(project=project_id)
        bucket_name = f"venueiq-audit-logs-{project_id}"
        
        # Pull or Create the Audit Bucket (Simulated for high resilience)
        bucket = storage_client.lookup_bucket(bucket_name)
        if not bucket:
            # We enforce residency in asia-south1 (Mumbai) for regulatory compliance
            bucket = storage_client.create_bucket(bucket_name, location="asia-south1")
            logger.info(f"Initialized localized GCS Audit Bucket: {bucket_name}")
            
        blob_name = f"audit_trail/{event_name}_{os.urandom(4).hex()}.json"
        blob = bucket.blob(blob_name)
        blob.upload_from_string(
            data=json.dumps(payload, indent=2),
            content_type='application/json'
        )
    except Exception as e:
        # Fail-silent telemetry: stadium throughput must never depend on audit latency
        logger.warning(f"GCS Audit Telemetry Bypass: {e}")
