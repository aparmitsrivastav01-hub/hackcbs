import logging
from fastapi import APIRouter, Depends, HTTPException, Request

from app.models.pharmacy_schemas import (
    ShopWhatsAppContactRequest,
    ShopWhatsAppContactResponse,
)
from app.services.pharmacy_service import PharmacyService
from app.services.tinyfish_service import TinyFishError, TinyFishNotConfigured, TinyFishTimeout

router = APIRouter(prefix="/api/stores", tags=["stores"])
logger = logging.getLogger(__name__)


def get_pharmacy_service(request: Request) -> PharmacyService:
    return request.app.state.pharmacy_service


@router.post("/whatsapp-contact", response_model=ShopWhatsAppContactResponse)
async def get_shop_whatsapp_contact(
    body: ShopWhatsAppContactRequest,
    service: PharmacyService = Depends(get_pharmacy_service),
):
    """
    On-demand WhatsApp number discovery for a specific selected pharmacy shop.
    Uses TinyFish to inspect official websites and verified public listings.
    Prioritizes explicit WhatsApp contacts over general phone numbers.
    Does not scrape private information or send messages automatically.
    """
    logger.info("WhatsApp contact discovery requested for shop: %s", body.shop_name)
    try:
        return await service.get_shop_whatsapp_contact(body)
    except TinyFishNotConfigured as exc:
        logger.warning("TinyFish contact discovery is not configured: %s", str(exc))
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except TinyFishTimeout as exc:
        logger.warning("TinyFish contact discovery timed out for shop: %s", body.shop_name)
        raise HTTPException(status_code=504, detail="TinyFish contact discovery timed out") from exc
    except TinyFishError as exc:
        logger.error("TinyFish contact discovery failed for shop: %s", body.shop_name)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
