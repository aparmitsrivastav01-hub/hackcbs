from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.health import router as health_router
from app.api.routes.medicines import router as medicines_router
from app.core.config import DEFAULT_CSV_PATH, get_cors_origins
from app.services.medicine_service import MedicineService

medicine_service = MedicineService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    csv_path = os.getenv("MEDEASY_CSV_PATH", str(DEFAULT_CSV_PATH))
    medicine_service.load_csv(csv_path)
    yield


app = FastAPI(
    title="MedEasy Medicine Search API",
    description="Medicine search and price comparison backed by the MedEasy catalogue.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(medicines_router)
