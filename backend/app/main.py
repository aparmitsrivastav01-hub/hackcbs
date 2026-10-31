from contextlib import asynccontextmanager
import asyncio
import os
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.health import router as health_router
from app.api.routes.medicines import router as medicines_router
from app.api.routes.prescriptions import router as prescriptions_router
from app.api.routes.cart import router as cart_router
from app.api.routes.pharmacies import router as pharmacies_router
from app.api.routes.stores import router as stores_router
from app.api.routes.enquiries import router as enquiries_router
from app.api.routes.safety import router as safety_router, batch_safety_router
from app.api.routes.ai import router as ai_router
from app.api.routes.elevenlabs import router as elevenlabs_router
<<<<<<< HEAD
from app.api.routes.auth import router as auth_router
from app.api.routes.profile import router as profile_router
from app.api.routes.privacy import router as privacy_router
=======
from app.api.routes.memory import router as memory_router
>>>>>>> 99ea3c54d9d08682bc49c798eea7fae9f24afb1f
from app.core.config import DEFAULT_CSV_PATH, get_cors_origins
from app.db.base import check_database_health, get_async_engine
from app.services.medicine_service import MedicineService
from app.services.prescription.prescription_service import PrescriptionService
from app.services.cart_service import CartService
from app.services.pharmacy_service import PharmacyService
from app.services.cdsco_safety_service import CDSCOSafetyService
from app.services.gemini_service import GeminiService, TemporaryChatSessions
from app.services.elevenlabs_service import ElevenLabsSpeechService
from app.services.meko_service import MekoService

medicine_service = MedicineService()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    csv_path = os.getenv("MEDEASY_CSV_PATH", str(DEFAULT_CSV_PATH))
    medicine_service.load_csv(csv_path)
    app.state.medicine_service = medicine_service
    app.state.prescription_service = PrescriptionService(medicine_service)
    from app.services.batch_extraction_service import BatchExtractionService
    app.state.batch_extraction_service = BatchExtractionService()
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
<<<<<<< HEAD

    # Check and log YugabyteDB / Database connectivity status
    db_health = await check_database_health()
    if db_health.get("connected"):
        logger.info("YugabyteDB / Accounts database connection verified: %s", db_health.get("status"))
    else:
        logger.warning("YugabyteDB connection warning: %s", db_health.get("error"))

=======
    app.state._background_tasks = set()
    meko_service = MekoService()
    await meko_service.initialize()
    app.state.meko_service = meko_service
>>>>>>> 99ea3c54d9d08682bc49c798eea7fae9f24afb1f
    try:
        yield
    finally:
        await app.state.gemini_service.close()
<<<<<<< HEAD
        engine = get_async_engine()
        await engine.dispose()
=======
        bg_tasks = list(getattr(app.state, "_background_tasks", []))
        for task in bg_tasks:
            if not task.done():
                try:
                    await asyncio.wait_for(asyncio.shield(task), timeout=5.0)
                except Exception:
                    pass
        if getattr(app.state, "meko_service", None):
            await app.state.meko_service.close()
>>>>>>> 99ea3c54d9d08682bc49c798eea7fae9f24afb1f


app = FastAPI(
    title="MedEasy Backend API",
    description="Medicine search, prescription extraction, MedSaathi Gemini chat, ElevenLabs speech, cart, pharmacy discovery, enquiries, CDSCO NSQ batch checks, and patient identity/consent management.",
    version="2.0.0",
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
app.include_router(stores_router)
app.include_router(enquiries_router)
app.include_router(safety_router)
app.include_router(batch_safety_router)
app.include_router(ai_router)
app.include_router(elevenlabs_router)
<<<<<<< HEAD
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(privacy_router)
=======
app.include_router(memory_router)
>>>>>>> 99ea3c54d9d08682bc49c798eea7fae9f24afb1f
