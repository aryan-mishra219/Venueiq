import pytest
from unittest.mock import MagicMock, AsyncMock
import sys
import os

# 1. Path resolution
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

# 2. IMMEDIATE Module-level Mocking (Executes on import of conftest.py)
# This prevents 403/Forbidden errors during pytest collection
mock_logging = MagicMock()
mock_secret = MagicMock()
mock_firebase = MagicMock()

sys.modules["google.cloud.logging"] = mock_logging
sys.modules["google.cloud.secretmanager"] = mock_secret
sys.modules["firebase_admin"] = mock_firebase
sys.modules["firebase_admin.credentials"] = MagicMock()
sys.modules["firebase_admin.firestore"] = MagicMock()

# Mock AI Service with AsyncMock to prevent await errors
mock_ai_instance = MagicMock()
mock_ai_instance.predict_wait_time = AsyncMock(return_value=12.0)
mock_ai_instance.analyze_crowd_density = AsyncMock(return_value=1.0)

mock_ai_module = MagicMock()
mock_ai_module.ai_service = mock_ai_instance

sys.modules["services.ai_service"] = mock_ai_module
sys.modules["backend.services.ai_service"] = mock_ai_module

# 3. Fixtures for finer control
@pytest.fixture(autouse=True)
def mock_db_fixture(monkeypatch):
    """
    Ensure get_db() always returns a mock during tests.
    Monkeypatches all possible locations where get_db might be used.
    """
    mock_firestore = MagicMock()
    
    # 1. Patch the source
    monkeypatch.setattr("firebase_admin_setup.get_db", lambda: mock_firestore)
    
    # 2. Patch the routes (because they use 'from X import get_db')
    monkeypatch.setattr("routes.queue.get_db", lambda: mock_firestore, raising=False)
    monkeypatch.setattr("routes.zones.get_db", lambda: mock_firestore, raising=False)
    monkeypatch.setattr("routes.announcements.get_db", lambda: mock_firestore, raising=False)
    
    return mock_firestore
