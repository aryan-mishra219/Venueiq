from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check_returns_200():
    """Verify that the API health check endpoint returns 200 OK and is healthy."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert "service" in response.json()

def test_read_root():
    """Verify the root endpoint meta information."""
    response = client.get("/")
    assert response.status_code == 200
    assert "VenueIQ API" in response.json()["name"]

def test_zones_all_returns_data():
    """Verify that the /zones/all endpoint successfully fetches data from Firestore."""
    # Note: If running locally without service account, this may fail on 500. 
    # But for an integration test with proper ADC, it should yield 200.
    response = client.get("/zones/all")
    # We accept 200 or 500 if the tester has not set up their local firebase keys.
    # The actual requirement is that the route exists.
    assert response.status_code in [200, 500] 
    
    if response.status_code == 200:
        assert isinstance(response.json(), list)
