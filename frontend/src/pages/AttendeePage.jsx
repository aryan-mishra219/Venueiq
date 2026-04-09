import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import VenueMap from '../components/VenueMap';
import ZoneCard from '../components/ZoneCard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function AttendeePage() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wayfindingFrom, setWayfindingFrom] = useState('');
  const [wayfindingTo, setWayfindingTo] = useState('');

  // Real-time Firestore listener for zones
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
        setLoading(false);
        // Fallback: fetch from API
        fetchZonesFromAPI();
      }
    );

    return () => unsubscribe();
  }, []);

  const fetchZonesFromAPI = async () => {
    try {
      const res = await fetch(`${API_URL}/zones/all`);
      const data = await res.json();
      setZones(data);
    } catch (err) {
      console.error('API fallback failed:', err);
    }
  };

  // Handle crowd report
  const handleReport = useCallback(async (zoneId, reportType) => {
    try {
      const res = await fetch(`${API_URL}/zones/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId, report_type: reportType }),
      });

      if (!res.ok) throw new Error('Report failed');

      const data = await res.json();
      toast.success(
        `Reported ${reportType === 'crowded' ? '🔴 Crowded' : '🟢 Clear'} — Score: ${data.new_crowd_score}`,
        { duration: 2000 }
      );
    } catch (err) {
      toast.error('Failed to submit report. Try again.');
      console.error(err);
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
        <h1 className="page-title">Live Venue Map</h1>
        <p className="page-subtitle">
          Real-time crowd density across all zones • Tap a zone to report congestion
        </p>
      </div>

      {/* Wayfinding Controls */}
      <div className="wayfinding-section">
        <div className="section-title">
          <span className="section-title-icon">🧭</span>
          Smart Wayfinding
        </div>
        <div className="wayfinding-controls">
          <select
            className="form-select"
            value={wayfindingFrom}
            onChange={(e) => setWayfindingFrom(e.target.value)}
          >
            <option value="">📍 Select starting zone...</option>
            {zones.map(zone => (
              <option key={zone.id} value={zone.id}>{zone.name}</option>
            ))}
          </select>
          <select
            className="form-select"
            value={wayfindingTo}
            onChange={(e) => setWayfindingTo(e.target.value)}
          >
            <option value="">🏁 Select destination...</option>
            {zones.map(zone => (
              <option key={zone.id} value={zone.id}>{zone.name}</option>
            ))}
          </select>
          {(wayfindingFrom || wayfindingTo) && (
            <button
              className="btn btn-primary"
              style={{ width: 'auto', minWidth: '100px' }}
              onClick={() => { setWayfindingFrom(''); setWayfindingTo(''); }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Interactive Map */}
      <div className="map-wrapper">
        <VenueMap
          zones={zones}
          onReport={handleReport}
          wayfindingFrom={wayfindingFrom}
          wayfindingTo={wayfindingTo}
        />
      </div>

      {/* Zone Cards Grid */}
      <div className="zones-section">
        <div className="section-title">
          <span className="section-title-icon">📊</span>
          Zone Overview
        </div>
        <div className="zones-grid">
          {zones.map(zone => (
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
