from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from firebase_admin_setup import db
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

router = APIRouter(prefix="/announcements", tags=["announcements"])


class AnnouncementRequest(BaseModel):
    message: str
    target_zone: str  # zone_id or "all"


@router.post("/send")
async def send_announcement(request: AnnouncementRequest):
    """Send an announcement to a specific zone or all zones."""
    try:
        announcement_data = {
            "message": request.message,
            "target_zone": request.target_zone,
            "created_at": SERVER_TIMESTAMP
        }
        
        doc_ref = db.collection("announcements").add(announcement_data)
        
        return {"success": True, "announcement_id": doc_ref[1].id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recent")
async def get_recent_announcements():
    """Get the 20 most recent announcements."""
    try:
        announcements_ref = db.collection("announcements")
        docs = announcements_ref.order_by("created_at", direction="DESCENDING").limit(20).stream()
        
        announcements = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            announcements.append(data)
        
        return announcements
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
