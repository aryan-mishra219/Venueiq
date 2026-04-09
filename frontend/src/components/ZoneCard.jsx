import { getCongestionLevel, getScoreColor } from './VenueMap';

export default function ZoneCard({ zone, showActions = false, onReport, queueCount }) {
  const level = getCongestionLevel(zone.crowd_score);
  const color = getScoreColor(zone.crowd_score);
  const levelText = level === 'low' ? 'Low' : level === 'moderate' ? 'Moderate' : 'Crowded';
  const typeIcons = { gate: '🚪', food: '🍔', restroom: '🚻', parking: '🅿️' };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  return (
    <div className={`zone-card ${level}`}>
      <div className="zone-card-header">
        <div>
          <div className="zone-card-name">
            {typeIcons[zone.type] || '📍'} {zone.name}
          </div>
          <div className="zone-card-type">{zone.type}</div>
        </div>
        <span className={`zone-card-badge ${level}`}>{levelText}</span>
      </div>

      <div className="zone-card-score">
        <div className="zone-card-score-bar">
          <div
            className={`zone-card-score-fill ${level}`}
            style={{ width: `${zone.crowd_score * 10}%` }}
          />
        </div>
      </div>

      <div className="zone-card-meta">
        <span className="zone-card-score-label" style={{ color }}>
          Score: {zone.crowd_score}/10
        </span>
        {queueCount !== undefined && (
          <span>🎫 Queue: {queueCount}</span>
        )}
        <span>🕐 {formatTime(zone.last_updated)}</span>
      </div>

      {showActions && onReport && (
        <div className="zone-card-actions">
          <button
            className="zone-card-btn danger"
            onClick={() => onReport(zone.id, 'crowded')}
          >
            🔴 Report Crowded
          </button>
          <button
            className="zone-card-btn success"
            onClick={() => onReport(zone.id, 'clear')}
          >
            🟢 Report Clear
          </button>
        </div>
      )}
    </div>
  );
}
