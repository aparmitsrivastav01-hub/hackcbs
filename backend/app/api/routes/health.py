from fastapi import APIRouter, Depends
from app.models.schemas import HealthResponse
from app.services.medicine_service import MedicineService
from app.api.routes.medicines import get_service

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(service: MedicineService = Depends(get_service)):
    return {"status": "ok", "catalogue_records": service.count}
