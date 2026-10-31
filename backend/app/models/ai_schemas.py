from typing import Literal

from pydantic import BaseModel, Field


class AIChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    session_id: str | None = Field(default=None, max_length=100)
    patient_id: str | None = Field(default=None, max_length=100)
    language: Literal["en", "hi"] = "en"
    stream: bool = True


class AIChatResponse(BaseModel):
    success: bool = True
    session_id: str
    response: str
    safety_flags: list[str]
    usage: dict[str, int | None]
