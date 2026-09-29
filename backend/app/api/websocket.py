import asyncio
import json
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.simulator.engine import FleetSimulator

router = APIRouter()
simulator = FleetSimulator()

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
    async def broadcast(self, data: dict):
        if not self.active_connections:
            return
        message = json.dumps(data)
        connections = list(self.active_connections)
        results = await asyncio.gather(*(c.send_text(message) for c in connections), return_exceptions=True)
        for c, result in zip(connections, results):
            if isinstance(result, Exception):
                self.disconnect(c)

manager = ConnectionManager()

def get_fleet_payload():
    return {
        "type": "fleet_update", "timestamp": time.time(), "count": simulator.fleet.count,
        "ships": [ship.model_dump() for ship in simulator.fleet.ships],
        "zones": [{"id": zid, "name": zid, "coordinates": coords} for zid, coords in simulator.restricted_zones.items()],
        "alerts": [*simulator.zone_alerts.values(), *simulator.proximity_alerts.values()],
    }

async def simulator_loop():
    previous = time.monotonic()
    weather_task = asyncio.create_task(simulator.refresh_weather())
    try:
        while True:
            current = time.monotonic()
            delta = current - previous
            previous = current
            simulator.tick(delta)
            if weather_task.done():
                weather_task = asyncio.create_task(simulator.refresh_weather())
            await manager.broadcast(get_fleet_payload())
            await asyncio.sleep(1)
    finally:
        weather_task.cancel()

@router.websocket('/ws/fleet')
async def fleet_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_text(json.dumps(get_fleet_payload()))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
