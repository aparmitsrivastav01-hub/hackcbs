from typing import Literal
from pydantic import BaseModel, Field, model_validator

CartProvider = Literal["jan_aushadhi", "dava_india", "private_brand"]


class CartAddRequest(BaseModel):
    medicine_id: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1, le=999)
    selected_provider: CartProvider
    cart_session_id: str | None = Field(default=None, min_length=1, max_length=100)


class CartUpdateRequest(BaseModel):
    cart_session_id: str = Field(min_length=1, max_length=100)
    quantity: int | None = Field(default=None, ge=1, le=999)
    selected_provider: CartProvider | None = None

    @model_validator(mode="after")
    def require_update(self):
        if self.quantity is None and self.selected_provider is None:
            raise ValueError("Provide quantity or selected_provider to update")
        return self


class CartItemResponse(BaseModel):
    item_id: str
    medicine_id: int
    medicine_name: str
    active_salt: str
    dosage_form: str
    quantity: int
    selected_provider: CartProvider
    unit_price: float
    subtotal: float
    private_brand_unit_price: float | None
    potential_savings: float | None


class CartResponse(BaseModel):
    success: bool
    cart_session_id: str
    items: list[CartItemResponse]
    line_item_count: int
    total_quantity: int
    subtotal: float
    private_brand_subtotal: float | None
    potential_savings: float | None
