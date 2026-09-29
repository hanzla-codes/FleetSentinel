import { useMemo, useState } from 'react'
import './AnalyticsPage.css'

const crisisStatuses = new Set([
  'warning',
  'critical',
  'distress',
  'distressed',
  'insufficient_fuel',
  'stranded',
])

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: digits,
  })
}

function AnalyticsPage({ ships = [], incidents = [], incidentHistory = [] }) {
  const [statusFilter, setStatusFilter] = useState('ALL')

  const metrics = useMemo(() => {
    const total = ships.length
    const normal = ships.filter((s) => s.status === 'normal').length
    const alerts = ships.filter((s) => crisisStatuses.has(s.status)).length
    const stopped = ships.filter((s) =>
      ['stopped', 'stranded', 'insufficient_fuel'].includes(s.status)
    ).length

    const totalFuel = ships.reduce(
      (sum, ship) => sum + Number(ship.fuel_tons || 0),
      0
    )
    const averageFuel = total ? totalFuel / total : 0
    const averageSpeed = total
      ? ships.reduce((sum, ship) => sum + Number(ship.speed_knots || 0), 0) / total
      : 0

    const statusMap = {}
    const cargoMap = {}
    const destinationMap = {}

    ships.forEach((ship) => {
      const status = ship.status || 'unknown'
      const cargo = ship.cargo || 'Unknown'
      const destination = ship.destination || 'Unknown'

      statusMap[status] = (statusMap[status] || 0) + 1
      cargoMap[cargo] = (cargoMap[cargo] || 0) + 1
      destinationMap[destination] = (destinationMap[destination] || 0) + 1
    })

    return {
      total,
      normal,
      alerts,
      stopped,
      totalFuel,
      averageFuel,
      averageSpeed,
      statusMap,
      cargoMap,
      destinationMap,
    }
  }, [ships])

  const visibleShips = useMemo(() => {
    if (statusFilter === 'ALL') return ships

    if (statusFilter === 'ALERTS') {
      return ships.filter((ship) => crisisStatuses.has(ship.status))
    }

    return ships.filter((ship) => ship.status === statusFilter)
  }, [ships, statusFilter])

  const statusRows = Object.entries(metrics.statusMap)
    .sort((a, b) => b[1] - a[1])

  const cargoRows = Object.entries(metrics.cargoMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const destinationRows = Object.entries(metrics.destinationMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const maxStatus = Math.max(...statusRows.map(([, value]) => value), 1)
  const maxCargo = Math.max(...cargoRows.map(([, value]) => value), 1)

  return (
    <div className="analytics-page">
      <section className="analytics-hero">
        <div>
          <div className="analytics-tag">
            <span />
            FLEET INTELLIGENCE
          </div>
          <h2>
            Operational
            <br />
            <strong>analytics.</strong>
          </h2>
          <p>
            Live performance, fleet composition, fuel readiness,
            destinations, and incident activity from current telemetry.
          </p>
        </div>

        <div className="analytics-live-card">
          <span>DATA SOURCE</span>
          <strong>LIVE TELEMETRY</strong>
          <small>{ships.length} vessels synchronized</small>
        </div>
      </section>

      <section className="analytics-kpis">
        <div className="analytics-kpi">
          <span>TOTAL VESSELS</span>
          <strong>{formatNumber(metrics.total)}</strong>
          <small>Tracked in fleet</small>
        </div>

        <div className="analytics-kpi positive">
          <span>NORMAL</span>
          <strong>{formatNumber(metrics.normal)}</strong>
          <small>{metrics.total ? Math.round((metrics.normal / metrics.total) * 100) : 0}% of fleet</small>
        </div>

        <div className="analytics-kpi danger">
          <span>ACTIVE ALERTS</span>
          <strong>{formatNumber(metrics.alerts)}</strong>
          <small>{metrics.stopped} stopped / fuel-risk</small>
        </div>

        <div className="analytics-kpi">
          <span>AVG SPEED</span>
          <strong>{formatNumber(metrics.averageSpeed, 1)} <em>kn</em></strong>
          <small>Across live vessels</small>
        </div>

        <div className="analytics-kpi">
          <span>TOTAL FUEL</span>
          <strong>{formatNumber(metrics.totalFuel)} <em>t</em></strong>
          <small>Avg {formatNumber(metrics.averageFuel)} t / vessel</small>
        </div>
      </section>

      <section className="analytics-grid">
        <div className="analytics-panel">
          <div className="analytics-panel-head">
            <div>
              <span>FLEET DISTRIBUTION</span>
              <h3>Status Breakdown</h3>
            </div>
            <b>{statusRows.length} statuses</b>
          </div>

          <div className="bar-list">
            {statusRows.length === 0 && (
              <div className="analytics-empty">Waiting for fleet telemetry...</div>
            )}

            {statusRows.map(([status, value]) => (
              <div className="bar-row" key={status}>
                <div className="bar-label">
                  <span>{status.replaceAll('_', ' ').toUpperCase()}</span>
                  <strong>{value}</strong>
                </div>
                <div className="bar-track">
                  <div
                    className={`bar-fill ${crisisStatuses.has(status) ? 'danger' : ''}`}
                    style={{ width: `${(value / maxStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-panel">
          <div className="analytics-panel-head">
            <div>
              <span>CARGO PROFILE</span>
              <h3>Cargo Distribution</h3>
            </div>
          </div>

          <div className="bar-list">
            {cargoRows.length === 0 && (
              <div className="analytics-empty">No cargo data available.</div>
            )}

            {cargoRows.map(([cargo, value]) => (
              <div className="bar-row" key={cargo}>
                <div className="bar-label">
                  <span>{cargo}</span>
                  <strong>{value}</strong>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill cargo"
                    style={{ width: `${(value / maxCargo) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-panel">
          <div className="analytics-panel-head">
            <div>
              <span>ROUTE INTELLIGENCE</span>
              <h3>Top Destinations</h3>
            </div>
          </div>

          <div className="destination-list">
            {destinationRows.length === 0 && (
              <div className="analytics-empty">No destination data available.</div>
            )}

            {destinationRows.map(([destination, value]) => (
              <div className="destination-row" key={destination}>
                <div>
                  <span>DESTINATION</span>
                  <strong>{destination}</strong>
                </div>
                <b>{value}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-panel">
          <div className="analytics-panel-head">
            <div>
              <span>INCIDENT INTELLIGENCE</span>
              <h3>Response Activity</h3>
            </div>
          </div>

          <div className="incident-summary">
            <div>
              <span>CURRENT INCIDENTS</span>
              <strong>{incidents.length}</strong>
            </div>
            <div>
              <span>RESPONSE ACTIONS</span>
              <strong>{incidentHistory.length}</strong>
            </div>
            <div>
              <span>ACKNOWLEDGED</span>
              <strong>
                {incidentHistory.filter((item) => item.action === 'ACKNOWLEDGED').length}
              </strong>
            </div>
            <div>
              <span>DISMISSED</span>
              <strong>
                {incidentHistory.filter((item) => item.action === 'DISMISSED').length}
              </strong>
            </div>
          </div>

          <div className="incident-mini-list">
            {incidentHistory.slice(0, 5).map((item, index) => (
              <div key={`${item.id}-${index}`}>
                <span>{item.action}</span>
                <strong>{item.vessel || 'Unknown Vessel'}</strong>
                <small>
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </small>
              </div>
            ))}

            {incidentHistory.length === 0 && (
              <div className="analytics-empty">No response actions recorded yet.</div>
            )}
          </div>
        </div>
      </section>

      <section className="analytics-panel analytics-table-panel">
        <div className="analytics-panel-head">
          <div>
            <span>LIVE TELEMETRY ANALYSIS</span>
            <h3>Vessel Performance</h3>
          </div>

          <div className="analytics-filters">
            {['ALL', 'normal', 'warning', 'critical', 'ALERTS'].map((filter) => (
              <button
                key={filter}
                className={statusFilter === filter ? 'active' : ''}
                onClick={() => setStatusFilter(filter)}
              >
                {filter === 'ALL' ? 'ALL' : filter === 'ALERTS' ? 'ALERTS' : filter.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>VESSEL</th>
                <th>STATUS</th>
                <th>SPEED</th>
                <th>HEADING</th>
                <th>FUEL</th>
                <th>DESTINATION</th>
              </tr>
            </thead>
            <tbody>
              {visibleShips.map((ship) => (
                <tr key={ship.id || ship.name}>
                  <td>
                    <strong>{ship.name}</strong>
                    <small>{ship.id}</small>
                  </td>
                  <td>
                    <span className={`analytics-status ${ship.status}`}>
                      {String(ship.status || 'unknown').replaceAll('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td>{formatNumber(ship.speed_knots, 1)} kn</td>
                  <td>{formatNumber(ship.heading, 0)}°</td>
                  <td>{formatNumber(ship.fuel_tons)} t</td>
                  <td>{ship.destination || 'N/A'}</td>
                </tr>
              ))}

              {visibleShips.length === 0 && (
                <tr>
                  <td colSpan="6" className="analytics-empty-cell">
                    No vessels match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default AnalyticsPage
