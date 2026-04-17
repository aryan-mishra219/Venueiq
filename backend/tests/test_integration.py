import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_join_queue_success(mock_db_fixture):
    """Verify that joining a queue correctly interacts with Firestore mocks via get_db."""
    
    # 1. Setup Mocks
    mock_zones_coll = MagicMock()
    mock_queues_coll = MagicMock()
    
    def collection_side_effect(name):
        if name == "zones": return mock_zones_coll
        return mock_queues_coll
    mock_db_fixture.collection.side_effect = collection_side_effect
    
    # Zone Doc Mock
    mock_zone_doc = MagicMock()
    mock_zone_doc.exists = True
    mock_zone_doc.to_dict.return_value = {"queue_paused": False, "type": "gate"}
    mock_zones_coll.document.return_value.get.return_value = mock_zone_doc
    
    # Queue Members Mock
    mock_queues_coll.document.return_value.collection.return_value.order_by.return_value.limit.return_value.get.return_value = []
    
    # 2. Execute Request
    response = client.post("/queue/join", json={
        "zone_id": "test_zone",
        "name": "Aryan",
        "phone": "9999999999",
        "email": "aryan@example.com"
    })
    
    # 3. Assertions
    assert response.status_code == 200
    data = response.json()
    assert "member_id" in data
    assert data["position"] == 1
    
    # Verify DB interactions
    assert mock_db_fixture.collection.called

def test_join_queue_paused(mock_db_fixture):
    """API should return 400 if the queue is paused."""
    
    # Setup Mocks
    mock_zone_doc = MagicMock()
    mock_zone_doc.exists = True
    mock_zone_doc.to_dict.return_value = {"queue_paused": True}
    mock_db_fixture.collection.return_value.document.return_value.get.return_value = mock_zone_doc
    
    # Execute Request
    response = client.post("/queue/join", json={
        "zone_id": "test_zone",
        "name": "Aryan",
        "phone": "9999999999"
    })
    
    assert response.status_code == 400
    assert "paused" in response.json()["detail"]

def test_get_all_venues_integration(mock_db_fixture):
    """Verify venue listing with mocked Firestore stream."""
    
    mock_doc = MagicMock()
    mock_doc.id = "venue_1"
    mock_doc.to_dict.return_value = {"name": "Test Venue"}
    mock_db_fixture.collection.return_value.stream.return_value = [mock_doc]
    
    response = client.get("/zones/venues/all")
    assert response.status_code == 200
    assert len(response.json()) == 1

@patch('routes.queue.get_secret')
def test_advance_queue_unauthorized(mock_get_secret, mock_db_fixture):
    """Verify that administrative actions fail without correct staff password."""
    mock_get_secret.return_value = "supersecret"
    
    response = client.post("/queue/next", json={
        "zone_id": "test_zone",
        "password": "wrongpassword"
    })
    
    assert response.status_code == 401
    assert "Unauthorized" in response.json()["detail"]

@patch('routes.queue.get_secret')
def test_advance_queue_authorized(mock_get_secret, mock_db_fixture):
    """Verify that administrative actions succeed with correct staff password."""
    mock_get_secret.return_value = "supersecret"
    
    # Mock the advancement logic
    mock_db_fixture.collection.return_value.document.return_value.collection.return_value.where.return_value.stream.return_value = []
    
    # Mock find next waiting person
    mock_db_fixture.collection.return_value.document.return_value.collection.return_value.where.return_value.order_by.return_value.limit.return_value.stream.return_value = []

    response = client.post("/queue/next", json={
        "zone_id": "test_zone",
        "password": "supersecret"
    })
    
    assert response.status_code == 200
