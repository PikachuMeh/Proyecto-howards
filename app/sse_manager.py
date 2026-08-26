import asyncio
import json
from typing import Set, Dict, Any

class SSEManager:
    """
    Manages Server-Sent Events (SSE) connections for the public screen and live clients.
    Thread-safe and async-compatible.
    """
    def __init__(self):
        self.subscribers: Set[asyncio.Queue] = set()

    async def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue(maxsize=100)
        self.subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        self.subscribers.discard(queue)

    async def broadcast_assignment(self, assignment_data: Dict[str, Any]):
        """Broadcasts a new assignment event to all connected public screens."""
        message = {
            "type": "assignment",
            "data": assignment_data
        }
        raw_msg = json.dumps(message)
        dead_queues = set()
        for queue in self.subscribers:
            try:
                queue.put_nowait(raw_msg)
            except asyncio.QueueFull:
                dead_queues.add(queue)

        for q in dead_queues:
            self.subscribers.discard(q)

    async def broadcast_reset(self):
        """Broadcasts an event reset to reload all public screens."""
        message = {
            "type": "event_reset",
            "data": {"message": "Event has been reset."}
        }
        raw_msg = json.dumps(message)
        for queue in list(self.subscribers):
            try:
                queue.put_nowait(raw_msg)
            except Exception:
                self.subscribers.discard(queue)

sse_manager = SSEManager()
