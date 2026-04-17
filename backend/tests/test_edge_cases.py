import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

@patch('routes.queue.get_db')
def test_join_queue_at_capacity(mock_get_db):
    """Verify that joining a queue fails when MAX_QUEUE_CAPACITY is reached."""
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    
    # Mock zone exists
    mock_zone_doc = MagicMock()
    mock_zone_doc.exists = True
    mock_zone_doc.to_dict.return_value = {"queue_paused": False, "type": "gate"}
    mock_db.collection.return_value.document.return_value.get.return_value = mock_zone_doc
    
    # Mock queue at capacity (200)
    mock_last_member = MagicMock()
    mock_last_member.to_dict.return_value = {"position": 200}
    mock_db.collection.return_value.document.return_value.collection.return_value.order_by.return_value.limit.return_value.get.return_value = [mock_last_member]
    
    response = client.post("/queue/join", json={
        "zone_id": "full_zone",
        "name": "Limit Tester",
        "phone": "0000000000"
    })
    
    assert response.status_code == 429
    assert "capacity" in response.json()["detail"].lower()

@patch('routes.queue.get_secret')
@patch('routes.queue.get_db')
def test_advance_empty_queue(mock_get_db, mock_get_secret):
    """Verify that advancing an empty queue handles the situation gracefully."""
    mock_get_secret.return_value = "staff_pass"
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    
    # Mock no members with 'your_turn' or 'waiting'
    mock_db.collection.return_value.document.return_value.collection.return_value.where.return_value.stream.return_value = []
    
    response = client.post("/queue/next", json={
        "zone_id": "empty_zone",
        "password": "staff_pass"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["advanced_member_id"] is None
    assert data["next_position"] is None

@patch('routes.queue.get_secret')
def test_advance_queue_null_password(mock_get_secret):
    """Verify that advancing a queue with a null password fails."""
    mock_get_secret.return_value = "staff_pass"
    
    response = client.post("/queue/next", json={
        "zone_id": "test_zone",
        "password": "" # Empty string/null
    })
    
    assert response.status_code == 401
    assert "Unauthorized" in response.json()["detail"]

@patch('routes.zones.get_db')
def test_report_crowd_invalid_type(mock_get_db):
    """Verify that reporting an invalid crowd type fails gracefully."""
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    
    # Mock zone exists
    mock_zone_doc = MagicMock()
    mock_zone_doc.exists = True
    mock_db.collection.return_value.document.return_value.get.return_value = mock_zone_doc

    response = client.post("/zones/report", json={
        "zone_id": "test_zone",
        "report_type": "very_crowded" # Invalid type
    })
    
    assert response.status_code == 400
    assert "report_type must be" in response.json()["detail"]

def test_root_health():
    """Verify that health checks are responsive for Cloud Run."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
