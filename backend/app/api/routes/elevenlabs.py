import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.api.routes.voice import get_voice_service, _map_provider_errors

logger = logging.getLogger(__name__)
# Compatibility router preserving previous /api/voice/elevenlabs/speak endpoint
router = APIRouter(prefix="/api/voice/elevenlabs", tags=["Voice speech compatibility"])


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2500)
    language: Literal["en", "hi", "en-IN", "hi-IN"] = "en"


@router.post("/speak")
async def speak(request: Request, body: SpeakRequest):
    """
    Backward-compatibility endpoint for previous ElevenLabs callers.
    Powered by backend Gnani AI Timbre voice synthesis without external ElevenLabs dependencies.
    """
    try:
        audio = await get_voice_service(request).speak(body.text, body.language)
    except Exception as exc:
        raise _map_provider_errors(exc) from exc
    return Response(content=audio, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})
