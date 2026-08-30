"""
Hogwarts Sorting Hat - Single Command Startup Script (NFR-10).
Usage:
    python run.py
"""

import os
import uvicorn
from app.config import HOST, PORT, get_local_ip
from app.seed import seed_database

def main():
    local_ip = get_local_ip()
    print("=" * 60)
    print("🧙‍♂️  HOGWARTS SORTING HAT - CHRISTMAS SPECIAL  🧙‍♂️")
    print("=" * 60)
    print("Initializing and seeding database...")
    seed_database()
    print("\n✨ Magic Portals Ready:")
    print(f"  📱 Mobile Questionnaire (Local):   http://localhost:{PORT}/")
    print(f"  🌐 Mobile Questionnaire (Wi-Fi):   http://{local_ip}:{PORT}/")
    print(f"  📺 Public Screen (Projector/TV):   http://{local_ip}:{PORT}/screen")
    print(f"  🏰 Admin Control Panel:            http://{local_ip}:{PORT}/admin (Password: alohomora)")
    print(f"  📚 Interactive API Docs:          http://{local_ip}:{PORT}/docs")
    print("=" * 60)
    print(f"🚀 Server listening on all interfaces: 0.0.0.0:{PORT}")
    print("Starting FastAPI Uvicorn Server...\n")

    reload_mode = os.getenv("RELOAD", "false").lower() in ("true", "1", "yes")
    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        reload=reload_mode
    )

if __name__ == "__main__":
    main()