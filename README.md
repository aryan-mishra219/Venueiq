# 🏟️ VenueIQ — Real-Time Crowd Intelligence Platform

A real-time crowd intelligence platform for large-scale sporting venues. Built with React.js, Leaflet.js, FastAPI, and Firebase Firestore.

## 📋 Features

### Attendee View (Public)
- **Live Heatmap** — Interactive Leaflet map with color-coded zone markers (green/yellow/red) that update in real-time via Firestore listeners
- **Crowd Reporting** — Tap any zone to report it as crowded or clear; scores auto-decay every 5 minutes
- **Virtual Queue** — Join queues digitally, track position in real-time, get a prominent "YOUR TURN" alert
- **Smart Wayfinding** — Dijkstra-based pathfinding that routes you through the least crowded zones

### Staff Dashboard (Protected)
- **Command Center** — Grid overview of all zones with live crowd scores and queue counts
- **Queue Management** — Advance, pause, or resume any queue across the venue
- **Announcement System** — Broadcast messages to specific zones or all attendees in real-time

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js + Vite |
| Maps | Leaflet.js + react-leaflet |
| Backend | FastAPI (Python) |
| Database | Firebase Firestore |
| Hosting | Vercel (frontend), Render (backend) |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- Firebase project with Firestore enabled

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your Firebase config
npm run dev
```

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
# Place your Firebase service account JSON as serviceAccountKey.json
uvicorn main:app --reload --port 8000
```

### Seed Initial Data

Once backend is running, call the seed endpoint to populate zones:

```bash
curl -X POST http://localhost:8000/zones/seed
```

## 🔑 Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firestore Database
3. Get your web app config → paste into `frontend/.env`
4. Generate a service account key → save as `backend/serviceAccountKey.json`

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/zones/all` | Get all zones with crowd scores |
| `POST` | `/zones/report` | Report crowd level for a zone |
| `POST` | `/zones/seed` | Seed initial zone data |
| `POST` | `/queue/join` | Join virtual queue |
| `POST` | `/queue/next` | Advance queue (staff) |
| `GET` | `/queue/status/{zone_id}/{member_id}` | Check queue position |
| `GET` | `/queue/members/{zone_id}` | List queue members |
| `POST` | `/queue/pause` | Pause/resume queue |
| `POST` | `/announcements/send` | Send announcement |
| `GET` | `/announcements/recent` | Get recent announcements |

## 🔐 Staff Access

Staff dashboard is at `/staff` route.  
**Demo password:** `venue2024`

## 📁 Project Structure

```
venueiq/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── VenueMap.jsx        # Leaflet map with markers & wayfinding
│   │   │   ├── ZoneCard.jsx        # Zone status card
│   │   │   ├── QueueCard.jsx       # Queue position display
│   │   │   └── AnnouncementToast.jsx  # Real-time announcement popup
│   │   ├── pages/
│   │   │   ├── AttendeePage.jsx    # Public heatmap + wayfinding
│   │   │   ├── QueuePage.jsx       # Virtual queue join/status
│   │   │   └── StaffDashboard.jsx  # Protected staff command center
│   │   ├── firebase.js             # Firebase client config
│   │   ├── App.jsx                 # Router + nav + layout
│   │   ├── main.jsx                # Entry point
│   │   └── index.css               # Complete design system
│   ├── .env.example
│   └── index.html
└── backend/
    ├── main.py                     # FastAPI app + CORS + cron
    ├── firebase_admin_setup.py     # Firebase Admin SDK init
    ├── requirements.txt
    └── routes/
        ├── zones.py                # Zone CRUD + crowd reporting
        ├── queue.py                # Queue join/advance/status
        └── announcements.py        # Announcement send/list
```

## 🌐 Deployment

### Frontend → Vercel
1. Connect GitHub repo to Vercel
2. Set root directory to `frontend`
3. Add all `VITE_*` environment variables in Vercel dashboard

### Backend → Render
1. Create a new Web Service on Render
2. Set `backend` as root directory
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add Firebase env variables

## 📄 License

MIT

## git add .; git commit -m "Update code"; git push
