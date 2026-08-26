import os

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "alohomora")
SECRET_KEY = os.getenv("SECRET_KEY", "gryffindor-ravenclaw-hufflepuff-slytherin-magic-key-2026")
COOKIE_NAME = "sorting_session"
DEFAULT_EVENT_NAME = "Hogwarts Christmas Party"
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))
