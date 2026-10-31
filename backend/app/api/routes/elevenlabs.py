import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.services.elevenlabs_service import (
    ElevenLabsAuthenticationError,
    ElevenLabsConfigurationError,
    ElevenLabsProviderError,
    ElevenLabsRateLimitError,
    ElevenLabsSpeechService,
    ElevenLabsTimeoutError,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/voice/elevenlabs", tags=["ElevenLabs speech"])


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2500)
    language: Literal["en", "hi"] = "en"


def _service(request: Request) -> ElevenLabsSpeechService:
    service = getattr(request.app.state, "elevenlabs_service", None)
    if service is None:
        service = ElevenLabsSpeechService()
        request.app.state.elevenlabs_service = service
    return service


@router.post("/speak")
async def speak(request: Request, body: SpeakRequest):
    try:
        audio = await _service(request).synthesize(body.text, body.language)
    except ElevenLabsConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ElevenLabsAuthenticationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ElevenLabsRateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except ElevenLabsTimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ElevenLabsProviderError as exc:
        logger.warning("ElevenLabs speech request failed")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return Response(content=audio, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})
