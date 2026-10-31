from fastapi import APIRouter, Depends, HTTPException, Query
from app.models.schemas import CategoriesResponse, MaximumSavingsResponse, MedicineResponse, SearchResponse
from app.services.medicine_service import MedicineService
from app.services.price_service import compare_prices, maximum_savings_opportunities
from app.services.search_service import search_rows

router = APIRouter(prefix="/api/medicines", tags=["medicines"])


def get_service() -> MedicineService:
    from app.main import medicine_service
    return medicine_service


def serialize(row: dict) -> dict:
    return {
        "id": int(row["id"]),
        "brand_name": row["brand_name"],
        "active_salt": row["active_salt"],
        "dosage_form": row["dosage_form"],
        "category": row["category"],
        **compare_prices(row),
    }


@router.get("/search", response_model=SearchResponse)
def search_medicines(q: str = Query(..., min_length=1, description="Medicine name, composition, strength, or dosage form"), service: MedicineService = Depends(get_service)):
    if not q.strip():
        raise HTTPException(status_code=422, detail="Search query must not be empty")
    rows = search_rows(q, service.all())
    results = [serialize(row) for row in rows]
    return {"success": True, "query": q.strip(), "total_results": len(results), "results": results}


@router.get("/maximum-savings", response_model=MaximumSavingsResponse)
def get_maximum_savings(
    provider: str | None = Query(None, pattern="^(jan_aushadhi|dava_india)$"),
    service: MedicineService = Depends(get_service),
):
    return maximum_savings_opportunities(service.all(), provider=provider, limit=10)


@router.get("/categories", response_model=CategoriesResponse)
def get_categories(service: MedicineService = Depends(get_service)):
    categories = service.categories()
    return {"categories": categories, "total_categories": len(categories)}


@router.get("/{medicine_id}", response_model=MedicineResponse)
def get_medicine(medicine_id: int, service: MedicineService = Depends(get_service)):
    row = service.get(medicine_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return serialize(row)
