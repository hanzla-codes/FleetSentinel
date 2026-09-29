import { useEffect, useRef, useState } from 'react'

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  'ws://127.0.0.1:8000/ws/fleet'

export function useFleetSocket() {
  const [ships, setShips] = useState([])
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [zones, setZones] = useState([])
  const [alerts, setAlerts] = useState([])

  const socketRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const isUnmountedRef = useRef(false)

  useEffect(() => {
    isUnmountedRef.current = false

    const connect = () => {
      if (isUnmountedRef.current) return

      // Don't create another socket if one is already active.
      if (
        socketRef.current &&
        (socketRef.current.readyState === WebSocket.OPEN ||
          socketRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return
      }

      console.log('Connecting Fleet WebSocket...')

      const socket = new WebSocket(WS_URL)
      socketRef.current = socket

      socket.onopen = () => {
        if (isUnmountedRef.current) return

        console.log('Fleet WebSocket connected')
        setConnected(true)
        reconnectAttemptsRef.current = 0
      }

      socket.onmessage = (event) => {
        if (isUnmountedRef.current) return

        try {
          const data = JSON.parse(event.data)

          if (data.type === 'fleet_update') {
            setShips(Array.isArray(data.ships) ? data.ships : [])
            setZones(Array.isArray(data.zones) ? data.zones : [])
            setAlerts(Array.isArray(data.alerts) ? data.alerts : [])
            setLastUpdate(new Date())
          }
        } catch (error) {
          console.error('Invalid WebSocket message:', error)
        }
      }

      socket.onerror = (error) => {
        console.error('Fleet WebSocket error:', error)
        setConnected(false)
      }

      socket.onclose = () => {
        if (isUnmountedRef.current) return

        console.log('Fleet WebSocket disconnected')
        setConnected(false)
        socketRef.current = null

        reconnectAttemptsRef.current += 1

        const delay = Math.min(
          1000 * 2 ** (reconnectAttemptsRef.current - 1),
          10000
        )

        console.log(`Reconnecting Fleet WebSocket in ${delay}ms...`)

        clearTimeout(reconnectTimerRef.current)

        reconnectTimerRef.current = setTimeout(() => {
          connect()
        }, delay)
      }
    }

    connect()

    return () => {
      isUnmountedRef.current = true

      clearTimeout(reconnectTimerRef.current)

      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
    }
  }, [])

  return {
    ships,
    connected,
    lastUpdate,
    zones,
    alerts,
  }
}