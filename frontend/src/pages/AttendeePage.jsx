import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Building2, Compass, BarChart2 } from 'lucide-react';
import VenueMap from '../components/VenueMap';
import ZoneCard from '../components/ZoneCard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function AttendeePage() {
  const [venues, setVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState('');
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wayfindingFrom, setWayfindingFrom] = useState('');
  const [wayfindingTo, setWayfindingTo] = useState('');

  useEffect(() => {
    const fetchVenues = async () => {
      try {
        const res = await fetch(`${API_URL}/zones/venues/all`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setVenues(data);
          if (data.length > 0) setSelectedVenue(data[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch venues:', err);
      }
    };
    fetchVenues();
  }, []);

  // Real-time Firestore listener for ALL zones
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'zones'),
      (snapshot) => {
        const zonesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setZones(zonesData);
        setLoading(false);
      },
      (error) => {
        console.error('Firestore zones listener error:', error);
        toast.error(`Failed to load live zone data: ${error.message}`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Derived filtered zones for the active venue
  const activeZones = zones.filter(z => z.venue_id === selectedVenue);

  // Handle crowd report (with Optimistic UI)
  const handleReport = useCallback(async (zoneId, reportType) => {
    // 1. Optimistic Update (Immediate Feedback)
    setZones(prevZones => prevZones.map(zone => {
      if (zone.id === zoneId) {
        // Estimate new score locally (Crowded +1, Clear -1)
        const currentScore = zone.crowd_score || 0;
        let nextScore = reportType === 'crowded' ? currentScore + 1 : currentScore - 1;
        nextScore = Math.max(0, Math.min(10, nextScore)); // Keep in 0-10 range
        return { ...zone, crowd_score: nextScore };
      }
      return zone;
    }));

    try {
      const res = await fetch(`${API_URL}/zones/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId, report_type: reportType }),
      });

      if (!res.ok) throw new Error('Report failed');

      const data = await res.json();
      // Server will confirm final score via Firestore snapshot anyway, 
      // but we can show a quick success toast.
      toast.success(
        `Reported ${reportType === 'crowded' ? 'Crowded' : 'Clear'}`,
        { duration: 1500 }
      );
    } catch (err) {
      // 2. Rollback on failure
      toast.error('Failed to submit report. Reverting...');
      console.error(err);
      // Firestore onSnapshot will naturally revert the state when the next update comes in,
      // but we could also manually trigger a refresh if needed.
    }
  }, []);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">LIVE VENUE MAP</h1>
        <p className="page-subtitle">
          REAL-TIME CROWD DENSITY ACROSS ALL ZONES • TAP A ZONE TO REPORT CONGESTION
        </p>
      </div>

      {/* Venue Selection Dropdown */}
      <div className="wayfinding-section" style={{ marginBottom: '16px', background: 'rgba(255, 255, 255, 0.03)' }}>
        <div className="section-title">
          <Building2 size={16} className="section-title-icon" />
          Current Venue
        </div>
        <div className="wayfinding-controls" style={{ padding: '0 24px 20px' }}>
          <select
            className="form-select"
            style={{ maxWidth: '400px', border: '1px solid var(--accent-blue)' }}
            value={selectedVenue}
            onChange={(e) => {
              setSelectedVenue(e.target.value);
              setWayfindingFrom('');
              setWayfindingTo('');
            }}
          >
            <option value="">Select a venue...</option>
            {venues.map(v => (
              <option key={v.id} value={v.id}>{v.name} ({v.city})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Zone Search Controls */}
      <div className="wayfinding-section">
        <div className="section-title">
          <Compass size={16} className="section-title-icon" />
          Find Zone
        </div>
        <div className="wayfinding-controls">
          <select
            className="form-select"
            value={wayfindingFrom}
            onChange={(e) => setWayfindingFrom(e.target.value)}
          >
            <option value="">Select a gate, stand or stall...</option>
            {activeZones.map(zone => (
              <option key={zone.id} value={zone.id}>{zone.name}</option>
            ))}
          </select>
          {wayfindingFrom && (
            <button
              className="btn btn-primary"
              style={{ width: 'auto', minWidth: '100px' }}
              onClick={() => { setWayfindingFrom(''); setWayfindingTo(''); }}
            >
              Search
            </button>
          )}
        </div>
      </div>

      {/* Interactive Map with Stadium BG */}
      <div className="map-wrapper">
        <div className="stadium-bg-wrapper">
          <VenueMap
            zones={activeZones}
            onReport={handleReport}
            wayfindingFrom={wayfindingFrom}
            wayfindingTo={wayfindingTo}
          />
        </div>
      </div>

      {/* Zone Cards Grid */}
      <div className="zones-section">
        <div className="section-title">
          <BarChart2 size={16} className="section-title-icon" />
          ZONE OVERVIEW
        </div>
        <div className="zones-grid">
          {activeZones.map(zone => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              showActions={true}
              onReport={handleReport}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
