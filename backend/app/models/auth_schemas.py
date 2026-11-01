import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# -------------------------------------------------------------
# Auth & User Schemas
# -------------------------------------------------------------

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    confirm_password: Optional[str] = None
    role: Optional[str] = Field("patient", pattern="^(patient|pharmacist|admin)$")
    display_label: Optional[str] = Field(None, max_length=80, description="Optional patient alias")
    preferred_language: str = Field("en", max_length=12)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: uuid.UUID
    email: str
    role: str = "patient"
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PatientProfilePublic(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    display_label: Optional[str] = None
    preferred_language: str = "en"
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PatientProfileUpdate(BaseModel):
    display_label: Optional[str] = Field(None, max_length=80)
    preferred_language: Optional[str] = Field(None, max_length=12)


class AuthResponse(BaseModel):
    success: bool = True
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
    profile: PatientProfilePublic


class TokenRefreshResponse(BaseModel):
    success: bool = True
    access_token: str
    token_type: str = "bearer"


# -------------------------------------------------------------
# Privacy Consent Schemas
# -------------------------------------------------------------

class PrivacyConsentPublic(BaseModel):
    purpose: str
    policy_version: str
    granted: bool
    granted_at: Optional[datetime] = None
    withdrawn_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ConsentUpdateRequest(BaseModel):
    granted: bool
    policy_version: str = "2026-10-v1"


class ConsentWithdrawResponse(BaseModel):
    success: bool = True
    purpose: str
    granted: bool = False
    withdrawn_at: datetime
    meko_cleanup_status: str
    message: str
