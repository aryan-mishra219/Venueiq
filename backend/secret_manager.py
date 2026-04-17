import functools
import os
from google.cloud import secretmanager
from logger import logger

@functools.lru_cache(maxsize=32)
def get_secret(secret_id, default=None):
    """
    Retrieves a sensitive credential from Google Cloud Secret Manager (ASM) 
    with a prioritized fallback to the system environment.
    
    Includes an LRU cache to minimize API latency and operational costs.
    """
    if os.getenv("PYTEST_CURRENT_TEST"):
        return os.getenv(secret_id, default)

    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    
    if project_id:
        try:
            client = secretmanager.SecretManagerServiceClient()
            name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
            
            response = client.access_secret_version(
                request={"name": name},
                timeout=5.0
            )
            return response.payload.data.decode("UTF-8")
        except Exception as e:
            logger.warning(f"Metadata Access Issue ({secret_id}): {str(e)}. Utilizing environment fallback.")

    # 3. Final Fallback: Standard OS Environment (e.g. injected at runtime by Cloud Run)
    return os.getenv(secret_id, default)

def get_required_secret(secret_id):
    """
    Fetches a secret or raises an error if not found.
    Ensures 'Safe-to-Boot' by failing fast if critical dependencies are missing.
    """
    val = get_secret(secret_id)
    if val is None:
        logger.error(f"CRITICAL: Missing required secret {secret_id}")
        raise ValueError(f"Required secret {secret_id} not found in environment or ASM.")
    return val
