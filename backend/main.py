"""
VenueIQ Core API
Entry point for the VenueIQ crowd intelligence platform.
Handles lifecycle events, health monitoring, and routing.
"""
import asyncio
import signal
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from firebase_admin_setup import get_db
from routes.zones import router as zones_router
from routes.queue import router as queue_router
from routes.announcements import router as announcements_router
from logger import logger

async def decay_crowd_scores():
    """Background task: decay all zone crowd_scores by 1 every 5 minutes."""
    while True:
        await asyncio.sleep(900)  # Reduced to 15 minutes to save Firestore Read Quota
        try:
            db = get_db()
            zones_ref = db.collection("zones")
            docs = zones_ref.stream()
            for doc in docs:
                zone_data = doc.to_dict()
                current_score = zone_data.get("crowd_score", 0)
                if current_score > 0:
                    zones_ref.document(doc.id).update({
                        "crowd_score": current_score - 1
                    })
            logger.info("[CRON] Decayed crowd scores by 1 across all zones.")
        except Exception as e:
            logger.error(f"[CRON] Error decaying scores: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app lifecycle — start background tasks on startup."""
    logger.info("VenueIQ Backend initialized and ready for traffic.")
    decay_task = asyncio.create_task(decay_crowd_scores())
    yield
    logger.info("VenueIQ Backend is shutting down. Cancelling background tasks...")
    decay_task.cancel()
    try:
        await decay_task
    except asyncio.CancelledError:
        pass
    logger.info("Graceful shutdown complete.")

app = FastAPI(
    title="VenueIQ API",
    description="Real-time crowd intelligence platform for large-scale sporting venues",
    version="1.1.0",
    lifespan=lifespan
)

# CORS — allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(zones_router)
app.include_router(queue_router)
app.include_router(announcements_router)

@app.get("/")
async def root():
    return {
        "name": "VenueIQ API",
        "description": "Smart Crowd Management Platform",
        "version": "1.1.0",
        "region": "Bharat/Global",
        "status": "healthy"
    }

@app.get("/health")
async def health_check():
    """Health check for Cloud Run monitoring."""
    return {
        "status": "healthy",
        "service": "venueiq-backend",
        "region": "asia-south1 (Mumbai)",
        "version": "2.1.0-gold"
    }

def handle_exit_signal(sig, frame):
    """Handle termination signals for safe exit."""
    logger.info(f"Received signal {sig}. Initiating shutdown sequence...")
    sys.exit(0)

# Register signal handlers for Cloud Run termination
signal.signal(signal.SIGTERM, handle_exit_signal)
# Note: we let uvicorn handle SIGINT (Ctrl+C) for a cleaner console exit
