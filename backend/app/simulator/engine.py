import asyncio
import math
import time
from collections import deque

from app.schemas.fleet import Fleet
from app.services.fleet_service import get_initial_fleet
from app.services.routing_service import (
    calculate_route,
    distance_km,
    point_in_polygon,
)
from app.services.weather_service import WeatherService


class FleetSimulator:
    FUEL_BURN_PER_KNOT_HOUR = 0.12
    WEATHER_FUEL_MULTIPLIER = 1.30

    WARNING_FUEL_PERCENT = 30.0
    CRITICAL_FUEL_PERCENT = 15.0
    INSUFFICIENT_FUEL_PERCENT = 5.0

    PROXIMITY_KM = 2.0
    WAYPOINT_REACHED_KM = 0.02

    def __init__(self):
        self.fleet: Fleet = get_initial_fleet()

        self.initial_fuel = {
            ship.id: ship.fuel_tons
            for ship in self.fleet.ships
        }

        self.restricted_zones: dict[str, list[tuple[float, float]]] = {}

        self.zone_alerts: dict[str, dict] = {}
        self.proximity_alerts: dict[str, dict] = {}

        self.weather = WeatherService()

        self.history = deque(maxlen=120)
        self.last_snapshot = 0.0

        # Keep track of ships that are currently inside a restricted zone.
        # This prevents route recalculation every second.
        self.zone_breached_ships: set[str] = set()

        for ship in self.fleet.ships:
            ship.route = calculate_route(
                ship.position,
                ship.destination,
            )

            ship.route_index = 0

            # Set an initial heading immediately.
            self._prepare_route(ship)

        self.record_snapshot(force=True)

    # ---------------------------------------------------------
    # HEADING
    # ---------------------------------------------------------

    def calculate_heading(self, current, target) -> float:
        """
        Calculate bearing from current position to target.

        0   = North
        90  = East
        180 = South
        270 = West
        """

        lat1 = math.radians(current.lat)
        lat2 = math.radians(target.lat)

        delta_lng = math.radians(
            target.lng - current.lng
        )

        x = math.sin(delta_lng) * math.cos(lat2)

        y = (
            math.cos(lat1) * math.sin(lat2)
            - math.sin(lat1)
            * math.cos(lat2)
            * math.cos(delta_lng)
        )

        # Same position -> keep current heading instead of forcing 0.
        if abs(x) < 1e-12 and abs(y) < 1e-12:
            return None

        return (
            math.degrees(math.atan2(x, y)) + 360
        ) % 360

    def _prepare_route(self, ship):
        """
        Remove route points that are already reached and
        calculate heading toward the next meaningful waypoint.
        """

        if not ship.route:
            return False

        # Skip waypoints that are essentially at the current position.
        while ship.route_index < len(ship.route):
            target = ship.route[ship.route_index]

            remaining = distance_km(
                ship.position.lat,
                ship.position.lng,
                target.lat,
                target.lng,
            )

            if remaining > self.WAYPOINT_REACHED_KM:
                break

            ship.route_index += 1

        if ship.route_index >= len(ship.route):
            ship.status = "arrived"
            return False

        target = ship.route[ship.route_index]

        heading = self.calculate_heading(
            ship.position,
            target,
        )

        if heading is not None:
            ship.heading = round(heading, 2)

        return True

    # ---------------------------------------------------------
    # FUEL
    # ---------------------------------------------------------

    def get_fuel_percent(self, ship) -> float:
        starting_fuel = self.initial_fuel.get(
            ship.id,
            ship.fuel_tons,
        )

        if starting_fuel <= 0:
            return 0.0

        return max(
            0.0,
            min(
                100.0,
                ship.fuel_tons / starting_fuel * 100,
            ),
        )

    def consume_fuel(
        self,
        ship,
        delta_seconds: float,
    ):
        if (
            ship.speed_knots <= 0
            or ship.status
            in {"stopped", "stranded", "arrived"}
        ):
            return

        hours = max(delta_seconds, 0.0) / 3600.0

        weather = self.weather.get(ship.id)

        multiplier = (
            self.WEATHER_FUEL_MULTIPLIER
            if weather.get("adverse")
            else 1.0
        )

        fuel_used = (
            ship.speed_knots
            * self.FUEL_BURN_PER_KNOT_HOUR
            * hours
            * multiplier
        )

        ship.fuel_tons = max(
            0.0,
            ship.fuel_tons - fuel_used,
        )

    # ---------------------------------------------------------
    # ROUTING
    # ---------------------------------------------------------

    def set_restricted_zones(
        self,
        zones: dict[str, list[tuple[float, float]]],
    ):
        self.restricted_zones = zones

        # Recalculate once when zones change.
        self.zone_breached_ships.clear()

        for ship in self.fleet.ships:
            self.recompute_route(
                ship,
                reason="restricted zone update",
            )

    def recompute_route(
        self,
        ship,
        reason: str = "reroute",
    ):
        try:
            route = calculate_route(
                ship.position,
                ship.destination,
                list(self.restricted_zones.values()),
            )

            ship.route = route
            ship.route_index = 0
            ship.manual_heading = False

            # Remove starting/current-position waypoints.
            self._prepare_route(ship)

            if ship.status not in {
                "distressed",
                "stopped",
                "arrived",
                "stranded",
            }:
                ship.status = "rerouting"

            return True

        except ValueError:
            ship.route = []
            ship.route_index = 0
            ship.status = "stranded"

            return False

    # ---------------------------------------------------------
    # FUEL FEASIBILITY
    # ---------------------------------------------------------

    def update_fuel_feasibility(self, ship):
        if (
            not ship.route
            or ship.route_index >= len(ship.route)
        ):
            ship.estimated_fuel_required_tons = 0.0
            ship.can_reach_destination = True
            return

        current = ship.position

        remaining_km = distance_km(
            current.lat,
            current.lng,
            ship.route[ship.route_index].lat,
            ship.route[ship.route_index].lng,
        )

        for index in range(
            ship.route_index,
            len(ship.route) - 1,
        ):
            a = ship.route[index]
            b = ship.route[index + 1]

            remaining_km += distance_km(
                a.lat,
                a.lng,
                b.lat,
                b.lng,
            )

        nautical_miles = remaining_km * 0.539957

        weather_multiplier = (
            self.WEATHER_FUEL_MULTIPLIER
            if self.weather.get(ship.id).get("adverse")
            else 1.0
        )

        ship.estimated_fuel_required_tons = round(
            max(
                0.0,
                nautical_miles
                / max(ship.speed_knots, 1)
                * self.FUEL_BURN_PER_KNOT_HOUR
                * weather_multiplier,
            ),
            2,
        )

        ship.can_reach_destination = (
            ship.fuel_tons
            >= ship.estimated_fuel_required_tons
        )

    # ---------------------------------------------------------
    # RISK
    # ---------------------------------------------------------

    def evaluate_risk(self, ship):
        if ship.status in {
            "stranded",
            "stopped",
            "arrived",
            "distressed",
        }:
            return

        fuel_percent = self.get_fuel_percent(ship)

        if ship.fuel_tons <= 0:
            ship.status = "stopped"

        elif (
            fuel_percent
            <= self.INSUFFICIENT_FUEL_PERCENT
        ):
            ship.status = "insufficient_fuel"

        elif fuel_percent <= self.CRITICAL_FUEL_PERCENT:
            ship.status = "critical"

        elif fuel_percent <= self.WARNING_FUEL_PERCENT:
            ship.status = "warning"

        elif ship.status == "rerouting":
            pass

        else:
            ship.status = "normal"

    # ---------------------------------------------------------
    # MOVEMENT
    # ---------------------------------------------------------

    def _move(
        self,
        ship,
        target,
        delta_seconds,
    ):
        if ship.speed_knots <= 0:
            return

        distance_nm = (
            ship.speed_knots
            * delta_seconds
            / 3600
        )

        lat_distance = distance_nm / 60

        heading_rad = math.radians(
            ship.heading
        )

        delta_lat = (
            lat_distance
            * math.cos(heading_rad)
        )

        longitude_scale = (
            60
            * math.cos(
                math.radians(
                    ship.position.lat
                )
            )
        )

        if abs(longitude_scale) < 0.001:
            delta_lng = 0
        else:
            delta_lng = (
                distance_nm
                * math.sin(heading_rad)
                / longitude_scale
            )

        new_lat = (
            ship.position.lat
            + delta_lat
        )

        new_lng = (
            ship.position.lng
            + delta_lng
        )

        remaining = distance_km(
            ship.position.lat,
            ship.position.lng,
            target.lat,
            target.lng,
        )

        moved = distance_km(
            ship.position.lat,
            ship.position.lng,
            new_lat,
            new_lng,
        )

        if moved >= remaining:
            ship.position.lat = target.lat
            ship.position.lng = target.lng
        else:
            ship.position.lat = new_lat
            ship.position.lng = new_lng

    def update_ship_position(
        self,
        ship,
        delta_seconds: float = 1.0,
    ):
        if ship.status in {
            "stopped",
            "stranded",
            "arrived",
        }:
            return

        # -----------------------------------------------------
        # MANUAL HEADING MODE
        # -----------------------------------------------------

        if ship.manual_heading:
            if ship.speed_knots <= 0:
                return

            distance_nm = (
                ship.speed_knots
                * delta_seconds
                / 3600
            )

            lat_distance = distance_nm / 60

            heading_rad = math.radians(
                ship.heading
            )

            delta_lat = (
                lat_distance
                * math.cos(heading_rad)
            )

            longitude_scale = (
                60
                * math.cos(
                    math.radians(
                        ship.position.lat
                    )
                )
            )

            if abs(longitude_scale) < 0.001:
                delta_lng = 0
            else:
                delta_lng = (
                    distance_nm
                    * math.sin(heading_rad)
                    / longitude_scale
                )

            ship.position.lat += delta_lat
            ship.position.lng += delta_lng

            return

        # -----------------------------------------------------
        # NORMAL ROUTE MODE
        # -----------------------------------------------------

        if not ship.route:
            self.recompute_route(ship)

            if not ship.route:
                return

        # Skip already-reached route points.
        if not self._prepare_route(ship):
            return

        target = ship.route[ship.route_index]

        # Calculate heading BEFORE movement.
        heading = self.calculate_heading(
            ship.position,
            target,
        )

        if heading is not None:
            ship.heading = round(heading, 2)

        before_lat = ship.position.lat
        before_lng = ship.position.lng

        self._move(
            ship,
            target,
            delta_seconds,
        )

        # Check if waypoint has been reached.
        remaining_to_target = distance_km(
            ship.position.lat,
            ship.position.lng,
            target.lat,
            target.lng,
        )

        if (
            remaining_to_target
            <= self.WAYPOINT_REACHED_KM
        ):
            ship.position.lat = target.lat
            ship.position.lng = target.lng

            ship.route_index += 1

            if ship.route_index >= len(
                ship.route
            ):
                ship.status = "arrived"
                return

            # Immediately point toward next waypoint.
            next_target = ship.route[
                ship.route_index
            ]

            next_heading = self.calculate_heading(
                ship.position,
                next_target,
            )

            if next_heading is not None:
                ship.heading = round(
                    next_heading,
                    2,
                )

        # -----------------------------------------------------
        # GEOFENCE HANDLING
        # -----------------------------------------------------

        inside_zone = any(
            point_in_polygon(
                ship.position.lat,
                ship.position.lng,
                zone,
            )
            for zone in self.restricted_zones.values()
        )

        if inside_zone:
            # IMPORTANT:
            # Only reroute when the ship ENTERS the zone.
            # Do NOT recalculate every second.
            if ship.id not in self.zone_breached_ships:
                self.zone_breached_ships.add(
                    ship.id
                )

                self.recompute_route(
                    ship,
                    reason="geofence breach",
                )

        else:
            self.zone_breached_ships.discard(
                ship.id
            )

    # ---------------------------------------------------------
    # ALERTS
    # ---------------------------------------------------------

    def detect_proximity(self):
        alerts = {}

        ships = self.fleet.ships

        for i, a in enumerate(ships):
            for b in ships[i + 1:]:
                d = distance_km(
                    a.position.lat,
                    a.position.lng,
                    b.position.lat,
                    b.position.lng,
                )

                if d <= self.PROXIMITY_KM:
                    key = "-".join(
                        sorted([a.id, b.id])
                    )

                    alerts[key] = {
                        "id": f"proximity-{key}",
                        "type": "PROXIMITY",
                        "severity": "HIGH",
                        "status": "ACTIVE",
                        "vessels": [
                            a.id,
                            b.id,
                        ],
                        "distanceKm": round(
                            d,
                            3,
                        ),
                        "createdAt": time.time(),
                    }

        self.proximity_alerts = alerts

    def detect_geofences(self):
        alerts = {}

        for zone_id, zone in (
            self.restricted_zones.items()
        ):
            for ship in self.fleet.ships:
                if point_in_polygon(
                    ship.position.lat,
                    ship.position.lng,
                    zone,
                ):
                    key = (
                        f"{zone_id}-{ship.id}"
                    )

                    alerts[key] = {
                        "id": f"geofence-{key}",
                        "type": "GEOFENCE_BREACH",
                        "severity": "CRITICAL",
                        "status": "ACTIVE",
                        "vesselId": ship.id,
                        "vessel": ship.name,
                        "zoneId": zone_id,
                        "position": ship.position.model_dump(),
                        "createdAt": time.time(),
                    }

        self.zone_alerts = alerts

    # ---------------------------------------------------------
    # HISTORY
    # ---------------------------------------------------------

    def record_snapshot(self, force=False):
        now = time.time()

        if (
            not force
            and now - self.last_snapshot < 30
        ):
            return

        self.last_snapshot = now

        self.history.append(
            {
                "timestamp": now,
                "ships": [
                    ship.model_dump()
                    for ship in self.fleet.ships
                ],
            }
        )

    # ---------------------------------------------------------
    # MAIN SIMULATION TICK
    # ---------------------------------------------------------

    def tick(
        self,
        delta_seconds: float = 1.0,
    ):
        for ship in self.fleet.ships:
            self.update_ship_position(
                ship,
                delta_seconds,
            )

            self.consume_fuel(
                ship,
                delta_seconds,
            )

            self.evaluate_risk(ship)

            self.update_fuel_feasibility(
                ship
            )

        self.detect_geofences()
        self.detect_proximity()
        self.record_snapshot()

    # ---------------------------------------------------------
    # WEATHER
    # ---------------------------------------------------------

    async def refresh_weather(self):
        await self.weather.refresh(
            self.fleet.ships
        )

        for ship in self.fleet.ships:
            ship.weather = self.weather.get(
                ship.id
            )

    # ---------------------------------------------------------
    # BACKGROUND RUNNER
    # ---------------------------------------------------------

    async def run(self):
        previous_time = (
            asyncio.get_event_loop().time()
        )

        while True:
            current = (
                asyncio.get_event_loop().time()
            )

            delta = (
                current - previous_time
            )

            previous_time = current

            self.tick(delta)

            await asyncio.sleep(1)

    def stop(self):
        pass