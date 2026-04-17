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
