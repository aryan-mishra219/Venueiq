"""
VenueIQ Database Seeder
Automates the initialization of venues and zones in Firestore for stadium operations.
Ensures a consistent baseline state for competition demonstrations.
"""
import requests
import os
from logger import logger
from secret_manager import get_secret

def seed_database():
    """
    Seeds the production database with 10 major Indian stadium venues.
    Requires staff authentication via STAFF_PASSWORD.
    """
    logger.info("🚀 Initializing VenueIQ Seeder...")
    
    api_url = os.getenv("API_URL", "http://localhost:8000")
    staff_pass = get_secret("STAFF_PASSWORD", "venue2024")

    try:
        response = requests.post(
            f"{api_url}/zones/seed",
            json={"password": staff_pass},
            timeout=10
        )
        
        if response.status_code == 200:
            logger.info("✅ SUCCESS: Database seeded with 10 Indian venues and their zones!")
        elif response.status_code == 401:
            logger.error("❌ ERROR: Unauthorized. Check STAFF_PASSWORD configuration.")
        else:
            logger.error(f"❌ ERROR: Received status {response.status_code} - {response.text}")
            
    except Exception as e:
        logger.error(f"❌ CONNECTION ERROR: Failed to reach API at {api_url}: {e}")

if __name__ == "__main__":
    seed_database()
