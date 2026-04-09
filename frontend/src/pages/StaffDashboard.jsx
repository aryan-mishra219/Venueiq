import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import ZoneCard from '../components/ZoneCard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const STAFF_PASSWORD = 'venue2024';

export default function StaffDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [venues, setVenues] = useState([]); // New: Venue list
  const [selectedVenueId, setSelectedVenueId] = useState(''); // New: Tier 1 selection
  const [focusedZoneId, setFocusedZoneId] = useState(''); // Tier 2 selection
  
  const [zones, setZones] = useState([]);
  const [queueData, setQueueData] = useState({});
  const [loading, setLoading] = useState(true);

  // Announcement form
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [announcementTarget, setAnnouncementTarget] = useState('all');
  const [sending, setSending] = useState(false);

  // Check session storage and fetch venues
  useEffect(() => {
    const isAuth = sessionStorage.getItem('venueiq_staff_auth');
    if (isAuth === 'true') setAuthenticated(true);

    const fetchVenues = async () => {
      try {
        const res = await fetch(`${API_URL}/zones/venues/all`);
        const data = await res.json();
        if (Array.isArray(data)) setVenues(data);
      } catch (err) {
        console.error('Failed to fetch venues:', err);
      }
    };
    fetchVenues();
  }, []);

  // Real-time zones
  useEffect(() => {
    if (!authenticated) return;

    const unsubscribe = onSnapshot(collection(db, 'zones'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setZones(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [authenticated]);

  // Fetch queue members for all zones
  useEffect(() => {
    if (!authenticated || zones.length === 0) return;

    const unsubscribers = [];

    zones.forEach(zone => {
      const membersRef = collection(db, 'queues', zone.id, 'members');
      const unsub = onSnapshot(membersRef, (snapshot) => {
        const members = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(m => m.status === 'waiting' || m.status === 'your_turn')
          .sort((a, b) => a.position - b.position);

        setQueueData(prev => ({ ...prev, [zone.id]: members }));
      });
      unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach(u => u());
  }, [authenticated, zones]);

  // Login
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === STAFF_PASSWORD) {
      setAuthenticated(true);
      sessionStorage.setItem('venueiq_staff_auth', 'true');
      setLoginError('');
    } else {
      setLoginError('Invalid password. Please try again.');
    }
  };

  // Logout
  const handleLogout = () => {
    setAuthenticated(false);
    sessionStorage.removeItem('venueiq_staff_auth');
  };

  // Advance queue
  const handleAdvanceQueue = useCallback(async (zoneId) => {
    try {
      const res = await fetch(`${API_URL}/queue/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId }),
      });

      if (!res.ok) throw new Error('Failed to advance queue');

      const data = await res.json();
      toast.success(
        data.next_position
          ? `Advanced queue — Next: #${data.next_position}`
          : 'Queue is now empty',
      );
    } catch (err) {
      toast.error('Failed to advance queue');
    }
  }, []);

  // Pause/resume queue
  const handleTogglePause = useCallback(async (zoneId, currentlyPaused) => {
    try {
      const res = await fetch(`${API_URL}/queue/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId, paused: !currentlyPaused }),
      });

      if (!res.ok) throw new Error('Failed');

      toast.success(!currentlyPaused ? 'Queue paused' : 'Queue resumed');
    } catch (err) {
      toast.error('Failed to update queue');
    }
  }, []);

  // Manual remove member
  const handleRemoveMember = useCallback(async (zoneId, memberId) => {
    if (!window.confirm('Are you sure you want to remove this person from the queue?')) return;
    
    try {
      const res = await fetch(`${API_URL}/queue/members/${zoneId}/${memberId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to remove');

      toast.success('Member removed');
    } catch (err) {
      toast.error('Failed to remove member');
    }
  }, []);

  // Send announcement
  const handleSendAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementMsg.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${API_URL}/announcements/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: announcementMsg.trim(),
          target_zone: announcementTarget,
        }),
      });

      if (!res.ok) throw new Error('Failed to send');

      toast.success('📢 Announcement sent!');
      setAnnouncementMsg('');
    } catch (err) {
      toast.error('Failed to send announcement');
    } finally {
      setSending(false);
    }
  };

  // ===== LOGIN SCREEN =====
  if (!authenticated) {
    return (
      <div className="staff-login">
        <form className="staff-login-card" onSubmit={handleLogin}>
          <div className="staff-login-icon">🛡️</div>
          <h2>Staff Access</h2>
          <p>Enter the staff password to access the command center</p>

          {loginError && (
            <div className="staff-login-error">{loginError}</div>
          )}

          <div className="form-group">
            <input
              type="password"
              className="form-input"
              placeholder="Enter staff password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>

          <button type="submit" className="btn btn-primary">
            Unlock Dashboard
          </button>
        </form>
      </div>
    );
  }

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  // ===== STATS (Filtered by Venue) =====
  const filteredZones = selectedVenueId 
    ? zones.filter(z => z.venue_id === selectedVenueId)
    : zones;

  const totalQueueMembers = Object.values(queueData).reduce((sum, members) => sum + members.length, 0);
  const avgCrowdScore = filteredZones.length > 0
    ? (filteredZones.reduce((sum, z) => sum + z.crowd_score, 0) / filteredZones.length).toFixed(1)
    : 0;
  const highCrowdZones = filteredZones.filter(z => z.crowd_score > 6).length;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">🛡️ Command Center</h1>
          <p className="page-subtitle">Real-time venue operations dashboard</p>
        </div>
        <button
          className="btn"
          style={{
            width: 'auto',
            padding: '8px 20px',
            fontSize: '13px',
            background: 'rgba(255, 23, 68, 0.15)',
            color: '#ff1744',
            border: '1px solid rgba(255, 23, 68, 0.3)',
          }}
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>

      <div className="staff-dashboard">
        {/* Overview Stats */}
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-value">{zones.length}</div>
            <div className="stat-label">Total Zones</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{
              background: avgCrowdScore <= 3 ? 'linear-gradient(135deg, #00e676, #69f0ae)' :
                          avgCrowdScore <= 6 ? 'linear-gradient(135deg, #ffc107, #ffab00)' :
                          'linear-gradient(135deg, #ff1744, #ff5252)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {avgCrowdScore}
            </div>
            <div className="stat-label">Avg Crowd Score</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{
              background: 'linear-gradient(135deg, #ff1744, #ff5252)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {highCrowdZones}
            </div>
            <div className="stat-label">High Crowd Zones</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalQueueMembers}</div>
            <div className="stat-label">People in Queues</div>
          </div>
        </div>

        {/* Announcement Panel */}
        <div className="announcement-panel">
          <h3>
            <span>📢</span> Send Announcement
          </h3>
          <form className="announcement-form" onSubmit={handleSendAnnouncement}>
            <input
              type="text"
              className="form-input"
              placeholder="Type your announcement message..."
              value={announcementMsg}
              onChange={(e) => setAnnouncementMsg(e.target.value)}
            />
            <select
              className="form-select"
              value={announcementTarget}
              onChange={(e) => setAnnouncementTarget(e.target.value)}
            >
              <option value="all">🌐 All Zones</option>
              {zones.map(zone => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={sending}
            >
              {sending ? 'Sending...' : '📢 Send'}
            </button>
          </form>
        </div>

        {/* TIER 1: Venue Selection */}
        <div className="wayfinding-section" style={{ marginBottom: '24px', background: 'var(--bg-card)' }}>
          <div className="section-title">
            <span className="section-title-icon">🇮🇳</span>
            {selectedVenueId ? 'Active Venue' : 'Select Venue to Start'}
          </div>
          <p style={{ padding: '0 24px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Choose a venue to monitor its live zones and crowd metrics
          </p>
          <div style={{ padding: '0 24px 20px' }}>
            <select
              className="form-select"
              style={{ maxWidth: '400px', border: '1px solid var(--accent-blue)' }}
              value={selectedVenueId}
              onChange={(e) => {
                setSelectedVenueId(e.target.value);
                setFocusedZoneId(''); // Reset focus when switching venues
              }}
            >
              <option value="">Select a venue...</option>
              {venues.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.city})</option>
              ))}
            </select>
          </div>
        </div>

        {selectedVenueId && (
          <>
            {/* TIER 2: Zone Monitoring Dashboard */}
            <div className="announcement-panel" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>
                  <span>📢</span> Venue Announcement
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Broadcasting to {focusedZoneId ? 'Focused Zone' : 'All Local Zones'}</span>
              </div>
              <form className="announcement-form" onSubmit={handleSendAnnouncement}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Type message for local attendees..."
                  value={announcementMsg}
                  onChange={(e) => setAnnouncementMsg(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sending}
                >
                  {sending ? 'Sending...' : '📢 Send'}
                </button>
              </form>
            </div>

            {/* Dynamic View: Local Overview vs Focused Zone */}
            {!focusedZoneId ? (
              <div className="local-overview fade-in">
                <div className="section-title" style={{ marginBottom: '16px' }}>
                  <span className="section-title-icon">📊</span>
                  {venues.find(v => v.id === selectedVenueId)?.name} — Zone Status
                </div>
                <div className="zones-grid" style={{ marginBottom: '32px' }}>
                  {filteredZones.map(zone => (
                    <div 
                      key={zone.id} 
                      onClick={() => setFocusedZoneId(zone.id)}
                      style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <ZoneCard
                        zone={zone}
                        queueCount={(queueData[zone.id] || []).length}
                      />
                      <div style={{ textAlign: 'center', marginTop: '-8px', fontSize: '10px', color: 'var(--accent-blue)', fontWeight: 600 }}>Click to Manage Queue ➔</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="focused-zone-dashboard fade-in">
                <div style={{ marginBottom: '16px' }}>
                   <button 
                    onClick={() => setFocusedZoneId('')}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '13px', cursor: 'pointer', padding: 0 }}
                  >
                    ← Back to {venues.find(v => v.id === selectedVenueId)?.name} Overview
                  </button>
                </div>
                
                {filteredZones.filter(z => z.id === focusedZoneId).map(zone => {
                  const members = queueData[zone.id] || [];
                  const isPaused = zone.queue_paused || false;

                  return (
                    <div key={zone.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div>
                          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{zone.name}</h2>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Dedicated Management Dashboard</span>
                            {isPaused && (
                              <span style={{ padding: '2px 8px', background: 'rgba(255, 193, 7, 0.15)', color: '#ffc107', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>PAUSED</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                           <button
                            className="btn btn-primary"
                            style={{ width: 'auto' }}
                            onClick={() => handleAdvanceQueue(zone.id)}
                            disabled={members.length === 0}
                          >
                            ⏩ Next Person
                          </button>
                          <button
                            className={`btn ${isPaused ? 'btn-success' : 'btn-danger'}`}
                            style={{ 
                              width: 'auto', 
                              background: isPaused ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 23, 68, 0.15)',
                              color: isPaused ? '#00e676' : '#ff1744',
                              border: `1px solid ${isPaused ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 23, 68, 0.3)'}`
                            }}
                            onClick={() => handleTogglePause(zone.id, isPaused)}
                          >
                            {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                          </button>
                        </div>
                      </div>

                      <div className="queue-management premium-list">
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600, fontSize: '14px' }}>Live Attendee List ({members.length})</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total queue size for this area</span>
                        </div>
                        
                        {members.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌟</div>
                            <h3>Queue is clear!</h3>
                            <p>Good job! No active attendees waiting in this zone.</p>
                          </div>
                        ) : (
                          <ul className="queue-member-list">
                            {members.map((member, idx) => (
                              <li key={member.id} className="queue-member-item" style={{ padding: '16px 24px' }}>
                                <div className="queue-member-info">
                                  <div className={`queue-member-position ${member.status === 'your_turn' ? 'your-turn' : ''}`}>
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <div className="queue-member-name" style={{ fontSize: '15px', fontWeight: 600 }}>{member.name}</div>
                                    <div className="queue-member-phone" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{member.phone} • Unique ID: <strong>{member.id}</strong></div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                  <span className={`queue-member-status ${member.status === 'your_turn' ? 'your-turn' : 'waiting'}`}>
                                    {member.status === 'your_turn' ? '🟢 Servicing' : '⏳ In Line'}
                                  </span>
                                  <button 
                                    className="btn"
                                    style={{ 
                                      width: 'auto', 
                                      padding: '6px 12px', 
                                      fontSize: '11px',
                                      background: 'rgba(255, 255, 255, 0.05)',
                                      border: '1px solid var(--border-color)'
                                    }}
                                    onClick={() => handleRemoveMember(zone.id, member.id)}
                                  >
                                    Clear
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
