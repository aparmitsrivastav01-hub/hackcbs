from contextlib import asynccontextmanager
import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.health import router as health_router
from app.api.routes.medicines import router as medicines_router
from app.api.routes.prescriptions import router as prescriptions_router
from app.api.routes.cart import router as cart_router
from app.api.routes.pharmacies import router as pharmacies_router
from app.api.routes.safety import router as safety_router, batch_safety_router
from app.api.routes.ai import router as ai_router
from app.api.routes.elevenlabs import router as elevenlabs_router
from app.core.config import DEFAULT_CSV_PATH, get_cors_origins
from app.services.medicine_service import MedicineService
from app.services.prescription.prescription_service import PrescriptionService
from app.services.cart_service import CartService
from app.services.pharmacy_service import PharmacyService
from app.services.cdsco_safety_service import CDSCOSafetyService
from app.services.gemini_service import GeminiService, TemporaryChatSessions
from app.services.elevenlabs_service import ElevenLabsSpeechService

medicine_service = MedicineService()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    csv_path = os.getenv("MEDEASY_CSV_PATH", str(DEFAULT_CSV_PATH))
    medicine_service.load_csv(csv_path)
    app.state.medicine_service = medicine_service
    app.state.prescription_service = PrescriptionService(medicine_service)
    app.state.gemini_service = GeminiService()
    app.state.ai_chat_sessions = TemporaryChatSessions()
    app.state.elevenlabs_service = ElevenLabsSpeechService()
    safety_path = os.getenv("CDSCO_ALERTS_CSV_PATH")
    app.state.safety_service = CDSCOSafetyService(safety_path)
    try:
        loaded = app.state.safety_service.load_csv()
        if loaded <= 0:
            raise RuntimeError(f"CDSCO safety dataset is empty: {app.state.safety_service.csv_path}")
    except Exception:
        logger.exception("Application startup blocked: CDSCO safety dataset failed validation")
        raise
    app.state.cart_service = CartService(medicine_service, app.state.safety_service)
    app.state.pharmacy_service = PharmacyService(app.state.cart_service, safety_service=app.state.safety_service)
    try:
        yield
    finally:
        await app.state.gemini_service.close()


app = FastAPI(
    title="MedEasy Backend API",
    description="Medicine search, prescription extraction, MedSaathi Gemini chat, ElevenLabs speech, cart, pharmacy discovery, enquiries, and CDSCO NSQ batch checks.",
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
app.include_router(safety_router)
app.include_router(batch_safety_router)
app.include_router(ai_router)
app.include_router(elevenlabs_router)
