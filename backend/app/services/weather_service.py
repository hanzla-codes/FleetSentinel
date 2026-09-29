import time
from typing import Any

import httpx


class WeatherService:
    def __init__(self):
        self.cache: dict[str, dict[str, Any]] = {}
        self.last_refresh = 0.0
        self.refresh_interval = 600.0

    @staticmethod
    def _adverse(current: dict[str, Any]) -> bool:
        wind = float(current.get("wind_speed_10m") or 0)
        code = int(current.get("weather_code") or 0)
        return wind >= 40 or code in {45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 95, 96, 99}

    async def refresh(self, ships) -> None:
        now = time.monotonic()
        if now - self.last_refresh < self.refresh_interval:
            return
        self.last_refresh = now
        async with httpx.AsyncClient(timeout=8) as client:
            for ship in ships:
                try:
                    response = await client.get(
                        "https://api.open-meteo.com/v1/forecast",
                        params={
                            "latitude": ship.position.lat,
                            "longitude": ship.position.lng,
                            "current": "wind_speed_10m,weather_code",
                            "wind_speed_unit": "kmh",
                        },
                    )
                    response.raise_for_status()
                    data = response.json().get("current", {})
                    self.cache[ship.id] = {
                        "wind_kmh": float(data.get("wind_speed_10m") or 0),
                        "weather_code": int(data.get("weather_code") or 0),
                        "adverse": self._adverse(data),
                        "updated_at": time.time(),
                    }
                except Exception:
                    self.cache.setdefault(ship.id, {
                        "wind_kmh": 0,
                        "weather_code": 0,
                        "adverse": False,
                        "updated_at": time.time(),
                    })

    def get(self, ship_id: str) -> dict[str, Any]:
        return self.cache.get(ship_id, {
            "wind_kmh": 0,
            "weather_code": 0,
            "adverse": False,
            "updated_at": None,
        })
