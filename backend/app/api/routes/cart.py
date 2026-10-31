from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.models.cart_schemas import CartAddRequest, CartResponse, CartUpdateRequest
from app.services.cart_service import CartSafetyBlocked, CartService

router = APIRouter(prefix="/api/cart", tags=["cart"])


def get_cart_service(request: Request) -> CartService:
    return request.app.state.cart_service


@router.post("/add", response_model=CartResponse, status_code=status.HTTP_201_CREATED)
def add_to_cart(body: CartAddRequest, service: CartService = Depends(get_cart_service)):
    try:
        return service.add(
            body.medicine_id, body.quantity, body.selected_provider, body.cart_session_id,
            body.batch_number, body.manufacturer,
        )
    except CartSafetyBlocked as exc:
        raise HTTPException(status_code=409, detail={
            "code": "batch_safety_review_required",
            "safety_status": exc.safety_result["safety_status"],
            "action_required": exc.safety_result["action_required"],
            "warning": exc.safety_result.get("warning"),
            "alert": exc.safety_result.get("alert"),
            "possible_alerts": exc.safety_result.get("possible_alerts", []),
            "safety_disclaimer": exc.safety_result["safety_disclaimer"],
        }) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("", response_model=CartResponse)
def get_cart(cart_session_id: str = Query(min_length=1, max_length=100), service: CartService = Depends(get_cart_service)):
    return service.get(cart_session_id)


@router.put("/update/{item_id}", response_model=CartResponse)
def update_cart_item(item_id: str, body: CartUpdateRequest, service: CartService = Depends(get_cart_service)):
    try:
        return service.update(
            body.cart_session_id, item_id, body.quantity, body.selected_provider,
            body.batch_number, body.manufacturer,
        )
    except CartSafetyBlocked as exc:
        raise HTTPException(status_code=409, detail={
            "code": "batch_safety_review_required",
            "safety_status": exc.safety_result["safety_status"],
            "action_required": exc.safety_result["action_required"],
            "warning": exc.safety_result.get("warning"),
            "alert": exc.safety_result.get("alert"),
            "possible_alerts": exc.safety_result.get("possible_alerts", []),
            "safety_disclaimer": exc.safety_result["safety_disclaimer"],
        }) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete("/remove/{item_id}", response_model=CartResponse)
def remove_cart_item(
    item_id: str,
    cart_session_id: str = Query(min_length=1, max_length=100),
    service: CartService = Depends(get_cart_service),
):
    try:
        return service.remove(cart_session_id, item_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc).strip("'")) from exc


@router.delete("/clear", response_model=CartResponse)
def clear_cart(
    cart_session_id: str = Query(min_length=1, max_length=100),
    service: CartService = Depends(get_cart_service),
):
    return service.clear(cart_session_id)
