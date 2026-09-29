import asyncio
import json
import websockets


async def test():
    async with websockets.connect(
        "ws://127.0.0.1:8000/ws/fleet"
    ) as ws:

        for i in range(5):
            data = json.loads(await ws.recv())

            ship = data["ships"][0]

            print(
                f"Update: {i + 1} | "
                f"Ships: {data['count']} | "
                f"First ship: {ship['name']} | "
                f"Position: {ship['position']}"
            )


asyncio.run(test())