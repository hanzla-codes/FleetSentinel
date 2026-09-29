from typing import Literal
from pydantic import BaseModel, Field

class Position(BaseModel):
    lat: float
    lng: float

class Ship(BaseModel):
    id: str
    name: str
    position: Position
    speed_knots: float = Field(ge=0)
    heading: float = Field(ge=0, lt=360)
    destination: str
    fuel_tons: float = Field(ge=0)
    cargo: str
    status: Literal[
        "normal", "warning", "critical", "rerouting", "distressed",
        "stopped", "stranded", "insufficient_fuel", "arrived",
    ] = "normal"
    route: list[Position] = Field(default_factory=list)
    route_index: int = 0
    manual_heading: bool = False
    weather: dict = Field(default_factory=dict)
    estimated_fuel_required_tons: float = 0.0
    can_reach_destination: bool = True

class Fleet(BaseModel):
    ships: list[Ship]
    @property
    def count(self) -> int:
        return len(self.ships)
