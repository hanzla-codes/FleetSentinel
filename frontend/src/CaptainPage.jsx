import { useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function CaptainPage({ ships = [] }) {
  const [selectedId, setSelectedId] = useState(ships[0]?.id || '')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const ship = useMemo(() => ships.find((item) => item.id === selectedId) || ships[0], [ships, selectedId])

  async function submitDistress() {
    if (!ship || message.trim().length < 3) return
    setBusy(true)
    setResult(null)
    try {
      const response = await fetch(`${API_BASE}/api/dispatch/distress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ship_id: ship.id, message: message.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Distress request failed')
      setResult(data)
      setMessage('')
    } catch (error) {
      setResult({ error: error.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dashboard-content">
      <section className="panel" style={{ padding: 24, maxWidth: 900 }}>
        <div className="panel-header">
          <div>
            <span className="panel-label">CAPTAIN INTERFACE</span>
            <h3>Vessel distress console</h3>
          </div>
        </div>
        <p style={{ color: '#94a3b8' }}>
          Select your vessel and send a free-form distress message. The backend extracts severity, problem and quantifiable impact for Command.
        </p>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ width: '100%', padding: 10, marginBottom: 12 }}>
          {ships.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}
        </select>
        {ship && <div style={{ marginBottom: 12, color: '#cbd5e1' }}>Destination: <strong>{ship.destination}</strong> · Status: <strong>{ship.status}</strong></div>}
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} placeholder="Example: Engine room is flooding. Two crew members are injured and propulsion is lost." style={{ width: '100%', boxSizing: 'border-box', padding: 12, resize: 'vertical' }} />
        <button onClick={submitDistress} disabled={busy || !ship || message.trim().length < 3} style={{ marginTop: 12, padding: '10px 16px', fontWeight: 700 }}>
          {busy ? 'PROCESSING…' : 'ESCALATE DISTRESS'}
        </button>
        {result && <pre style={{ marginTop: 18, whiteSpace: 'pre-wrap', background: '#0f172a', padding: 14, borderRadius: 8 }}>{JSON.stringify(result, null, 2)}</pre>}
      </section>
    </div>
  )
}
