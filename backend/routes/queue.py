from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from firebase_admin_setup import db
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
import uuid

router = APIRouter(prefix="/queue", tags=["queue"])

ESTIMATED_MINUTES_PER_PERSON = 3


class QueueJoinRequest(BaseModel):
    zone_id: str
    name: str
    phone: str


class QueueNextRequest(BaseModel):
    zone_id: str


class QueuePauseRequest(BaseModel):
    zone_id: str
    paused: bool


@router.post("/join")
async def join_queue(request: QueueJoinRequest):
    """Add an attendee to the virtual queue for a zone."""
    try:
        zone_ref = db.collection("zones").document(request.zone_id)
        zone_doc = zone_ref.get()
        
        if not zone_doc.exists:
            raise HTTPException(status_code=404, detail="Zone not found")
        
        # Check if queue is paused
        zone_data = zone_doc.to_dict()
        if zone_data.get("queue_paused", False):
            raise HTTPException(status_code=400, detail="Queue is currently paused for this zone")
        
        # Get current queue members to determine position
        members_ref = db.collection("queues").document(request.zone_id).collection("members")
        active_members = members_ref.where("status", "in", ["waiting", "your_turn"]).stream()
        
        positions = []
        for member in active_members:
            member_data = member.to_dict()
            positions.append(member_data.get("position", 0))
        
        next_position = max(positions) + 1 if positions else 1
        
        member_id = str(uuid.uuid4())[:8]
        
        member_data = {
            "name": request.name,
            "phone": request.phone,
            "position": next_position,
            "joined_at": SERVER_TIMESTAMP,
            "status": "your_turn" if next_position == 1 else "waiting"
        }
        
        members_ref.document(member_id).set(member_data)
        
        # New: Register member globally for tracking retrieval
        db.collection("members_registry").document(member_id).set({
            "name": request.name.lower(),
            "zone_id": request.zone_id,
            "joined_at": SERVER_TIMESTAMP
        })
        
        estimated_wait = (next_position - 1) * ESTIMATED_MINUTES_PER_PERSON
        
        return {
            "member_id": member_id,
            "position": next_position,
            "estimated_wait_minutes": estimated_wait
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/next")
async def advance_queue(request: QueueNextRequest):
    """Advance the queue: mark current #1 as done, promote next person."""
    try:
        members_ref = db.collection("queues").document(request.zone_id).collection("members")
        
        # Find the person whose turn it is
        current_turn = list(
            members_ref.where("status", "==", "your_turn").stream()
        )
        
        advanced_member_id = None
        
        if current_turn:
            # Mark current person as done
            current_doc = current_turn[0]
            advanced_member_id = current_doc.id
            members_ref.document(current_doc.id).update({"status": "done"})
        
        # Find next waiting person (lowest position)
        waiting = list(
            members_ref.where("status", "==", "waiting")
                       .order_by("position")
                       .limit(1)
                       .stream()
        )
        
        next_position = None
        if waiting:
            next_doc = waiting[0]
            members_ref.document(next_doc.id).update({"status": "your_turn"})
            next_position = next_doc.to_dict().get("position")
        
        return {
            "advanced_member_id": advanced_member_id,
            "next_position": next_position
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{zone_id}/{member_id}")
async def get_queue_status(zone_id: str, member_id: str):
    """Get the current queue position and status for a member."""
    try:
        member_ref = db.collection("queues").document(zone_id).collection("members").document(member_id)
        member_doc = member_ref.get()
        
        if not member_doc.exists:
            raise HTTPException(status_code=404, detail="Member not found in queue")
        
        member_data = member_doc.to_dict()
        position = member_data.get("position", 0)
        status = member_data.get("status", "waiting")
        
        # Calculate actual position in line (count people ahead)
        if status == "waiting":
            members_ref = db.collection("queues").document(zone_id).collection("members")
            ahead = list(
                members_ref.where("status", "in", ["waiting", "your_turn"])
                           .where("position", "<", position)
                           .stream()
            )
            actual_position = len(ahead) + 1
        elif status == "your_turn":
            actual_position = 1
        else:
            actual_position = 0
        
        estimated_wait = max(0, (actual_position - 1) * ESTIMATED_MINUTES_PER_PERSON)
        
        return {
            "position": actual_position,
            "estimated_wait_minutes": estimated_wait,
            "status": status
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/members/{zone_id}")
async def get_queue_members(zone_id: str):
    """Get all active queue members for a zone (for staff dashboard)."""
    try:
        members_ref = db.collection("queues").document(zone_id).collection("members")
        active_members = members_ref.where("status", "in", ["waiting", "your_turn"]).order_by("position").stream()
        
        members = []
        for doc in active_members:
            member_data = doc.to_dict()
            member_data["id"] = doc.id
            members.append(member_data)
        
        return members
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pause")
async def pause_queue(request: QueuePauseRequest):
    """Pause or resume a queue for a zone."""
    try:
        zone_ref = db.collection("zones").document(request.zone_id)
        zone_doc = zone_ref.get()
        
        if not zone_doc.exists:
            raise HTTPException(status_code=404, detail="Zone not found")
        
        zone_ref.update({"queue_paused": request.paused})
        
        return {"success": True, "paused": request.paused}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/track/{member_id}")
async def track_queue_member(member_id: str, name: str):
    """Retrieve queue info for an existing member ID and name."""
    try:
        # Check global registry
        registry_ref = db.collection("members_registry").document(member_id)
        register_doc = registry_ref.get()
        
        if not register_doc.exists:
            raise HTTPException(status_code=404, detail="Ticket ID not found")
        
        reg_data = register_doc.to_dict()
        if reg_data.get("name") != name.lower().strip():
            raise HTTPException(status_code=403, detail="Name does not match Ticket ID")
        
        zone_id = reg_data.get("zone_id")
        
        # Get live status
        member_ref = db.collection("queues").document(zone_id).collection("members").document(member_id)
        member_doc = member_ref.get()
        
        if not member_doc.exists:
            # Maybe they were deleted or are done?
            raise HTTPException(status_code=404, detail="Ticket exists but queue record is missing")
            
        member_data = member_doc.to_dict()
        
        return {
            "member_id": member_id,
            "zone_id": zone_id,
            "position": member_data.get("position", 0),
            "status": member_data.get("status", "waiting")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
