"""
Hogwarts Sorting Hat - Single Command Startup Script (NFR-10).
Usage:
    python run.py
"""

import uvicorn
from app.config import HOST, PORT
from app.seed import seed_database

def main():
    print("=" * 60)
    print("🧙‍♂️  HOGWARTS SORTING HAT - CHRISTMAS SPECIAL  🧙‍♂️")
    print("=" * 60)
    print("Initializing and seeding database...")
    seed_database()
    print("\n✨ Magic Portals Ready:")
    print(f"  📱 Mobile Questionnaire (Guests): http://localhost:{PORT}/")
    print(f"  📺 Public Screen (Projector/TV): http://localhost:{PORT}/screen")
    print(f"  🏰 Admin Control Panel:          http://localhost:{PORT}/admin (Password: alohomora)")
    print(f"  📚 Interactive API Docs:        http://localhost:{PORT}/docs")
    print("=" * 60)
    print("Starting FastAPI Uvicorn Server...\n")

    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        reload=True
    )

if __name__ == "__main__":
    main()
