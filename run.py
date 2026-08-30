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
    print(f"  📺 Public Screen (Projector/TV):   http://localhost:{PORT}/screen")
    print(f"  🏰 Admin Control Panel:            http://localhost:{PORT}/admin (Password: alohomora)")
    if local_ip and not local_ip.startswith("172.") and not local_ip.startswith("127."):
        print(f"  🌐 Mobile Questionnaire (Wi-Fi):   http://{local_ip}:{PORT}/")
    else:
        print(f"  🌐 For other devices on Wi-Fi:     http://<YOUR-PC-IP>:{PORT}/")
    print(f"  📚 Interactive API Docs:          http://localhost:{PORT}/docs")
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