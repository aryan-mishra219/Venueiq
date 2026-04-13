import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';

export default function StaffLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const success = onLogin(password);
    if (!success) {
      setLoginError('Invalid password. Please try again.');
    }
  };

  return (
    <div className="staff-login">
      <form className="staff-login-card" onSubmit={handleSubmit} style={{ background: 'var(--ops-surface)', borderColor: 'var(--ops-border)' }}>
        <div className="staff-login-icon" style={{ background: 'var(--ops-cyan-dim)' }}>
          <ShieldAlert size={28} color="var(--ops-cyan)" aria-hidden="true" />
        </div>
        <h2 style={{ fontFamily: 'var(--ops-mono)', color: 'var(--ops-cyan)', letterSpacing: '3px' }}>STAFF ACCESS</h2>
        <p style={{ fontFamily: 'var(--ops-mono)', fontSize: '11px', color: 'var(--ops-text-dim)' }}>ENTER CREDENTIALS TO ACCESS COMMAND CENTER</p>
        
        {loginError && <div className="staff-login-error" role="alert">{loginError}</div>}
        
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
          style={{ width: '100%', padding: '12px', background: 'var(--ops-cyan-dim)', border: '1px solid var(--ops-border-bright)', borderRadius: '6px', color: 'var(--ops-cyan)', fontFamily: 'var(--ops-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', cursor: 'pointer' }}
        >
          UNLOCK DASHBOARD
        </button>
      </form>
    </div>
  );
}
