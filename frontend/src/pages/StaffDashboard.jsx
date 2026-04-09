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

  const [zones, setZones] = useState([]);
  const [queueData, setQueueData] = useState({});  // { zoneId: [members] }
  const [loading, setLoading] = useState(true);

  // Announcement form
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [announcementTarget, setAnnouncementTarget] = useState('all');
  const [sending, setSending] = useState(false);

  // Check session storage
  useEffect(() => {
    const isAuth = sessionStorage.getItem('venueiq_staff_auth');
    if (isAuth === 'true') setAuthenticated(true);
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

  // ===== STATS =====
  const totalQueueMembers = Object.values(queueData).reduce((sum, members) => sum + members.length, 0);
  const avgCrowdScore = zones.length > 0
    ? (zones.reduce((sum, z) => sum + z.crowd_score, 0) / zones.length).toFixed(1)
    : 0;
  const highCrowdZones = zones.filter(z => z.crowd_score > 6).length;

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

        {/* Zone Overview Grid */}
        <div className="section-title" style={{ marginBottom: '16px' }}>
          <span className="section-title-icon">📊</span>
          Zone Status
        </div>
        <div className="zones-grid" style={{ marginBottom: '32px' }}>
          {zones.map(zone => (
            <ZoneCard
              key={zone.id}
              zone={zone}
              queueCount={(queueData[zone.id] || []).length}
            />
          ))}
        </div>

        {/* Queue Management */}
        <div className="section-title" style={{ marginBottom: '16px' }}>
          <span className="section-title-icon">🎫</span>
          Queue Management
        </div>

        {zones.map(zone => {
          const members = queueData[zone.id] || [];
          const isPaused = zone.queue_paused || false;

          return (
            <div key={zone.id} className="queue-management" style={{ marginBottom: '16px' }}>
              <div className="queue-zone-header">
                <div>
                  <span className="queue-zone-title">{zone.name}</span>
                  {isPaused && (
                    <span style={{
                      marginLeft: '10px',
                      padding: '2px 8px',
                      background: 'rgba(255, 193, 7, 0.15)',
                      color: '#ffc107',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}>
                      PAUSED
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="zone-card-btn primary"
                    style={{ padding: '6px 14px' }}
                    onClick={() => handleAdvanceQueue(zone.id)}
                    disabled={members.length === 0}
                  >
                    ⏩ Next
                  </button>
                  <button
                    className={`zone-card-btn ${isPaused ? 'success' : 'danger'}`}
                    style={{ padding: '6px 14px' }}
                    onClick={() => handleTogglePause(zone.id, isPaused)}
                  >
                    {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                  </button>
                </div>
              </div>

              {members.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0' }}>
                  No one in queue
                </p>
              ) : (
                <ul className="queue-member-list">
                  {members.map((member, idx) => (
                    <li key={member.id} className="queue-member-item">
                      <div className="queue-member-info">
                        <div className={`queue-member-position ${member.status === 'your_turn' ? 'your-turn' : ''}`}>
                          {idx + 1}
                        </div>
                        <div>
                          <div className="queue-member-name">{member.name}</div>
                          <div className="queue-member-phone">{member.phone}</div>
                        </div>
                      </div>
                      <span className={`queue-member-status ${member.status === 'your_turn' ? 'your-turn' : 'waiting'}`}>
                        {member.status === 'your_turn' ? '🟢 Turn' : '⏳ Waiting'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
