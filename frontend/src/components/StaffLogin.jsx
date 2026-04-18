import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';

export default function StaffLogin({ onLogin, externalError }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(password);
      // Parent handleLogin will set errors if authentication fails
    } catch (err) {
      console.error('Login bridge failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const displayError = externalError;

  return (
    <div className="staff-login">
      <form className="staff-login-card" onSubmit={handleSubmit} style={{ background: 'var(--ops-surface)', borderColor: 'var(--ops-border)' }}>
        <div className="staff-login-icon" style={{ background: 'var(--ops-cyan-dim)' }}>
          <ShieldAlert size={28} color="var(--ops-cyan)" aria-hidden="true" />
        </div>
        <h2 style={{ fontFamily: 'var(--ops-mono)', color: 'var(--ops-cyan)', letterSpacing: '3px' }}>STAFF ACCESS</h2>
        <p style={{ fontFamily: 'var(--ops-mono)', fontSize: '11px', color: 'var(--ops-text-dim)' }}>ENTER CREDENTIALS TO ACCESS COMMAND CENTER</p>
        
        {displayError && <div className="staff-login-error" role="alert" style={{ color: 'var(--ops-magenta)', fontSize: '10px', marginBottom: '15px', textAlign: 'center' }}>{displayError}</div>}
        
        <div className="form-group">
          <input
            type="password"
            className="form-input"
            placeholder="Enter staff password"
            aria-label="Staff Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            style={{ background: 'var(--ops-surface-2)', borderColor: 'var(--ops-border)', fontFamily: 'var(--ops-mono)' }}
          />
        </div>
        <button 
          type="submit" 
          aria-label="Unlock Dashboard"
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '12px', 
            background: loading ? 'var(--ops-bg)' : 'var(--ops-cyan-dim)', 
            border: '1px solid var(--ops-border-bright)', 
            borderRadius: '6px', 
            color: loading ? 'var(--ops-text-dim)' : 'var(--ops-cyan)', 
            fontFamily: 'var(--ops-mono)', 
            fontSize: '12px', 
            fontWeight: 700, 
            letterSpacing: '2px', 
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'VERIFYING IDENTITY...' : 'UNLOCK DASHBOARD'}
        </button>
      </form>
    </div>
  );
}
