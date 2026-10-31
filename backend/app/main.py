from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.health import router as health_router
from app.api.routes.medicines import router as medicines_router
from app.api.routes.prescriptions import router as prescriptions_router
from app.api.routes.cart import router as cart_router
from app.api.routes.pharmacies import router as pharmacies_router
from app.core.config import DEFAULT_CSV_PATH, get_cors_origins
from app.services.medicine_service import MedicineService
from app.services.prescription.prescription_service import PrescriptionService
from app.services.cart_service import CartService
from app.services.pharmacy_service import PharmacyService

medicine_service = MedicineService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    csv_path = os.getenv("MEDEASY_CSV_PATH", str(DEFAULT_CSV_PATH))
    medicine_service.load_csv(csv_path)
    app.state.prescription_service = PrescriptionService(medicine_service)
    app.state.cart_service = CartService(medicine_service)
    app.state.pharmacy_service = PharmacyService(app.state.cart_service)
    yield


app = FastAPI(
    title="MedEasy Backend API",
    description="CSV-backed medicine search, prescription extraction, smart cart, and pharmacy discovery/enquiries.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(medicines_router)
app.include_router(prescriptions_router)
app.include_router(cart_router)
app.include_router(pharmacies_router)
