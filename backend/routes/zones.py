from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from firebase_admin_setup import db
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

router = APIRouter(prefix="/zones", tags=["zones"])


class CrowdReport(BaseModel):
    zone_id: str
    report_type: str  # "crowded" | "clear"


@router.get("/venues/all")
async def get_all_venues():
    """Return all venues in the system."""
    try:
        venues_ref = db.collection("venues")
        docs = venues_ref.stream()
        
        venues = []
        for doc in docs:
            venue_data = doc.to_dict()
            venue_data["id"] = doc.id
            venues.append(venue_data)
        
        return venues
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all")
async def get_all_zones(venue_id: str = None):
    """Return all zones, optionally filtered by venue_id."""
    try:
        zones_ref = db.collection("zones")
        if venue_id:
            docs = zones_ref.where("venue_id", "==", venue_id).stream()
        else:
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
async def seed_venues_and_zones():
    """Seed initial data for 10 Indian venues and their zones into Firestore."""
    venues_data = [
        {"id": "modi_stadium", "name": "Narendra Modi Stadium", "city": "Ahmedabad", "center": [23.0919, 72.5975]},
        {"id": "bharat_mandapam", "name": "Bharat Mandapam", "city": "New Delhi", "center": [28.6127, 77.2431]},
        {"id": "eden_gardens", "name": "Eden Gardens", "city": "Kolkata", "center": [22.5646, 88.3433]},
        {"id": "wankhede_stadium", "name": "Wankhede Stadium", "city": "Mumbai", "center": [18.9389, 72.8258]},
        {"id": "chinnaswamy_stadium", "name": "M. Chinnaswamy Stadium", "city": "Bengaluru", "center": [12.9784, 77.5997]},
        {"id": "hpca_stadium", "name": "HPCA Stadium", "city": "Dharamshala", "center": [32.1975, 76.3259]},
        {"id": "yashobhoomi", "name": "Yashobhoomi (IICC)", "city": "New Delhi", "center": [28.5501, 77.0210]},
        {"id": "statue_of_unity", "name": "Statue of Unity Complex", "city": "Kevadia", "center": [21.8380, 73.7191]},
        {"id": "jio_world", "name": "Jio World Convention Centre", "city": "Mumbai", "center": [19.0620, 72.8687]},
        {"id": "chepauk_stadium", "name": "MA Chidambaram Stadium", "city": "Chennai", "center": [13.0628, 80.2824]}
    ]

    try:
        total_zones = 0
        for v in venues_data:
            v_id = v["id"]
            # Copy dict so we don't modify the original list if reused
            v_copy = v.copy()
            v_copy.pop("id")
            
            # Seed Venue
            db.collection("venues").document(v_id).set(v_copy)
            
            # Seed Zones for each venue
            base_lat, base_lng = v["center"]
            zone_templates = [
                {"name": "Gate 1 (Main Entry)", "type": "gate", "offset": [0.001, 0.001]},
                {"name": "Gate 2 (General)", "type": "gate", "offset": [-0.001, -0.001]},
                {"name": "Food Plaza (South)", "type": "food", "offset": [0.0005, -0.001]},
                {"name": "Parking Area", "type": "parking", "offset": [0.002, 0.002]},
                {"name": "Information Center", "type": "restroom", "offset": [-0.0005, 0.0005]}
            ]
            
            if "stadium" in v["name"].lower() or "gardens" in v["name"].lower():
                zone_templates.extend([
                    {"name": "North Stand", "type": "gate", "offset": [0.0015, 0]},
                    {"name": "South Stand Pavilion", "type": "gate", "offset": [-0.0015, 0]}
                ])

            for zt in zone_templates:
                # Create a URL-safe ID
                safe_name = zt['name'].lower().replace(' ', '_').replace('(', '').replace(')', '').replace('/', '_')
                z_id = f"{v_id}_{safe_name}"
                
                zone_data = {
                    "venue_id": v_id,
                    "name": zt["name"],
                    "type": zt["type"],
                    "crowd_score": 1 + (int(len(z_id)) % 8),
                    "coordinates": [base_lat + zt["offset"][0], base_lng + zt["offset"][1]],
                    "last_updated": SERVER_TIMESTAMP
                }
                db.collection("zones").document(z_id).set(zone_data)
                total_zones += 1
        
        return {"success": True, "message": f"Seeded {len(venues_data)} venues and {total_zones} zones"}
    except Exception as e:
        print(f"Error during seeding: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
