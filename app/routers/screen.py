import asyncio
import json
from typing import List
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.database import get_db
from app.models import HouseOut
from app.sse_manager import sse_manager

router = APIRouter(prefix="/api", tags=["Screen"])

@router.get("/houses", response_model=List[HouseOut])
def get_houses(lang: str = "en"):
    lang = "de" if lang.lower() == "de" else "en"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT h.id, h.code,
                   CASE WHEN ? = 'de' THEN h.name_de ELSE h.name_en END as name,
                   h.color_hex, h.secondary_color,
                   CASE WHEN ? = 'de' THEN h.motto_de ELSE h.motto_en END as motto,
                   h.crest_icon, h.game_points, COUNT(a.id) as total
            FROM house h
            LEFT JOIN assignment a ON a.house_id = h.id
            GROUP BY h.id, h.code, h.name_en, h.name_de, h.color_hex, h.secondary_color, h.motto_en, h.motto_de, h.crest_icon, h.game_points
            ORDER BY h.id ASC
        """, (lang, lang))
        houses = [dict(h) for h in cursor.fetchall()]

        for h in houses:
            cursor.execute("""
                SELECT p.id, p.display_name, a.assigned_at
                FROM assignment a
                JOIN participant p ON p.id = a.participant_id
                WHERE a.house_id = ?
                ORDER BY a.assigned_at ASC
            """, (h["id"],))
            h["participants"] = [dict(p) for p in cursor.fetchall()]

    return houses

@router.get("/events/stream")
async def events_stream(request: Request):
    """
    SSE stream providing real-time assignment and event broadcasts.
    Automatically reconnects on the browser side via EventSource.
    """
    queue = await sse_manager.subscribe()

    async def event_generator():
        try:
            # Yield initial connection confirmation
            init_payload = json.dumps({"type": "connected", "message": "Connected to Sorting Hat stream"})
            yield f"data: {init_payload}\n\n"

            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    break

                try:
                    # Wait for next event or send keepalive ping after 15 seconds
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    # Keepalive comment
                    yield ": keepalive-ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            sse_manager.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
