import asyncio
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from models.database import engine, SessionLocal
from models.orm import Base

# Import all ORM models so Base.metadata is populated before create_all
import models.orm  # noqa: F401

from api.routes import studies, blocks, slots, participants, files, protocol, analysis, log, admin
from services.analysis_service import worker as analysis_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all DB tables on startup (idempotent)
    Base.metadata.create_all(bind=engine)

    # Start the background analysis queue worker
    task = asyncio.create_task(analysis_worker(SessionLocal))
    yield
    # Graceful shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Probe-Adjust API",
    description="Backend for the Probe-Adjust mixed-methods research prototype",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow Vite dev server, GitHub Pages, and any configured FRONTEND_ORIGIN
frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
extra_origins = [o.strip() for o in os.getenv("EXTRA_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        frontend_origin,
        "http://localhost:5173",
        "http://localhost:4173",
        *extra_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers under /api prefix
PREFIX = "/api"
app.include_router(studies.router, prefix=PREFIX)
app.include_router(blocks.router, prefix=PREFIX)
app.include_router(slots.router, prefix=PREFIX)
app.include_router(participants.router, prefix=PREFIX)
app.include_router(files.router, prefix=PREFIX)
app.include_router(protocol.router, prefix=PREFIX)
app.include_router(analysis.router, prefix=PREFIX)
app.include_router(log.router, prefix=PREFIX)
app.include_router(admin.router, prefix=PREFIX)


@app.get("/health")
def health():
    return {"status": "ok"}
