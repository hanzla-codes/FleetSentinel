import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.websocket import (
    router as websocket_router,
    simulator,
    simulator_loop,
)

from app.api.dispatch import (
    router as dispatch_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    simulator_task = asyncio.create_task(
        simulator_loop()
    )

    try:
        yield
    finally:
        simulator_task.cancel()

        try:
            await simulator_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Fleet Crisis Command System",
    version="1.0.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(websocket_router)
app.include_router(dispatch_router)


@app.get("/")
async def root():
    return {
        "system": "Fleet Crisis Command System",
        "status": "online",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
    }


@app.get("/api/fleet")
async def get_fleet():
    return {
        "count": simulator.fleet.count,
        "ships": [
            ship.model_dump()
            for ship in simulator.fleet.ships
        ],
    }