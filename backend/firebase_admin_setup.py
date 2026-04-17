import firebase_admin
from firebase_admin import credentials, firestore
import os
import json
from secret_manager import get_secret
from logger import logger

def initialize_firebase():
    """
    Initialize Firebase Admin SDK.
    Prioritizes ASM-defined configuration, falling back to ADC for 
    transparent authentication in Cloud Run.
    """
    if not firebase_admin._apps:
        # Check for service account JSON in Secret Manager (optional enhancement)
        # For Cloud Run, simply initializing with ADC is the best practice.
        try:
            # 1. Resolve Firebase Project ID (The target for Firestore)
            # We check secrets for FIREBASE_PROJECT_ID first, then env, then fallback to host project
            firebase_project = get_secret("FIREBASE_PROJECT_ID") or get_secret("GOOGLE_CLOUD_PROJECT")
            
            if firebase_project:
                cred = credentials.ApplicationDefault()
                firebase_admin.initialize_app(cred, {
                    'projectId': firebase_project,
                })
                logger.info(f"Firebase Admin initialized for project: {firebase_project}")
            else:
                # Fallback to standard initialization (relies on ADC environment)
                firebase_admin.initialize_app()
                logger.info("Firebase Admin initialized using Application Default Credentials")
        except Exception as e:
            logger.error(f"Critical failure during Firebase initialization: {e}")
            raise e
    
    return firestore.client()

# Lazy Firestore client
_db = None

def get_db():
    """Returns the initialized Firestore client, creating it if necessary."""
    global _db
    if _db is None:
        _db = initialize_firebase()
    return _db
