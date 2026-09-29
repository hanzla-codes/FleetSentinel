import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  useMap,
} from 'react-leaflet'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw/dist/leaflet.draw.js'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

// ============================================================
// SHIP COLOR
// ============================================================

const getShipColor = (ship, breached) => {
  if (breached) return '#ef4444'

  if (
    ship.status === 'critical' ||
    ship.status === 'distress' ||
    ship.status === 'distressed' ||
    ship.status === 'insufficient_fuel'
  ) {
    return '#ef4444'
  }

  if (ship.status === 'warning') {
    return '#f59e0b'
  }

  return '#22c55e'
}

// ============================================================
// SHIP ICON
// ============================================================

const createShipIcon = (ship, breached) => {
  const color = getShipColor(ship, breached)
  const heading = Number(ship.heading || 0)

  return L.divIcon({
    className: 'fleet-ship-icon-wrapper',

    html: `
      <div style="
        position:relative;
        width:46px;
        height:46px;
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <div style="
          position:absolute;
          top:-8px;
          left:50%;
          width:3px;
          height:18px;
          background:${color};
          transform-origin:bottom center;
          transform:translateX(-50%) rotate(${heading}deg);
          border-radius:3px;
          box-shadow:0 0 6px ${color};
        "></div>

        <div style="
          width:30px;
          height:30px;
          border-radius:50%;
          background:${color};
          border:3px solid white;
          box-shadow:0 0 10px ${color};
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:15px;
          z-index:2;
        ">🚢</div>

        ${
          breached
            ? `
              <div style="
                position:absolute;
                right:-8px;
                top:-8px;
                width:17px;
                height:17px;
                background:#dc2626;
                color:white;
                border-radius:50%;
                font-size:11px;
                display:flex;
                align-items:center;
                justify-content:center;
                border:2px solid white;
                z-index:5;
              ">!</div>
            `
            : ''
        }

        <div style="
          position:absolute;
          top:35px;
          left:50%;
          transform:translateX(-50%);
          white-space:nowrap;
          background:rgba(0,0,0,.75);
          color:white;
          padding:2px 6px;
          border-radius:4px;
          font-size:9px;
          font-weight:600;
        ">
          ${ship.name || 'Unknown'}
        </div>
      </div>
    `,

    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -20],
  })
}

// ============================================================
// INITIAL MAP VIEW
// ============================================================

function MapInitialView({ ships }) {
  const map = useMap()
  const fittedRef = useRef(false)

  useEffect(() => {
    if (fittedRef.current || !ships.length) return

    const validShips = ships.filter(
      (ship) =>
        ship.position &&
        Number.isFinite(Number(ship.position.lat)) &&
        Number.isFinite(Number(ship.position.lng))
    )

    if (!validShips.length) return

    const bounds = L.latLngBounds(
      validShips.map((ship) => [
        Number(ship.position.lat),
        Number(ship.position.lng),
      ])
    )

    map.fitBounds(bounds, {
      padding: [35, 35],
      maxZoom: 8,
      animate: false,
    })

    fittedRef.current = true
  }, [map, ships])

  return null
}

// ============================================================
// POINT INSIDE POLYGON
// ============================================================

function isPointInsidePolygon(lat, lng, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) {
    return false
  }

  let inside = false

  for (
    let i = 0, j = polygon.length - 1;
    i < polygon.length;
    j = i++
  ) {
    const xi = Number(polygon[i][1])
    const yi = Number(polygon[i][0])
    const xj = Number(polygon[j][1])
    const yj = Number(polygon[j][0])

    const intersect =
      yi > lat !== yj > lat &&
      lng <
        ((xj - xi) * (lat - yi)) /
          (yj - yi) +
          xi

    if (intersect) {
      inside = !inside
    }
  }

  return inside
}

// ============================================================
// STATUS
// ============================================================

function getStatusLabel(status) {
  if (!status) return 'UNKNOWN'

  return String(status)
    .replaceAll('_', ' ')
    .toUpperCase()
}

// ============================================================
// SMOOTH SHIP MOVEMENT
// ============================================================

function AnimatedShipMarker({ ship, breached }) {
  const markerRef = useRef(null)
  const animationRef = useRef(null)
  const previousPositionRef = useRef(null)

  const position = ship.position

  useEffect(() => {
    if (!markerRef.current || !position) return

    const targetLat = Number(position.lat)
    const targetLng = Number(position.lng)

    if (
      !Number.isFinite(targetLat) ||
      !Number.isFinite(targetLng)
    ) {
      return
    }

    const marker = markerRef.current

    if (!previousPositionRef.current) {
      marker.setLatLng([targetLat, targetLng])

      previousPositionRef.current = {
        lat: targetLat,
        lng: targetLng,
      }

      return
    }

    const startLat = previousPositionRef.current.lat
    const startLng = previousPositionRef.current.lng

    const duration = 900
    const startTime = performance.now()

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    const animate = (currentTime) => {
      const progress = Math.min(
        (currentTime - startTime) / duration,
        1
      )

      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 -
            Math.pow(-2 * progress + 2, 2) /
              2

      marker.setLatLng([
        startLat + (targetLat - startLat) * eased,
        startLng + (targetLng - startLng) * eased,
      ])

      if (progress < 1) {
        animationRef.current =
          requestAnimationFrame(animate)
      }
    }

    animationRef.current =
      requestAnimationFrame(animate)

    previousPositionRef.current = {
      lat: targetLat,
      lng: targetLng,
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [position])

  if (!position) return null

  const speed =
    typeof ship.speed_knots === 'number'
      ? `${ship.speed_knots} kn`
      : 'N/A'

  const fuel =
    typeof ship.fuel_tons === 'number'
      ? `${ship.fuel_tons.toLocaleString(undefined, {
          maximumFractionDigits: 1,
        })} t`
      : 'N/A'

  const heading =
    typeof ship.heading === 'number'
      ? `${ship.heading.toFixed(1)}°`
      : 'N/A'

  return (
    <Marker
      ref={markerRef}
      position={[
        Number(position.lat),
        Number(position.lng),
      ]}
      icon={createShipIcon(ship, breached)}
    >
      <Popup maxWidth={230} minWidth={210}>
        <div
          style={{
            width: '210px',
            fontFamily: 'Arial, sans-serif',
            color: '#111827',
            fontSize: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '7px',
              marginBottom: '7px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: '700',
                }}
              >
                🚢 {ship.name || 'Unknown'}
              </div>

              <div
                style={{
                  color: '#6b7280',
                  fontSize: '10px',
                  marginTop: '2px',
                }}
              >
                {ship.id || 'N/A'} • {getStatusLabel(ship.status)}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px 12px',
            }}
          >
            <div>
              <span style={{ color: '#6b7280' }}>
                Destination
              </span>
              <br />
              <strong>{ship.destination || 'N/A'}</strong>
            </div>

            <div>
              <span style={{ color: '#6b7280' }}>
                Speed
              </span>
              <br />
              <strong>{speed}</strong>
            </div>

            <div>
              <span style={{ color: '#6b7280' }}>
                Heading
              </span>
              <br />
              <strong>{heading}</strong>
            </div>

            <div>
              <span style={{ color: '#6b7280' }}>
                Cargo
              </span>
              <br />
              <strong>{ship.cargo || 'N/A'}</strong>
            </div>

            <div>
              <span style={{ color: '#6b7280' }}>
                Fuel
              </span>
              <br />
              <strong>{fuel}</strong>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid #e5e7eb',
              marginTop: '8px',
              paddingTop: '7px',
              color: '#4b5563',
              fontSize: '10px',
            }}
          >
            📍 {Number(position.lat).toFixed(5)},{' '}
            {Number(position.lng).toFixed(5)}
          </div>

          {breached && (
            <div
              style={{
                marginTop: '7px',
                padding: '6px',
                background: '#fee2e2',
                color: '#b91c1c',
                borderRadius: '4px',
                textAlign: 'center',
                fontWeight: '700',
                fontSize: '10px',
              }}
            >
              ⚠ RESTRICTED ZONE BREACH
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  )
}

// ============================================================
// RESTRICTED ZONE DRAWER
// ============================================================

function RestrictedZoneDrawer({
  onZoneCreated,
  onZoneEdited,
  onZoneDeleted,
}) {
  const map = useMap()

  useEffect(() => {
    const drawnItems = new L.FeatureGroup()

    map.addLayer(drawnItems)

    const drawControl = new L.Control.Draw({
      position: 'topright',

      draw: {
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,

        polygon: {
          allowIntersection: false,
          showArea: true,

          shapeOptions: {
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: 0.18,
            weight: 2,
          },
        },
      },

      edit: {
        featureGroup: drawnItems,
      },
    })

    map.addControl(drawControl)

    const handleCreated = (event) => {
      if (event.layerType !== 'polygon') return

      drawnItems.clearLayers()
      drawnItems.addLayer(event.layer)

      const latLngs = event.layer.getLatLngs()

      if (!latLngs || !latLngs[0]) return

      const coordinates = latLngs[0]
        .map((point) => [
          Number(point.lat),
          Number(point.lng),
        ])

      if (coordinates.length >= 3) {
        onZoneCreated(coordinates)
      }
    }

    const handleEdited = (event) => {
      event.layers.eachLayer((layer) => {
        if (!layer.getLatLngs) return

        const latLngs = layer.getLatLngs()

        if (!latLngs || !latLngs[0]) return

        const coordinates = latLngs[0]
          .map((point) => [
            Number(point.lat),
            Number(point.lng),
          ])

        if (coordinates.length >= 3) {
          onZoneEdited?.(coordinates)
        }
      })
    }

    const handleDeleted = () => {
      drawnItems.clearLayers()
      onZoneDeleted()
    }

    map.on(
      L.Draw.Event.CREATED,
      handleCreated
    )

    map.on(
      L.Draw.Event.EDITED,
      handleEdited
    )

    map.on(
      L.Draw.Event.DELETED,
      handleDeleted
    )

    return () => {
      map.off(
        L.Draw.Event.CREATED,
        handleCreated
      )

      map.off(
        L.Draw.Event.EDITED,
        handleEdited
      )

      map.off(
        L.Draw.Event.DELETED,
        handleDeleted
      )

      map.removeControl(drawControl)
      map.removeLayer(drawnItems)
    }
  }, [
    map,
    onZoneCreated,
    onZoneEdited,
    onZoneDeleted,
  ])

  return null
}

// ============================================================
// MAIN FLEET MAP
// ============================================================

export default function FleetMap({
  ships = [],
  zones = [],
  onZoneBreachesChange,
}) {
  const initialZone = useMemo(() => {
    if (
      !Array.isArray(zones) ||
      zones.length === 0
    ) {
      return null
    }

    const zone = zones[0]

    if (
      zone &&
      Array.isArray(zone.coordinates) &&
      zone.coordinates.length >= 3
    ) {
      return zone
    }

    return null
  }, [zones])

  const [
    restrictedZone,
    setRestrictedZone,
  ] = useState(
    () => initialZone?.coordinates ?? null
  )

  const [zoneName, setZoneName] =
    useState(
      () =>
        initialZone?.name ||
        initialZone?.id ||
        'Restricted Zone'
    )

  const [zoneSaved, setZoneSaved] =
    useState(Boolean(initialZone))

  const [activeZoneId, setActiveZoneId] =
    useState(
      () => initialZone?.id ?? null
    )

  const API_BASE =
    import.meta.env.VITE_API_URL ||
    'http://127.0.0.1:8000'

  const [zonePanelOpen, setZonePanelOpen] =
    useState(false)

  // ----------------------------------------------------------
  // CREATE ZONE
  // ----------------------------------------------------------

  const handleZoneCreated = useCallback(
    (coordinates) => {
      if (
        !Array.isArray(coordinates) ||
        coordinates.length < 3
      ) {
        return
      }

      setRestrictedZone(coordinates)
      setZoneSaved(false)
      setActiveZoneId(null)
    },
    []
  )

  // ----------------------------------------------------------
  // EDIT ZONE
  // ----------------------------------------------------------

  const handleZoneEdited = useCallback(
    (coordinates) => {
      if (
        !Array.isArray(coordinates) ||
        coordinates.length < 3
      ) {
        return
      }

      setRestrictedZone(coordinates)
      setZoneSaved(false)
    },
    []
  )

  // ----------------------------------------------------------
  // DELETE ZONE
  // ----------------------------------------------------------

  const handleZoneDeleted = useCallback(
    async () => {
      if (activeZoneId) {
        await fetch(
          `${API_BASE}/api/dispatch/zones/${activeZoneId}`,
          {
            method: 'DELETE',
          }
        ).catch(() => {})
      }

      setRestrictedZone(null)
      setActiveZoneId(null)
      setZoneSaved(false)
    },
    [activeZoneId, API_BASE]
  )

  // ----------------------------------------------------------
  // SAVE ZONE
  // ----------------------------------------------------------

  const handleSaveZone = async () => {
    if (
      !Array.isArray(restrictedZone) ||
      restrictedZone.length < 3
    ) {
      return
    }

    const id =
      activeZoneId ||
      `ZONE-${Date.now()}`

    const method =
      activeZoneId ? 'PUT' : 'POST'

    const url = activeZoneId
      ? `${API_BASE}/api/dispatch/zones/${activeZoneId}`
      : `${API_BASE}/api/dispatch/zones`

    try {
      const response = await fetch(url, {
        method,

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          id,
          name:
            zoneName || 'Restricted Zone',
          coordinates: restrictedZone,
        }),
      })

      if (!response.ok) {
        setZoneSaved(false)
        return
      }

      setActiveZoneId(id)
      setZoneSaved(true)
    } catch {
      setZoneSaved(false)
    }
  }

  // ----------------------------------------------------------
  // BREACHED SHIPS
  // ----------------------------------------------------------

  const breachedShips = useMemo(() => {
    if (
      !Array.isArray(ships) ||
      !Array.isArray(restrictedZone) ||
      restrictedZone.length < 3
    ) {
      return []
    }

    return ships.filter((ship) => {
      if (!ship?.position) {
        return false
      }

      const lat = Number(ship.position.lat)
      const lng = Number(ship.position.lng)

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return false
      }

      return isPointInsidePolygon(
        lat,
        lng,
        restrictedZone
      )
    })
  }, [ships, restrictedZone])

  // ----------------------------------------------------------
  // BREACHED IDs
  // ----------------------------------------------------------

  const breachedIds = useMemo(() => {
    return new Set(
      breachedShips.map(
        (ship) =>
          ship.id ||
          ship.name
      )
    )
  }, [breachedShips])

  // ----------------------------------------------------------
  // BREACH PAYLOAD
  // ----------------------------------------------------------

  const breachPayload = useMemo(() => {
    return breachedShips.map((ship) => ({
      shipId:
        ship.id ||
        ship.name,

      shipName:
        ship.name ||
        ship.id ||
        'Unknown Vessel',

      zoneName:
        zoneName ||
        'Restricted Zone',

      position: {
        lat: Number(ship.position.lat),
        lng: Number(ship.position.lng),
      },

      status: 'restricted_zone_breach',
    }))
  }, [
    breachedShips,
    zoneName,
  ])

  // ----------------------------------------------------------
  // SEND BREACHES TO APP
  // ----------------------------------------------------------

  useEffect(() => {
    onZoneBreachesChange?.(
      breachPayload
    )
  }, [
    breachPayload,
    onZoneBreachesChange,
  ])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
      }}
    >
      <MapContainer
        center={[26.5, 56.2]}
        zoom={6}
        scrollWheelZoom
        style={{
          width: '100%',
          height: '100%',
          minHeight: '300px',
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapInitialView
          ships={ships}
        />

        <RestrictedZoneDrawer
          onZoneCreated={
            handleZoneCreated
          }
          onZoneEdited={
            handleZoneEdited
          }
          onZoneDeleted={
            handleZoneDeleted
          }
        />

        {restrictedZone && (
          <Polygon
            positions={
              restrictedZone
            }
            pathOptions={{
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.16,
              weight: 2,
            }}
          />
        )}

        {ships.map(
          (ship, index) => {
            if (
              !ship?.position
            ) {
              return null
            }

            const key =
              ship.id ||
              ship.name ||
              `ship-${index}`

            return (
              <AnimatedShipMarker
                key={key}
                ship={ship}
                breached={breachedIds.has(
                  key
                )}
              />
            )
          }
        )}
      </MapContainer>

      {!zonePanelOpen ? (
        <button
          onClick={() =>
            setZonePanelOpen(true)
          }
          title="Restricted Zone"
          style={{
            position: 'absolute',
            left: '12px',
            bottom: '12px',
            zIndex: 1000,
            width: '42px',
            height: '42px',
            borderRadius: '9px',
            border:
              '1px solid #ef4444',
            background: '#111827',
            color: '#ef4444',
            fontSize: '20px',
            cursor: 'pointer',
            boxShadow:
              '0 3px 12px rgba(0,0,0,.35)',
          }}
        >
          ⚠️
        </button>
      ) : (
        <div
          style={{
            position: 'absolute',
            left: '12px',
            bottom: '12px',
            zIndex: 1000,
            width: '180px',
            padding: '10px',
            background:
              'rgba(10,18,30,.94)',
            border:
              '1px solid #374151',
            borderRadius: '8px',
            color: 'white',
            boxShadow:
              '0 4px 15px rgba(0,0,0,.35)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              marginBottom: '7px',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                fontWeight: '700',
              }}
            >
              ⚠ RESTRICTED ZONE
            </span>

            <button
              onClick={() =>
                setZonePanelOpen(false)
              }
              title="Minimize"
              style={{
                border: 'none',
                background:
                  'transparent',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: '17px',
                padding: '0 3px',
              }}
            >
              −
            </button>
          </div>

          <input
            value={zoneName}
            onChange={(e) =>
              setZoneName(
                e.target.value
              )
            }
            placeholder="Zone name"
            style={{
              width: '100%',
              boxSizing:
                'border-box',
              padding: '6px',
              marginBottom: '6px',
              borderRadius: '4px',
              border:
                '1px solid #4b5563',
              background:
                '#111827',
              color: 'white',
              fontSize: '11px',
            }}
          />

          <button
            onClick={
              handleSaveZone
            }
            disabled={
              !restrictedZone
            }
            style={{
              width: '100%',
              padding: '6px',
              border: 'none',
              borderRadius: '4px',
              background:
                restrictedZone
                  ? '#dc2626'
                  : '#374151',
              color: 'white',
              fontSize: '10px',
              fontWeight: '700',
              cursor:
                restrictedZone
                  ? 'pointer'
                  : 'not-allowed',
            }}
          >
            SAVE ZONE
          </button>

          {restrictedZone && (
            <div
              style={{
                marginTop: '6px',
                fontSize: '10px',
                color:
                  breachedShips.length
                    ? '#fca5a5'
                    : '#9ca3af',
              }}
            >
              {breachedShips.length
                ? `⚠ ${breachedShips.length} vessel inside`
                : '✓ No vessels inside'}
            </div>
          )}

          {zoneSaved && (
            <div
              style={{
                marginTop: '4px',
                fontSize: '9px',
                color: '#4ade80',
              }}
            >
              ✓ Saved
            </div>
          )}
        </div>
      )}
    </div>
  )
}