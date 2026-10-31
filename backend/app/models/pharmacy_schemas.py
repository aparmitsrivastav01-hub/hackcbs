from datetime import datetime
from math import isfinite
from typing import Literal
from pydantic import BaseModel, Field, model_validator
from datetime import date
from app.models.safety_schemas import SafetyCheckResponse

PharmacyProvider = Literal["jan_aushadhi", "dava_india"]
DeliveryAvailability = Literal["yes", "no", "unknown"]
EnquiryStatus = Literal[
    "draft", "ready_to_send", "user_opened_whatsapp", "awaiting_response",
    "partially_available", "fully_available", "unavailable", "delivery_available",
    "delivery_unavailable", "completed",
]


class NearbyPharmaciesRequest(BaseModel):
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    postal_code: str | None = Field(default=None, pattern=r"^\d{6}$")
    area: str | None = Field(default=None, min_length=2, max_length=120)
    radius_km: float = Field(default=10, gt=0, le=100)
    providers: list[PharmacyProvider] = Field(default_factory=lambda: ["jan_aushadhi", "dava_india"], min_length=1, max_length=2)

    @model_validator(mode="after")
    def validate_location(self):
        has_lat = self.latitude is not None
        has_lon = self.longitude is not None
        if has_lat != has_lon:
            raise ValueError("latitude and longitude must be supplied together")
        if (has_lat and (not isfinite(self.latitude) or not isfinite(self.longitude))) or not isfinite(self.radius_km):
            raise ValueError("Location and radius values must be finite numbers")
        if not has_lat and not (self.postal_code or self.area):
            raise ValueError("Provide coordinates, a six-digit postal_code, or a manually entered area")
        if len(set(self.providers)) != len(self.providers):
            raise ValueError("providers must not contain duplicates")
        return self


class PharmacyStore(BaseModel):
    store_id: str
    store_name: str
    provider: PharmacyProvider
    address: str
    latitude: float | None
    longitude: float | None
    distance_km: float | None
    phone_number: str | None
    whatsapp_number: str | None
    whatsapp_verified: bool
    opening_hours: str | None
    delivery_available: DeliveryAvailability
    source_url: str
    last_verified_at: datetime


class NearbyPharmaciesResponse(BaseModel):
    success: bool
    total_stores: int
    stores: list[PharmacyStore]
    cached: bool
    warnings: list[str] = Field(default_factory=list)


class EnquiryCreateRequest(BaseModel):
    store_id: str = Field(min_length=1, max_length=100)
    cart_session_id: str = Field(min_length=1, max_length=100)


class EnquiryStatusUpdate(BaseModel):
    status: EnquiryStatus


class EnquiryBatchVerifyRequest(BaseModel):
    cart_item_id: str = Field(min_length=1, max_length=100)
    product_name: str = Field(min_length=1, max_length=300)
    batch_number: str = Field(min_length=1, max_length=120)
    manufacturer: str | None = Field(default=None, max_length=500)
    expiry_date: date | None = None


class EnquiryBatchCheck(BaseModel):
    cart_item_id: str
    product_name: str
    batch_number: str
    manufacturer: str | None
    expiry_date: date | None
    checked_at: datetime
    safety_check: SafetyCheckResponse


class PharmacyEnquiryResponse(BaseModel):
    success: bool
    enquiry_id: str
    store_id: str
    store_name: str
    message: str
    whatsapp_url: str | None
    phone_contact: str | None
    status: EnquiryStatus
    user_confirmation_required: bool
    created_at: datetime
    batch_checks: list[EnquiryBatchCheck] = Field(default_factory=list)
    batch_verification_required: bool = True
    order_blocked: bool = True


class PharmacyEnquiryRecord(PharmacyEnquiryResponse):
    pass


class ShopWhatsAppContactRequest(BaseModel):
    shop_name: str = Field(min_length=1, max_length=200)
    shop_address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=100)
    locality: str | None = Field(default=None, max_length=100)
    maps_url: str | None = Field(default=None, max_length=1000)
    query: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def validate_shop(self):
        if not self.shop_name or not self.shop_name.strip():
            raise ValueError("shop_name cannot be blank or whitespace only")
        return self


class ShopWhatsAppContactResponse(BaseModel):
    shop_name: str
    phone_number: str | None = None
    whatsapp_number: str | None = None
    source_url: str | None = None
    verification_status: Literal["verified", "verified_whatsapp", "phone_only", "not_found", "ambiguous"]
    confidence: Literal["high", "medium", "low", "none"] | None = None
    message: str
    cached: bool = False

