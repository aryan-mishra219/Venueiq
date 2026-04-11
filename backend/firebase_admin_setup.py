import firebase_admin
from firebase_admin import credentials, firestore
import os
import json

def initialize_firebase():
    """Initialize Firebase Admin SDK with service account credentials."""
    if not firebase_admin._apps:
        # Option 1: Use service account JSON file
        cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")
        
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            # Option 2: Use environment variable with JSON string
            cred_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
            if cred_json:
                cred_dict = json.loads(cred_json)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
            else:
                # Option 3: Fall back to Application Default Credentials (ADC)
                # This works automatically on Cloud Run.
                firebase_admin.initialize_app()
    
    return firestore.client()

# Global Firestore client
db = initialize_firebase()
