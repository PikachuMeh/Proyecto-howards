import os
import socket

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "alohomora")
SECRET_KEY = os.getenv("SECRET_KEY", "gryffindor-ravenclaw-hufflepuff-slytherin-magic-key-2026")
COOKIE_NAME = "sorting_session"
DEFAULT_EVENT_NAME = "Hogwarts Christmas Party"
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))

def get_local_ip() -> str:
    """Detects the server host's primary local LAN IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"

