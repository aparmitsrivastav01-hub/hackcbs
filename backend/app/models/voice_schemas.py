from typing import Literal

from pydantic import BaseModel, Field

from app.models.schemas import MedicineResponse

VoiceLanguage = Literal["auto", "hi-IN", "en-IN", "hi", "en", "hinglish", "indic-auto"]


class VoiceTranscriptResponse(BaseModel):
    success: bool = True
    transcript: str
    language: str | None = None
    confidence: float | None = None


class VoiceSpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2500)
    language: str = "hi-IN"


class VoiceSearchResponse(BaseModel):
    success: bool = True
    transcript: str
    search_query: str
    language: str | None = None
    confidence: float | None = None
    total_results: int
    medicines: list[MedicineResponse]
    spoken_response: str
    audio_base64: str | None = None
    audio_content_type: str | None = None
    speech_error: str | None = None
