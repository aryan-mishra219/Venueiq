import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import QueueCard from '../components/QueueCard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function QueuePage() {
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [joining, setJoining] = useState(false);
  const [queueInfo, setQueueInfo] = useState(null);  // { member_id, zone_id, position, estimated_wait_minutes }
  const [liveStatus, setLiveStatus] = useState(null); // Real-time status from Firestore

  // Load zones
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'zones'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setZones(data);
    });
    return () => unsubscribe();
  }, []);

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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Virtual Queue</h1>
        <p className="page-subtitle">
          Skip the physical line — join a virtual queue and get notified when it's your turn
        </p>
      </div>

      <div className="queue-page">
        {/* If not in a queue, show join form */}
        {!queueInfo ? (
          <>
            <form className="queue-join-form" onSubmit={handleJoinQueue}>
              <h3>🎫 Join a Queue</h3>
              <p>Select a zone and enter your details to join the virtual queue</p>

              <div className="form-group">
                <label className="form-label">Zone / Stall</label>
                <select
                  className="form-select"
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  required
                >
                  <option value="">Select a zone...</option>
                  {zones.map(zone => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} — Score: {zone.crowd_score}/10
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Your Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="John Doe"
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
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={joining}
              >
                {joining ? (
                  <>
                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span>
                    Joining...
                  </>
                ) : (
                  '🎫 Join Queue'
                )}
              </button>
            </form>

            {/* QR Code Section */}
            <div className="qr-section">
              <h3>📱 Scan to Join Queue</h3>
              <p style={{ color: '#9aa0a6', fontSize: '13px', marginBottom: '16px' }}>
                Share this QR code at stalls and entry points
              </p>
              <div className="qr-code-wrapper">
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
            />

            {/* Queue details */}
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Zone</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedZoneName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Member ID</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{queueInfo.member_id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Status</span>
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
                  setSelectedZone('');
                  toast('Left the queue', { icon: '👋' });
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
