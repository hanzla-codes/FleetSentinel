from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.websocket import (
    get_fleet_payload,
    manager,
    simulator,
)

from app.services.routing_service import (
    PORTS,
    calculate_route,
)


router = APIRouter(
    prefix="/api/dispatch",
    tags=["dispatch"],
)


# ============================================================
# DISPATCH COMMAND SCHEMA
# ============================================================

class DispatchCommand(BaseModel):
    ship_id: str = Field(
        min_length=1
    )

    command: Literal[
        "REROUTE",
        "SET SPEED",
        "CHANGE HEADING",
        "HOLD POSITION",
    ]

    destination: str | None = None

    speed: float | None = Field(
        default=None,
        ge=0,
        le=40,
    )

    heading: float | None = Field(
        default=None,
        ge=0,
        lt=360,
    )

    priority: Literal[
        "CRITICAL",
        "HIGH",
        "NORMAL",
    ] = "HIGH"

    incident_id: str | None = None


# ============================================================
# INCIDENT RESPONSE SCHEMA
# ============================================================

class IncidentAction(BaseModel):
    incident_id: str = Field(
        min_length=1
    )

    action: Literal[
        "ACKNOWLEDGE",
        "DISMISS",
        "RESOLVE",
    ]

    operator: str = "COMMAND_OPERATOR"


# ============================================================
# IN-MEMORY DATA
# ============================================================

command_history: list[dict] = []

incident_registry: dict[str, dict] = {}


# ============================================================
# HELPERS
# ============================================================

def utc_now() -> str:
    return datetime.now(
        timezone.utc
    ).isoformat()


def find_ship(ship_id: str):
    return next(
        (
            ship
            for ship in simulator.fleet.ships
            if ship.id == ship_id
        ),
        None,
    )


def add_history(record: dict):
    command_history.insert(
        0,
        record,
    )

    del command_history[100:]


def broadcast_fleet():
    return get_fleet_payload()


def get_incident_id(
    ship_id: str,
    incident_id: str | None = None,
) -> str:
    if incident_id:
        return incident_id

    return f"status-{ship_id}"


def create_or_update_incident(
    ship,
    incident_id: str,
    severity: str,
    incident_type: str,
):
    existing = incident_registry.get(
        incident_id
    )

    if existing:
        return existing

    incident = {
        "id": incident_id,
        "vesselId": ship.id,
        "vessel": ship.name,
        "type": incident_type,
        "severity": severity,
        "status": "ACTIVE",
        "createdAt": utc_now(),
        "acknowledgedAt": None,
        "dispatchedAt": None,
        "resolvedAt": None,
        "dismissedAt": None,
        "responseTimeSeconds": None,
        "dispatchCommand": None,
        "dispatchPriority": None,
        "timeline": [
            {
                "event": "INCIDENT DETECTED",
                "timestamp": utc_now(),
                "operator": "SYSTEM",
            }
        ],
    }

    incident_registry[
        incident_id
    ] = incident

    return incident


def add_incident_event(
    incident: dict,
    event: str,
    operator: str = "COMMAND_OPERATOR",
):
    timestamp = utc_now()

    incident["timeline"].append(
        {
            "event": event,
            "timestamp": timestamp,
            "operator": operator,
        }
    )

    return timestamp


def calculate_response_time(
    created_at: str,
    current_time: str,
):
    try:
        created = datetime.fromisoformat(
            created_at
        )

        current = datetime.fromisoformat(
            current_time
        )

        return round(
            (
                current - created
            ).total_seconds(),
            2,
        )

    except (
        ValueError,
        TypeError,
    ):
        return None


# ============================================================
# DISPATCH HISTORY
# ============================================================

@router.get("/history")
async def get_dispatch_history():

    return {
        "count": len(
            command_history
        ),
        "commands": command_history,
    }


# ============================================================
# INCIDENT LIST
# ============================================================

@router.get("/incidents")
async def get_incidents():

    incidents = list(
        incident_registry.values()
    )

    return {
        "count": len(incidents),
        "incidents": incidents,
    }


# ============================================================
# SINGLE INCIDENT
# ============================================================

@router.get(
    "/incidents/{incident_id}"
)
async def get_incident(
    incident_id: str,
):

    incident = incident_registry.get(
        incident_id
    )

    if incident is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Incident "
                f"{incident_id} "
                f"not found"
            ),
        )

    return {
        "success": True,
        "incident": incident,
    }


# ============================================================
# INCIDENT ACTION
# ============================================================

@router.post("/incident/action")
async def incident_action(
    payload: IncidentAction,
):

    incident = incident_registry.get(
        payload.incident_id
    )

    if incident is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Incident "
                f"{payload.incident_id} "
                f"not found"
            ),
        )

    timestamp = utc_now()

    if payload.action == "ACKNOWLEDGE":

        if incident["status"] in {
            "DISMISSED",
            "RESOLVED",
        }:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Closed incident "
                    "cannot be acknowledged."
                ),
            )

        incident["status"] = (
            "ACKNOWLEDGED"
        )

        incident["acknowledgedAt"] = (
            timestamp
        )

        add_incident_event(
            incident,
            "INCIDENT ACKNOWLEDGED",
            payload.operator,
        )

    elif payload.action == "DISMISS":

        if incident["status"] == "RESOLVED":
            raise HTTPException(
                status_code=400,
                detail=(
                    "Resolved incident "
                    "cannot be dismissed."
                ),
            )

        incident["status"] = (
            "DISMISSED"
        )

        incident["dismissedAt"] = (
            timestamp
        )

        add_incident_event(
            incident,
            "INCIDENT DISMISSED",
            payload.operator,
        )

    elif payload.action == "RESOLVE":

        incident["status"] = (
            "RESOLVED"
        )

        incident["resolvedAt"] = (
            timestamp
        )

        if incident["responseTimeSeconds"] is None:
            incident[
                "responseTimeSeconds"
            ] = calculate_response_time(
                incident["createdAt"],
                timestamp,
            )

        add_incident_event(
            incident,
            "INCIDENT RESOLVED",
            payload.operator,
        )

    return {
        "success": True,
        "message": (
            f"{payload.action} "
            f"completed"
        ),
        "incident": incident,
    }


# ============================================================
# FLEET PLAYBACK / PROXIMITY / GEOFENCE
# ============================================================

@router.get("/playback")
async def get_playback():
    return {"count": len(simulator.history), "snapshots": list(simulator.history)}

@router.get("/alerts")
async def get_alerts():
    return {"alerts": [*simulator.zone_alerts.values(), *simulator.proximity_alerts.values()]}


# ============================================================
# RESTRICTED ZONES
# ============================================================

class ZonePayload(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    coordinates: list[list[float]] = Field(min_length=3)


def _normalise_zone(payload: ZonePayload):
    if any(len(point) != 2 for point in payload.coordinates):
        raise HTTPException(status_code=400, detail="Each zone coordinate must be [lat, lng]")
    return [(float(point[0]), float(point[1])) for point in payload.coordinates]

@router.get("/zones")
async def get_zones():
    return {"zones": [{"id": zid, "name": zid, "coordinates": coords} for zid, coords in simulator.restricted_zones.items()]}

@router.post("/zones")
async def create_zone(payload: ZonePayload):
    simulator.restricted_zones[payload.id] = _normalise_zone(payload)
    for ship in simulator.fleet.ships:
        simulator.recompute_route(ship, reason="restricted zone created")
    if manager.active_connections:
        await manager.broadcast(get_fleet_payload())
    return {"success": True, "zone": {"id": payload.id, "name": payload.name, "coordinates": simulator.restricted_zones[payload.id]}}

@router.put("/zones/{zone_id}")
async def update_zone(zone_id: str, payload: ZonePayload):
    if zone_id not in simulator.restricted_zones:
        raise HTTPException(status_code=404, detail="Zone not found")
    simulator.restricted_zones.pop(zone_id)
    simulator.restricted_zones[payload.id] = _normalise_zone(payload)
    for ship in simulator.fleet.ships:
        simulator.recompute_route(ship, reason="restricted zone updated")
    if manager.active_connections:
        await manager.broadcast(get_fleet_payload())
    return {"success": True}

@router.delete("/zones/{zone_id}")
async def delete_zone(zone_id: str):
    if zone_id not in simulator.restricted_zones:
        raise HTTPException(status_code=404, detail="Zone not found")
    simulator.restricted_zones.pop(zone_id)
    for ship in simulator.fleet.ships:
        simulator.recompute_route(ship, reason="restricted zone deleted")
    if manager.active_connections:
        await manager.broadcast(get_fleet_payload())
    return {"success": True}


# ============================================================
# CAPTAIN / DISTRESS NLP
# ============================================================

class DistressPayload(BaseModel):
    ship_id: str = Field(min_length=1)
    message: str = Field(min_length=3, max_length=2000)


def parse_distress(message: str):
    text = message.lower()
    severity = "LOW"
    if any(word in text for word in ["mayday", "sinking", "fire", "flood", "collision", "dead", "critical"]):
        severity = "CRITICAL"
    elif any(word in text for word in ["injur", "damage", "engine", "medical", "leak", "disabled"]):
        severity = "HIGH"
    injuries = 0
    import re
    match = re.search(r"(\d+)\s+(?:crew|people|persons|injur)", text)
    if match:
        injuries = int(match.group(1))
    else:
        number_words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
        word_match = re.search(r"(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:crew|people|persons|injur)", text)
        if word_match:
            injuries = number_words[word_match.group(1)]
    problem = "General distress"
    for candidate in ["fire", "flooding", "engine failure", "collision", "medical emergency", "fuel leak", "loss of propulsion"]:
        if candidate in text:
            problem = candidate
            break
    return {"severity": severity, "problem": problem, "injuryCount": injuries, "impact": message.strip()}

@router.post("/distress")
async def submit_distress(payload: DistressPayload):
    ship = find_ship(payload.ship_id)
    if ship is None:
        raise HTTPException(status_code=404, detail="Vessel not found")
    analysis = parse_distress(payload.message)
    ship.status = "distressed"
    incident_id = f"distress-{ship.id}-{int(datetime.now().timestamp()*1000)}"
    incident = create_or_update_incident(ship, incident_id, analysis["severity"], "AI DISTRESS")
    incident["distressMessage"] = payload.message
    incident["aiAnalysis"] = analysis
    if manager.active_connections:
        await manager.broadcast(get_fleet_payload())
    return {"success": True, "incident": incident, "analysis": analysis}


# ============================================================
# EXECUTE DISPATCH COMMAND
# ============================================================

@router.post("/command")
async def execute_dispatch_command(
    payload: DispatchCommand,
):

    ship = find_ship(
        payload.ship_id
    )

    if ship is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Vessel "
                f"{payload.ship_id} "
                f"not found"
            ),
        )

    try:

        # ====================================================
        # REROUTE
        # ====================================================

        if payload.command == "REROUTE":

            if not payload.destination:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Destination is "
                        "required for REROUTE"
                    ),
                )

            destination = (
                payload.destination.upper()
            )

            if destination not in PORTS:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Unknown destination: "
                        f"{destination}. "
                        f"Available: "
                        f"{', '.join(PORTS.keys())}"
                    ),
                )

            ship.destination = (
                destination
            )

            ship.route = calculate_route(
                ship.position,
                ship.destination,
                list(simulator.restricted_zones.values()),
            )

            ship.route_index = 0

            ship.manual_heading = False

            ship.status = "rerouting"

        # ====================================================
        # SET SPEED
        # ====================================================

        elif payload.command == "SET SPEED":

            if payload.speed is None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Speed is required "
                        "for SET SPEED"
                    ),
                )

            ship.speed_knots = (
                payload.speed
            )

            if (
                ship.speed_knots > 0
                and ship.status
                in {
                    "stopped",
                    "rerouting",
                }
            ):
                ship.status = "normal"

        # ====================================================
        # CHANGE HEADING
        # ====================================================

        elif (
            payload.command
            == "CHANGE HEADING"
        ):

            if payload.heading is None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Heading is required "
                        "for CHANGE HEADING"
                    ),
                )

            ship.heading = (
                payload.heading
            )

            ship.manual_heading = True

            if (
                ship.speed_knots > 0
                and ship.status == "stopped"
            ):
                ship.status = "normal"

        # ====================================================
        # HOLD POSITION
        # ====================================================

        elif (
            payload.command
            == "HOLD POSITION"
        ):

            ship.status = "stopped"

        # ====================================================
        # COMMAND AUDIT
        # ====================================================

        timestamp = utc_now()

        record = {
            "id": f"CMD-{int(datetime.now().timestamp() * 1000)}",
            "timestamp": timestamp,
            "ship_id": ship.id,
            "vessel": ship.name,
            "command": payload.command,
            "destination": (
                payload.destination
            ),
            "speed": payload.speed,
            "heading": payload.heading,
            "priority": payload.priority,
            "status": "EXECUTED",
            "incident_id": (
                payload.incident_id
            ),
        }

        add_history(record)

        # ====================================================
        # LINK COMMAND TO INCIDENT
        # ====================================================

        if payload.incident_id:

            incident = incident_registry.get(
                payload.incident_id
            )

            if incident is None:

                severity = (
                    "CRITICAL"
                    if payload.priority
                    == "CRITICAL"
                    else "HIGH"
                )

                incident = (
                    create_or_update_incident(
                        ship,
                        payload.incident_id,
                        severity,
                        "DISPATCH RESPONSE",
                    )
                )

            incident["status"] = (
                "DISPATCHED"
            )

            incident["dispatchedAt"] = (
                timestamp
            )

            incident[
                "dispatchCommand"
            ] = payload.command

            incident[
                "dispatchPriority"
            ] = payload.priority

            incident[
                "responseTimeSeconds"
            ] = calculate_response_time(
                incident["createdAt"],
                timestamp,
            )

            add_incident_event(
                incident,
                (
                    "VESSEL DISPATCHED · "
                    f"{payload.command}"
                ),
                "COMMAND_OPERATOR",
            )

        # ====================================================
        # BROADCAST LIVE UPDATE
        # ====================================================

        if manager.active_connections:

            await manager.broadcast(
                get_fleet_payload()
            )

        return {
            "success": True,
            "message": (
                f"{payload.command} "
                f"executed for "
                f"{ship.name}"
            ),
            "command": record,
            "ship": ship.model_dump(),
            "incident": (
                incident_registry.get(
                    payload.incident_id
                )
                if payload.incident_id
                else None
            ),
        }

    except HTTPException:
        raise

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc