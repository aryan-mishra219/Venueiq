import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { QRCode } from 'react-qr-code';
import toast from 'react-hot-toast';
import { Ticket, Search, QrCode, ArrowLeft } from 'lucide-react';
import QueueCard from '../components/QueueCard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function QueuePage() {
  const [venues, setVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState('');
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [joining, setJoining] = useState(false);
  const [queueInfo, setQueueInfo] = useState(null);  // { member_id, zone_id, position, estimated_wait_minutes }
  const [liveStatus, setLiveStatus] = useState(null); // Real-time status from Firestore
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false); // Toggle between Join and Track form
  const [trackId, setTrackId] = useState('');

  // Load Venues
  useEffect(() => {
    const fetchVenues = async () => {
      try {
        const res = await fetch(`${API_URL}/zones/venues/all`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setVenues(data);
        }
      } catch (err) {
        console.error('Failed to fetch venues:', err);
      }
    };
    fetchVenues();
  }, []);

  // Load Zones (Real-time) and handle deep-linking
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'zones'),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setZones(data);
        setLoading(false);

        // Handle Deep Linking from QR Code URL Params (?venue=xxx&zone=yyy)
        const params = new URLSearchParams(window.location.search);
        const urlVenue = params.get('venue');
        const urlZone = params.get('zone');

        if (urlVenue) setSelectedVenue(urlVenue);
        if (urlZone) setSelectedZone(urlZone);
      },
      (error) => {
        console.error('Firestore zones listener error:', error);
        setLoading(false);
        toast.error(`Failed to load live zone data: ${error.message}`);
      }
    );
    return () => unsubscribe();
  }, []);

  // Derived filtered zones based on selected venue
  const filteredZones = zones.filter(z => z.venue_id === selectedVenue);

  // Real-time listener for queue member status
  useEffect(() => {
    if (!queueInfo) return;

    const memberRef = doc(
      db,
      'queues',
      queueInfo.zone_id,
      'members',
      queueInfo.member_id
    );

    const unsubscribe = onSnapshot(memberRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setLiveStatus(data);

        // Show notification when it's their turn
        if (data.status === 'your_turn') {
          toast.success("🎉 It's your turn! Please proceed.", {
            duration: 10000,
            icon: '🟢',
          });
        }
      }
    });

    return () => unsubscribe();
  }, [queueInfo]);

  // Track existing queue
  const handleTrackQueue = async (e) => {
    e.preventDefault();
    if (!trackId.trim() || !name.trim()) {
      toast.error('Please enter both Name and Ticket ID');
      return;
    }

    setJoining(true); // Reusing joining state for loading spinner
    try {
      const res = await fetch(`${API_URL}/queue/track/${trackId.trim()}?name=${encodeURIComponent(name.trim())}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Tracking failed');
      }

      const data = await res.json();
      setQueueInfo({
        member_id: data.member_id,
        zone_id: data.zone_id,
        position: data.position,
        estimated_wait_minutes: (data.position - 1) * 3
      });
      toast.success('Pass retrieved successfully!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setJoining(false);
    }
  };

  // Join queue
  const handleJoinQueue = async (e) => {
    e.preventDefault();

    if (!selectedZone || !name.trim() || !phone.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setJoining(true);
    try {
      const res = await fetch(`${API_URL}/queue/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone_id: selectedZone,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to join queue');
      }

      const data = await res.json();
      setQueueInfo({
        member_id: data.member_id,
        zone_id: selectedZone,
        position: data.position,
        estimated_wait_minutes: data.estimated_wait_minutes,
      });

      toast.success(`Joined queue at position #${data.position}!`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setJoining(false);
    }
  };

  // Get display info
  const selectedZoneName = zones.find(z => z.id === selectedZone)?.name || selectedZone;
  const position = liveStatus?.position || queueInfo?.position || 0;
  const status = liveStatus?.status || 'waiting';
  const estimatedWait = status === 'your_turn' ? 0 : ((position - 1) * 3);

  // Build QR URL for the current page
  const queueUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/queue`
    : 'https://venueiq.vercel.app/queue';

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">VIRTUAL QUEUE</h1>
        <p className="page-subtitle">
          SKIP THE PHYSICAL LINE — JOIN A VIRTUAL QUEUE AND GET NOTIFIED WHEN IT'S YOUR TURN
        </p>
      </div>

      <div className="queue-page">
        {/* If not in a queue, show join or track form */}
        {!queueInfo ? (
          <>
            {!isTracking ? (
              <form className="queue-join-form" onSubmit={handleJoinQueue}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Ticket size={20} /> JOIN QUEUE
                </h3>
                <p>SELECT A ZONE AND ENTER YOUR DETAILS TO JOIN THE VIRTUAL QUEUE</p>

                <div className="form-group">
                  <label className="form-label">Select Venue</label>
                  <select
                    className="form-select"
                    aria-label="Select Event Venue"
                    value={selectedVenue}
                    onChange={(e) => {
                      setSelectedVenue(e.target.value);
                      setSelectedZone(''); 
                    }}
                    required
                  >
                    <option value="">Select a venue...</option>
                    {venues.map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({v.city})</option>
                    ))}
                  </select>
                </div>

                {selectedVenue && (
                  <div className="form-group">
                    <label className="form-label">Zone / Stall</label>
                    <select
                      className="form-select"
                      aria-label="Select Zone or Stall"
                      value={selectedZone}
                      onChange={(e) => setSelectedZone(e.target.value)}
                      required
                    >
                      <option value="">Select a zone...</option>
                      {filteredZones.map(zone => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name} — Score: {zone.crowd_score}/10
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Your Name</label>
                  <input
                    type="text"
                    className="form-input"
                    aria-label="Your Name"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    aria-label="Phone Number"
                    placeholder="+91 XXXXX XXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address (Optional)</label>
                  <input
                    type="email"
                    className="form-input"
                    aria-label="Email Address (Optional)"
                    placeholder="Receive an email when it's your turn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <small style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    We'll send you a professional notification so you don't miss your turn.
                  </small>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  aria-label="Join the Virtual Queue"
                  disabled={joining}
                >
                  {joining ? 'Joining...' : (
                    <><Ticket size={16} /> Join Queue</>
                  )}
                </button>

                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button 
                    type="button"
                    className="btn-link"
                    aria-label="Switch to Ticket Tracking form"
                    style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '13px' }}
                    onClick={() => { setIsTracking(true); setName(''); }}
                  >
                    Already have a ticket? Track it here ➔
                  </button>
                </div>
              </form>
            ) : (
              <form className="queue-join-form" onSubmit={handleTrackQueue}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={20} /> Track My Pass
                </h3>
                <p>Enter your details to retrieve your active virtual ticket</p>

                <div className="form-group">
                  <label className="form-label">Your Name</label>
                  <input
                    type="text"
                    className="form-input"
                    aria-label="Your Name"
                    placeholder="Enter the name used to join"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Ticket ID (Unique ID)</label>
                  <input
                    type="text"
                    className="form-input"
                    aria-label="Ticket ID"
                    placeholder="e.g. a7b2c5d1"
                    value={trackId}
                    onChange={(e) => setTrackId(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  aria-label="Restore Pass"
                  disabled={joining}
                >
                  {joining ? 'Searching...' : (
                    <><Search size={16} /> Restore Pass</>
                  )}
                </button>

                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button 
                    type="button"
                    className="btn-link"
                    aria-label="Switch to Join Queue form"
                    style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '13px' }}
                    onClick={() => { setIsTracking(false); setName(''); }}
                  >
                    <ArrowLeft size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                    Back to Join Form
                  </button>
                </div>
              </form>
            )}

            {/* QR Code Section */}
            <div className="qr-section">
              <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <QrCode size={20} /> Scan to Join Queue
              </h3>
              <p style={{ color: '#9aa0a6', fontSize: '13px', marginBottom: '16px' }}>
                Share this QR code at stalls and entry points
              </p>
              <div className="qr-code-wrapper" aria-label="QR Code to scan and join the queue">
                <QRCode
                  value={queueUrl}
                  size={180}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#0f0f0f"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Queue Status */}
            <QueueCard
              position={position}
              estimatedWait={estimatedWait}
              status={status}
              name={name}
              zone={selectedZoneName}
              memberId={queueInfo.member_id}
            />

            {/* Queue details */}
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Official Venue</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {venues.find(v => v.id === selectedVenue)?.name || 'Venue'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Assigned Zone</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedZoneName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Current Status</span>
                <span style={{
                  color: status === 'your_turn' ? '#00e676' : status === 'done' ? '#448aff' : '#ffc107',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}>
                  {status.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Leave queue */}
            {status !== 'done' && (
              <button
                className="btn"
                style={{
                  marginTop: '16px',
                  background: 'rgba(255, 23, 68, 0.15)',
                  color: '#ff1744',
                  border: '1px solid rgba(255, 23, 68, 0.3)',
                }}
                onClick={() => {
                  setQueueInfo(null);
                  setLiveStatus(null);
                  setName('');
                  setPhone('');
                  setEmail('');
                  setSelectedZone('');
                  toast('Left the queue');
                }}
              >
                Leave Queue
              </button>
            )}

            {status === 'done' && (
              <button
                className="btn btn-primary"
                style={{ marginTop: '16px' }}
                onClick={() => {
                  setQueueInfo(null);
                  setLiveStatus(null);
                  setName('');
                  setPhone('');
                  setEmail('');
                  setSelectedZone('');
                }}
              >
                Join Another Queue
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
