from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.seed import seed_database
from app.routers import guest, screen, admin

BASE_DIR = Path(__file__).parent.parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

STATIC_DIR.mkdir(parents=True, exist_ok=True)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB and seed default data if not present
    seed_database()
    yield

app = FastAPI(
    title="Hogwarts Sorting Hat API",
    description="Full-stack real-time Hogwarts sorting hat web application (Bilingual: EN / DE).",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for mobile & projector clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Templates
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# Include API Routers
app.include_router(guest.router)
app.include_router(screen.router)
app.include_router(admin.router)

# Frontend Page Routes
@app.get("/")
@app.get("/guest")
async def guest_page(request: Request):
    return templates.TemplateResponse(request=request, name="guest.html")

@app.get("/screen")
async def screen_page(request: Request):
    return templates.TemplateResponse(request=request, name="screen.html")

@app.get("/admin")
async def admin_page(request: Request):
    return templates.TemplateResponse(request=request, name="admin.html")

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    ico_path = STATIC_DIR / "favicon.ico"
    if ico_path.exists():
        return FileResponse(ico_path, media_type="image/x-icon")
    return FileResponse(STATIC_DIR / "images" / "hogwarts_favicon.png", media_type="image/png")

@app.get("/health")
def health_check():
    return {"status": "ok", "app": "Hogwarts Sorting Hat"}

