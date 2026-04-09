from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from firebase_admin_setup import db
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

router = APIRouter(prefix="/zones", tags=["zones"])


class CrowdReport(BaseModel):
    zone_id: str
    report_type: str  # "crowded" | "clear"


@router.get("/all")
async def get_all_zones():
    """Return all zones with current crowd scores."""
    try:
        zones_ref = db.collection("zones")
        docs = zones_ref.stream()
        
        zones = []
        for doc in docs:
            zone_data = doc.to_dict()
            zone_data["id"] = doc.id
            zones.append(zone_data)
        
        return zones
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/report")
async def report_crowd(report: CrowdReport):
    """Report crowd level for a zone. Increments or decrements crowd_score."""
    try:
        zone_ref = db.collection("zones").document(report.zone_id)
        zone_doc = zone_ref.get()
        
        if not zone_doc.exists:
            raise HTTPException(status_code=404, detail="Zone not found")
        
        zone_data = zone_doc.to_dict()
        current_score = zone_data.get("crowd_score", 0)
        
        if report.report_type == "crowded":
            new_score = min(current_score + 1, 10)
        elif report.report_type == "clear":
            new_score = max(current_score - 1, 0)
        else:
            raise HTTPException(status_code=400, detail="report_type must be 'crowded' or 'clear'")
        
        zone_ref.update({
            "crowd_score": new_score,
            "last_updated": SERVER_TIMESTAMP
        })
        
        return {"new_crowd_score": new_score}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/seed")
async def seed_zones():
    """Seed initial zone data into Firestore. Call once for setup."""
    zones = [
        {
            "name": "Gate A",
            "crowd_score": 2,
            "coordinates": [40.7505, -73.9934],
            "type": "gate",
            "last_updated": SERVER_TIMESTAMP
        },
        {
            "name": "Gate B",
            "crowd_score": 5,
            "coordinates": [40.7515, -73.9934],
            "type": "gate",
            "last_updated": SERVER_TIMESTAMP
        },
        {
            "name": "Gate C",
            "crowd_score": 8,
            "coordinates": [40.7525, -73.9934],
            "type": "gate",
            "last_updated": SERVER_TIMESTAMP
        },
        {
            "name": "Food Court 1",
            "crowd_score": 3,
            "coordinates": [40.7510, -73.9924],
            "type": "food",
            "last_updated": SERVER_TIMESTAMP
        },
        {
            "name": "Food Court 2",
            "crowd_score": 7,
            "coordinates": [40.7520, -73.9924],
            "type": "food",
            "last_updated": SERVER_TIMESTAMP
        },
        {
            "name": "Restrooms North",
            "crowd_score": 4,
            "coordinates": [40.7508, -73.9914],
            "type": "restroom",
            "last_updated": SERVER_TIMESTAMP
        },
        {
            "name": "Restrooms South",
            "crowd_score": 6,
            "coordinates": [40.7522, -73.9914],
            "type": "restroom",
            "last_updated": SERVER_TIMESTAMP
        },
        {
            "name": "Parking Lot",
            "crowd_score": 1,
            "coordinates": [40.7500, -73.9944],
            "type": "parking",
            "last_updated": SERVER_TIMESTAMP
        }
    ]
    
    try:
        for zone in zones:
            zone_id = zone["name"].lower().replace(" ", "_")
            db.collection("zones").document(zone_id).set(zone)
        
        return {"success": True, "message": f"Seeded {len(zones)} zones"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
