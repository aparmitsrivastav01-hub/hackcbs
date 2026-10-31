from typing import Literal
from pydantic import BaseModel, Field, model_validator

CartProvider = Literal["jan_aushadhi", "dava_india", "private_brand"]


class CartAddRequest(BaseModel):
    medicine_id: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1, le=999)
    selected_provider: CartProvider
    cart_session_id: str | None = Field(default=None, min_length=1, max_length=100)
    batch_number: str | None = Field(default=None, max_length=120)
    manufacturer: str | None = Field(default=None, max_length=500)


class CartUpdateRequest(BaseModel):
    cart_session_id: str = Field(min_length=1, max_length=100)
    quantity: int | None = Field(default=None, ge=1, le=999)
    selected_provider: CartProvider | None = None
    batch_number: str | None = Field(default=None, max_length=120)
    manufacturer: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def require_update(self):
        if all(value is None for value in (self.quantity, self.selected_provider, self.batch_number, self.manufacturer)):
            raise ValueError("Provide quantity, selected_provider, or batch details to update")
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
    batch_number: str | None
    manufacturer: str | None
    batch_safety_status: str
    can_be_sold: bool | None
    can_be_dispensed: bool | None
    batch_verification_required: bool
    safety_warning: str


class CartResponse(BaseModel):
    success: bool
    cart_session_id: str
    items: list[CartItemResponse]
    line_item_count: int
    total_quantity: int
    subtotal: float
    private_brand_subtotal: float | None
    potential_savings: float | None
