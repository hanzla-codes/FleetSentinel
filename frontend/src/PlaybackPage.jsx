import { useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function PlaybackPage() {
  const [snapshots, setSnapshots] = useState([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    fetch(`${API_BASE}/api/dispatch/playback`)
      .then((response) => response.json())
      .then((data) => setSnapshots(Array.isArray(data.snapshots) ? data.snapshots : []))
      .catch(() => setSnapshots([]))
  }, [])

  const snapshot = snapshots[index]
  const visibleShips = useMemo(() => snapshot?.ships || [], [snapshot])

  return (
    <div className="dashboard-content">
      <section className="panel" style={{ padding: 24 }}>
        <div className="panel-header">
          <div>
            <span className="panel-label">OPERATIONS HISTORY</span>
            <h3>Fleet Playback</h3>
          </div>
          <span>{snapshots.length} snapshots · 30 sec resolution</span>
        </div>
        <input type="range" min="0" max={Math.max(0, snapshots.length - 1)} value={index} onChange={(e) => setIndex(Number(e.target.value))} style={{ width: '100%' }} disabled={!snapshots.length} />
        <div style={{ margin: '10px 0', color: '#94a3b8' }}>{snapshot ? new Date(snapshot.timestamp * 1000).toLocaleString() : 'Waiting for history…'}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th align="left">Vessel</th><th align="left">Position</th><th align="left">Fuel</th><th align="left">Status</th></tr></thead>
            <tbody>{visibleShips.map((ship) => <tr key={ship.id}><td>{ship.name}</td><td>{ship.position.lat.toFixed(3)}, {ship.position.lng.toFixed(3)}</td><td>{ship.fuel_tons.toFixed(1)} t</td><td>{ship.status}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
