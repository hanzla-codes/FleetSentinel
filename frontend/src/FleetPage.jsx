import { useMemo, useState } from 'react'

function getStatusClass(status) {
  switch (status) {
    case 'critical':
    case 'distressed':
    case 'distress':
      return 'critical'

    case 'warning':
    case 'insufficient_fuel':
      return 'warning'

    case 'rerouting':
      return 'rerouting'

    case 'stopped':
    case 'stranded':
      return 'stopped'

    case 'arrived':
      return 'arrived'

    default:
      return 'normal'
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'insufficient_fuel':
      return 'INSUFFICIENT FUEL'

    case 'distressed':
      return 'DISTRESSED'

    default:
      return String(status || 'normal').toUpperCase()
  }
}

function getFuelPercentage(fuel) {
  const value = Number(fuel || 0)

  return Math.max(
    0,
    Math.min(100, (value / 7500) * 100)
  )
}

export default function FleetPage({ ships = [] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedShip, setSelectedShip] = useState(null)

  const filteredShips = useMemo(() => {
    const query = search.trim().toLowerCase()

    return ships.filter((ship) => {
      const matchesSearch =
        !query ||
        String(ship.name || '')
          .toLowerCase()
          .includes(query) ||
        String(ship.id || '')
          .toLowerCase()
          .includes(query) ||
        String(ship.cargo || '')
          .toLowerCase()
          .includes(query) ||
        String(ship.destination || '')
          .toLowerCase()
          .includes(query)

      const matchesStatus =
        statusFilter === 'all' ||
        ship.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [ships, search, statusFilter])

  const normalCount = ships.filter(
    (ship) => ship.status === 'normal'
  ).length

  const warningCount = ships.filter(
    (ship) =>
      ship.status === 'warning' ||
      ship.status === 'insufficient_fuel'
  ).length

  const criticalCount = ships.filter(
    (ship) =>
      ship.status === 'critical' ||
      ship.status === 'distress' ||
      ship.status === 'distressed' ||
      ship.status === 'stranded'
  ).length

  return (
    <div className="fleet-page">

      {/* HEADER */}
      <section className="fleet-page-header">
        <div>
          <div className="section-tag">
            <span></span>
            FLEET CONTROL
          </div>

          <h2>
            Fleet
            <br />
            <span>control center.</span>
          </h2>

          <p>
            Real-time monitoring and operational
            information for every vessel in the fleet.
          </p>
        </div>

        <div className="fleet-live-box">
          <span className="fleet-live-dot"></span>

          <div>
            <strong>LIVE FLEET</strong>
            <small>
              {ships.length} vessels connected
            </small>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="fleet-stats">

        <div className="fleet-stat">
          <span>TOTAL VESSELS</span>
          <strong>{ships.length}</strong>
          <small>LIVE TRACKING</small>
        </div>

        <div className="fleet-stat">
          <span>NORMAL</span>
          <strong>{normalCount}</strong>
          <small>OPERATING NORMALLY</small>
        </div>

        <div className="fleet-stat warning-stat">
          <span>WARNING</span>
          <strong>{warningCount}</strong>
          <small>REQUIRES MONITORING</small>
        </div>

        <div className="fleet-stat danger-stat">
          <span>CRITICAL</span>
          <strong>{criticalCount}</strong>
          <small>IMMEDIATE ATTENTION</small>
        </div>

      </section>

      {/* CONTROLS */}
      <section className="fleet-controls">

        <div className="fleet-search">
          <span>⌕</span>

          <input
            type="text"
            placeholder="Search vessel, ID, cargo or destination..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <div className="fleet-filters">

          <button
            className={
              statusFilter === 'all'
                ? 'active'
                : ''
            }
            onClick={() =>
              setStatusFilter('all')
            }
          >
            ALL
          </button>

          <button
            className={
              statusFilter === 'normal'
                ? 'active'
                : ''
            }
            onClick={() =>
              setStatusFilter('normal')
            }
          >
            NORMAL
          </button>

          <button
            className={
              statusFilter === 'warning'
                ? 'active'
                : ''
            }
            onClick={() =>
              setStatusFilter('warning')
            }
          >
            WARNING
          </button>

          <button
            className={
              statusFilter === 'critical'
                ? 'active'
                : ''
            }
            onClick={() =>
              setStatusFilter('critical')
            }
          >
            CRITICAL
          </button>

        </div>

      </section>

      {/* TABLE */}
      <section className="panel fleet-full-panel">

        <div className="panel-header">
          <div>
            <span className="panel-label">
              LIVE TELEMETRY
            </span>

            <h3>
              Fleet Status
            </h3>
          </div>

          <span className="crisis-count">
            {filteredShips.length
              .toString()
              .padStart(2, '0')}{' '}
            VESSELS
          </span>
        </div>

        <div className="fleet-full-table">

          <div className="fleet-full-head">
            <span>VESSEL</span>
            <span>ID</span>
            <span>CARGO</span>
            <span>DESTINATION</span>
            <span>SPEED</span>
            <span>HEADING</span>
            <span>FUEL</span>
            <span>STATUS</span>
            <span></span>
          </div>

          {filteredShips.map((ship) => {
            const statusClass =
              getStatusClass(ship.status)

            const fuelPercentage =
              getFuelPercentage(
                ship.fuel_tons
              )

            return (
              <div
                className="fleet-full-row"
                key={ship.id}
              >

                <strong className="vessel-name">
                  <span
                    className={`vessel-dot ${statusClass}`}
                  ></span>

                  {ship.name}
                </strong>

                <span className="muted">
                  {ship.id}
                </span>

                <span>
                  {ship.cargo || 'N/A'}
                </span>

                <span>
                  → {ship.destination || 'N/A'}
                </span>

                <span>
                  {Number(
                    ship.speed_knots || 0
                  ).toFixed(1)}{' '}
                  kn
                </span>

                <span>
                  {Number(
                    ship.heading || 0
                  ).toFixed(0)}
                  °
                </span>

                <div className="fleet-fuel">
                  <div className="fuel-bar">
                    <span
                      style={{
                        width: `${fuelPercentage}%`,
                      }}
                    ></span>
                  </div>

                  <small>
                    {Number(
                      ship.fuel_tons || 0
                    ).toLocaleString()}{' '}
                    t
                  </small>
                </div>

                <span
                  className={`fleet-status ${statusClass}`}
                >
                  <i></i>

                  {getStatusLabel(
                    ship.status
                  )}
                </span>

                <button
                  className="details-button"
                  onClick={() =>
                    setSelectedShip(ship)
                  }
                >
                  VIEW
                </button>

              </div>
            )
          })}

          {filteredShips.length === 0 && (
            <div className="fleet-empty">
              <strong>
                No vessels found
              </strong>

              <span>
                Try changing your search or
                status filter.
              </span>
            </div>
          )}

        </div>
      </section>

      {/* SELECTED SHIP */}
      {selectedShip && (
        <div
          className="ship-overlay"
          onClick={() =>
            setSelectedShip(null)
          }
        >
          <div
            className="ship-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="ship-modal-header">
              <div>
                <span>
                  VESSEL PROFILE
                </span>

                <h3>
                  {selectedShip.name}
                </h3>
              </div>

              <button
                onClick={() =>
                  setSelectedShip(null)
                }
              >
                ×
              </button>
            </div>

            <div className="ship-status-large">
              <span
                className={`vessel-dot ${getStatusClass(
                  selectedShip.status
                )}`}
              ></span>

              {getStatusLabel(
                selectedShip.status
              )}
            </div>

            <div className="ship-details-grid">

              <div>
                <span>VESSEL ID</span>
                <strong>
                  {selectedShip.id}
                </strong>
              </div>

              <div>
                <span>CARGO</span>
                <strong>
                  {selectedShip.cargo ||
                    'N/A'}
                </strong>
              </div>

              <div>
                <span>DESTINATION</span>
                <strong>
                  {selectedShip.destination ||
                    'N/A'}
                </strong>
              </div>

              <div>
                <span>SPEED</span>
                <strong>
                  {Number(
                    selectedShip.speed_knots ||
                      0
                  ).toFixed(1)}{' '}
                  knots
                </strong>
              </div>

              <div>
                <span>HEADING</span>
                <strong>
                  {Number(
                    selectedShip.heading ||
                      0
                  ).toFixed(0)}
                  °
                </strong>
              </div>

              <div>
                <span>FUEL</span>
                <strong>
                  {Number(
                    selectedShip.fuel_tons ||
                      0
                  ).toLocaleString()}{' '}
                  tons
                </strong>
              </div>

              <div>
                <span>LATITUDE</span>
                <strong>
                  {selectedShip.position
                    ? Number(
                        selectedShip.position
                          .lat
                      ).toFixed(6)
                    : 'N/A'}
                </strong>
              </div>

              <div>
                <span>LONGITUDE</span>
                <strong>
                  {selectedShip.position
                    ? Number(
                        selectedShip.position
                          .lng
                      ).toFixed(6)
                    : 'N/A'}
                </strong>
              </div>

            </div>

            <div className="ship-live-location">
              <span>LIVE POSITION</span>

              <strong>
                {selectedShip.position
                  ? `${Number(
                      selectedShip.position.lat
                    ).toFixed(5)}, ${Number(
                      selectedShip.position.lng
                    ).toFixed(5)}`
                  : 'POSITION UNAVAILABLE'}
              </strong>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}