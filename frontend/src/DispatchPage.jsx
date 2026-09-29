import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import './DispatchPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

function getStatusClass(status) {
  if (
    status === 'critical' ||
    status === 'distressed' ||
    status === 'stranded' ||
    status === 'insufficient_fuel'
  ) {
    return 'critical'
  }

  if (
    status === 'warning' ||
    status === 'rerouting'
  ) {
    return 'warning'
  }

  if (status === 'stopped') {
    return 'stopped'
  }

  if (status === 'arrived') {
    return 'arrived'
  }

  return 'normal'
}

function formatTime(value) {
  if (!value) {
    return '—'
  }

  return new Date(value).toLocaleTimeString(
    [],
    {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }
  )
}

function getCommandDetail(item) {
  if (item.command === 'REROUTE') {
    return item.destination || '—'
  }

  if (item.command === 'SET SPEED') {
    return `${item.speed ?? '—'} kn`
  }

  if (item.command === 'CHANGE HEADING') {
    return `${item.heading ?? '—'}°`
  }

  return 'Current position'
}

function getFuelPercent(fuel) {
  const value = Number(fuel || 0)

  /*
    Fleet simulator fuel values are stored
    in tons. This is only a visual meter.
  */
  return Math.max(
    0,
    Math.min(100, value / 100)
  )
}

export default function DispatchPage({
  ships = [],
  selectedVesselId = '',
  onSelectedVesselHandled,
}) {
  const [selectedId, setSelectedId] =
    useState(selectedVesselId || '')

  const [command, setCommand] =
    useState('REROUTE')

  const [destination, setDestination] =
    useState('')

  const [speed, setSpeed] =
    useState('')

  const [heading, setHeading] =
    useState('')

  const [priority, setPriority] =
    useState('HIGH')

  const [queue, setQueue] =
    useState([])

  const [history, setHistory] =
    useState([])

  const [message, setMessage] =
    useState('')

  const [busy, setBusy] =
    useState(false)

  /*
    IMPORTANT:
    This effect does NOT synchronously
    call setState.

    It only reacts to the external
    selectedVesselId prop.
  */
  useEffect(() => {
    if (!selectedVesselId) {
      return
    }

    setSelectedId(selectedVesselId)

    if (onSelectedVesselHandled) {
      onSelectedVesselHandled()
    }
  }, [
    selectedVesselId,
    onSelectedVesselHandled,
  ])

  /*
    Load backend dispatch history.
  */
  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      try {
        const response = await fetch(
          `${API_BASE}/api/dispatch/history`
        )

        if (!response.ok) {
          return
        }

        const data =
          await response.json()

        if (cancelled) {
          return
        }

        setHistory(
          Array.isArray(data.commands)
            ? data.commands
            : []
        )
      } catch {
        /*
          Backend may still be starting.
        */
      }
    }

    loadHistory()

    return () => {
      cancelled = true
    }
  }, [])

  /*
    Find currently selected vessel.
  */
  const selectedShip = useMemo(() => {
    return (
      ships.find(
        (ship) =>
          ship.id === selectedId
      ) ||
      ships.find(
        (ship) =>
          ship.id === selectedVesselId
      ) ||
      ships[0] ||
      null
    )
  }, [
    ships,
    selectedId,
    selectedVesselId,
  ])

  /*
    When telemetry arrives and there
    is no selection yet, the first ship
    is used.
  */
  useEffect(() => {
    if (
      !selectedId &&
      ships.length > 0
    ) {
      setSelectedId(ships[0].id)
    }
  }, [
    ships,
    selectedId,
  ])

  /*
    Selection handler.
    State changes happen directly from
    user interaction instead of an effect.
  */
  const selectShip = (id) => {
    const ship = ships.find(
      (item) => item.id === id
    )

    setSelectedId(id)

    if (ship) {
      setDestination(
        ship.destination || ''
      )

      setSpeed(
        ship.speed_knots ?? ''
      )

      setHeading(
        ship.heading ?? ''
      )
    }

    setMessage('')
  }

  /*
    If the user has not manually changed
    an input, use current telemetry.
  */
  const displayDestination =
    destination !== ''
      ? destination
      : selectedShip?.destination || ''

  const displaySpeed =
    speed !== ''
      ? speed
      : selectedShip?.speed_knots ?? 0

  const displayHeading =
    heading !== ''
      ? heading
      : selectedShip?.heading ?? 0

  const buildCommand = () => {
    if (!selectedShip) {
      return null
    }

    return {
      id:
        `${Date.now()}-${selectedShip.id}`,

      vessel:
        selectedShip.name,

      vesselId:
        selectedShip.id,

      command,

      destination:
        command === 'REROUTE'
          ? displayDestination
          : null,

      speed:
        command === 'SET SPEED'
          ? Number(displaySpeed)
          : null,

      heading:
        command === 'CHANGE HEADING'
          ? Number(displayHeading)
          : null,

      priority,

      time:
        new Date().toISOString(),

      status: 'QUEUED',
    }
  }

  const addCommand = () => {
    const item = buildCommand()

    if (!item) {
      setMessage(
        'No vessel selected.'
      )

      return
    }

    if (
      item.command === 'REROUTE' &&
      !item.destination.trim()
    ) {
      setMessage(
        'Destination is required for REROUTE.'
      )

      return
    }

    if (
      item.command === 'SET SPEED' &&
      (
        !Number.isFinite(item.speed) ||
        item.speed < 0 ||
        item.speed > 40
      )
    ) {
      setMessage(
        'Speed must be between 0 and 40 knots.'
      )

      return
    }

    if (
      item.command ===
        'CHANGE HEADING' &&
      (
        !Number.isFinite(item.heading) ||
        item.heading < 0 ||
        item.heading >= 360
      )
    ) {
      setMessage(
        'Heading must be between 0 and 359 degrees.'
      )

      return
    }

    setQueue(
      (previous) => [
        item,
        ...previous,
      ].slice(0, 12)
    )

    setMessage(
      `${command} command queued for ${selectedShip.name}.`
    )
  }

  const clearQueue = () => {
    setQueue([])

    setMessage(
      'Command queue cleared.'
    )
  }

  const executeLatest = async () => {
    const latest = queue[0]

    if (!latest || busy) {
      return
    }

    setBusy(true)

    setMessage(
      'Sending command to fleet control...'
    )

    try {
      const response =
        await fetch(
          `${API_BASE}/api/dispatch/command`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              ship_id:
                latest.vesselId,

              command:
                latest.command,

              destination:
                latest.destination,

              speed:
                latest.speed,

              heading:
                latest.heading,

              priority:
                latest.priority,
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.detail ||
          'Command execution failed.'
        )
      }

      const executed =
        data.command

      setQueue(
        (previous) =>
          previous.map(
            (item, index) =>
              index === 0
                ? {
                    ...item,
                    status:
                      'EXECUTED',
                    executedAt:
                      executed?.timestamp ||
                      new Date().toISOString(),
                  }
                : item
          )
      )

      if (executed) {
        setHistory(
          (previous) => [
            executed,
            ...previous,
          ].slice(0, 100)
        )
      }

      setMessage(
        `✓ ${
          data.message ||
          'Command executed successfully.'
        }`
      )
    } catch (error) {
      setQueue(
        (previous) =>
          previous.map(
            (item, index) =>
              index === 0
                ? {
                    ...item,
                    status:
                      'FAILED',
                  }
                : item
          )
      )

      setMessage(
        `✕ ${
          error.message ||
          'Command execution failed.'
        }`
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dispatch-page">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <section className="dispatch-hero">

        <div>

          <div className="dispatch-tag">
            <span />
            FLEET OPERATIONS
          </div>

          <h2>
            Dispatch{' '}
            <span>command.</span>
          </h2>

          <p>
            Prepare, prioritize and
            execute operational
            commands against live
            fleet telemetry.
          </p>

        </div>

        <div className="dispatch-hero-status">

          <span className="pulse-dot" />

          COMMAND LINK

          <strong>
            {ships.length
              .toString()
              .padStart(2, '0')}
          </strong>

          <small>
            vessels available
          </small>

        </div>

      </section>

      {/* =====================================================
          STATS
      ====================================================== */}

      <section className="dispatch-stats">

        <div className="dispatch-stat">

          <span>
            SELECTED VESSEL
          </span>

          <strong>
            {selectedShip?.name || '—'}
          </strong>

          <small>
            {selectedShip?.id ||
              'NO TELEMETRY'}
          </small>

        </div>

        <div className="dispatch-stat">

          <span>
            VESSEL STATUS
          </span>

          <strong
            className={
              getStatusClass(
                selectedShip?.status
              )
            }
          >
            {(
              selectedShip?.status ||
              '—'
            ).toUpperCase()}
          </strong>

          <small>
            Live telemetry
          </small>

        </div>

        <div className="dispatch-stat">

          <span>
            FUEL
          </span>

          <strong>
            {selectedShip
              ? Number(
                  selectedShip.fuel_tons
                ).toLocaleString()
              : '—'}{' '}
            t
          </strong>

          <div className="fuel-track">

            <i
              style={{
                width:
                  `${getFuelPercent(
                    selectedShip?.fuel_tons
                  )}%`,
              }}
            />

          </div>

        </div>

        <div className="dispatch-stat">

          <span>
            QUEUE
          </span>

          <strong>
            {queue.length
              .toString()
              .padStart(2, '0')}
          </strong>

          <small>
            pending commands
          </small>

        </div>

      </section>

      {/* =====================================================
          COMMAND + TELEMETRY
      ====================================================== */}

      <section className="dispatch-grid">

        <div className="dispatch-panel command-panel">

          <div className="dispatch-panel-head">

            <div>

              <span>
                COMMAND BUILDER
              </span>

              <h3>
                Fleet Control
              </h3>

            </div>

            <b>
              {busy
                ? 'EXECUTING'
                : 'READY'}
            </b>

          </div>

          <label>
            VESSEL

            <select
              value={
                selectedShip?.id || ''
              }
              onChange={(event) =>
                selectShip(
                  event.target.value
                )
              }
            >

              {ships.length === 0 && (
                <option value="">
                  Waiting for telemetry...
                </option>
              )}

              {ships.map((ship) => (
                <option
                  key={ship.id}
                  value={ship.id}
                >
                  {ship.name} · {ship.id}
                </option>
              ))}

            </select>

          </label>

          <div className="command-types">

            {[
              'REROUTE',
              'SET SPEED',
              'CHANGE HEADING',
              'HOLD POSITION',
            ].map((item) => (

              <button
                key={item}
                className={
                  command === item
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setCommand(item)
                }
                disabled={busy}
              >
                {item}
              </button>

            ))}

          </div>

          {command === 'REROUTE' && (

            <label>
              DESTINATION

              <input
                value={
                  displayDestination
                }
                onChange={(event) =>
                  setDestination(
                    event.target.value
                      .toUpperCase()
                  )
                }
                placeholder="MCT-1 / DXB-1 / SOH-1"
                disabled={busy}
              />

            </label>

          )}

          {command === 'SET SPEED' && (

            <label>
              SPEED · KNOTS

              <input
                type="number"
                min="0"
                max="40"
                value={displaySpeed}
                onChange={(event) =>
                  setSpeed(
                    event.target.value
                  )
                }
                disabled={busy}
              />

            </label>

          )}

          {command ===
            'CHANGE HEADING' && (

            <label>
              HEADING · DEGREES

              <input
                type="number"
                min="0"
                max="359"
                value={displayHeading}
                onChange={(event) =>
                  setHeading(
                    event.target.value
                  )
                }
                disabled={busy}
              />

            </label>

          )}

          {command ===
            'HOLD POSITION' && (

            <div className="command-note">
              Vessel movement will
              stop immediately and
              the current position will
              be maintained.
            </div>

          )}

          <label>
            PRIORITY

            <select
              value={priority}
              onChange={(event) =>
                setPriority(
                  event.target.value
                )
              }
              disabled={busy}
            >

              <option value="CRITICAL">
                CRITICAL
              </option>

              <option value="HIGH">
                HIGH
              </option>

              <option value="NORMAL">
                NORMAL
              </option>

            </select>

          </label>

          <div className="command-actions">

            <button
              className="queue-btn"
              onClick={addCommand}
              disabled={
                !selectedShip ||
                busy
              }
            >
              ＋ QUEUE COMMAND
            </button>

            <button
              className="dispatch-btn"
              onClick={executeLatest}
              disabled={
                !queue.length ||
                busy
              }
            >
              {busy
                ? 'EXECUTING...'
                : 'DISPATCH LATEST →'}
            </button>

          </div>

          {message && (
            <div className="command-message">
              {message}
            </div>
          )}

          <div className="command-disclaimer">
            Commands are executed by
            the FleetSentinel backend
            simulator and reflected in
            live telemetry.
          </div>

        </div>

        {/* =================================================
            TELEMETRY
        ================================================== */}

        <div className="dispatch-panel vessel-panel">

          <div className="dispatch-panel-head">

            <div>

              <span>
                LIVE TELEMETRY
              </span>

              <h3>
                Vessel Snapshot
              </h3>

            </div>

            <b className="live-badge">
              ● LIVE
            </b>

          </div>

          {selectedShip ? (

            <div className="vessel-snapshot">

              <div className="vessel-title">

                <div
                  className={
                    `vessel-orb ${
                      getStatusClass(
                        selectedShip.status
                      )
                    }`
                  }
                >
                  ◈
                </div>

                <div>

                  <h4>
                    {selectedShip.name}
                  </h4>

                  <span>
                    {selectedShip.id}
                    {' · '}
                    {selectedShip.cargo}
                  </span>

                </div>

              </div>

              <div className="telemetry-grid">

                <div>
                  <span>
                    DESTINATION
                  </span>

                  <strong>
                    {selectedShip.destination ||
                      '—'}
                  </strong>
                </div>

                <div>
                  <span>
                    SPEED
                  </span>

                  <strong>
                    {
                      selectedShip.speed_knots
                    }{' '}
                    kn
                  </strong>
                </div>

                <div>
                  <span>
                    HEADING
                  </span>

                  <strong>
                    {Number(
                      selectedShip.heading
                    ).toFixed(1)}
                    °
                  </strong>
                </div>

                <div>
                  <span>
                    FUEL
                  </span>

                  <strong>
                    {Number(
                      selectedShip.fuel_tons
                    ).toLocaleString()}
                    {' '}
                    t
                  </strong>
                </div>

                <div>
                  <span>
                    LATITUDE
                  </span>

                  <strong>
                    {Number(
                      selectedShip.position
                        ?.lat || 0
                    ).toFixed(5)}
                  </strong>
                </div>

                <div>
                  <span>
                    LONGITUDE
                  </span>

                  <strong>
                    {Number(
                      selectedShip.position
                        ?.lng || 0
                    ).toFixed(5)}
                  </strong>
                </div>

              </div>

              <div className="snapshot-status">

                <span>
                  OPERATIONAL STATUS
                </span>

                <b
                  className={
                    getStatusClass(
                      selectedShip.status
                    )
                  }
                >
                  {String(
                    selectedShip.status ||
                    'UNKNOWN'
                  ).toUpperCase()}
                </b>

              </div>

            </div>

          ) : (

            <div className="empty-state">
              Waiting for live fleet
              telemetry...
            </div>

          )}

        </div>

      </section>

      {/* =====================================================
          QUEUE
      ====================================================== */}

      <section className="dispatch-panel queue-panel">

        <div className="dispatch-panel-head">

          <div>

            <span>
              OPERATIONS LOG
            </span>

            <h3>
              Command Queue
            </h3>

          </div>

          <div className="queue-head-actions">

            <span>
              {queue.length} QUEUED
            </span>

            <button
              onClick={clearQueue}
              disabled={busy}
            >
              CLEAR
            </button>

          </div>

        </div>

        {queue.length === 0 ? (

          <div className="empty-queue">
            No commands queued.
            Select a vessel and build
            an operational command.
          </div>

        ) : (

          <div className="queue-table">

            <div className="queue-row queue-head">

              <span>
                VESSEL
              </span>

              <span>
                COMMAND
              </span>

              <span>
                DETAIL
              </span>

              <span>
                PRIORITY
              </span>

              <span>
                TIME
              </span>

              <span>
                STATUS
              </span>

            </div>

            {queue.map((item) => (

              <div
                className="queue-row"
                key={item.id}
              >

                <strong>
                  {item.vessel}
                </strong>

                <span>
                  {item.command}
                </span>

                <span>
                  {getCommandDetail(item)}
                </span>

                <span
                  className={
                    `priority ${
                      item.priority
                        .toLowerCase()
                    }`
                  }
                >
                  {item.priority}
                </span>

                <span>
                  {formatTime(
                    item.executedAt ||
                    item.time
                  )}
                </span>

                <b>
                  {item.status}
                </b>

              </div>

            ))}

          </div>

        )}

      </section>

      {/* =====================================================
          BACKEND HISTORY
      ====================================================== */}

      <section className="dispatch-panel queue-panel">

        <div className="dispatch-panel-head">

          <div>

            <span>
              BACKEND AUDIT TRAIL
            </span>

            <h3>
              Executed Commands
            </h3>

          </div>

          <b>
            {history.length} RECORDS
          </b>

        </div>

        {history.length === 0 ? (

          <div className="empty-queue">
            No backend command history
            yet.
          </div>

        ) : (

          <div className="queue-table">

            <div className="queue-row queue-head">

              <span>
                VESSEL
              </span>

              <span>
                COMMAND
              </span>

              <span>
                DETAIL
              </span>

              <span>
                PRIORITY
              </span>

              <span>
                TIME
              </span>

              <span>
                STATUS
              </span>

            </div>

            {history
              .slice(0, 12)
              .map((item, index) => (

                <div
                  className="queue-row"
                  key={
                    item.id ||
                    `${item.timestamp}-${index}`
                  }
                >

                  <strong>
                    {item.vessel}
                  </strong>

                  <span>
                    {item.command}
                  </span>

                  <span>
                    {getCommandDetail(item)}
                  </span>

                  <span
                    className={
                      `priority ${
                        String(
                          item.priority ||
                          'NORMAL'
                        ).toLowerCase()
                      }`
                    }
                  >
                    {item.priority ||
                      'NORMAL'}
                  </span>

                  <span>
                    {formatTime(
                      item.timestamp
                    )}
                  </span>

                  <b>
                    {item.status}
                  </b>

                </div>

              ))}

          </div>

        )}

      </section>

    </div>
  )
}