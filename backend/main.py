from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from firebase_admin_setup import db
from routes.zones import router as zones_router
from routes.queue import router as queue_router
from routes.announcements import router as announcements_router


async def decay_crowd_scores():
    """Background task: decay all zone crowd_scores by 1 every 5 minutes."""
    while True:
        await asyncio.sleep(300)  # 5 minutes
        try:
            zones_ref = db.collection("zones")
            docs = zones_ref.stream()
            for doc in docs:
                zone_data = doc.to_dict()
                current_score = zone_data.get("crowd_score", 0)
                if current_score > 0:
                    zones_ref.document(doc.id).update({
                        "crowd_score": current_score - 1
                    })
            print("[CRON] Decayed crowd scores by 1")
        except Exception as e:
            print(f"[CRON] Error decaying scores: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app lifecycle — start background tasks on startup."""
    task = asyncio.create_task(decay_crowd_scores())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="VenueIQ API",
    description="Real-time crowd intelligence platform for large-scale sporting venues",
    version="1.0.0",
    lifespan=lifespan
)

# CORS — allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://*.vercel.app",
        "*"  # Allow all for development
    ],
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
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
