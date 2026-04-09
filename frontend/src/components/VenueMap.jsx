import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Venue center coordinates (MSG-inspired layout)
const VENUE_CENTER = [40.7512, -73.9930];
const VENUE_ZOOM = 17;

// Helper to get congestion level
function getCongestionLevel(score) {
  if (score <= 3) return 'low';
  if (score <= 6) return 'moderate';
  return 'high';
}

// Helper to get color for score
function getScoreColor(score) {
  if (score <= 3) return '#00e676';
  if (score <= 6) return '#ffc107';
  return '#ff1744';
}

// Custom icon factory
function createZoneIcon(score, type) {
  const level = getCongestionLevel(score);
  const color = getScoreColor(score);
  const icons = { gate: '🚪', food: '🍔', restroom: '🚻', parking: '🅿️' };
  const icon = icons[type] || '📍';

  return L.divIcon({
    className: '',
    html: `
      <div class="zone-marker ${level}" style="position:relative;">
        <span style="font-size:18px;filter:none;">${icon}</span>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -28],
  });
}

// Zone adjacency graph for pathfinding
const ZONE_ADJACENCY = {
  gate_a: ['gate_b', 'food_court_1', 'parking_lot'],
  gate_b: ['gate_a', 'gate_c', 'food_court_1', 'food_court_2'],
  gate_c: ['gate_b', 'food_court_2', 'restrooms_south'],
  food_court_1: ['gate_a', 'gate_b', 'restrooms_north'],
  food_court_2: ['gate_b', 'gate_c', 'restrooms_south'],
  restrooms_north: ['food_court_1', 'restrooms_south'],
  restrooms_south: ['food_court_2', 'restrooms_north', 'gate_c'],
  parking_lot: ['gate_a'],
};

// Simple Dijkstra pathfinding using crowd scores as weights
function findLeastCrowdedPath(zones, fromId, toId) {
  if (fromId === toId) return [fromId];

  const zoneMap = {};
  zones.forEach(z => { zoneMap[z.id] = z; });

  const distances = {};
  const previous = {};
  const unvisited = new Set();

  zones.forEach(z => {
    distances[z.id] = Infinity;
    previous[z.id] = null;
    unvisited.add(z.id);
  });
  distances[fromId] = 0;

  while (unvisited.size > 0) {
    let current = null;
    let minDist = Infinity;
    for (const id of unvisited) {
      if (distances[id] < minDist) {
        minDist = distances[id];
        current = id;
      }
    }
    if (current === null || current === toId) break;
    unvisited.delete(current);

    const neighbors = ZONE_ADJACENCY[current] || [];
    for (const neighbor of neighbors) {
      if (!unvisited.has(neighbor)) continue;
      const weight = 1 + (zoneMap[neighbor]?.crowd_score || 0);
      const alt = distances[current] + weight;
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        previous[neighbor] = current;
      }
    }
  }

  // Reconstruct path
  const path = [];
  let step = toId;
  while (step) {
    path.unshift(step);
    step = previous[step];
  }
  return path[0] === fromId ? path : [];
}

// Component to fit map bounds dynamically
function MapBoundsUpdater({ zones }) {
  const map = useMap();
  useEffect(() => {
    if (zones.length > 0) {
      const bounds = zones.map(z => z.coordinates);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
    }
  }, [zones, map]);
  return null;
}

export default function VenueMap({ zones, onReport, wayfindingFrom, wayfindingTo }) {
  const [reportingZone, setReportingZone] = useState(null);

  // Calculate wayfinding path
  const pathData = useMemo(() => {
    if (!wayfindingFrom || !wayfindingTo || zones.length === 0) return null;
    const path = findLeastCrowdedPath(zones, wayfindingFrom, wayfindingTo);
    if (path.length < 2) return null;

    const zoneMap = {};
    zones.forEach(z => { zoneMap[z.id] = z; });

    const coords = path
      .map(id => zoneMap[id]?.coordinates)
      .filter(Boolean);

    // Estimate: 1 min per zone hop
    const walkTime = (path.length - 1) * 1.5;
    const totalCrowd = path.reduce((sum, id) => sum + (zoneMap[id]?.crowd_score || 0), 0);

    return { coords, walkTime, path, totalCrowd };
  }, [zones, wayfindingFrom, wayfindingTo]);

  const handleReport = async (zoneId, type) => {
    setReportingZone(zoneId);
    try {
      await onReport(zoneId, type);
    } finally {
      setTimeout(() => setReportingZone(null), 500);
    }
  };

  return (
    <>
      <div className="map-container">
        <MapContainer
          center={VENUE_CENTER}
          zoom={VENUE_ZOOM}
          zoomControl={true}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBoundsUpdater zones={zones} />

          {zones.map(zone => (
            <Marker
              key={zone.id}
              position={zone.coordinates}
              icon={createZoneIcon(zone.crowd_score, zone.type)}
            >
              <Popup>
                <div className="zone-popup">
                  <div className="zone-popup-name">{zone.name}</div>
                  <div className="zone-popup-score">
                    <span style={{ fontSize: '13px', fontWeight: 600, color: getScoreColor(zone.crowd_score) }}>
                      {zone.crowd_score}/10
                    </span>
                    <div className="zone-popup-bar">
                      <div
                        className="zone-popup-fill"
                        style={{
                          width: `${zone.crowd_score * 10}%`,
                          background: getScoreColor(zone.crowd_score),
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    {getCongestionLevel(zone.crowd_score) === 'low' && '✅ Low congestion — good to go!'}
                    {getCongestionLevel(zone.crowd_score) === 'moderate' && '⚠️ Moderate crowd — plan ahead'}
                    {getCongestionLevel(zone.crowd_score) === 'high' && '🔴 High congestion — consider alternatives'}
                  </div>
                  <div className="zone-popup-actions">
                    <button
                      className="zone-popup-btn crowded"
                      onClick={() => handleReport(zone.id, 'crowded')}
                      disabled={reportingZone === zone.id}
                    >
                      🔴 Crowded
                    </button>
                    <button
                      className="zone-popup-btn clear"
                      onClick={() => handleReport(zone.id, 'clear')}
                      disabled={reportingZone === zone.id}
                    >
                      🟢 Clear
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Wayfinding polyline */}
          {pathData && (
            <Polyline
              positions={pathData.coords}
              pathOptions={{
                color: '#448aff',
                weight: 5,
                opacity: 0.9,
                dashArray: '12, 8',
                lineCap: 'round',
              }}
            />
          )}
        </MapContainer>
      </div>

      {/* Map Legend */}
      <div className="map-legend">
        <div className="legend-item">
          <div className="legend-dot low"></div>
          <span>Low (0-3)</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot moderate"></div>
          <span>Moderate (4-6)</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot high"></div>
          <span>Crowded (7-10)</span>
        </div>
      </div>

      {/* Wayfinding Info */}
      {pathData && (
        <div className="wayfinding-info" style={{ margin: '12px 24px', maxWidth: '1400px', marginLeft: 'auto', marginRight: 'auto' }}>
          <div className="wayfinding-stat">
            <div className="wayfinding-stat-value">{pathData.walkTime.toFixed(0)} min</div>
            <div className="wayfinding-stat-label">Est. Walk Time</div>
          </div>
          <div className="wayfinding-stat">
            <div className="wayfinding-stat-value">{pathData.path.length - 1}</div>
            <div className="wayfinding-stat-label">Zone Hops</div>
          </div>
          <div className="wayfinding-stat">
            <div className="wayfinding-stat-value" style={{
              color: pathData.totalCrowd / pathData.path.length <= 3 ? '#00e676' :
                     pathData.totalCrowd / pathData.path.length <= 6 ? '#ffc107' : '#ff1744'
            }}>
              {(pathData.totalCrowd / pathData.path.length).toFixed(1)}
            </div>
            <div className="wayfinding-stat-label">Avg. Crowd Score</div>
          </div>
        </div>
      )}
    </>
  );
}

export { getCongestionLevel, getScoreColor, ZONE_ADJACENCY };
