import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, LayoutDashboard, Map, Users, Bell, Settings, Power, Zap, Mic } from 'lucide-react';
import VenueMap from '../components/VenueMap';
import StaffLogin from '../components/StaffLogin';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const STAFF_PASSWORD = import.meta.env.VITE_STAFF_PASSWORD || 'venue2024';

// Helper: get congestion level from score
const getLevel = (score) => score <= 3 ? 'nominal' : score <= 6 ? 'moderate' : 'dense';
const getLevelLabel = (score) => score <= 3 ? 'NOMINAL' : score <= 6 ? 'MODERATE' : 'DENSE';

export default function StaffDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [venues, setVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [zones, setZones] = useState([]);
  const [queueData, setQueueData] = useState({});
  const [loading, setLoading] = useState(true);

  // Announcement / Comms
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [commsLog, setCommsLog] = useState([]);

  // Drill-down modal
  const [drillZoneId, setDrillZoneId] = useState(null);

  // Map Toggle
  const [showLiveMap, setShowLiveMap] = useState(false);

  const getVenueImage = (venueId) => {
    if (venueId === 'bharat_mandapam') return '/stadium_radar_convention.png';
    if (venueId === 'statue_of_unity') return '/stadium_radar_statue.png';
    if (venueId === 'jio_world' || venueId === 'yashobhoomi') return '/stadium_radar_convention.png';
    return '/stadium_radar_circular.png'; 
  };

  // Session
  useEffect(() => {
    const isAuth = sessionStorage.getItem('venueiq_staff_auth');
    const storedPass = sessionStorage.getItem('venueiq_staff_pass');
    if (isAuth === 'true') setAuthenticated(true);
    if (storedPass) setPassword(storedPass);

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

  // Real-time queue members
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
  const handleLogin = (enteredPassword) => {
    if (enteredPassword === STAFF_PASSWORD) {
      setAuthenticated(true);
      setPassword(enteredPassword);
      sessionStorage.setItem('venueiq_staff_auth', 'true');
      sessionStorage.setItem('venueiq_staff_pass', enteredPassword);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setAuthenticated(false);
    setPassword('');
    sessionStorage.removeItem('venueiq_staff_auth');
    sessionStorage.removeItem('venueiq_staff_pass');
  };

  // Advance queue (Optimistic UI)
  const handleAdvanceQueue = useCallback(async (zoneId) => {
    const previousQueue = queueData[zoneId] || [];
    setQueueData(prev => {
      const current = prev[zoneId] || [];
      if (current.length === 0) return prev;
      const nextQueue = current.slice(1).map((m, idx) =>
        idx === 0 ? { ...m, status: 'your_turn' } : m
      );
      return { ...prev, [zoneId]: nextQueue };
    });

    try {
      const res = await fetch(`${API_URL}/queue/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          zone_id: zoneId,
          password: password
        }),
      });
      if (!res.ok) throw new Error('Failed to advance queue');
      const data = await res.json();
      toast.success(data.next_position ? `Authorized: Advancing to position #${data.next_position}` : 'Queue check complete: No waiting members');

      const now = new Date();
      const ts = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCommsLog(prev => [{ time: ts, sender: 'SYS_ADMIN', type: 'system', msg: `QUEUE ADVANCED FOR ZONE. NOTIFICATION DISPATCHED.` }, ...prev].slice(0, 20));
    } catch (err) {
      setQueueData(prev => ({ ...prev, [zoneId]: previousQueue }));
      toast.error('Unable to advance queue. Please verify connectivity.');
    }
  }, [queueData, password]);

  // Pause/resume (Optimistic UI)
  const handleTogglePause = useCallback(async (zoneId, currentlyPaused) => {
    setZones(prev => prev.map(z =>
      z.id === zoneId ? { ...z, queue_paused: !currentlyPaused } : z
    ));
    try {
      const res = await fetch(`${API_URL}/queue/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          zone_id: zoneId, 
          paused: !currentlyPaused,
          password: password 
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(!currentlyPaused ? 'Status: Queue Paused' : 'Status: Queue Resumed');
    } catch (err) {
      setZones(prev => prev.map(z =>
        z.id === zoneId ? { ...z, queue_paused: currentlyPaused } : z
      ));
      toast.error('Command failed: Could not update queue status.');
    }
  }, [password]);

  // Remove member
  const handleRemoveMember = useCallback(async (zoneId, memberId) => {
    if (!window.confirm('Remove this person from the queue?')) return;
    try {
      const res = await fetch(`${API_URL}/queue/members/${zoneId}/${memberId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Member removed');
    } catch (err) {
      toast.error('Failed to remove member');
    }
  }, [password]);

  // Send announcement (via Comms)
  const handleSendAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementMsg.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/announcements/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: announcementMsg.trim(), target_zone: 'all' }),
      });
      if (!res.ok) throw new Error('Failed');
      const now = new Date();
      const ts = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCommsLog(prev => [{ time: ts, sender: 'OPERATOR', type: 'operator', msg: announcementMsg.trim().toUpperCase() }, ...prev].slice(0, 20));
      setAnnouncementMsg('');
      toast.success('Broadcast sent', { icon: <Mic size={14} /> });
    } catch (err) {
      toast.error('Failed to send');
    } finally {
      setSending(false);
    }
  };

  // Derived data
  const filteredZones = useMemo(() =>
    selectedVenueId ? zones.filter(z => z.venue_id === selectedVenueId) : []
  , [zones, selectedVenueId]);

  const totalQueueMembers = useMemo(() =>
    Object.values(queueData).reduce((sum, m) => sum + m.length, 0)
  , [queueData]);

  const avgCrowdScore = useMemo(() =>
    filteredZones.length > 0
      ? (filteredZones.reduce((s, z) => s + (z.crowd_score || 0), 0) / filteredZones.length).toFixed(1)
      : 0
  , [filteredZones]);

  const highCrowdZones = useMemo(() =>
    filteredZones.filter(z => (z.crowd_score || 0) > 6)
  , [filteredZones]);

  const selectedVenueName = venues.find(v => v.id === selectedVenueId)?.name || 'ALL SECTORS';

  const alertLevel = highCrowdZones.length === 0 ? 'LOW' : highCrowdZones.length <= 2 ? 'MODERATE' : 'HIGH';
  const alertDesc = highCrowdZones.length > 0
    ? `${highCrowdZones[0]?.name?.toUpperCase()} BOTTLENECK DETECTED. MONITORING.`
    : 'ALL ZONES NOMINAL. NO CONGESTION DETECTED.';

  // ===== LOGIN SCREEN =====
  if (!authenticated) {
    return <StaffLogin onLogin={handleLogin} />;
  }

  if (loading) {
    return (
      <div className="loading-spinner" style={{ background: 'var(--ops-bg)' }}>
        <div className="spinner" style={{ borderTopColor: 'var(--ops-cyan)' }}></div>
      </div>
    );
  }

  // Queue zones with members for the right panel
  const queueZones = filteredZones.filter(z => {
    const members = queueData[z.id] || [];
    return members.length > 0 || z.queue_paused;
  });
  // Also show zones even without members so staff can see the full picture
  const allQueueZones = filteredZones;

  return (
    <div className="ops-shell">
      {/* Subtle scanline overlay */}
      <div className="ops-scanline" />

      <div className="ops-layout">
        <div className="ops-sidebar">
          <button className="ops-sidebar-icon active" aria-label="HUD Dashboard" title="HUD" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><LayoutDashboard size={18} aria-hidden="true" /></button>
          <button className="ops-sidebar-icon" aria-label="Logout" title="Logout" onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: 'var(--ops-magenta)', marginTop: 'auto', cursor: 'pointer' }}><Power size={18} aria-hidden="true" /></button>
        </div>

        {/* ===== LEFT COLUMN (HUD) ===== */}
        <div className="ops-left">
          {/* Brand */}
          <div className="ops-brand">
            <div className="ops-brand-title" aria-label="Venue IQ">VENUEIQ</div>
            <div className="ops-brand-sub" aria-label="Operator 042">OPERATOR 042</div>
          </div>

          {/* Total Occupancy */}
          <div className="ops-metric">
            <div className="ops-metric-header">
              <span className="ops-metric-label">Total Occupancy</span>
              <span className="ops-metric-tag id">ID-STAT</span>
            </div>
            <div className="ops-metric-value">
              {totalQueueMembers.toLocaleString()}<span> /{filteredZones.length * 100}</span>
            </div>
            <div className="ops-metric-bar">
              <div className="ops-metric-bar-fill" style={{ width: `${Math.min(100, (totalQueueMembers / Math.max(1, filteredZones.length * 100)) * 100)}%` }} />
            </div>
          </div>

          {/* Alert Level */}
          <div className="ops-alert">
            <div className="ops-metric-header">
              <span className="ops-metric-label">Alert Level</span>
              <span className="ops-metric-tag alert">ID-ALERT</span>
            </div>
            <div className="ops-alert-level">
              {alertLevel}
              <div className="bars">
                <span style={{ height: '8px' }} />
                <span style={{ height: '14px' }} />
                <span style={{ height: alertLevel === 'LOW' ? '6px' : '20px', opacity: alertLevel === 'LOW' ? 0.3 : 1 }} />
              </div>
            </div>
            <div className="ops-alert-desc">{alertDesc}</div>
          </div>

          {/* Zone Mini Cards */}
          {filteredZones.slice(0, 4).map(zone => {
            const level = getLevel(zone.crowd_score || 0);
            const members = queueData[zone.id] || [];
            return (
              <div key={zone.id} className="ops-zone-mini" onClick={() => setDrillZoneId(zone.id)}>
                <div className="ops-zone-mini-header">
                  <span className="ops-zone-mini-name">{zone.name}</span>
                  <span className={`ops-status-chip ${level}`}>{getLevelLabel(zone.crowd_score || 0)}</span>
                </div>
                <div className="ops-zone-mini-bar">
                  <div className={`ops-zone-mini-bar-fill ${level === 'nominal' ? 'low' : level === 'dense' ? 'high' : 'moderate'}`} style={{ width: `${(zone.crowd_score || 0) * 10}%` }} />
                </div>
                <div className="ops-zone-mini-stats">
                  <span className="ops-zone-mini-stat">DENSITY: <strong>{zone.crowd_score}/10</strong></span>
                  <span className="ops-zone-mini-stat">QUEUE: <strong>{members.length}</strong></span>
                </div>
              </div>
            );
          })}


        </div>

        {/* ===== CENTER COLUMN (Map + Comms) ===== */}
        <div className="ops-center">
          {/* Map Header */}
          <div className="ops-map-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="ops-map-tag" aria-label="Live Feed Satellite Link 04">LIVE_FEED // SAT_LINK_04</span>
              <span style={{ fontFamily: 'var(--ops-mono)', fontSize: '10px', color: 'var(--ops-text-dim)', letterSpacing: '1px' }}>
                ACTIVE ZONES: {filteredZones.length}
              </span>
            </div>
            <button
              onClick={() => setShowLiveMap(!showLiveMap)}
              className="ops-action-btn cyan"
              aria-label={showLiveMap ? "Switch to Heatmap view" : "Switch to Live Map view"}
              style={{ width: 'auto', padding: '6px 12px' }}
            >
              {showLiveMap ? 'SEE HEATMAP' : 'SEE ON MAP'}
            </button>
          </div>

          {/* Map Area */}
          <div className="ops-map-container" style={{ background: '#0a0e17' }}>
            {!showLiveMap ? (
              // Heatmap View
              <div style={{ position: 'relative', width: '100%', height: '100%', background: `url(${getVenueImage(selectedVenueId)}) center center / cover no-repeat` }}>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(6, 10, 19, 0.4)', zIndex: 0 }} />
                <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
                  {filteredZones.map((zone, idx) => {
                    const positions = [
                      { top: '35%', left: '40%' },
                      { top: '55%', left: '25%' },
                      { top: '45%', left: '65%' },
                      { top: '65%', left: '55%' },
                      { top: '25%', left: '50%' },
                      { top: '75%', left: '40%' }
                    ];
                    const pos = positions[idx % positions.length];
                    const level = getLevel(zone.crowd_score || 0);
                    const color = level === 'dense' ? 'var(--ops-magenta)' : level === 'moderate' ? 'var(--ops-amber)' : 'var(--ops-green)';
                    const bg = level === 'dense' ? 'rgba(255, 45, 120, 0.3)' : level === 'moderate' ? 'rgba(255, 171, 0, 0.3)' : 'rgba(0, 230, 118, 0.2)';
                    
                    return (
                      <div key={zone.id} style={{
                        position: 'absolute',
                        top: pos.top,
                        left: pos.left,
                        background: bg,
                        border: `1px solid ${color}`,
                        padding: '6px 10px',
                        boxShadow: `0 0 20px ${color}`,
                        backdropFilter: 'blur(4px)',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontFamily: 'var(--ops-mono)', fontSize: '9px', color: 'white', fontWeight: 700, textTransform: 'uppercase' }}>{zone.name}</div>
                        <div style={{ fontFamily: 'var(--ops-mono)', fontSize: '8px', color: color, marginTop: '2px' }}>DENS: {zone.crowd_score}/10</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // Live Map View
              <>
                <div style={{ position: 'absolute', inset: 0, background: 'url(/stadium-bg.png) center center / cover no-repeat', opacity: 0.5, zIndex: 0 }} />
                <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
                  <VenueMap
                    zones={filteredZones}
                    onReport={() => {}}
                    wayfindingFrom=""
                    wayfindingTo=""
                  />
                </div>
              </>
            )}
            {/* Legend Overlay */}
            <div className="ops-map-overlay">
              <div className="ops-map-legend-title">MAP LEGEND</div>
              <div className="ops-map-legend-item">
                <div className="ops-map-legend-dot" style={{ background: 'var(--ops-magenta)' }} />
                CRITICAL CONGESTION
              </div>
              <div className="ops-map-legend-item">
                <div className="ops-map-legend-dot" style={{ background: 'var(--ops-green)' }} />
                NOMINAL FLOW
              </div>
            </div>
          </div>

          {/* Comms Log */}
          <div className="ops-comms">
            <div className="ops-comms-header">
              <span className="ops-comms-title">
                <span className="dot" /> COMMS LOG // LOCAL CHANNEL
              </span>
              <span style={{ fontFamily: 'var(--ops-mono)', fontSize: '9px', color: 'var(--ops-text-dim)', letterSpacing: '1px' }}>AUTO-ARCHIVING ACTIVE</span>
            </div>

            {commsLog.map((entry, i) => (
              <div key={i} className="ops-comms-log-entry">
                <span className="timestamp">[{entry.time}]</span>
                <span className={`sender ${entry.type}`}>{entry.sender}:</span>
                {entry.msg}
              </div>
            ))}

            <form className="ops-comms-input" onSubmit={handleSendAnnouncement}>
              <span style={{ color: 'var(--ops-text-dim)', fontFamily: 'var(--ops-mono)', fontSize: '11px' }}>⟫⟫</span>
              <input
                placeholder="TRANSMIT TO FIELD STAFF..."
                value={announcementMsg}
                onChange={(e) => setAnnouncementMsg(e.target.value)}
              />
              <button type="submit" disabled={sending} aria-label="Send Announcement">
                {sending ? '...' : 'SEND'}
              </button>
            </form>
          </div>
        </div>

        {/* ===== RIGHT COLUMN (Queue Management) ===== */}
        <div className="ops-right">
          <div className="ops-right-header">
            <div className="ops-right-title">QUEUE MANAGEMENT</div>
            <div className="ops-right-sub">LIVE TELEMETRY FEED // {selectedVenueName.toUpperCase()}</div>
          </div>

          {/* Venue Filter */}
          <div className="ops-venue-filter">
            <select
              value={selectedVenueId}
              onChange={(e) => setSelectedVenueId(e.target.value)}
            >
              <option value="">ALL SECTORS</option>
              {venues.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.city})</option>
              ))}
            </select>
          </div>

          {/* Queue Cards */}
          <div className="ops-queue-list">
            <AnimatePresence mode="popLayout" initial={false}>
              {allQueueZones.map(zone => {
                const members = queueData[zone.id] || [];
                const isPaused = zone.queue_paused || false;
                const level = getLevel(zone.crowd_score || 0);
                const waitTime = members.length > 0 ? members.length * 3 : 0;

                return (
                  <motion.div
                    key={zone.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="ops-queue-card"
                    onClick={() => members.length > 0 && setDrillZoneId(zone.id)}
                  >
                    <div className="ops-queue-card-header">
                      <div>
                        <div className="ops-queue-card-name">{zone.name}</div>
                        {isPaused && <span className="ops-status-chip dense" style={{ marginTop: '4px', display: 'inline-block' }}>PAUSED</span>}
                      </div>
                      <span className={`ops-status-chip ${level}`}>{members.length > 0 ? 'OPERATIONAL' : 'IDLE'}</span>
                    </div>

                    <div className="ops-queue-card-stats">
                      <div className="ops-queue-stat">
                        <div className="ops-queue-stat-val" style={{ color: 'var(--ops-cyan)' }}>{String(waitTime).padStart(2, '0')}<span style={{ fontSize: '10px', color: 'var(--ops-text-dim)' }}> MIN</span></div>
                        <div className="ops-queue-stat-label">WAIT TIME</div>
                      </div>
                      <div className="ops-queue-stat">
                        <div className="ops-queue-stat-val">{members.length}</div>
                        <div className="ops-queue-stat-label">IN QUEUE</div>
                      </div>
                      <div className="ops-queue-stat">
                        <div className="ops-queue-stat-val" style={{ color: 'var(--ops-green)' }}>{zone.crowd_score || 0}<span style={{ fontSize: '10px', color: 'var(--ops-text-dim)' }}>/10</span></div>
                        <div className="ops-queue-stat-label">DENSITY</div>
                      </div>
                    </div>

                    <div className="ops-queue-card-actions" onClick={(e) => e.stopPropagation()}>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        className="ops-action-btn cyan"
                        disabled={members.length === 0}
                        onClick={() => handleAdvanceQueue(zone.id)}
                      >
                        CALL NEXT (EMAIL)
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        className={`ops-action-btn ${isPaused ? 'cyan' : 'magenta'}`}
                        onClick={() => handleTogglePause(zone.id, isPaused)}
                      >
                        {isPaused ? 'RESUME' : 'PAUSE'}
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {allQueueZones.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ops-text-dim)', fontFamily: 'var(--ops-mono)', fontSize: '12px' }}>
                SELECT A VENUE TO VIEW QUEUE DATA
              </div>
            )}
          </div>

          {/* Global Queue Stats */}
          <div className="ops-global-stats">
            <div className="ops-global-stats-grid">
              <div>
                <div className="ops-global-stat-val">{totalQueueMembers.toLocaleString()}<span className="unit"> USR</span></div>
                <div className="ops-global-stat-label">TOTAL USERS IN QUEUE</div>
              </div>
              <div>
                <div className="ops-global-stat-val">{(totalQueueMembers * 3 / Math.max(1, filteredZones.length)).toFixed(1)}<span className="unit"> MIN</span></div>
                <div className="ops-global-stat-label">AVG STADIUM DELAY</div>
              </div>
            </div>
          </div>



          {/* System Status */}
          <div className="ops-system-status">
            <span className="ops-system-status-text"><span className="dot" /> SYSTEM STATUS: NOMINAL</span>
            <span style={{ fontFamily: 'var(--ops-mono)', fontSize: '9px', color: 'var(--ops-text-dim)' }}>v2.1.0</span>
          </div>
        </div>
      </div>

      {/* ===== MEMBER DRILL-DOWN MODAL ===== */}
      <AnimatePresence>
        {drillZoneId && (
          <motion.div
            className="ops-member-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrillZoneId(null)}
          >
            <motion.div
              className="ops-member-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ops-member-modal-header">
                <span className="ops-member-modal-title">
                  {zones.find(z => z.id === drillZoneId)?.name?.toUpperCase()} — LIVE QUEUE
                </span>
                <button className="ops-member-modal-close" onClick={() => setDrillZoneId(null)} aria-label="Close live queue details">✕</button>
              </div>

              <table className="ops-member-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(queueData[drillZoneId] || []).map((member) => (
                    <tr key={member.id}>
                      <td style={{ color: 'var(--ops-cyan)' }}>
                        {member.id}
                      </td>
                      <td>{member.name}</td>
                      <td style={{ color: 'var(--ops-text-dim)' }}>
                        {member.email
                          ? member.email.slice(0, 3) + '***@' + member.email.split('@')[1]
                          : '—'}
                      </td>
                      <td>
                        <span className={`ops-status-chip ${member.status === 'your_turn' ? 'nominal' : 'moderate'}`}>
                          {member.status === 'your_turn' ? 'SERVICING' : 'WAITING'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="ops-action-btn magenta"
                          style={{ padding: '4px 8px', flex: 'none' }}
                          onClick={() => handleRemoveMember(drillZoneId, member.id)}
                          aria-label={`Remove user ${member.name} from queue`}
                        >
                          REMOVE
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(queueData[drillZoneId] || []).length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ops-text-dim)', padding: '30px' }}>
                        NO ACTIVE USERS IN THIS QUEUE
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div style={{ padding: '12px 16px', display: 'flex', gap: '8px', borderTop: '1px solid var(--ops-border)' }}>
                <button
                  className="ops-action-btn cyan"
                  style={{ flex: 1 }}
                  onClick={() => { handleAdvanceQueue(drillZoneId); }}
                  disabled={(queueData[drillZoneId] || []).length === 0}
                >
                  CALL NEXT USER (SEND EMAIL)
                </button>
                <button className="ops-action-btn magenta" style={{ flex: 'none', padding: '8px 16px' }} onClick={() => setDrillZoneId(null)} aria-label="Close window">
                  CLOSE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
