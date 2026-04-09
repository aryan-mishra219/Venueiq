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
        else:
            # Option 2: Use environment variable with JSON string
            cred_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
            if cred_json:
                cred_dict = json.loads(cred_json)
                cred = credentials.Certificate(cred_dict)
            else:
                # Option 3: Use individual env vars (for Render deployment)
                cred_dict = {
                    "type": "service_account",
                    "project_id": os.getenv("FIREBASE_PROJECT_ID", "your-project-id"),
                    "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID", "key-id"),
                    "private_key": os.getenv("FIREBASE_PRIVATE_KEY", "-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n").replace("\\n", "\n"),
                    "client_email": os.getenv("FIREBASE_CLIENT_EMAIL", "firebase-adminsdk@your-project.iam.gserviceaccount.com"),
                    "client_id": os.getenv("FIREBASE_CLIENT_ID", "123456789"),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "client_x509_cert_url": os.getenv("FIREBASE_CERT_URL", "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk%40your-project.iam.gserviceaccount.com")
                }
                cred = credentials.Certificate(cred_dict)
        
        firebase_admin.initialize_app(cred)
    
    return firestore.client()

# Global Firestore client
db = initialize_firebase()
