import { getCongestionLevel, getScoreColor } from './VenueMap';
import { DoorOpen, Utensils, Users, Car, MapPin, Ticket, Clock, AlertCircle, CheckCircle } from 'lucide-react';

export default function ZoneCard({ zone, showActions = false, onReport, queueCount }) {
  const level = getCongestionLevel(zone.crowd_score);
  const color = getScoreColor(zone.crowd_score);
  const levelText = level === 'low' ? 'Low' : level === 'moderate' ? 'Moderate' : 'Crowded';

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
          <div className="zone-card-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {zone.type === 'gate' ? <DoorOpen size={14} /> :
             zone.type === 'food' ? <Utensils size={14} /> :
             zone.type === 'restroom' ? <Users size={14} /> :
             zone.type === 'parking' ? <Car size={14} /> :
             <MapPin size={14} />} {zone.name}
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
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Ticket size={10} /> Queue: {queueCount}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={10} /> {formatTime(zone.last_updated)}
        </span>
      </div>

      {showActions && onReport && (
        <div className="zone-card-actions">
          <button
            className="zone-card-btn danger"
            onClick={() => onReport(zone.id, 'crowded')}
            aria-label={`Report ${zone.name} as crowded`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <AlertCircle size={14} /> Report Crowded
          </button>
          <button
            className="zone-card-btn success"
            onClick={() => onReport(zone.id, 'clear')}
            aria-label={`Report ${zone.name} as clear`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <CheckCircle size={14} /> Report Clear
          </button>
        </div>
      )}
    </div>
  );
}
