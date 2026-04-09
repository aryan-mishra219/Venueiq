import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AttendeePage from './pages/AttendeePage';
import StaffDashboard from './pages/StaffDashboard';
import QueuePage from './pages/QueuePage';
import AnnouncementToast from './components/AnnouncementToast';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app">
        {/* Navigation */}
        <nav className="navbar">
          <div className="navbar-brand">
            <div className="navbar-logo">V</div>
            <div>
              <div className="navbar-title">VenueIQ Bharat</div>
              <div className="navbar-subtitle">CROWD INTELLIGENCE</div>
            </div>
          </div>
          <div className="navbar-links">
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
              <span className="nav-link-icon">🗺️</span>
              <span>Live Map</span>
            </NavLink>
            <NavLink to="/queue" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-link-icon">🎫</span>
              <span>Queue</span>
            </NavLink>
            <NavLink to="/staff" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-link-icon">🛡️</span>
              <span>Staff</span>
            </NavLink>
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
              background: '#16213e',
              color: '#e8eaed',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#00e676', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#ff1744', secondary: '#fff' },
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;
