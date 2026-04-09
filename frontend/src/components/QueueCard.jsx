export default function QueueCard({ position, estimatedWait, status, name, zone }) {
  const isYourTurn = status === 'your_turn';

  return (
    <div className={`queue-status-card ${isYourTurn ? 'your-turn' : ''}`}>
      {/* Status label */}
      <div className="queue-status-label">
        {isYourTurn ? "🎉 It's Your Turn!" : `You're in line at ${zone}`}
      </div>

      {/* Big position number */}
      <div className={`queue-position ${isYourTurn ? 'your-turn' : ''}`}>
        #{position}
      </div>

      {/* Wait info */}
      {!isYourTurn && (
        <>
          <div className="queue-wait-time">
            ~{estimatedWait} min
          </div>
          <div className="queue-status-label">estimated wait time</div>
        </>
      )}

      {/* YOUR TURN alert */}
      {isYourTurn && (
        <div className="queue-your-turn-alert">
          <h3>🟢 YOUR TURN</h3>
          <p>Please proceed to the counter now!</p>
        </div>
      )}

      {/* Done status */}
      {status === 'done' && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          background: 'rgba(68, 138, 255, 0.15)',
          borderRadius: '12px',
          border: '1px solid rgba(68, 138, 255, 0.3)',
        }}>
          <h3 style={{ color: '#448aff', fontSize: '18px', marginBottom: '4px' }}>✅ Completed</h3>
          <p style={{ color: '#9aa0a6', fontSize: '13px' }}>Thank you for your patience, {name}!</p>
        </div>
      )}
    </div>
  );
}
