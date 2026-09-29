import heapq
import math
from typing import Iterable, List

from app.schemas.fleet import Position

NAVIGABLE_WATER = [
    (29.80, 48.60), (29.50, 50.00), (28.80, 50.80),
    (27.80, 52.00), (26.70, 53.50), (26.30, 55.00),
    (26.65, 56.10), (26.50, 56.40), (26.00, 56.80),
    (25.50, 57.50), (25.50, 58.50), (25.00, 60.00),
    (22.00, 60.00), (22.50, 60.00), (23.80, 58.80),
    (24.50, 57.20), (25.20, 56.50), (26.45, 56.45),
    (26.30, 55.90), (26.00, 55.50), (25.30, 54.50),
    (24.80, 53.00), (25.30, 52.00), (26.40, 51.50),
    (26.50, 50.30), (27.50, 49.80), (28.50, 49.00),
    (29.50, 48.30), (29.80, 48.60),
]

PORTS = {
    "KWT-1": (29.48, 48.34), "BUS-1": (28.83, 50.73),
    "DMM-1": (26.56, 50.30), "BAH-1": (26.50, 50.55),
    "DOH-1": (25.46, 51.95), "AUH-1": (25.22, 54.18),
    "DXB-1": (25.50, 54.75), "BND-1": (26.62, 56.11),
    "SOH-1": (24.72, 57.02), "MCT-1": (23.92, 58.58),
}


def point_in_polygon(lat: float, lng: float, polygon: list[tuple[float, float]]) -> bool:
    inside = False
    j = len(polygon) - 1
    for i in range(len(polygon)):
        yi, xi = polygon[i]
        yj, xj = polygon[j]
        if ((xi > lng) != (xj > lng)) and (lat < (yj - yi) * (lng - xi) / (xj - xi + 1e-12) + yi):
            inside = not inside
        j = i
    return inside


def distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))



def _point_on_segment(lat: float, lng: float, a: tuple[float, float], b: tuple[float, float], tolerance: float = 0.0008) -> bool:
    ax, ay = a[1], a[0]
    bx, by = b[1], b[0]
    px, py = lng, lat
    dx, dy = bx - ax, by - ay
    length2 = dx * dx + dy * dy
    if length2 == 0:
        return math.hypot(px - ax, py - ay) <= tolerance
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy)) <= tolerance


def _in_or_on_water(lat: float, lng: float) -> bool:
    return point_in_polygon(lat, lng, NAVIGABLE_WATER) or any(
        _point_on_segment(lat, lng, NAVIGABLE_WATER[i], NAVIGABLE_WATER[(i + 1) % len(NAVIGABLE_WATER)])
        for i in range(len(NAVIGABLE_WATER))
    )


def _segment_clear(a: tuple[float, float], b: tuple[float, float], zones: list[list[tuple[float, float]]], allow_start_inside: bool = False) -> bool:
    dist = max(distance_km(a[0], a[1], b[0], b[1]), 1.0)
    samples = max(8, int(dist / 4))
    start_inside = [point_in_polygon(a[0], a[1], zone) for zone in zones]
    exited = [False] * len(zones)
    for i in range(samples + 1):
        t = i / samples
        lat = a[0] + (b[0] - a[0]) * t
        lng = a[1] + (b[1] - a[1]) * t
        if not _in_or_on_water(lat, lng):
            return False
        for z_index, zone in enumerate(zones):
            inside = point_in_polygon(lat, lng, zone)
            if inside:
                if not (allow_start_inside and start_inside[z_index] and not exited[z_index]):
                    return False
            elif start_inside[z_index]:
                exited[z_index] = True
    return True


def _safe_zone_vertices(zones: list[list[tuple[float, float]]]) -> list[tuple[float, float]]:
    vertices: list[tuple[float, float]] = []
    for zone in zones:
        if len(zone) < 3:
            continue
        center_lat = sum(p[0] for p in zone) / len(zone)
        center_lng = sum(p[1] for p in zone) / len(zone)
        for lat, lng in zone:
            # Move each candidate a small amount away from the zone centroid so
            # the path does not run directly along the restricted boundary.
            dy, dx = lat - center_lat, lng - center_lng
            length = math.hypot(dy, dx) or 1.0
            candidate = (lat + dy / length * 0.015, lng + dx / length * 0.015)
            if point_in_polygon(candidate[0], candidate[1], NAVIGABLE_WATER):
                vertices.append(candidate)
    return vertices


def calculate_route(start: Position, destination: str, restricted_zones: list[list[tuple[float, float]]] | None = None) -> List[Position]:
    if destination not in PORTS:
        raise ValueError(f"Unknown destination: {destination}")

    zones = restricted_zones or []
    dest = PORTS[destination]
    start_xy = (start.lat, start.lng)

    if not point_in_polygon(start_xy[0], start_xy[1], NAVIGABLE_WATER):
        raise ValueError("Ship is outside navigable water")
    if not point_in_polygon(dest[0], dest[1], NAVIGABLE_WATER):
        raise ValueError("Destination is outside navigable water")

    if not any(point_in_polygon(start_xy[0], start_xy[1], zone) for zone in zones) and _segment_clear(start_xy, dest, zones):
        return [Position(lat=dest[0], lng=dest[1])]

    nodes = [start_xy, dest, *NAVIGABLE_WATER, *_safe_zone_vertices(zones)]
    graph: list[list[tuple[int, float]]] = [[] for _ in nodes]

    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            if _segment_clear(nodes[i], nodes[j], zones, allow_start_inside=(i == 0)):
                weight = distance_km(*nodes[i], *nodes[j])
                graph[i].append((j, weight))
                graph[j].append((i, weight))

    queue = [(0.0, 0)]
    distances = {0: 0.0}
    previous: dict[int, int | None] = {0: None}

    while queue:
        cost, current = heapq.heappop(queue)
        if current == 1:
            break
        if cost > distances.get(current, float("inf")):
            continue
        for nxt, weight in graph[current]:
            new_cost = cost + weight
            if new_cost < distances.get(nxt, float("inf")):
                distances[nxt] = new_cost
                previous[nxt] = current
                heapq.heappush(queue, (new_cost, nxt))

    if 1 not in previous:
        raise ValueError("No valid route exists around the current restricted zones")

    path = []
    cursor: int | None = 1
    while cursor is not None:
        path.append(nodes[cursor])
        cursor = previous.get(cursor)
    path.reverse()

    return [Position(lat=lat, lng=lng) for lat, lng in path]
