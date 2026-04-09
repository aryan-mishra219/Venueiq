export default function QueueCard({ position, estimatedWait, status, name, zone, memberId }) {
  const isYourTurn = status === 'your_turn';
  const isDone = status === 'done';

  return (
    <div className={`queue-status-card premium-pass ${isYourTurn ? 'active-turn' : ''} ${isDone ? 'completed-pass' : ''}`}>
      {/* Pass Header */}
      <div className="pass-header">
        <div className="pass-chip">V-IQ SMART PASS</div>
        <div className="pass-id">ID: {memberId || '-------'}</div>
      </div>

      <div className="pass-body">
        <div className="pass-user-info">
          <div className="pass-label">ATTENDEE</div>
          <div className="pass-value">{name || 'Guest'}</div>
        </div>
        
        <div className="pass-zone-info">
          <div className="pass-label">LOCATION</div>
          <div className="pass-value">{zone}</div>
        </div>
      </div>

      <div className="pass-divider">
        <div className="pass-notch left"></div>
        <div className="pass-notch right"></div>
      </div>

      <div className="pass-footer">
        {isDone ? (
          <div className="pass-status-final">
            <span className="icon">✅</span>
            <div>
              <div className="status-title">SERVICED</div>
              <div className="status-time">Thanks for your patience</div>
            </div>
          </div>
        ) : isYourTurn ? (
          <div className="pass-status-active">
            <span className="pulse-icon">🟢</span>
            <div>
              <div className="status-title">YOUR TURN</div>
              <div className="status-subtitle">Proceed to Counter</div>
            </div>
          </div>
        ) : (
          <div className="pass-status-waiting">
            <div className="pass-position-big">
              <span className="pos-hash">#</span>{position}
            </div>
            <div className="pass-wait-details">
              <div className="wait-label">In Queue</div>
              <div className="wait-value">~{estimatedWait} min</div>
            </div>
          </div>
        )}
      </div>
      
      {isYourTurn && (
        <div className="pass-entry-instruction">
          Please show this pass to the staff member
        </div>
      )}
    </div>
  );
}
