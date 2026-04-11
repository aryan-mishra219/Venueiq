import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Map, Ticket, Shield } from 'lucide-react';
import AttendeePage from './pages/AttendeePage';
import StaffDashboard from './pages/StaffDashboard';
import QueuePage from './pages/QueuePage';
import AnnouncementToast from './components/AnnouncementToast';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [systemStatus, setSystemStatus] = useState('FETCHING');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/health`);
        if (res.ok) setSystemStatus('STABLE');
        else setSystemStatus('ERROR');
      } catch (err) {
        setSystemStatus('OFFLINE');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <div className="app">
        {/* Navigation — OPS Style */}
        <nav className="navbar">
          <div className="navbar-brand">
            <div className="navbar-logo">V</div>
            <div>
              <div className="navbar-title">VenueIQ</div>
              <div className="navbar-subtitle">CROWD INTELLIGENCE</div>
            </div>
          </div>

          <div className="navbar-links">
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
              <Map size={14} className="nav-link-icon" />
              <span>MAP</span>
            </NavLink>
            <NavLink to="/queue" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Ticket size={14} className="nav-link-icon" />
              <span>QUEUE</span>
            </NavLink>
            <NavLink to="/staff" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Shield size={14} className="nav-link-icon" />
              <span>OPS</span>
            </NavLink>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontFamily: 'var(--ops-mono)', fontSize: '9px', color: 'var(--ops-text-dim)', letterSpacing: '1px' }}>SYSTEM STATUS:</span>
            <span style={{ 
              fontFamily: 'var(--ops-mono)', 
              fontSize: '10px', 
              color: systemStatus === 'STABLE' ? 'var(--ops-green)' : systemStatus === 'OFFLINE' ? 'var(--ops-magenta)' : 'var(--ops-amber)', 
              fontWeight: 700, 
              letterSpacing: '1px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '5px' 
            }}>
              <span style={{ 
                width: '6px', 
                height: '6px', 
                background: systemStatus === 'STABLE' ? 'var(--ops-green)' : systemStatus === 'OFFLINE' ? 'var(--ops-magenta)' : 'var(--ops-amber)', 
                borderRadius: '50%', 
                display: 'inline-block' 
              }} />
              {systemStatus}
            </span>
          </div>
        </nav>

        {/* Main Content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<AttendeePage />} />
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/staff" element={<StaffDashboard />} />
          </Routes>
        </main>

        {/* Real-time Announcement Listener */}
        <AnnouncementToast />

        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#111827',
              color: '#f0f6fc',
              borderRadius: '6px',
              border: '1px solid rgba(0, 255, 213, 0.15)',
              fontSize: '12px',
              fontFamily: "'JetBrains Mono', monospace",
            },
            success: {
              iconTheme: { primary: '#00e676', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#ff2d78', secondary: '#fff' },
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;
